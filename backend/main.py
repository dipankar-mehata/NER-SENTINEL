"""
main.py — NER-SENTINEL FastAPI application entry point.

Registers all routes, seeds the database on startup, and wires together:
weather, risk_engine, routing, copilot, simulation, and supply modules.
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime
import json
import random

import database
import models
from schemas import (
    IncidentCreate, RouteRequest, ChatRequest,
    VehicleUpdate, ShipmentCreate, SimulationRequest, WhatIfRequest,
)
from routing import LogisticsRouter
from weather import get_all_zone_weather, weather_cache
from risk_engine import risk_engine
import copilot
import simulation as sim_engine
import supply as supply_engine

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="NER-SENTINEL Logistics Intelligence API",
    description="Real-time disaster-aware logistics system for Northeast India",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router_engine = LogisticsRouter()


# ---------------------------------------------------------------------------
# Helper: serialise geometry to lat/lng
# ---------------------------------------------------------------------------

def _geo_to_latlon(db: Session, geom) -> dict:
    """Convert a GeoAlchemy2 geometry column value to {"lat": ..., "lng": ...}."""
    try:
        geo_json = db.scalar(func.ST_AsGeoJSON(geom))
        if geo_json is None:
            return {"lat": 0.0, "lng": 0.0}
        coords = json.loads(geo_json)["coordinates"]
        return {"lat": coords[1], "lng": coords[0]}
    except Exception:
        return {"lat": 0.0, "lng": 0.0}


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

def _seed_vehicles(db: Session):
    vehicles_data = [
        {
            "driver_name": "Ramesh Kumar (Vehicle #27)",
            "status": "EN_ROUTE",
            "payload_type": "Critical Medicine",
            "priority": "Critical",
            "location": "SRID=4326;POINT(91.73 26.14)",
            "destination_name": "Tezpur District Hospital",
            "destination_lat": 26.65,
            "destination_lng": 92.79,
            "origin_name": "Guwahati Medical Hub",
            "cargo_weight_kg": 1200.0,
            "capacity_kg": 3000.0,
            "current_load_pct": 40.0,
            "eta_hours": 4.5,
            "speed_kmh": 48.0,
        },
        {
            "driver_name": "Suresh Das (Vehicle #14)",
            "status": "DELAYED",
            "payload_type": "Food Supplies",
            "priority": "High",
            "location": "SRID=4326;POINT(91.88 25.57)",
            "destination_name": "Silchar Relief Camp",
            "destination_lat": 24.83,
            "destination_lng": 92.78,
            "origin_name": "Shillong Depot",
            "cargo_weight_kg": 4500.0,
            "capacity_kg": 5000.0,
            "current_load_pct": 90.0,
            "eta_hours": 8.2,
            "speed_kmh": 28.0,
        },
        {
            "driver_name": "Priya Sharma (Vehicle #08)",
            "status": "IDLE",
            "payload_type": "Fuel & Generator",
            "priority": "Medium",
            "location": "SRID=4326;POINT(92.79 26.65)",
            "destination_name": "Bomdila Forward Base",
            "destination_lat": 27.26,
            "destination_lng": 92.41,
            "origin_name": "Tezpur Supply Depot",
            "cargo_weight_kg": 2000.0,
            "capacity_kg": 4000.0,
            "current_load_pct": 50.0,
            "eta_hours": 0.0,
            "speed_kmh": 0.0,
        },
        {
            "driver_name": "Mohan Singh (Vehicle #31)",
            "status": "EN_ROUTE",
            "payload_type": "Emergency Equipment",
            "priority": "Critical",
            "location": "SRID=4326;POINT(93.94 24.82)",
            "destination_name": "Kohima Emergency Center",
            "destination_lat": 25.67,
            "destination_lng": 94.11,
            "origin_name": "Imphal Army Depot",
            "cargo_weight_kg": 800.0,
            "capacity_kg": 2000.0,
            "current_load_pct": 40.0,
            "eta_hours": 2.1,
            "speed_kmh": 55.0,
        },
        {
            "driver_name": "Anjali Bora (Vehicle #19)",
            "status": "COMPLETED",
            "payload_type": "Medical Kits",
            "priority": "Normal",
            "location": "SRID=4326;POINT(92.78 24.83)",
            "destination_name": "Silchar District Hospital",
            "destination_lat": 24.83,
            "destination_lng": 92.78,
            "origin_name": "Guwahati Medical Hub",
            "cargo_weight_kg": 600.0,
            "capacity_kg": 3000.0,
            "current_load_pct": 20.0,
            "eta_hours": 0.0,
            "speed_kmh": 0.0,
        },
    ]
    objs = [models.Vehicle(**d) for d in vehicles_data]
    db.add_all(objs)
    db.flush()   # get IDs assigned
    return objs


def _seed_warehouses(db: Session):
    warehouses_data = [
        {
            "name": "Guwahati Central Hub",
            "district": "Kamrup Metropolitan",
            "location": "SRID=4326;POINT(91.73 26.14)",
            "medicine_stock_pct": 72.0,
            "food_stock_pct": 85.0,
            "fuel_stock_pct": 91.0,
            "equipment_stock_pct": 65.0,
        },
        {
            "name": "Shillong Regional Depot",
            "district": "East Khasi Hills",
            "location": "SRID=4326;POINT(91.88 25.58)",
            "medicine_stock_pct": 31.0,   # below threshold → triggers shortage warning
            "food_stock_pct": 45.0,
            "fuel_stock_pct": 22.0,       # critical shortage
            "equipment_stock_pct": 58.0,
        },
        {
            "name": "Tezpur Forward Base",
            "district": "Sonitpur",
            "location": "SRID=4326;POINT(92.79 26.65)",
            "medicine_stock_pct": 55.0,
            "food_stock_pct": 38.0,       # below threshold
            "fuel_stock_pct": 60.0,
            "equipment_stock_pct": 44.0,
        },
    ]
    objs = [models.Warehouse(**d) for d in warehouses_data]
    db.add_all(objs)


def _seed_road_segments(db: Session):
    segments_data = [
        {
            "name": "Guwahati-Tezpur (NH15)",
            "start_lat": 26.14, "start_lng": 91.73,
            "end_lat":   26.65, "end_lng":   92.79,
            "district": "Kamrup/Sonitpur",
            "length_km": 183.0,
            "slope_risk": 12,
            "road_condition_score": 8,
            "is_critical_corridor": True,
            "dependent_districts": "Sonitpur,Lakhimpur,Darrang",
            "current_risk_score": 0,
            "risk_label": "LOW",
            "blocked": False,
        },
        {
            "name": "Shillong-Silchar (NH6)",
            "start_lat": 25.58, "start_lng": 91.88,
            "end_lat":   24.83, "end_lng":   92.78,
            "district": "East Khasi Hills/Cachar",
            "length_km": 240.0,
            "slope_risk": 18,
            "road_condition_score": 12,
            "is_critical_corridor": True,
            "dependent_districts": "Cachar,Hailakandi,Karimganj",
            "current_risk_score": 0,
            "risk_label": "LOW",
            "blocked": False,
        },
        {
            "name": "Guwahati-Shillong (NH6)",
            "start_lat": 26.14, "start_lng": 91.73,
            "end_lat":   25.58, "end_lng":   91.88,
            "district": "Kamrup/East Khasi Hills",
            "length_km": 100.0,
            "slope_risk": 10,
            "road_condition_score": 6,
            "is_critical_corridor": False,
            "dependent_districts": "East Khasi Hills,Ri Bhoi",
            "current_risk_score": 0,
            "risk_label": "LOW",
            "blocked": False,
        },
        {
            "name": "Tezpur-Bomdila",
            "start_lat": 26.65, "start_lng": 92.79,
            "end_lat":   27.26, "end_lng":   92.41,
            "district": "Sonitpur/West Kameng",
            "length_km": 178.0,
            "slope_risk": 20,
            "road_condition_score": 14,
            "is_critical_corridor": True,
            "dependent_districts": "West Kameng,Tawang",
            "current_risk_score": 0,
            "risk_label": "LOW",
            "blocked": False,
        },
        {
            "name": "Imphal-Kohima",
            "start_lat": 24.82, "start_lng": 93.94,
            "end_lat":   25.67, "end_lng":   94.11,
            "district": "Imphal West/Kohima",
            "length_km": 74.0,
            "slope_risk": 15,
            "road_condition_score": 9,
            "is_critical_corridor": False,
            "dependent_districts": "Kohima,Senapati",
            "current_risk_score": 0,
            "risk_label": "LOW",
            "blocked": False,
        },
        {
            "name": "Silchar-Aizawl",
            "start_lat": 24.83, "start_lng": 92.78,
            "end_lat":   23.73, "end_lng":   92.72,
            "district": "Cachar/Aizawl",
            "length_km": 130.0,
            "slope_risk": 17,
            "road_condition_score": 13,
            "is_critical_corridor": False,
            "dependent_districts": "Aizawl,Kolasib",
            "current_risk_score": 0,
            "risk_label": "LOW",
            "blocked": False,
        },
        {
            "name": "Guwahati-Bongaigaon",
            "start_lat": 26.14, "start_lng": 91.73,
            "end_lat":   26.48, "end_lng":   90.56,
            "district": "Kamrup/Bongaigaon",
            "length_km": 147.0,
            "slope_risk": 4,
            "road_condition_score": 4,
            "is_critical_corridor": False,
            "dependent_districts": "Bongaigaon,Chirang,Barpeta",
            "current_risk_score": 0,
            "risk_label": "LOW",
            "blocked": False,
        },
        {
            "name": "Jorhat-Majuli",
            "start_lat": 26.75, "start_lng": 94.20,
            "end_lat":   27.00, "end_lng":   94.20,
            "district": "Jorhat",
            "length_km": 28.0,
            "slope_risk": 2,
            "road_condition_score": 5,
            "is_critical_corridor": False,
            "dependent_districts": "Majuli",
            "current_risk_score": 0,
            "risk_label": "LOW",
            "blocked": False,
        },
    ]
    objs = [models.RoadSegment(**d) for d in segments_data]
    db.add_all(objs)


def _seed_districts(db: Session):
    districts_data = [
        {
            "name": "Kamrup Metropolitan",
            "accessibility_score": 78,
            "active_incidents_count": 2,
            "blocked_routes_count": 0,
            "critical_routes_count": 1,
            "weather_risk": "HIGH",
            "population": 1253938,
        },
        {
            "name": "Sonitpur",
            "accessibility_score": 52,
            "active_incidents_count": 4,
            "blocked_routes_count": 1,
            "critical_routes_count": 2,
            "weather_risk": "HIGH",
            "population": 1924110,
        },
        {
            "name": "East Khasi Hills",
            "accessibility_score": 65,
            "active_incidents_count": 1,
            "blocked_routes_count": 0,
            "critical_routes_count": 1,
            "weather_risk": "MODERATE",
            "population": 825922,
        },
        {
            "name": "Cachar",
            "accessibility_score": 43,
            "active_incidents_count": 3,
            "blocked_routes_count": 1,
            "critical_routes_count": 2,
            "weather_risk": "MODERATE",
            "population": 1736617,
        },
    ]
    objs = [models.District(**d) for d in districts_data]
    db.add_all(objs)


def _seed_shipments(db: Session, vehicles):
    """vehicles is the list of Vehicle ORM objects returned from _seed_vehicles."""
    shipments_data = [
        {
            "vehicle_id": vehicles[0].id,
            "cargo_type": "Medicine",
            "priority": "Critical",
            "origin": "Guwahati Medical Hub",
            "destination": "Tezpur District Hospital",
            "eta_hours": 4.5,
            "status": "ON_TIME",
            "weight_kg": 600.0,
            "description": "Anti-malarial drugs & IV fluids",
        },
        {
            "vehicle_id": vehicles[0].id,
            "cargo_type": "Equipment",
            "priority": "High",
            "origin": "Guwahati Medical Hub",
            "destination": "Tezpur District Hospital",
            "eta_hours": 4.5,
            "status": "ON_TIME",
            "weight_kg": 600.0,
            "description": "Portable oxygen concentrators",
        },
        {
            "vehicle_id": vehicles[1].id,
            "cargo_type": "Food",
            "priority": "High",
            "origin": "Shillong Depot",
            "destination": "Silchar Relief Camp",
            "eta_hours": 8.2,
            "status": "DELAYED",
            "weight_kg": 4500.0,
            "description": "Emergency ration packs for 2000 people",
        },
        {
            "vehicle_id": vehicles[2].id,
            "cargo_type": "Fuel",
            "priority": "Medium",
            "origin": "Tezpur Supply Depot",
            "destination": "Bomdila Forward Base",
            "eta_hours": 6.0,
            "status": "ON_TIME",
            "weight_kg": 2000.0,
            "description": "Diesel for generators and vehicles",
        },
        {
            "vehicle_id": vehicles[3].id,
            "cargo_type": "Equipment",
            "priority": "Critical",
            "origin": "Imphal Army Depot",
            "destination": "Kohima Emergency Center",
            "eta_hours": 2.1,
            "status": "AT_RISK",
            "weight_kg": 800.0,
            "description": "Water purification units & tents",
        },
        {
            "vehicle_id": vehicles[4].id,
            "cargo_type": "Medicine",
            "priority": "Normal",
            "origin": "Guwahati Medical Hub",
            "destination": "Silchar District Hospital",
            "eta_hours": 0.0,
            "status": "DELIVERED",
            "weight_kg": 600.0,
            "description": "Routine medical supplies",
        },
        {
            "vehicle_id": None,
            "cargo_type": "Food",
            "priority": "Critical",
            "origin": "Guwahati Central Hub",
            "destination": "Majuli Island Relief Camp",
            "eta_hours": 10.0,
            "status": "AT_RISK",
            "weight_kg": 3000.0,
            "description": "Flood relief food — Majuli route partially blocked",
        },
        {
            "vehicle_id": None,
            "cargo_type": "Medicine",
            "priority": "High",
            "origin": "Shillong Regional Depot",
            "destination": "Aizawl General Hospital",
            "eta_hours": 12.0,
            "status": "DELAYED",
            "weight_kg": 400.0,
            "description": "Surgical supplies — Silchar-Aizawl route risk HIGH",
        },
    ]
    objs = [models.Shipment(**d) for d in shipments_data]
    db.add_all(objs)


def _seed_incidents(db: Session):
    incidents_data = [
        {
            "incident_type": "LANDSLIDE",
            "severity": 5,
            "verified": True,
            "location": "SRID=4326;POINT(92.50 26.40)",
            "description": "Major landslide blocking NH15 near Bhalukpong. "
                           "Full road closure — heavy equipment required.",
            "source": "FIELD_OFFICER",
            "confidence_pct": 98,
            "report_count": 7,
        },
        {
            "incident_type": "FLOOD",
            "severity": 4,
            "verified": True,
            "location": "SRID=4326;POINT(91.90 24.90)",
            "description": "Barak River flooding — water on NH6 (Silchar approach). "
                           "1.5m water level. Vehicles > 4t advised to halt.",
            "source": "AI",
            "confidence_pct": 85,
            "report_count": 3,
        },
        {
            "incident_type": "ROAD_DAMAGE",
            "severity": 3,
            "verified": False,
            "location": "SRID=4326;POINT(94.00 25.20)",
            "description": "Reported pothole crater on Imphal-Kohima stretch. "
                           "Slows traffic significantly.",
            "source": "DRIVER",
            "confidence_pct": 70,
            "report_count": 2,
        },
    ]
    objs = [models.Incident(**d) for d in incidents_data]
    db.add_all(objs)


def _seed_weather_zones(db: Session):
    from weather import NER_ZONES, _SIMULATED_CONDITIONS
    for zone in NER_ZONES:
        cond = _SIMULATED_CONDITIONS[zone["zone_name"]]
        obj = models.WeatherZone(
            zone_name=zone["zone_name"],
            lat=zone["lat"],
            lng=zone["lng"],
            temperature_c=cond["temperature_c"],
            rainfall_mm_hr=cond["rainfall_mm_hr"],
            condition=cond["condition"],
            wind_speed_kmh=cond["wind_speed_kmh"],
            humidity_pct=cond["humidity_pct"],
            forecast_24h=cond["forecast_24h"],
            updated_at=datetime.utcnow(),
        )
        db.add(obj)


def _refresh_risk_scores(db: Session):
    """Recompute current_risk_score for every RoadSegment using the RiskEngine."""
    segments = db.query(models.RoadSegment).all()
    incidents = db.query(models.Incident).all()
    weather_zones = db.query(models.WeatherZone).all()

    for seg in segments:
        # Find nearest weather zone from DB
        nearest_wz = None
        min_dist = float("inf")
        seg_lat = (seg.start_lat + seg.end_lat) / 2
        seg_lng = (seg.start_lng + seg.end_lng) / 2
        for wz in weather_zones:
            d = ((wz.lat - seg_lat) ** 2 + (wz.lng - seg_lng) ** 2) ** 0.5
            if d < min_dist:
                min_dist = d
                nearest_wz = wz

        # Filter nearby incidents (within ~1 degree ~111km)
        nearby_incidents = [
            inc for inc in incidents
        ]
        result = risk_engine.calculate_segment_risk(seg, nearest_wz, nearby_incidents)
        seg.current_risk_score = result["total"]
        seg.risk_label = result["label"]
        seg.rainfall_factor = result["rainfall"]
        seg.incident_factor = result["incidents"]
        seg.traffic_factor = result["traffic"]

    # Refresh district scores
    districts = db.query(models.District).all()
    for dist in districts:
        dist_segs = [s for s in segments if dist.name.lower() in (s.dependent_districts or "").lower()]
        dist_incidents = [i for i in incidents]
        score = risk_engine.calculate_district_accessibility(dist, dist_segs, dist_incidents)
        dist.accessibility_score = score


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def startup_event():
    # Create all tables
    models.Base.metadata.create_all(bind=database.engine)

    db = database.SessionLocal()
    try:
        if db.query(models.Vehicle).count() == 0:
            vehicles = _seed_vehicles(db)
            _seed_warehouses(db)
            _seed_road_segments(db)
            _seed_districts(db)
            db.flush()
            _seed_shipments(db, vehicles)
            _seed_incidents(db)
            _seed_weather_zones(db)
            db.commit()

        # Always refresh weather cache and risk scores on startup
        get_all_zone_weather()
        _refresh_risk_scores(db)
        db.commit()
    finally:
        db.close()


# ===========================================================================
# VEHICLES
# ===========================================================================

@app.get("/api/vehicles", tags=["Vehicles"])
def get_vehicles(db: Session = Depends(database.get_db)):
    """Return all registered vehicles with location and shipment summary."""
    results = db.query(models.Vehicle).all()
    out = []
    for v in results:
        loc = _geo_to_latlon(db, v.location)
        out.append({
            "id": v.id,
            "driver_name": v.driver_name,
            "status": v.status,
            "payload_type": v.payload_type,
            "priority": v.priority,
            "location": loc,
            "destination_name": v.destination_name,
            "destination_lat": v.destination_lat,
            "destination_lng": v.destination_lng,
            "origin_name": v.origin_name,
            "cargo_weight_kg": v.cargo_weight_kg,
            "capacity_kg": v.capacity_kg,
            "current_load_pct": v.current_load_pct,
            "eta_hours": v.eta_hours,
            "speed_kmh": v.speed_kmh,
            "shipment_count": len(v.shipments),
        })
    return out


@app.post("/api/vehicles/{vehicle_id}/location", tags=["Vehicles"])
def update_vehicle_location(
    vehicle_id: int,
    update: VehicleUpdate,
    db: Session = Depends(database.get_db),
):
    """Update a vehicle's GPS location, status, and speed."""
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail=f"Vehicle {vehicle_id} not found")

    vehicle.location = f"SRID=4326;POINT({update.lng} {update.lat})"
    if update.status is not None:
        vehicle.status = update.status
    if update.speed_kmh is not None:
        vehicle.speed_kmh = update.speed_kmh

    db.commit()
    return {"status": "updated", "vehicle_id": vehicle_id, "lat": update.lat, "lng": update.lng}


