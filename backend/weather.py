"""
weather.py — Weather data module for NER-SENTINEL.

Tries OpenWeatherMap API first (env var OPENWEATHER_KEY).
Falls back to realistic simulated data with varied conditions per zone.
Exports weather_cache dict refreshed by get_all_zone_weather().
"""

import os
import math
import random
from datetime import datetime
from typing import Dict, Any

try:
    import httpx
    _HTTPX_AVAILABLE = True
except ImportError:
    _HTTPX_AVAILABLE = False


# ---------------------------------------------------------------------------
# Known NER observation zones
# ---------------------------------------------------------------------------

NER_ZONES = [
    {"zone_name": "Guwahati",  "lat": 26.14, "lng": 91.73},
    {"zone_name": "Shillong",  "lat": 25.58, "lng": 91.88},
    {"zone_name": "Tezpur",    "lat": 26.65, "lng": 92.79},
    {"zone_name": "Silchar",   "lat": 24.83, "lng": 92.78},
    {"zone_name": "Imphal",    "lat": 24.82, "lng": 93.94},
    {"zone_name": "Kohima",    "lat": 25.67, "lng": 94.11},
]

# ---------------------------------------------------------------------------
# Simulated baseline conditions — varied for demo realism
# ---------------------------------------------------------------------------
# 2 rainy, 1 storm, 2 clear, 1 cloudy

_SIMULATED_CONDITIONS: Dict[str, Dict[str, Any]] = {
    "Guwahati": {
        "temperature_c": 28.5,
        "rainfall_mm_hr": 32.0,
        "condition": "HEAVY_RAIN",
        "wind_speed_kmh": 35.0,
        "humidity_pct": 91.0,
        "forecast_24h": "RAINY",
        "description": "Persistent heavy rainfall over Brahmaputra valley",
    },
    "Shillong": {
        "temperature_c": 18.2,
        "rainfall_mm_hr": 0.0,
        "condition": "CLOUDY",
        "wind_speed_kmh": 14.0,
        "humidity_pct": 72.0,
        "forecast_24h": "RAINY",
        "description": "Overcast with rain expected by evening",
    },
    "Tezpur": {
        "temperature_c": 31.0,
        "rainfall_mm_hr": 58.0,
        "condition": "STORM",
        "wind_speed_kmh": 65.0,
        "humidity_pct": 96.0,
        "forecast_24h": "HEAVY_RAIN",
        "description": "Severe thunderstorm — high landslide risk on NH15",
    },
    "Silchar": {
        "temperature_c": 27.8,
        "rainfall_mm_hr": 18.0,
        "condition": "RAINY",
        "wind_speed_kmh": 22.0,
        "humidity_pct": 85.0,
        "forecast_24h": "CLOUDY",
        "description": "Moderate rain along Barak valley corridor",
    },
    "Imphal": {
        "temperature_c": 24.3,
        "rainfall_mm_hr": 0.0,
        "condition": "CLEAR",
        "wind_speed_kmh": 8.0,
        "humidity_pct": 55.0,
        "forecast_24h": "CLEAR",
        "description": "Clear skies, good visibility on NH39",
    },
    "Kohima": {
        "temperature_c": 20.1,
        "rainfall_mm_hr": 0.0,
        "condition": "CLEAR",
        "wind_speed_kmh": 12.0,
        "humidity_pct": 60.0,
        "forecast_24h": "CLOUDY",
        "description": "Clear morning, mild cloud build-up expected",
    },
}


# ---------------------------------------------------------------------------
# Public cache — refreshed each call to get_all_zone_weather()
# ---------------------------------------------------------------------------

weather_cache: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Risk conversion
# ---------------------------------------------------------------------------

def rainfall_to_risk_factor(rainfall_mm_hr: float) -> int:
    """
    Convert rainfall (mm/hr) to an additive risk factor (0-25).

    Breakpoints:
        0        → 0
        < 5      → 5
        < 15     → 10
        < 30     → 15
        < 50     → 20
        >= 50    → 25
    """
    if rainfall_mm_hr <= 0:
        return 0
    if rainfall_mm_hr < 5:
        return 5
    if rainfall_mm_hr < 15:
        return 10
    if rainfall_mm_hr < 30:
        return 15
    if rainfall_mm_hr < 50:
        return 20
    return 25


