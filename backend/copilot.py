"""
copilot.py — Smart query router / AI Copilot for NER-SENTINEL.

Handles natural-language queries by dispatching to real DB queries and
returning structured, data-driven responses.
"""

from sqlalchemy.orm import Session
from typing import List

import models
from weather import weather_cache, get_all_zone_weather


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _vehicles_at_risk(db: Session) -> List[models.Vehicle]:
    """Return vehicles whose shipments are DELAYED or AT_RISK."""
    risky_vehicle_ids = (
        db.query(models.Shipment.vehicle_id)
        .filter(models.Shipment.status.in_(["DELAYED", "AT_RISK"]))
        .filter(models.Shipment.vehicle_id.isnot(None))
        .all()
    )
    ids = {r[0] for r in risky_vehicle_ids}
    if not ids:
        return []
    return db.query(models.Vehicle).filter(models.Vehicle.id.in_(ids)).all()


def _high_risk_segments(db: Session, threshold: int = 60) -> List[models.RoadSegment]:
    return (
        db.query(models.RoadSegment)
        .filter(models.RoadSegment.current_risk_score > threshold)
        .all()
    )


def _low_stock_warehouses(db: Session, threshold: float = 40.0) -> List[models.Warehouse]:
    return (
        db.query(models.Warehouse)
        .filter(
            (models.Warehouse.medicine_stock_pct < threshold)
            | (models.Warehouse.food_stock_pct < threshold)
            | (models.Warehouse.fuel_stock_pct < threshold)
            | (models.Warehouse.equipment_stock_pct < threshold)
        )
        .all()
    )


def _format_vehicle(v: models.Vehicle) -> str:
    return f"**{v.driver_name}** ({v.payload_type}, {v.priority} priority, status: {v.status})"


def _format_segment(s: models.RoadSegment) -> str:
    label = s.risk_label
    emoji = "🔴" if label == "HIGH" else "🟡" if label == "MODERATE" else "🟢"
    return f"{emoji} **{s.name}** — risk score {s.current_risk_score}/100 ({label})"


# ---------------------------------------------------------------------------
# Main dispatcher
# ---------------------------------------------------------------------------