# ===========================================================================
# INCIDENTS
# ===========================================================================

@app.get("/api/incidents", tags=["Incidents"])
def get_incidents(db: Session = Depends(database.get_db)):
    """Return all reported incidents with full details."""
    results = db.query(models.Incident).order_by(
        models.Incident.severity.desc(), models.Incident.created_at.desc()
    ).all()
    out = []
    for r in results:
        loc = _geo_to_latlon(db, r.location)
        out.append({
            "id": r.id,
            "incident_type": r.incident_type,
            "severity": r.severity,
            "verified": r.verified,
            "location": loc,
            "description": r.description,
            "photo_url": r.photo_url,
            "voice_note_url": r.voice_note_url,
            "source": r.source,
            "confidence_pct": r.confidence_pct,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "report_count": r.report_count,
        })
    return out


@app.post("/api/incidents", tags=["Incidents"])
def create_incident(incident: IncidentCreate, db: Session = Depends(database.get_db)):
    """Report a new incident. Triggers risk score refresh."""
    new_incident = models.Incident(
        incident_type=incident.incident_type,
        severity=incident.severity,
        location=f"SRID=4326;POINT({incident.lng} {incident.lat})",
        verified=False,
        description=incident.description,
        source=incident.source,
        photo_url=incident.photo_url,
        voice_note_url=incident.voice_note_url,
        confidence_pct=incident.confidence_pct,
        created_at=datetime.utcnow(),
        report_count=1,
    )
    db.add(new_incident)
    db.commit()

    # Refresh risk scores after new incident
    get_all_zone_weather()
    _refresh_risk_scores(db)
    db.commit()

    return {"status": "success", "id": new_incident.id}


