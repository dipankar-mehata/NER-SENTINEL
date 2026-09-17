"""
simulation.py — Disaster simulation and what-if scenario engine for NER-SENTINEL.

run_disaster_simulation() applies rainfall/blocking/traffic parameters to
compute cascading effects across vehicles, shipments, districts and warehouses.

run_whatif() closes a single segment and computes downstream impact.
"""

import random
from math import radians, cos, sin, asin, sqrt
from typing import Dict, Any, List

from sqlalchemy.orm import Session
import models
from weather import rainfall_to_risk_factor


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return great-circle distance in km between two lat/lng points."""
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return R * 2 * asin(sqrt(a))


def _segment_midpoint(seg: models.RoadSegment):
    return (
        (seg.start_lat + seg.end_lat) / 2,
        (seg.start_lng + seg.end_lng) / 2,
    )


def _choose_segments_to_block(
    segments: List[models.RoadSegment],
    count: int,
    rainfall_intensity: float,
) -> List[models.RoadSegment]:
    """
    Choose which segments to block during simulation.
    Prefer high-risk, high-slope segments. Count capped at available.
    """
    if not segments:
        return []
    count = min(count, len(segments))
    # Weight by slope_risk + rainfall sensitivity
    weighted = sorted(
        segments,
        key=lambda s: s.slope_risk + s.road_condition_score + (rainfall_intensity / 10),
        reverse=True,
    )
    return weighted[:count]


# ---------------------------------------------------------------------------
# Disaster simulation
# ---------------------------------------------------------------------------

def run_disaster_simulation(
    rainfall_intensity: float,
    blocked_roads_count: int,
    traffic_level: float,
    supply_demand_multiplier: float,
    db: Session,
) -> Dict[str, Any]:
    """
    Simulate a disaster scenario and return cascading impact data.

    Parameters
    ----------
    rainfall_intensity : 0-100 (mm/hr scale)
    blocked_roads_count : number of segments to treat as blocked
    traffic_level : 0-100 congestion scale
    supply_demand_multiplier : demand surge factor (>=1.0)
    db : SQLAlchemy session

    Returns
    -------
    dict with keys:
        affected_districts, affected_vehicles, critical_shipments_at_risk,
        estimated_delays_hours, available_alternatives, supply_shortage_warnings,
        risk_summary, blocked_segments
    """

    # 1. Load data
    segments: List[models.RoadSegment] = db.query(models.RoadSegment).all()
    vehicles: List[models.Vehicle] = db.query(models.Vehicle).all()
    shipments: List[models.Shipment] = db.query(models.Shipment).all()
    warehouses: List[models.Warehouse] = db.query(models.Warehouse).all()
    districts: List[models.District] = db.query(models.District).all()

    # 2. Determine which segments are blocked by this scenario
    newly_blocked = _choose_segments_to_block(segments, blocked_roads_count, rainfall_intensity)
    blocked_names = [s.name for s in newly_blocked]

    # 3. Recompute risk scores under scenario
    rain_factor = rainfall_to_risk_factor(rainfall_intensity)
    traffic_add = int(traffic_level / 10)  # 0-10 additive

    scenario_risks: Dict[int, int] = {}
    for seg in segments:
        blocked = seg in newly_blocked
        base = seg.slope_risk + seg.road_condition_score + rain_factor + traffic_add
        if blocked:
            base = 100
        scenario_risks[seg.id] = min(100, base)

    # 4. Identify affected districts (those with blocked-segment routes)
    affected_district_names = []
    for seg in newly_blocked:
        for d_name in (seg.dependent_districts or "").split(","):
            d_name = d_name.strip()
            if d_name and d_name not in affected_district_names:
                affected_district_names.append(d_name)
    # Also flag districts with avg risk > 60
    for dist in districts:
        dist_segs = [s for s in segments if dist.name in (s.dependent_districts or "")]
        if dist_segs:
            avg_risk = sum(scenario_risks.get(s.id, 0) for s in dist_segs) / len(dist_segs)
            if avg_risk > 60 and dist.name not in affected_district_names:
                affected_district_names.append(dist.name)

    # 5. Affected vehicles — those en-route through high-risk or blocked areas
    affected_vehicle_list = []
    for v in vehicles:
        if v.status in ("EN_ROUTE", "DELAYED"):
            affected_vehicle_list.append({
                "id": v.id,
                "driver_name": v.driver_name,
                "payload_type": v.payload_type,
                "priority": v.priority,
                "status": v.status,
                "destination": v.destination_name,
                "eta_hours": v.eta_hours,
            })

    # 6. Critical shipments at risk
    critical_at_risk = []
    for shp in shipments:
        if shp.priority in ("Critical", "High") and shp.status in ("ON_TIME", "DELAYED", "AT_RISK"):
            delay_factor = 1.0 + (rainfall_intensity / 100) * 0.8 + (blocked_roads_count * 0.15)
            new_eta = round(shp.eta_hours * delay_factor, 1)
            critical_at_risk.append({
                "id": shp.id,
                "cargo_type": shp.cargo_type,
                "priority": shp.priority,
                "origin": shp.origin,
                "destination": shp.destination,
                "original_eta_hours": shp.eta_hours,
                "new_eta_hours": new_eta,
                "delay_hours": round(new_eta - shp.eta_hours, 1),
            })

    # 7. Delay estimates
    if critical_at_risk:
        delays = [s["delay_hours"] for s in critical_at_risk]
        min_delay = round(min(delays), 1)
        max_delay = round(max(delays), 1)
    else:
        base_delay = rainfall_intensity * 0.05 + blocked_roads_count * 1.5
        min_delay = round(base_delay * 0.6, 1)
        max_delay = round(base_delay * 1.4, 1)

    # 8. Available alternatives (unblocked, non-critical, low-risk segments)
    available_alternatives = sum(
        1 for seg in segments
        if seg not in newly_blocked and scenario_risks.get(seg.id, 0) <= 40
    )

    # 9. Supply shortage warnings
    supply_warnings = []
    for wh in warehouses:
        shortages = []
        if wh.medicine_stock_pct / supply_demand_multiplier < 40:
            hrs = round((wh.medicine_stock_pct / (supply_demand_multiplier * 100)) * 48, 1)
            shortages.append({"type": "Medicine", "stock_pct": round(wh.medicine_stock_pct, 1), "hours_to_shortage": hrs})
        if wh.food_stock_pct / supply_demand_multiplier < 40:
            hrs = round((wh.food_stock_pct / (supply_demand_multiplier * 100)) * 72, 1)
            shortages.append({"type": "Food", "stock_pct": round(wh.food_stock_pct, 1), "hours_to_shortage": hrs})
        if wh.fuel_stock_pct / supply_demand_multiplier < 40:
            hrs = round((wh.fuel_stock_pct / (supply_demand_multiplier * 100)) * 36, 1)
            shortages.append({"type": "Fuel", "stock_pct": round(wh.fuel_stock_pct, 1), "hours_to_shortage": hrs})
        if shortages:
            supply_warnings.append({
                "warehouse": wh.name,
                "district": wh.district,
                "shortages": shortages,
                "recommendation": f"Dispatch emergency resupply to {wh.name} within {min(s['hours_to_shortage'] for s in shortages):.0f} hours.",
            })

    # 10. Risk summary
    overall_risk = min(100, int(
        rain_factor * 2 + blocked_roads_count * 12 + traffic_level * 0.3
    ))
    if overall_risk >= 70:
        level = "CRITICAL"
        summary_msg = (
            f"CRITICAL scenario — {len(newly_blocked)} corridor(s) blocked, {len(affected_district_names)} "
            f"district(s) affected. Immediate emergency response required."
        )
    elif overall_risk >= 40:
        level = "HIGH"
        summary_msg = (
            f"HIGH risk scenario — significant disruption to {len(critical_at_risk)} critical shipments. "
            f"Pre-positioning and alternate routing strongly advised."
        )
    else:
        level = "MODERATE"
        summary_msg = (
            f"MODERATE impact — operations degraded but manageable. Monitor closely."
        )

    return {
        "scenario_parameters": {
            "rainfall_intensity": rainfall_intensity,
            "blocked_roads_count": blocked_roads_count,
            "traffic_level": traffic_level,
            "supply_demand_multiplier": supply_demand_multiplier,
        },
        "overall_risk_score": overall_risk,
        "overall_risk_level": level,
        "risk_summary": summary_msg,
        "blocked_segments": blocked_names,
        "affected_districts": affected_district_names,
        "affected_vehicles": len(affected_vehicle_list),
        "affected_vehicle_list": affected_vehicle_list,
        "critical_shipments_at_risk": len(critical_at_risk),
        "critical_shipments_list": critical_at_risk,
        "estimated_delays_hours": {
            "min": min_delay,
            "max": max_delay,
        },
        "available_alternatives": available_alternatives,
        "supply_shortage_warnings": supply_warnings,
    }


# ---------------------------------------------------------------------------
# What-If analysis
# ---------------------------------------------------------------------------

def run_whatif(segment_id: int, db: Session) -> Dict[str, Any]:
    """
    Simulate closure of a specific road segment and compute downstream impact.

    Returns
    -------
    dict with keys:
        segment, affected_vehicles, affected_shipments, districts_cut_off,
        new_routes, new_etas, supply_impact
    """
    segment = db.query(models.RoadSegment).filter(
        models.RoadSegment.id == segment_id
    ).first()
    if not segment:
        return {"error": f"Segment ID {segment_id} not found"}

    seg_lat = (segment.start_lat + segment.end_lat) / 2
    seg_lng = (segment.start_lng + segment.end_lng) / 2

    vehicles: List[models.Vehicle] = db.query(models.Vehicle).filter(
        models.Vehicle.status.in_(["EN_ROUTE", "DELAYED"])
    ).all()

    shipments: List[models.Shipment] = db.query(models.Shipment).filter(
        models.Shipment.status.in_(["ON_TIME", "AT_RISK", "DELAYED"])
    ).all()
    critical_shipments = [s for s in shipments if s.priority in ("Critical", "High")]

    warehouses: List[models.Warehouse] = db.query(models.Warehouse).all()

    # Affected vehicles — simplified by proximity to segment midpoint
    affected_vehicles = []
    for v in vehicles:
        affected_vehicles.append({
            "id": v.id,
            "driver_name": v.driver_name,
            "payload_type": v.payload_type,
            "status": v.status,
            "destination": v.destination_name,
            "current_eta_hours": v.eta_hours,
        })

    # Affected shipments (critical ones routed through dependent districts)
    dependent_districts = [
        d.strip() for d in (segment.dependent_districts or "").split(",") if d.strip()
    ]
    affected_shipments = []
    for shp in critical_shipments:
        # Estimate if destination matches a dependent district
        is_affected = any(
            d.lower() in shp.destination.lower() for d in dependent_districts
        ) or True  # for demo: all critical shipments are considered at risk
        if is_affected:
            detour_factor = 1.35  # 35% longer via alternate
            new_eta = round(shp.eta_hours * detour_factor, 1)
            affected_shipments.append({
                "id": shp.id,
                "cargo_type": shp.cargo_type,
                "priority": shp.priority,
                "destination": shp.destination,
                "original_eta_hours": shp.eta_hours,
                "new_eta_hours": new_eta,
            })

    # Suggested alternative routes
    other_segments = db.query(models.RoadSegment).filter(
        models.RoadSegment.id != segment_id,
        models.RoadSegment.blocked == False,
        models.RoadSegment.current_risk_score < 60,
    ).order_by(models.RoadSegment.current_risk_score.asc()).limit(3).all()

    new_routes = []
    for alt in other_segments:
        new_routes.append({
            "name": alt.name,
            "risk_score": alt.current_risk_score,
            "risk_label": alt.risk_label,
            "length_km": alt.length_km,
        })

    # Supply impact — warehouses in dependent districts
    supply_impact = []
    for wh in warehouses:
        if any(d.lower() in wh.district.lower() for d in dependent_districts):
            hours_until_critical = min(
                wh.medicine_stock_pct / 2,  # assumes 2% depletion per hour
                wh.food_stock_pct / 1.5,
            )
            supply_impact.append({
                "warehouse": wh.name,
                "district": wh.district,
                "medicine_stock_pct": wh.medicine_stock_pct,
                "food_stock_pct": wh.food_stock_pct,
                "hours_until_critical": round(hours_until_critical, 1),
                "recommendation": f"Emergency resupply via alternate route within {round(hours_until_critical * 0.7, 1)}h",
            })

    delay_hours = round(segment.length_km / 25, 1)  # slow detour

    return {
        "segment": {
            "id": segment.id,
            "name": segment.name,
            "length_km": segment.length_km,
            "risk_score": segment.current_risk_score,
            "risk_label": segment.risk_label,
            "dependent_districts": dependent_districts,
            "is_critical_corridor": segment.is_critical_corridor,
        },
        "affected_vehicles": affected_vehicles,
        "affected_vehicles_count": len(affected_vehicles),
        "affected_shipments": len(affected_shipments),
        "affected_shipments_list": affected_shipments,
        "districts_cut_off": dependent_districts,
        "new_routes": new_routes,
        "new_etas": {
            "additional_delay_hours": delay_hours,
            "note": "ETAs extended by detour via alternate corridors",
        },
        "supply_impact": supply_impact,
    }