# ---------------------------------------------------------------------------
# OpenWeatherMap fetch (live)
# ---------------------------------------------------------------------------

def _fetch_owm(zone: Dict[str, Any], api_key: str) -> "Optional[Dict[str, Any]]":
    """Try to fetch live weather from OpenWeatherMap. Returns None on failure."""
    if not _HTTPX_AVAILABLE:
        return None
    try:
        url = (
            f"https://api.openweathermap.org/data/2.5/weather"
            f"?lat={zone['lat']}&lon={zone['lng']}&appid={api_key}&units=metric"
        )
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url)
        if resp.status_code != 200:
            return None
        data = resp.json()

        # Map OWM weather IDs to NER-SENTINEL condition strings
        weather_id = data["weather"][0]["id"]
        if weather_id >= 900:
            condition = "STORM"
        elif weather_id >= 500 and weather_id < 600:
            rain_mm = data.get("rain", {}).get("1h", 0.0)
            if rain_mm >= 15:
                condition = "HEAVY_RAIN"
            else:
                condition = "RAINY"
        elif weather_id >= 300:
            condition = "RAINY"
        elif weather_id >= 800:
            condition = "CLEAR" if weather_id == 800 else "CLOUDY"
        else:
            condition = "CLOUDY"

        rain_mm_hr = data.get("rain", {}).get("1h", 0.0)
        return {
            "zone_name": zone["zone_name"],
            "lat": zone["lat"],
            "lng": zone["lng"],
            "temperature_c": round(data["main"]["temp"], 1),
            "rainfall_mm_hr": round(rain_mm_hr, 1),
            "condition": condition,
            "wind_speed_kmh": round(data["wind"]["speed"] * 3.6, 1),
            "humidity_pct": float(data["main"]["humidity"]),
            "forecast_24h": condition,
            "description": data["weather"][0]["description"].title(),
            "updated_at": datetime.utcnow().isoformat(),
            "source": "openweathermap",
        }
    except Exception:
        return None


def _add_jitter(base_value: float, pct: float = 0.05) -> float:
    """Add ±pct% noise to a value to make simulated data feel live."""
    delta = base_value * pct
    return round(base_value + random.uniform(-delta, delta), 2)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_weather_for_zone(zone_name: str) -> Dict[str, Any]:
    """
    Return weather data for a named zone.

    Strategy:
        1. Try OpenWeatherMap if OPENWEATHER_KEY env var is set.
        2. Fall back to realistic simulated data with small random jitter.
    """
    zone = next((z for z in NER_ZONES if z["zone_name"] == zone_name), None)
    if zone is None:
        raise ValueError(f"Unknown zone: {zone_name}")

    api_key = os.environ.get("OPENWEATHER_KEY", "")
    if api_key:
        live = _fetch_owm(zone, api_key)
        if live:
            return live

    # Simulated fallback
    base = _SIMULATED_CONDITIONS[zone_name]
    rain = _add_jitter(base["rainfall_mm_hr"], pct=0.08)
    rain = max(0.0, rain)
    return {
        "zone_name": zone_name,
        "lat": zone["lat"],
        "lng": zone["lng"],
        "temperature_c": _add_jitter(base["temperature_c"], pct=0.02),
        "rainfall_mm_hr": rain,
        "condition": base["condition"],
        "wind_speed_kmh": _add_jitter(base["wind_speed_kmh"], pct=0.05),
        "humidity_pct": _add_jitter(base["humidity_pct"], pct=0.03),
        "forecast_24h": base["forecast_24h"],
        "description": base["description"],
        "updated_at": datetime.utcnow().isoformat(),
        "source": "simulated",
    }


def get_all_zone_weather() -> Dict[str, Dict[str, Any]]:
    """
    Refresh and return weather data for all NER zones.
    Updates the module-level weather_cache in place.
    """
    global weather_cache
    result = {}
    for zone in NER_ZONES:
        data = get_weather_for_zone(zone["zone_name"])
        result[zone["zone_name"]] = data
    weather_cache = result
    return result


# Populate cache on module import so risk_engine can use it immediately
get_all_zone_weather()