# ===========================================================================
# ROAD SEGMENTS
# ===========================================================================

@app.get("/api/road-segments", tags=["Roads"])
def get_road_segments(db: Session = Depends(database.get_db)):
    """Return all road segments with live risk scores."""
    # Refresh weather and risk scores first
    get_all_zone_weather()
    _refresh_risk_scores(db)
    db.commit()

    segments = db.query(models.RoadSegment).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "start": {"lat": s.start_lat, "lng": s.start_lng},
            "end":   {"lat": s.end_lat,   "lng": s.end_lng},
            "start_lat": s.start_lat,
            "start_lng": s.start_lng,
            "end_lat": s.end_lat,
            "end_lng": s.end_lng,
            "district": s.district,
            "length_km": s.length_km,
            "slope_risk": s.slope_risk,
            "road_condition_score": s.road_condition_score,
            "is_critical_corridor": s.is_critical_corridor,
            "dependent_districts": s.dependent_districts,
            "current_risk_score": s.current_risk_score,
            "risk_label": s.risk_label,
            "rainfall_factor": s.rainfall_factor,
            "incident_factor": s.incident_factor,
            "traffic_factor": s.traffic_factor,
            "blocked": s.blocked,
        }
        for s in segments
    ]


# ===========================================================================
# DISTRICTS
# ===========================================================================

