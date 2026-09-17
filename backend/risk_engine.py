"""
risk_engine.py — Road segment and district risk calculation for NER-SENTINEL.

RiskEngine reads live weather from weather_cache so risk scores change
dynamically as weather data is refreshed.
"""

import random
from typing import List, Dict, Any

from weather import weather_cache, rainfall_to_risk_factor


# ---------------------------------------------------------------------------
# Zone proximity helpers
# ---------------------------------------------------------------------------

# Map zone names to approximate district / segment coverage
_ZONE_DISTRICT_MAP: Dict[str, List[str]] = {
    "Guwahati": ["Kamrup Metropolitan", "Kamrup"],
    "Shillong": ["East Khasi Hills"],
    "Tezpur":   ["Sonitpur"],
    "Silchar":  ["Cachar"],
    "Imphal":   ["Imphal West", "Imphal East"],
    "Kohima":   ["Kohima"],
}


def _nearest_zone_for_segment(start_lat: float, start_lng: float,
                               end_lat: float, end_lng: float) -> str:
    """Return the weather zone name geographically closest to a segment's midpoint."""
    from weather import NER_ZONES
    mid_lat = (start_lat + end_lat) / 2
    mid_lng = (start_lng + end_lng) / 2

    def dist(zone):
        return ((zone["lat"] - mid_lat) ** 2 + (zone["lng"] - mid_lng) ** 2) ** 0.5

    closest = min(NER_ZONES, key=dist)
    return closest["zone_name"]


# ---------------------------------------------------------------------------
# RiskEngine
# ---------------------------------------------------------------------------

class RiskEngine:
    """
    Calculates real-time risk scores for road segments and district
    accessibility indexes using weather, slope, incidents, traffic, and
    road condition factors.
    """

    # ------------------------------------------------------------------
    # Segment risk
    # ------------------------------------------------------------------

    def calculate_segment_risk(
        self,
        segment,           # models.RoadSegment instance
        weather_zone,      # models.WeatherZone instance OR None
        recent_incidents: List,  # list of models.Incident within proximity
    ) -> Dict[str, Any]:
        """
        Calculate composite risk score for a road segment.

        Returns a dict with keys:
            total, rainfall, slope, incidents, traffic, road_condition, label
        """
        # 1. Rainfall factor — prefer live weather_cache over DB record
        zone_name = _nearest_zone_for_segment(
            segment.start_lat, segment.start_lng,
            segment.end_lat, segment.end_lng,
        )
        cached = weather_cache.get(zone_name)
        if cached:
            rainfall_mm = cached.get("rainfall_mm_hr", 0.0)
        elif weather_zone is not None:
            rainfall_mm = weather_zone.rainfall_mm_hr
        else:
            rainfall_mm = 0.0
        rainfall_factor = rainfall_to_risk_factor(rainfall_mm)

        # 2. Slope factor — static, encoded at seed time (0-20)
        slope_factor = int(segment.slope_risk)

        # 3. Incident factor — based on nearby severity-3+ incidents (0-30)
        severe = [i for i in recent_incidents if i.severity >= 3]
        incident_factor = min(30, len(severe) * 10 + len(recent_incidents) * 5)

        # 4. Traffic factor — deterministic per segment ID (0-10)
        rng = random.Random(segment.id * 31337)
        traffic_factor = rng.randint(0, 10)

        # 5. Road condition — static (0-15, higher = worse)
        road_condition_factor = int(segment.road_condition_score)

        # Total capped at 100
        total = min(
            100,
            rainfall_factor + slope_factor + incident_factor
            + traffic_factor + road_condition_factor,
        )

        if total > 60:
            label = "HIGH"
        elif total > 30:
            label = "MODERATE"
        else:
            label = "LOW"

        return {
            "total": total,
            "rainfall": rainfall_factor,
            "slope": slope_factor,
            "incidents": incident_factor,
            "traffic": traffic_factor,
            "road_condition": road_condition_factor,
            "label": label,
            "zone_used": zone_name,
            "rainfall_mm_hr": round(rainfall_mm, 1),
        }

    # ------------------------------------------------------------------
    # District accessibility
    # ------------------------------------------------------------------

    def calculate_district_accessibility(
        self,
        district,          # models.District instance
        segments: List,    # list of models.RoadSegment relevant to district
        incidents: List,   # list of models.Incident in district
    ) -> int:
        """
        Compute accessibility score (0-100) for a district.

        Score = 100 - avg_segment_risk - blocked_penalty - incident_penalty

        Higher score = more accessible.
        """
        if segments:
            # Average risk across all segments touching this district
            avg_risk = sum(s.current_risk_score for s in segments) / len(segments)
        else:
            avg_risk = 0.0

        blocked_count = sum(1 for s in segments if s.blocked)
        blocked_penalty = min(40, blocked_count * 15)

        # Incidents: each severity-4/5 deducts 5 pts, others deduct 2 pts
        incident_penalty = 0
        for inc in incidents:
            incident_penalty += 5 if inc.severity >= 4 else 2
        incident_penalty = min(30, incident_penalty)

        score = int(100 - (avg_risk * 0.4) - blocked_penalty - incident_penalty)
        return max(0, min(100, score))


# Module-level singleton
risk_engine = RiskEngine()