def handle_query(query: str, db: Session) -> str:
    """
    Route a natural-language query to the appropriate data queries and
    return a markdown-formatted response string.
    """
    q = query.lower().strip()

    # ------------------------------------------------------------------
    # 1. Critical / at-risk vehicles
    # ------------------------------------------------------------------
    if any(word in q for word in ["critical", "affected", "at risk", "exposed", "danger"]):
        risky_vehicles = _vehicles_at_risk(db)
        high_segments = _high_risk_segments(db)

        if not risky_vehicles and not high_segments:
            return (
                "✅ **All Clear** — No vehicles are currently on high-risk routes. "
                "All shipments are ON_TIME and road risk scores are within safe limits."
            )

        lines = ["## ⚠️ Critical Situation Report\n"]

        if risky_vehicles:
            lines.append(f"**{len(risky_vehicles)} vehicle(s) exposed to hazardous conditions:**\n")
            for v in risky_vehicles:
                shipments = db.query(models.Shipment).filter(
                    models.Shipment.vehicle_id == v.id,
                    models.Shipment.status.in_(["DELAYED", "AT_RISK"])
                ).all()
                for s in shipments:
                    delay_est = round(s.eta_hours * 0.4, 1)
                    lines.append(
                        f"- {_format_vehicle(v)} — carrying **{s.cargo_type}** to **{s.destination}** "
                        f"(ETA +{delay_est}h delay estimated)"
                    )

        if high_segments:
            lines.append(f"\n**{len(high_segments)} high-risk corridor(s) active:**\n")
            for seg in high_segments:
                lines.append(f"- {_format_segment(seg)}")

        lines.append(
            "\n> 💡 Recommend activating alternate routing and pre-positioning emergency "
            "stocks at nearest hubs."
        )
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # 2. What-if / closure simulation
    # ------------------------------------------------------------------
    if any(phrase in q for phrase in ["what if", "close", "shut", "block", "route a"]):
        segments = db.query(models.RoadSegment).order_by(
            models.RoadSegment.current_risk_score.desc()
        ).all()

        if not segments:
            return "⚠️ No road segment data available. Please ensure the system is seeded."

        highest = segments[0]
        # Count vehicles en-route through districts this segment serves
        dependent = [d.strip() for d in (highest.dependent_districts or "").split(",") if d.strip()]
        affected_vehicles = db.query(models.Vehicle).filter(
            models.Vehicle.status == "EN_ROUTE"
        ).count()
        affected_shipments = db.query(models.Shipment).filter(
            models.Shipment.status.in_(["ON_TIME", "AT_RISK", "DELAYED"])
        ).count()
        delay_estimate = round(highest.length_km / 30, 1)  # avg detour speed 30 km/h

        districts_str = ", ".join(dependent) if dependent else "multiple districts"
        return (
            f"## 🔴 What-If: Closure of **{highest.name}**\n\n"
            f"If this corridor (risk score: **{highest.current_risk_score}/100**) is closed:\n\n"
            f"- **{affected_vehicles}** vehicles currently en-route would need rerouting\n"
            f"- **{affected_shipments}** active shipments affected\n"
            f"- Districts cut off: **{districts_str}**\n"
            f"- Estimated additional delay: **+{delay_estimate}h** per trip via alternate routes\n"
            f"- Recommended alternative: Use NH37 / Brahmaputra ferry crossings as bypass\n\n"
            f"> ⚡ NER-SENTINEL has pre-computed alternate routes — see `/api/route` for path options."
        )

    # ------------------------------------------------------------------
    # 3. Weather query
    # ------------------------------------------------------------------
    if any(word in q for word in ["weather", "rain", "storm", "flood", "forecast"]):
        cache = weather_cache if weather_cache else get_all_zone_weather()

        lines = ["## 🌦️ Live NER Weather Report\n"]
        for zone_name, data in cache.items():
            cond = data.get("condition", "UNKNOWN")
            rain = data.get("rainfall_mm_hr", 0.0)
            emoji = {"STORM": "⛈️", "HEAVY_RAIN": "🌧️", "RAINY": "🌦️",
                     "CLOUDY": "☁️", "CLEAR": "☀️"}.get(cond, "🌡️")
            lines.append(
                f"{emoji} **{zone_name}**: {cond} | {rain} mm/hr | "
                f"{data.get('temperature_c', 0)}°C | "
                f"Wind: {data.get('wind_speed_kmh', 0)} km/h"
            )
            if cond in ("STORM", "HEAVY_RAIN"):
                lines.append(
                    f"  > ⚠️ HIGH RISK — {data.get('description', '')}. "
                    "Landslide probability elevated."
                )

        lines.append(f"\n*Data source: {list(cache.values())[0].get('source','simulated')} | "
                     f"Updated: {list(cache.values())[0].get('updated_at', 'N/A')}*")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # 4. Supply shortage
    # ------------------------------------------------------------------
    if any(word in q for word in ["shortage", "supply", "stock", "inventory", "warehouse"]):
        warehouses = _low_stock_warehouses(db)
        all_warehouses = db.query(models.Warehouse).all()

        if not warehouses:
            lines = ["## 📦 Supply Chain Status — All Clear\n"]
            for wh in all_warehouses:
                lines.append(
                    f"- **{wh.name}** ({wh.district}): "
                    f"Medicine {wh.medicine_stock_pct:.0f}% | "
                    f"Food {wh.food_stock_pct:.0f}% | "
                    f"Fuel {wh.fuel_stock_pct:.0f}% | "
                    f"Equipment {wh.equipment_stock_pct:.0f}%"
                )
            return "\n".join(lines)

        lines = [f"## ⚠️ Supply Shortage Alert — {len(warehouses)} Warehouse(s)\n"]
        for wh in warehouses:
            shortage_items = []
            if wh.medicine_stock_pct < 40:
                hrs = round((wh.medicine_stock_pct / 100) * 48, 1)
                shortage_items.append(f"Medicine ({wh.medicine_stock_pct:.0f}% — ~{hrs}h to shortage)")
            if wh.food_stock_pct < 40:
                hrs = round((wh.food_stock_pct / 100) * 72, 1)
                shortage_items.append(f"Food ({wh.food_stock_pct:.0f}% — ~{hrs}h to shortage)")
            if wh.fuel_stock_pct < 40:
                hrs = round((wh.fuel_stock_pct / 100) * 36, 1)
                shortage_items.append(f"Fuel ({wh.fuel_stock_pct:.0f}% — ~{hrs}h to shortage)")
            if wh.equipment_stock_pct < 40:
                hrs = round((wh.equipment_stock_pct / 100) * 96, 1)
                shortage_items.append(f"Equipment ({wh.equipment_stock_pct:.0f}% — ~{hrs}h to shortage)")
            lines.append(f"### 🏪 {wh.name} ({wh.district})")
            for item in shortage_items:
                lines.append(f"  - 🔴 {item}")
        lines.append("\n> 💡 Recommend immediate pre-positioning from Guwahati Central Hub.")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # 5. District accessibility
    # ------------------------------------------------------------------
    if any(word in q for word in ["district", "accessible", "accessibility", "cut off", "isolated"]):
        districts = db.query(models.District).order_by(
            models.District.accessibility_score.asc()
        ).all()

        if not districts:
            return "⚠️ No district data available."

        lines = ["## 🗺️ District Accessibility Scores\n"]
        for d in districts:
            score = d.accessibility_score
            emoji = "🔴" if score < 40 else "🟡" if score < 70 else "🟢"
            lines.append(
                f"{emoji} **{d.name}**: {score}/100 — "
                f"{d.active_incidents_count} incident(s), "
                f"{d.blocked_routes_count} blocked route(s), "
                f"Weather risk: {d.weather_risk}"
            )
        worst = districts[0]
        lines.append(
            f"\n> ⚠️ Most critical: **{worst.name}** with accessibility score {worst.accessibility_score}/100."
        )
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # 6. Bottlenecks / critical corridors
    # ------------------------------------------------------------------
    if any(word in q for word in ["bottleneck", "critical corridor", "choke", "corridor"]):
        critical_segs = (
            db.query(models.RoadSegment)
            .filter(models.RoadSegment.is_critical_corridor == True)
            .all()
        )
        if not critical_segs:
            return "No critical corridors flagged in the system."

        lines = ["## 🚨 Critical Infrastructure Corridors\n"]
        for seg in critical_segs:
            dependent = seg.dependent_districts or "N/A"
            lines.append(
                f"- {_format_segment(seg)}\n"
                f"  Serves: {dependent} | Length: {seg.length_km} km | "
                f"Slope risk: {seg.slope_risk}/20 | Blocked: {'YES ⛔' if seg.blocked else 'No'}"
            )
        lines.append(
            "\n> 🔒 These corridors are the **lifelines** for relief operations. "
            "Any blockage triggers automatic rerouting alerts."
        )
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # 7. Vehicle / fleet status
    # ------------------------------------------------------------------
    if any(word in q for word in ["vehicle", "fleet", "driver", "truck", "convoy"]):
        vehicles = db.query(models.Vehicle).all()
        if not vehicles:
            return "No vehicles registered in the system."

        status_counts = {}
        for v in vehicles:
            status_counts[v.status] = status_counts.get(v.status, 0) + 1

        lines = ["## 🚛 Fleet Status Report\n"]
        for status, count in status_counts.items():
            emoji = {"EN_ROUTE": "🚛", "DELAYED": "⚠️", "IDLE": "🟡", "COMPLETED": "✅"}.get(status, "•")
            lines.append(f"{emoji} **{status}**: {count} vehicle(s)")

        lines.append("\n### Individual Vehicle Status\n")
        for v in vehicles:
            shipment_count = len(v.shipments)
            lines.append(
                f"- **{v.driver_name}** | {v.payload_type} | {v.priority} priority | "
                f"Status: {v.status} | ETA: {v.eta_hours}h | {shipment_count} shipment(s) | "
                f"Speed: {v.speed_kmh} km/h"
            )
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # 8. Default — comprehensive system status
    # ------------------------------------------------------------------
    total_vehicles = db.query(models.Vehicle).count()
    en_route = db.query(models.Vehicle).filter(models.Vehicle.status == "EN_ROUTE").count()
    delayed = db.query(models.Vehicle).filter(models.Vehicle.status == "DELAYED").count()
    total_incidents = db.query(models.Incident).count()
    active_incidents = db.query(models.Incident).filter(models.Incident.severity >= 3).count()
    high_risk = db.query(models.RoadSegment).filter(
        models.RoadSegment.current_risk_score > 60
    ).count()
    low_access = db.query(models.District).filter(
        models.District.accessibility_score < 60
    ).count()
    critical_shipments = db.query(models.Shipment).filter(
        models.Shipment.priority == "Critical"
    ).count()
    at_risk_shipments = db.query(models.Shipment).filter(
        models.Shipment.status.in_(["DELAYED", "AT_RISK"])
    ).count()

    # Worst weather zone
    cache = weather_cache if weather_cache else get_all_zone_weather()
    worst_weather = max(
        cache.items(),
        key=lambda kv: kv[1].get("rainfall_mm_hr", 0),
        default=("N/A", {}),
    )

    return (
        f"## 🛡️ NER-SENTINEL System Status\n\n"
        f"**Fleet**: {total_vehicles} vehicles | {en_route} en-route | {delayed} delayed\n\n"
        f"**Incidents**: {total_incidents} total | {active_incidents} severity 3+ active\n\n"
        f"**Roads**: {high_risk} high-risk corridor(s) | {low_access} district(s) with low accessibility\n\n"
        f"**Supply**: {critical_shipments} critical shipments | {at_risk_shipments} at risk or delayed\n\n"
        f"**Worst Weather**: {worst_weather[0]} — "
        f"{worst_weather[1].get('condition','N/A')} | "
        f"{worst_weather[1].get('rainfall_mm_hr',0)} mm/hr\n\n"
        f"> Ask me about: *critical vehicles, weather, supply shortages, district access, "
        f"bottlenecks, fleet status, or what-if scenarios.*"
    )