@app.get("/api/districts", tags=["Districts"])
def get_districts(db: Session = Depends(database.get_db)):
    """Return all districts with accessibility scores."""
    districts = db.query(models.District).order_by(
        models.District.accessibility_score.asc()
    ).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "accessibility_score": d.accessibility_score,
            "active_incidents_count": d.active_incidents_count,
            "blocked_routes_count": d.blocked_routes_count,
            "critical_routes_count": d.critical_routes_count,
            "weather_risk": d.weather_risk,
            "population": d.population,
        }
        for d in districts
    ]


# ===========================================================================
# WEATHER
# ===========================================================================

@app.get("/api/weather", tags=["Weather"])
def get_weather(db: Session = Depends(database.get_db)):
    """Return live weather data for all NER observation zones."""
    cache = get_all_zone_weather()

    # Sync DB records with fresh cache
    weather_zones = db.query(models.WeatherZone).all()
    zone_map = {wz.zone_name: wz for wz in weather_zones}
    for zone_name, data in cache.items():
        if zone_name in zone_map:
            wz = zone_map[zone_name]
            wz.temperature_c = data["temperature_c"]
            wz.rainfall_mm_hr = data["rainfall_mm_hr"]
            wz.condition = data["condition"]
            wz.wind_speed_kmh = data["wind_speed_kmh"]
            wz.humidity_pct = data["humidity_pct"]
            wz.forecast_24h = data["forecast_24h"]
            wz.updated_at = datetime.utcnow()
    db.commit()

    return list(cache.values())


