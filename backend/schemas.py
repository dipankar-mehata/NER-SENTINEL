"""
Pydantic v2 request / response schemas for NER-SENTINEL API.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Union


# ---------------------------------------------------------------------------
# Vehicle schemas
# ---------------------------------------------------------------------------

class VehicleUpdate(BaseModel):
    """Payload to update a vehicle's real-time GPS position and status."""
    lat: float = Field(..., description="Current latitude")
    lng: float = Field(..., description="Current longitude")
    status: Optional[str] = Field(None, description="EN_ROUTE / DELAYED / IDLE / COMPLETED")
    speed_kmh: Optional[float] = Field(None, description="Current speed in km/h")


# ---------------------------------------------------------------------------
# Incident schemas
# ---------------------------------------------------------------------------

class IncidentCreate(BaseModel):
    """Payload to report a new field incident."""
    incident_type: str = Field(
        ...,
        description="LANDSLIDE / FLOOD / ROAD_DAMAGE / BRIDGE_DAMAGE / TRAFFIC / VEHICLE_BREAKDOWN / WEATHER",
    )
    severity: Union[int, str] = Field(..., description="Severity 1-5 or LOW / MEDIUM / HIGH")
    lat: float
    lng: float
    description: str = Field(default="", description="Free-text description")
    source: str = Field(default="FIELD_OFFICER", description="FIELD_OFFICER / DRIVER / SYSTEM / AI")
    photo_url: str = Field(default="")
    voice_note_url: str = Field(default="")
    confidence_pct: int = Field(default=80, ge=0, le=100)

    @field_validator("severity", mode="before")
    @classmethod
    def parse_severity(cls, v):
        if isinstance(v, str):
            v_upper = v.strip().upper()
            mapping = {"LOW": 1, "MED": 3, "MEDIUM": 3, "HIGH": 5, "CRITICAL": 5}
            if v_upper in mapping:
                return mapping[v_upper]
            try:
                val = int(v_upper)
                return max(1, min(5, val))
            except ValueError:
                return 3
        if isinstance(v, (int, float)):
            return max(1, min(5, int(v)))
        return 3

    @field_validator("incident_type", mode="before")
    @classmethod
    def parse_incident_type(cls, v):
        if isinstance(v, str):
            clean = v.strip().upper().replace(" ", "_")
            return clean
        return "LANDSLIDE"


# ---------------------------------------------------------------------------
# Route schemas
# ---------------------------------------------------------------------------

class RouteRequest(BaseModel):
    """Request dual safe-route calculation between two coordinates."""
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float


# ---------------------------------------------------------------------------
# Shipment schemas
# ---------------------------------------------------------------------------

class ShipmentCreate(BaseModel):
    """Payload to create a new shipment record."""
    vehicle_id: Optional[int] = Field(None, description="Assigned vehicle ID (optional)")
    cargo_type: str = Field(..., description="Medicine / Food / Fuel / Equipment")
    priority: str = Field(default="Normal", description="Critical / High / Medium / Normal")
    origin: str
    destination: str
    eta_hours: float = Field(default=0.0)
    weight_kg: float = Field(default=0.0)
    description: str = Field(default="")


# ---------------------------------------------------------------------------
# Simulation schemas
# ---------------------------------------------------------------------------

class SimulationRequest(BaseModel):
    """Disaster scenario parameters for the simulation engine."""
    rainfall_intensity: float = Field(
        default=50.0,
        ge=0.0,
        le=100.0,
        description="Rainfall intensity (mm/hr scale 0-100)",
    )
    blocked_roads_count: int = Field(
        default=2,
        ge=0,
        description="Number of road segments to simulate as blocked",
    )
    traffic_level: float = Field(
        default=50.0,
        ge=0.0,
        le=100.0,
        description="Traffic congestion level 0-100",
    )
    supply_demand_multiplier: float = Field(
        default=1.5,
        ge=1.0,
        description="Demand surge multiplier",
    )


class WhatIfRequest(BaseModel):
    """Request a what-if closure analysis for a specific road segment."""
    segment_id: int = Field(..., description="ID of the road segment to simulate closing")


# ---------------------------------------------------------------------------
# Chat / Copilot schema
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """Query to the AI logistics copilot."""
    query: str = Field(..., min_length=1, description="Natural-language query")


# ---------------------------------------------------------------------------
# SOS & Emergency schemas
# ---------------------------------------------------------------------------

class SOSBroadcastRequest(BaseModel):
    """Payload when a driver hits Emergency SOS to alert nearby vehicles and report disaster."""
    driver_name: str = Field(default="Driver", description="Driver reporting the emergency")
    vehicle_id: Optional[int] = Field(default=None, description="Vehicle ID if assigned")
    lat: float = Field(..., description="Current latitude of the vehicle")
    lng: float = Field(..., description="Current longitude of the vehicle")
    disaster_type: str = Field(
        default="LANDSLIDE",
        description="LANDSLIDE / FLASH_FLOOD / ROAD_COLLAPSE / VEHICLE_STRANDED / MEDICAL / SEVERE_STORM",
    )
    severity: Union[int, str] = Field(default="HIGH", description="Severity 1-5 or HIGH / CRITICAL")
    description: str = Field(default="", description="Emergency description / voice note transcript")
    radius_km: float = Field(default=50.0, description="Broadcast radius in kilometers")


class FuelStationResponse(BaseModel):
    """Fuel station information along highway corridors."""
    id: str
    name: str
    brand: str
    lat: float
    lng: float
    fuels: list[str]
    is_24x7: bool
    def_available: bool
    contact: str
    distance_km: Optional[float] = None

