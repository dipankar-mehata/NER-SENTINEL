"""
supply.py — Supply chain analysis for NER-SENTINEL.

get_supply_status()          — per-warehouse shortage predictions
get_preposition_recommendations() — proactive pre-positioning advice
"""

from typing import List, Dict, Any
from sqlalchemy.orm import Session

import models


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SHORTAGE_THRESHOLD = 40.0   # % stock below which we warn
PREPOSITION_RISK_THRESHOLD = 70  # segment risk score above which we recommend move

# Depletion rates (% per hour under normal demand)
_DEPLETION_RATE = {
    "Medicine":  2.0,   # critical, fastest depletion during disaster
    "Food":      1.5,
    "Fuel":      2.5,
    "Equipment": 0.8,
}

# Stock fields per cargo type
_STOCK_FIELD = {
    "Medicine":  "medicine_stock_pct",
    "Food":      "food_stock_pct",
    "Fuel":      "fuel_stock_pct",
    "Equipment": "equipment_stock_pct",
}


def _hours_to_shortage(current_pct: float, depletion_rate: float) -> float:
    """How many hours until stock reaches 0% at given depletion rate."""
    if depletion_rate <= 0:
        return 9999.0
    return round(current_pct / depletion_rate, 1)


def _recommendation(cargo_type: str, warehouse_name: str, district: str, hours: float) -> str:
    urgency = "URGENT" if hours < 12 else "HIGH PRIORITY" if hours < 24 else "MONITOR"
    return (
        f"[{urgency}] Dispatch {cargo_type} resupply to **{warehouse_name}** ({district}) "
        f"within {hours:.0f}h before depletion. Route via lowest-risk corridor."
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_supply_status(db: Session) -> List[Dict[str, Any]]:
    """
    Analyse stock levels at each warehouse.
    For each cargo type below 40%, cross-check whether the supplying vehicle
    is delayed — if so, escalate to critical shortage prediction.

    Returns a list of shortage dicts sorted by urgency (hours_to_shortage ASC).
    """
    warehouses: List[models.Warehouse] = db.query(models.Warehouse).all()
    delayed_vehicle_cargo = set()

    # Collect cargo types being carried by delayed vehicles
    delayed_vehicles = db.query(models.Vehicle).filter(
        models.Vehicle.status == "DELAYED"
    ).all()
    for v in delayed_vehicles:
        for shp in v.shipments:
            delayed_vehicle_cargo.add(shp.cargo_type)

    results = []
    for wh in warehouses:
        for cargo_type, field in _STOCK_FIELD.items():
            stock_pct = getattr(wh, field, 100.0)
            if stock_pct < SHORTAGE_THRESHOLD:
                depletion = _DEPLETION_RATE[cargo_type]
                # Escalate depletion if a delayed vehicle was supposed to deliver this
                if cargo_type in delayed_vehicle_cargo:
                    depletion *= 1.5   # faster burn because resupply is stuck

                hours = _hours_to_shortage(stock_pct, depletion)
                results.append({
                    "warehouse": wh.name,
                    "district": wh.district,
                    "cargo_type": cargo_type,
                    "stock_pct": round(stock_pct, 1),
                    "hours_to_shortage": hours,
                    "supplying_vehicle_delayed": cargo_type in delayed_vehicle_cargo,
                    "severity": "CRITICAL" if hours < 12 else "HIGH" if hours < 24 else "MODERATE",
                    "recommendation": _recommendation(cargo_type, wh.name, wh.district, hours),
                })

    # Sort by most urgent first
    results.sort(key=lambda x: x["hours_to_shortage"])
    return results


def get_preposition_recommendations(db: Session) -> List[Dict[str, Any]]:
    """
    Identify supply corridors where high route risk should trigger proactive
    pre-positioning of stock to a closer hub before routes become blocked.

    Returns a list of recommendation dicts.
    """
    high_risk_segments: List[models.RoadSegment] = (
        db.query(models.RoadSegment)
        .filter(models.RoadSegment.current_risk_score >= PREPOSITION_RISK_THRESHOLD)
        .order_by(models.RoadSegment.current_risk_score.desc())
        .all()
    )

    warehouses: List[models.Warehouse] = db.query(models.Warehouse).all()
    recommendations = []

    for seg in high_risk_segments:
        dependent = [
            d.strip() for d in (seg.dependent_districts or "").split(",") if d.strip()
        ]
        # Find warehouses serving these districts
        at_risk_warehouses = [
            wh for wh in warehouses
            if any(d.lower() in wh.district.lower() for d in dependent)
        ]

        # Find source warehouses not on this segment's route (safe hubs)
        safe_warehouses = [wh for wh in warehouses if wh not in at_risk_warehouses]

        for wh in at_risk_warehouses:
            cargo_concerns = []
            if wh.medicine_stock_pct < 70:
                cargo_concerns.append(f"Medicine ({wh.medicine_stock_pct:.0f}%)")
            if wh.food_stock_pct < 70:
                cargo_concerns.append(f"Food ({wh.food_stock_pct:.0f}%)")
            if wh.fuel_stock_pct < 70:
                cargo_concerns.append(f"Fuel ({wh.fuel_stock_pct:.0f}%)")

            safe_hub = safe_warehouses[0].name if safe_warehouses else "Guwahati Central Hub"
            window_hours = max(6, int((100 - seg.current_risk_score) * 0.5))

            recommendations.append({
                "segment_at_risk": seg.name,
                "segment_risk_score": seg.current_risk_score,
                "segment_risk_label": seg.risk_label,
                "warehouse": wh.name,
                "district": wh.district,
                "cargo_concerns": cargo_concerns,
                "recommended_source_hub": safe_hub,
                "action_window_hours": window_hours,
                "recommendation": (
                    f"Pre-position supplies from **{safe_hub}** to **{wh.name}** ({wh.district}) "
                    f"within {window_hours}h before **{seg.name}** deteriorates further "
                    f"(current risk: {seg.current_risk_score}/100). "
                    f"Cargo priorities: {', '.join(cargo_concerns) if cargo_concerns else 'All types'}."
                ),
            })

    # If no high-risk segments, return positive status
    if not recommendations:
        recommendations.append({
            "segment_at_risk": None,
            "recommendation": (
                "✅ All supply corridors are currently within safe risk thresholds. "
                "No pre-positioning required at this time. Continue monitoring."
            ),
            "action_window_hours": None,
        })

    return recommendations