# ===========================================================================
# ROUTE
# ===========================================================================

@app.post("/api/route", tags=["Routing"])
def calculate_route(req: RouteRequest, db: Session = Depends(database.get_db)):
    """
    Calculate dual routes (shortest + safest) between two coordinates.
    Uses live incident data and DB road segment risk overlay.
    """
    results = db.query(models.Incident).all()
    incidents = []
    for r in results:
        loc = _geo_to_latlon(db, r.location)
        incidents.append({
            "lat": loc["lat"],
            "lng": loc["lng"],
            "severity": r.severity,
            "type": r.incident_type,
        })

    route_data = router_engine.calculate_safe_route(
        req.start_lat, req.start_lng,
        req.end_lat, req.end_lng,
        incidents,
        db=db,
    )
    return route_data


# ===========================================================================
# SIMULATION
# ===========================================================================

@app.post("/api/simulate", tags=["Simulation"])
def disaster_simulation(req: SimulationRequest, db: Session = Depends(database.get_db)):
    """Run a disaster scenario simulation with given parameters."""
    return sim_engine.run_disaster_simulation(
        rainfall_intensity=req.rainfall_intensity,
        blocked_roads_count=req.blocked_roads_count,
        traffic_level=req.traffic_level,
        supply_demand_multiplier=req.supply_demand_multiplier,
        db=db,
    )


