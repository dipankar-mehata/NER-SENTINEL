"""
SQLAlchemy ORM models for NER-SENTINEL logistics intelligence system.
Covers: Vehicle, Incident, Warehouse, Shipment, RoadSegment, District, WeatherZone
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()


class Vehicle(Base):
    """Represents a logistics vehicle operating across Northeast India."""
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    driver_name = Column(String, index=True, nullable=False)
    status = Column(String, default="IDLE")          # EN_ROUTE / DELAYED / IDLE / COMPLETED
    payload_type = Column(String, nullable=False)
    priority = Column(String, default="Normal")      # Critical / High / Medium / Normal
    lat = Column(Float, default=0.0)
    lng = Column(Float, default=0.0)

    destination_name = Column(String, default="")
    destination_lat = Column(Float, default=0.0)
    destination_lng = Column(Float, default=0.0)
    origin_name = Column(String, default="")

    cargo_weight_kg = Column(Float, default=0.0)
    capacity_kg = Column(Float, default=5000.0)
    current_load_pct = Column(Float, default=0.0)

    eta_hours = Column(Float, default=0.0)
    speed_kmh = Column(Float, default=40.0)

    shipments = relationship("Shipment", back_populates="vehicle")


class Incident(Base):
    """Represents a field-reported or AI-detected hazard incident."""
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_type = Column(String, nullable=False)
    # LANDSLIDE / FLOOD / ROAD_DAMAGE / BRIDGE_DAMAGE / TRAFFIC / VEHICLE_BREAKDOWN / WEATHER

    severity = Column(Integer, default=1)
    verified = Column(Boolean, default=False)
    lat = Column(Float, default=0.0)
    lng = Column(Float, default=0.0)

    description = Column(Text, default="")
    photo_url = Column(String, default="")
    voice_note_url = Column(String, default="")

    source = Column(String, default="FIELD_OFFICER")
    # FIELD_OFFICER / DRIVER / SYSTEM / AI

    confidence_pct = Column(Integer, default=80)
    created_at = Column(DateTime, default=datetime.utcnow)
    report_count = Column(Integer, default=1)


class Warehouse(Base):
    """Represents a supply depot / warehouse in NER."""
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    district = Column(String, nullable=False)
    lat = Column(Float, default=0.0)
    lng = Column(Float, default=0.0)

    medicine_stock_pct = Column(Float, default=100.0)
    food_stock_pct = Column(Float, default=100.0)
    fuel_stock_pct = Column(Float, default=100.0)
    equipment_stock_pct = Column(Float, default=100.0)


class Shipment(Base):
    """Represents a cargo shipment assigned to a vehicle."""
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)

    cargo_type = Column(String, nullable=False)
    priority = Column(String, default="Normal")      # Critical / High / Medium / Normal
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    eta_hours = Column(Float, default=0.0)
    status = Column(String, default="ON_TIME")       # ON_TIME / DELAYED / AT_RISK / DELIVERED
    weight_kg = Column(Float, default=0.0)
    description = Column(Text, default="")

    vehicle = relationship("Vehicle", back_populates="shipments")


class RoadSegment(Base):
    """Represents a named road corridor with static and dynamic risk factors."""
    __tablename__ = "road_segments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

    start_lat = Column(Float, nullable=False)
    start_lng = Column(Float, nullable=False)
    end_lat = Column(Float, nullable=False)
    end_lng = Column(Float, nullable=False)

    district = Column(String, default="")
    length_km = Column(Float, default=0.0)

    # Static risk factors
    slope_risk = Column(Integer, default=0)          # 0-20
    road_condition_score = Column(Integer, default=0)  # 0-15 (higher = worse)
    is_critical_corridor = Column(Boolean, default=False)
    dependent_districts = Column(String, default="")

    # Dynamic risk (updated by risk engine)
    current_risk_score = Column(Integer, default=0)  # 0-100
    risk_label = Column(String, default="LOW")       # LOW / MODERATE / HIGH

    # Per-factor breakdown
    rainfall_factor = Column(Integer, default=0)
    incident_factor = Column(Integer, default=0)
    traffic_factor = Column(Integer, default=0)

    blocked = Column(Boolean, default=False)


class District(Base):
    """Represents an administrative district in Northeast India."""
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    accessibility_score = Column(Integer, default=100)
    active_incidents_count = Column(Integer, default=0)
    blocked_routes_count = Column(Integer, default=0)
    critical_routes_count = Column(Integer, default=0)
    weather_risk = Column(String, default="LOW")
    population = Column(Integer, default=0)


class WeatherZone(Base):
    """Represents a meteorological observation zone in NER."""
    __tablename__ = "weather_zones"

    id = Column(Integer, primary_key=True, index=True)
    zone_name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)

    temperature_c = Column(Float, default=25.0)
    rainfall_mm_hr = Column(Float, default=0.0)
    condition = Column(String, default="CLEAR")
    # CLEAR / CLOUDY / RAINY / HEAVY_RAIN / STORM

    wind_speed_kmh = Column(Float, default=10.0)
    humidity_pct = Column(Float, default=50.0)
    forecast_24h = Column(String, default="CLEAR")
    updated_at = Column(DateTime, default=datetime.utcnow)