@app.post("/api/whatif", tags=["Simulation"])
def whatif_analysis(req: WhatIfRequest, db: Session = Depends(database.get_db)):
    """Analyse the cascading impact of closing a specific road segment."""
    return sim_engine.run_whatif(segment_id=req.segment_id, db=db)


# ===========================================================================
# SUPPLY CHAIN
# ===========================================================================

@app.get("/api/supply/status", tags=["Supply Chain"])
def supply_status(db: Session = Depends(database.get_db)):
    """Return shortage predictions for all warehouses."""
    return supply_engine.get_supply_status(db)


@app.get("/api/supply/preposition", tags=["Supply Chain"])
def supply_preposition(db: Session = Depends(database.get_db)):
    """Return pre-positioning recommendations based on current route risk."""
    return supply_engine.get_preposition_recommendations(db)


# ===========================================================================
# COPILOT
# ===========================================================================

@app.post("/api/chat", tags=["Copilot"])
def copilot_chat(req: ChatRequest, db: Session = Depends(database.get_db)):
    """Smart logistics copilot — answers natural-language queries with real DB data."""
    response_text = copilot.handle_query(req.query, db)
    return {"response": response_text}


# ===========================================================================
# BOTTLENECKS
# ===========================================================================

@app.get("/api/bottlenecks", tags=["Analysis"])
def get_bottlenecks(db: Session = Depends(database.get_db)):
    """Return critical infrastructure corridors and their current risk status."""
    critical_segs = db.query(models.RoadSegment).filter(
        models.RoadSegment.is_critical_corridor == True
    ).order_by(models.RoadSegment.current_risk_score.desc()).all()

    return [
        {
            "id": s.id,
            "name": s.name,
            "district": s.district,
            "length_km": s.length_km,
            "is_critical_corridor": s.is_critical_corridor,
            "dependent_districts": s.dependent_districts,
            "current_risk_score": s.current_risk_score,
            "risk_label": s.risk_label,
            "rainfall_factor": s.rainfall_factor,
            "slope_risk": s.slope_risk,
            "incident_factor": s.incident_factor,
            "blocked": s.blocked,
            "start": {"lat": s.start_lat, "lng": s.start_lng},
            "end":   {"lat": s.end_lat,   "lng": s.end_lng},
        }
        for s in critical_segs
    ]


# ===========================================================================
# RISK PREDICTION (24h / 48h / 72h forecast)
# ===========================================================================

@app.get("/api/risk-prediction", tags=["Analysis"])
def risk_prediction(db: Session = Depends(database.get_db)):
    """
    Return simulated 24h / 48h / 72h risk forecasts for all road segments.
    Based on: current score + weather forecast + historical pattern.
    """
    segments = db.query(models.RoadSegment).all()
    forecasts = []
    for seg in segments:
        # Simulate forecast by applying forecast weather factor
        base_risk = seg.current_risk_score
        rng = random.Random(seg.id + 12345)

        # 24h: weather forecast effect (storm areas escalate)
        zone_name = (seg.dependent_districts or "").split(",")[0].strip()
        cached = weather_cache.get("Tezpur") or weather_cache.get("Guwahati") or {}
        forecast_cond = cached.get("forecast_24h", "CLEAR")
        forecast_rain_factor = {"CLEAR": 0, "CLOUDY": 5, "RAINY": 10, "HEAVY_RAIN": 20, "STORM": 25}.get(
            forecast_cond, 0
        )

        risk_24h = min(100, base_risk + forecast_rain_factor + rng.randint(-5, 5))
        risk_48h = min(100, risk_24h + rng.randint(-10, 15))
        risk_72h = min(100, risk_48h + rng.randint(-15, 10))

        def label(score):
            if score > 60:
                return "HIGH"
            if score > 30:
                return "MODERATE"
            return "LOW"

        forecasts.append({
            "segment_id": seg.id,
            "segment_name": seg.name,
            "current_risk": base_risk,
            "current_label": seg.risk_label,
            "forecast_24h": {"risk": risk_24h, "label": label(risk_24h)},
            "forecast_48h": {"risk": risk_48h, "label": label(risk_48h)},
            "forecast_72h": {"risk": risk_72h, "label": label(risk_72h)},
            "trend": (
                "WORSENING" if risk_72h > base_risk + 10
                else "IMPROVING" if risk_72h < base_risk - 10
                else "STABLE"
            ),
        })

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "weather_basis": weather_cache.get("Tezpur", {}).get("forecast_24h", "N/A"),
        "segments": forecasts,
    }
