# 🛰️ NER-SENTINEL

> **Real-Time Emergency Logistics & Intelligent Routing Platform**
> *Built for Northeast India's complex terrain and disaster-prone environment — Smart India Hackathon.*

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/UI-React%2019-61DAFB?logo=react)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Realtime-Firebase%20Firestore-FFCA28?logo=firebase)](https://firebase.google.com/)
[![FastAPI](https://img.shields.io/badge/Backend-Python%20FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Tailwind](https://img.shields.io/badge/Styling-Tailwind%20CSS%204-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Render](https://img.shields.io/badge/API%20Hosting-Render-46E3B7?logo=render)](https://render.com/)
[![Vercel](https://img.shields.io/badge/Frontend%20Hosting-Vercel-black?logo=vercel)](https://vercel.com/)

---

## 📌 What is NER-SENTINEL?

The Northeastern Region (NER) of India — comprising Assam, Meghalaya, Manipur, Nagaland, Mizoram, Arunachal Pradesh, Tripura, and Sikkim — is one of the world's most geographically complex and disaster-prone areas. Monsoon-driven flash floods, recurring landslides, and steep mountain terrain regularly sever critical supply chains. Life-saving cargo — medicines, food, fuel — routinely fails to reach its destination.

**NER-SENTINEL** is a unified, production-grade, real-time intelligence platform that solves this problem. It combines:

- **Firebase Firestore** as the central, zero-latency synchronization spine between field drivers and command centers.
- **A Python/FastAPI AI routing engine** to compute optimal, disaster-aware road paths via real NER highway corridors (NH27, NH15, NH6, NH2, etc.).
- **A 5-factor risk scoring algorithm** that evaluates every road segment in real time against weather, rainfall, slope, incidents, and traffic.
- **A look-ahead autonomous reroute engine** that silently monitors the route ahead and diverges the vehicle before it enters a hazard zone.
- **Live weather & earthquake data integration** via Open-Meteo and USGS APIs.
- **A multi-language Command Center & Driver Portal** accessible in English, Hindi, Assamese, and Bengali.

---

## 🗂️ Repository Structure

```
NER-SENTINEL/
├── backend/                  # Python FastAPI microservice (deployed on Render)
│   ├── main.py               # App entry point — registers all API routes, seeds DB on startup
│   ├── routing.py            # Real-road routing engine (OSRM + NER highway corridors)
│   ├── risk_engine.py        # 5-factor composite risk scoring for road segments
│   ├── weather.py            # Weather data ingestion (OpenWeatherMap + simulated fallback)
│   ├── simulation.py         # Disaster simulation & what-if scenario engine
│   ├── supply.py             # Supply chain shortage prediction & pre-positioning logic
│   ├── copilot.py            # AI Copilot: natural-language query router over real DB data
│   ├── models.py             # SQLAlchemy ORM models (Vehicle, Incident, Warehouse, etc.)
│   ├── database.py           # SQLite database engine & session factory
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── requirements.txt      # Python dependencies
│   └── render.yaml           # Render.com deployment config (at repo root)
│
├── frontend/                 # Next.js 16 / React 19 app (deployed on Vercel)
│   ├── pages/                # Next.js file-based routing
│   │   ├── index.tsx         # Landing page / portal selector
│   │   ├── command/          # Logistics Command Center dashboard
│   │   ├── driver/           # Driver Portal (mobile-responsive)
│   │   ├── admin/            # Admin panel
│   │   ├── district/         # District-level dashboard
│   │   ├── logistics/        # Logistics management views
│   │   └── field/            # Field officer interface
│   ├── components/
│   │   ├── CommandMap.tsx    # Master GIS map with all overlays (Leaflet)
│   │   ├── DriverRouteMap.tsx# Driver navigation & simulation map
│   │   ├── SimulationMap.tsx # Route simulation with animated truck movement
│   │   ├── AIRerouteEngine.ts# Look-ahead hazard detection & auto-reroute logic
│   │   ├── AICopilot.tsx     # Natural-language query chatbot UI
│   │   ├── DisasterSim.tsx   # Disaster scenario simulator panel
│   │   ├── WhatIfSimulator.tsx # What-if road closure analysis
│   │   ├── RiskForecast.tsx  # Predictive risk heatmap component
│   │   ├── SOSPanel.tsx      # SOS alerts management panel
│   │   ├── SupplyPanel.tsx   # Supply chain status & shortage display
│   │   ├── WeatherWidget.tsx # Live weather conditions widget
│   │   ├── LiveMap.tsx       # Real-time Firebase-driven vehicle map
│   │   ├── DistrictScorePanel.tsx # District accessibility scores
│   │   ├── LanguageSwitcher.tsx   # i18n language toggle
│   │   └── VehiclePanel.tsx  # Vehicle details sidebar
│   ├── lib/
│   │   ├── firebase.ts       # Firebase app initialization (singleton)
│   │   └── firebaseRealtimeSync.ts # All Firestore CRUD & onSnapshot hooks
│   └── utils/                # Helper utilities
│
├── render.yaml               # Render.com deployment manifest
├── docker-compose.yml        # Optional local PostgreSQL/PostGIS container
└── ARCHITECTURE.md           # Deep-dive algorithm blueprints
```

---

## 🏗️ Full System Architecture

NER-SENTINEL operates on a **Decoupled, Event-Driven, Pub/Sub Architecture** with three distinct layers that each have clear responsibilities and communicate over well-defined interfaces.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│                                                                     │
│  ┌──────────────────────┐      ┌───────────────────────────────┐   │
│  │   Command Center     │      │       Driver Portal           │   │
│  │   (Desktop/Web)      │      │   (Mobile-Responsive Web)     │   │
│  │                      │      │                               │   │
│  │ • Master GIS Map     │      │ • Live GPS Tracking           │   │
│  │ • Weather Overlays   │      │ • Route Simulation            │   │
│  │ • SOS Alerts Feed    │      │ • Look-Ahead Hazard Detect    │   │
│  │ • Supply Dashboard   │      │ • SOS Panic Button            │   │
│  │ • AI Copilot Chat    │      │ • Local Weather Widget        │   │
│  │ • Disaster Sim Panel │      │ • Multi-language UI           │   │
│  └──────────┬───────────┘      └──────────────┬────────────────┘   │
└─────────────│────────────────────────────────│───────────────────┘
              │                                │
              │    onSnapshot (push)           │  setDoc / addDoc (push)
              ▼                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│               REAL-TIME SYNC LAYER (Firebase Firestore)             │
│                                                                     │
│   Collection: vehicles       → GPS lat/lng, speed, status          │
│   Collection: sos_alerts     → Emergency SOS with coordinates       │
│   Collection: active_routes  → Safe route polylines currently used  │
│   Collection: reroute_events → History of dynamic reroute actions  │
│   Collection: supply_items   → Cargo inventory & priority state     │
│                                                                     │
│   Firebase SDK handles: offline persistence, retry, ordering        │
└─────────────────────────────────────────────────────────────────────┘
              │
              │  REST HTTP (fetch on demand)
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 COMPUTE LAYER (Python FastAPI on Render)            │
│                                                                     │
│   main.py          → Registers all routes, seeds SQLite DB          │
│   routing.py       → OSRM + NER highway corridor routing            │
│   risk_engine.py   → 5-factor composite risk scoring                │
│   weather.py       → OpenWeatherMap API + simulated fallback        │
│   simulation.py    → Disaster & what-if scenario engine             │
│   supply.py        → Shortage prediction & pre-positioning          │
│   copilot.py       → NL query router over real SQLite data          │
│   database.py      → SQLAlchemy/SQLite session management           │
└─────────────────────────────────────────────────────────────────────┘
              │
              │  HTTP GET (fire-and-forget, no auth)
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL DATA APIS                             │
│                                                                     │
│   Open-Meteo API   → Free, no-auth hyperlocal weather (WMO codes)  │
│   USGS Earthquake  → Real-time GeoJSON disaster feeds               │
│   OSRM Public API  → OpenStreetMap real-road route geometry         │
│   OpenStreetMap    → Map tile rendering (via Leaflet)               │
│   OpenTopoMap      → Terrain tile rendering (satellite-like view)   │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Principle: Firebase is the Spine

The frontend does **not** call the Python backend for real-time data. Instead:

1. The **Driver Portal** writes GPS data directly to Firestore (`setDoc` on `vehicles/{vehicleId}`).
2. The **Command Center** holds a persistent `onSnapshot` listener on every Firestore collection.
3. When the driver's GPS coordinates change, Firestore **pushes** the update to the Command Center within milliseconds — no polling, no REST endpoint, no server roundtrip.
4. The **Python backend** is called only for computationally expensive, stateless operations: generating a polyline route, calculating segment risk scores, or running a disaster simulation. These are one-shot HTTP requests.

This hybrid design means Firebase provides the real-time communication bus, while the Python service provides the heavy compute without blocking the UI.

---

## 🛠️ Complete Tech Stack

### Frontend — Client Layer

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16.3.4 | React framework with file-based routing, SSR/SSG, and `NEXT_PUBLIC_*` env injection |
| **React** | 19.2.8 | UI component model; all state managed with hooks, no Redux |
| **TypeScript** | 5.x | Full type safety across components and Firebase document interfaces |
| **Tailwind CSS** | 4.x | Utility-first styling with a custom White/Red design system using CSS custom properties |
| **Leaflet** | 1.9.4 | Lightweight, open-source GIS mapping engine |
| **react-leaflet** | 5.0.0 | React wrapper for Leaflet; used for `MapContainer`, `TileLayer`, `Polyline`, `Marker`, `Circle` |
| **Firebase SDK** | 12.19.0 | Firestore `onSnapshot`, `setDoc`, `addDoc`, `updateDoc`, `serverTimestamp` |
| **i18next** | 26.4.2 | Internationalization framework |
| **react-i18next** | 17.0.14 | React hooks (`useTranslation`) for i18n |
| **i18next-browser-languagedetector** | 8.2.1 | Detects user locale from browser settings |
| **Satoshi Font** | — | Clean, modern typography loaded from Fontshare CDN |

**Map Tiles Used:**
- `OpenStreetMap` — Standard street-level detail (`tile.openstreetmap.org`)
- `OpenTopoMap` — Terrain/elevation-aware tiles for mountain terrain visualization (`tile.opentopomap.org`)

---

### Backend — Compute Layer

| Technology | Version | Purpose |
|---|---|---|
| **Python** | 3.11.9 | Runtime (pinned in Render via `PYTHON_VERSION` env var) |
| **FastAPI** | 0.103.1 | High-performance ASGI web framework for REST API |
| **Uvicorn** | 0.23.2 | ASGI server; runs the FastAPI app in production |
| **SQLAlchemy** | 2.0.20 | ORM for all database models (Vehicle, Incident, Warehouse, etc.) |
| **Pydantic** | 2.3.0 | Request/response validation via typed schemas |
| **httpx** | 0.25.0 | Async HTTP client for weather API calls |
| **networkx** | 3.1 | Graph data structure for route planning and road network analysis |
| **SQLite** | (stdlib) | Embedded file-based database (`logistics.db`); zero-configuration, included in the repo |
| **aiofiles** | 23.2.1 | Async file I/O utilities |

**CORS:** Configured with `allow_origins=["*"]` so the Vercel-hosted frontend can freely call the Render-hosted API without browser origin blocking.

---

### Database — Two-Database Design

NER-SENTINEL uses two databases for two entirely different purposes:

| Database | Technology | Hosted On | Purpose |
|---|---|---|---|
| **Operational Store** | Firebase Firestore (NoSQL) | Google Firebase Cloud | Real-time GPS sync, SOS alerts, active routes, supply state — anything that changes in seconds |
| **Intelligence Store** | SQLite (Relational) | Render (file on disk) | Vehicles, incidents, warehouses, road segments, districts — structured data queried by the risk engine and copilot |

This split allows Firebase to handle the extremely high write frequency of GPS tracking (every 5 seconds per vehicle) without degrading the analytical queries that the copilot and risk engine run against the SQLite store.

---

### Infrastructure & Hosting

| Service | Provider | What it hosts |
|---|---|---|
| **Frontend** | [Vercel](https://vercel.com) | Next.js app; auto-deploys on every `git push` to `main` |
| **Python API** | [Render](https://render.com) | FastAPI + Uvicorn server (`render.yaml` in repo root) |
| **Firestore** | [Firebase](https://firebase.google.com) | Real-time NoSQL database; managed by Google |
| **Map Tiles** | OpenStreetMap / OpenTopoMap | Publicly hosted tile servers; no API key needed |
| **Weather Data** | Open-Meteo | Free, no-authentication weather API |
| **Disaster Data** | USGS | Free, public GeoJSON earthquake feeds |

---

## ⚙️ How Vercel, Render, and Firebase Work Together

Understanding the three-way interaction is key to understanding the whole system.

### 1. Vercel (Frontend Host)

Vercel builds and serves the **Next.js frontend**. When you push code to GitHub:
- Vercel automatically detects the repository.
- It runs `npm run build --webpack` inside the `frontend/` root directory.
- The built static assets and serverless pages are deployed to Vercel's global CDN.
- Vercel injects all `NEXT_PUBLIC_*` environment variables at build time. This means Firebase credentials and the Render API URL are baked into the JavaScript bundle that the browser downloads — they are public-facing values, not secrets.

**At runtime**, the browser-side JavaScript makes two types of outbound connections:
- **To Firebase Firestore** — directly, using the Firebase JS SDK. This is a persistent WebSocket/HTTP/2 connection that Firestore maintains for `onSnapshot` subscriptions.
- **To the Render API** — standard `fetch()` REST calls for route generation and risk data.

Vercel itself is **not involved** after the initial page load. The frontend is a pure client-side app that communicates directly with Firebase and Render.

---

### 2. Firebase Firestore (Real-Time Sync)

Firebase Firestore is the **message bus** between the Driver Portal and the Command Center. Here is the exact data flow:

```
Driver Portal (browser)
   │
   │  navigator.geolocation.watchPosition()
   │  ↓ GPS lat/lng every 5 seconds
   │
   └──► setDoc(doc(db, 'vehicles', vehicleId), { lat, lng, speed, ... })
            │
            │  Firestore Cloud replicates document update
            │
            ▼
   Command Center (browser)
   onSnapshot(collection(db, 'vehicles'), snapshot => {
     // Called immediately on change — no polling
     snapshot.docChanges().forEach(change => {
       updateMarkerOnMap(change.doc.data());
     });
   })
```

**Firestore Collections and their schemas:**

| Collection | Document Fields | Written By | Read By |
|---|---|---|---|
| `vehicles` | `driverName`, `lat`, `lng`, `speed`, `heading`, `status`, `priority`, `payloadType`, `destinationLat/Lng`, `updatedAt` | Driver Portal | Command Center |
| `sos_alerts` | `vehicleId`, `driverName`, `lat`, `lng`, `message`, `severity`, `resolved`, `createdAt` | Driver Portal (SOS button) | Command Center |
| `active_routes` | `vehicleId`, `segments[]` (lat/lng/risk/color), `totalRiskScore`, `estimatedTimeMin`, `rerouteFlag`, `updatedAt` | Driver Portal (after route fetch) | Command Center |
| `reroute_events` | `vehicleId`, `reason`, `oldRouteSummary`, `newRouteSummary`, `triggeredAt` | AIRerouteEngine (client-side) | Command Center |
| `supply_items` | `name`, `category`, `quantity`, `unit`, `priority`, `assignedVehicleId`, `status`, `updatedAt` | Admin Portal | Command Center, Driver Portal |

**Firebase SDK features used:**
- `onSnapshot` — persistent real-time listener (WebSocket-based push, not polling).
- `setDoc` — creates or fully overwrites a document (used for GPS updates — idempotent by vehicle ID).
- `addDoc` — appends a new document with auto-ID (used for SOS alerts and reroute events).
- `updateDoc` — partial field update (used when admin resolves an SOS).
- `serverTimestamp()` — uses Firebase's server-side time to avoid clock skew between devices.
- `query`, `where`, `orderBy`, `limit` — compound queries for fetching recent alerts or events.
- Exponential-backoff retry wrapper (`withRetry`) wraps all write operations for resilience.

---

### 3. Render (Python API Host)

Render hosts the **stateless Python FastAPI backend**. It is deployed via `render.yaml` at the repository root:

```yaml
services:
  - type: web
    name: ner-sentinel-backend
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: PYTHON_VERSION
        value: "3.11.9"
```

On every `git push` to `main`, Render:
1. Checks out the repo.
2. Changes directory into `backend/`.
3. Runs `pip install -r requirements.txt`.
4. Starts `uvicorn main:app --host 0.0.0.0 --port $PORT` (Render injects `$PORT` automatically).

On **startup**, `main.py` runs a seeding function that populates the SQLite database with realistic sample vehicles, incidents, warehouses, road segments, and districts for NER — so the system is fully functional the moment it boots, without any manual data entry.

**Key API endpoints exposed by the Python service:**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/weather` | Returns live/simulated weather for all 6 NER zones |
| `GET` | `/api/vehicles` | Returns all vehicles with current status and GPS |
| `GET` | `/api/incidents` | Returns all active hazard incidents |
| `GET` | `/api/road-segments` | Returns all road segments with risk scores |
| `GET` | `/api/districts` | Returns all districts with accessibility scores |
| `GET` | `/api/warehouses` | Returns all warehouses with stock levels |
| `POST` | `/api/route` | Computes dual Route A (shortest) + Route B (safest) polylines |
| `POST` | `/api/risk/segment` | Calculates real-time composite risk for a road segment |
| `POST` | `/api/simulation/disaster` | Runs a what-if disaster scenario across the network |
| `POST` | `/api/simulation/whatif` | Simulates closing a specific road segment |
| `POST` | `/api/chat` | AI Copilot: natural-language query → structured DB answer |
| `POST` | `/api/vehicles/{id}/sos` | Broadcasts an SOS from a vehicle |
| `GET` | `/api/supply/status` | Returns warehouse shortage predictions |
| `GET` | `/api/supply/recommendations` | Returns pre-positioning recommendations |
| `GET` | `/api/fuel-stations` | Returns nearby fuel stations along a route |

---

## 🧠 Core Algorithms Explained

### Algorithm 1: The 5-Factor Composite Risk Score

Every road segment in the system carries a live risk score between 0 (completely safe) and 100 (impassable). The `RiskEngine` in `risk_engine.py` calculates this by combining five independent factors:

```
Total Risk Score = min(100,
    Rainfall Factor   (0–25)   ← Live mm/hr from OpenWeatherMap or simulated
  + Slope Factor      (0–20)   ← Static, encoded at seed time based on terrain
  + Incident Factor   (0–30)   ← Nearby severity-3+ incidents (landslides, floods)
  + Traffic Factor    (0–10)   ← Deterministic per-segment pseudo-random (demo)
  + Road Condition    (0–15)   ← Static road quality score (higher = worse)
)
```

**Risk Label Thresholds:**
- `> 60` → **HIGH** (🔴 Red) — rerouting recommended
- `> 30` → **MODERATE** (🟡 Yellow) — proceed with caution
- `≤ 30` → **LOW** (🟢 Green) — normal passage

**Rainfall to risk factor conversion** (from `weather.py`):

| Rainfall (mm/hr) | Risk Factor |
|---|---|
| 0 | 0 |
| 1–5 | 5 |
| 5–15 | 10 |
| 15–30 | 15 |
| 30–50 | 20 |
| > 50 | 25 |

**Incident Factor logic:** For each road segment, the engine queries all incidents within a geographic proximity. Each severity-3+ incident adds 10 points; lower-severity incidents add 5 points each, capped at 30 total.

---

### Algorithm 2: OSRM-Backed Real-Road Routing

The `LogisticsRouter` in `routing.py` does NOT use straight-line or Dijkstra on a custom graph. It calls the **OSRM public API** (`router.project-osrm.org`) to get actual road-following polylines:

```
GET https://router.project-osrm.org/route/v1/driving/{lng_start},{lat_start};{lng_end},{lat_end}
    ?overview=full&geometries=geojson&steps=false
```

OSRM returns a GeoJSON `LineString` of coordinates that follow actual National Highways. This polyline is then fed into the risk engine — each segment's midpoint is mapped to the nearest weather zone, and a risk score is computed.

**Dual-Route Strategy:**
- **Route A (Direct):** Shortest OSRM path between origin and destination.
- **Route B (Safe):** An alternate OSRM path computed via a manually curated bypass waypoint for the known NER corridor. The system selects a waypoint from a hardcoded set of `NAMED_CORRIDORS` (e.g., Guwahati → Tezpur via NH27 South Bank instead of NH15 North Bank).

**Fallback:** If the OSRM API is unreachable (timeout), the router falls back to interpolating a smooth Bézier-like curve between the start and end coordinates using the curated `NAMED_CORRIDORS` waypoints stored in memory.

---

### Algorithm 3: Look-Ahead Autonomous Reroute Engine

The `AIRerouteEngine` (in `components/AIRerouteEngine.ts`) runs entirely on the **client side** in the Driver Portal. It implements a frame-driven look-ahead strategy:

```
Route Polyline: [P0, P1, P2, ..., Pn]
Current Driver Position: Pk

Every 3rd animation frame:
  Look-ahead target = P(k + LOOK_AHEAD_STEPS)   // default: 10 steps ahead

  1. Compute midpoint of look-ahead segment.
  2. Call Open-Meteo API at that coordinate:
     GET https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...
         &current_weather=true&hourly=precipitation,windspeed_10m
  3. Parse WMO weather code → Risk Factor (Wc):
     Clear=0.0, Drizzle=0.3, Rain=0.6, Storm=1.0
  4. Normalize precipitation (Pr) and wind speed (Ws).
  5. Compute Risk R = (Wc × 0.4) + (Pr × 0.3) + (Ws × 0.2) + (Eq × 0.1)

  If R > REROUTE_THRESHOLD (0.65):
    a. HALT vehicle animation.
    b. POST /api/route with { origin: Pk, destination: Pn, avoid: [midpoint] }
    c. Splice new route into active state.
    d. Write RerouteEvent to Firebase 'reroute_events' collection.
    e. Show orange toast: "⚠️ Route altered due to severe weather ahead."
```

**Haversine Formula** (used for all geographic distance calculations throughout the system):

```
d = 2R × arcsin( √[ sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlng/2) ] )
```

Where R = 6371 km (Earth's mean radius). This formula accurately accounts for the spherical surface of the Earth, critical for the long distances involved across Northeast India.

---

### Algorithm 4: District Accessibility Score

The `RiskEngine.calculate_district_accessibility()` method computes a 0–100 score for each district based on how passable its road network is:

```
Accessibility Score = 100
  - (avg_segment_risk × 0.4)    // Average risk of all road segments in district
  - blocked_penalty              // 15 pts per blocked segment, capped at 40
  - incident_penalty             // 5 pts per severity-4/5 incident, 2 pts for others, capped at 30

Clamped to [0, 100]
```

---

### Algorithm 5: Supply Shortage Prediction

The `supply.py` module models each warehouse's cargo as depleting at a fixed rate per hour under disaster conditions, then predicts how many hours until critical shortage:

```
Hours to Shortage = current_stock_pct / depletion_rate_per_hour

Depletion rates (% per hour):
  Medicine:  2.0%/hr  (fastest — critical during disaster)
  Food:      1.5%/hr
  Fuel:      2.5%/hr  (fastest overall due to generator demand)
  Equipment: 0.8%/hr
```

Any warehouse below 40% stock triggers a shortage warning with urgency classification:
- `< 12h` → **URGENT**
- `< 24h` → **HIGH PRIORITY**
- `≥ 24h` → **MONITOR**

---

## 🌟 Key Features In Depth

### ⚡ Command Center Dashboard
A full-screen, desktop-optimized logistics operations center:
- **Master GIS Map** (`CommandMap.tsx`): Renders all tracked vehicles as colored Leaflet markers (🔴 Critical, 🟡 High, 🟢 Normal). Color updates live via `onSnapshot`.
- **Weather Overlay**: Purple storm circles, blue rain circles, yellow wind circles rendered on the map using Open-Meteo data for the 6 NER monitoring zones.
- **Earthquake Overlay**: Orange triangular markers for USGS-reported earthquakes above magnitude 3.5 within 500 km.
- **SOS Alert Feed** (`SOSPanel.tsx`): Pulsing red alerts from the `sos_alerts` Firestore collection, with one-click resolution.
- **AI Copilot** (`AICopilot.tsx`): Natural-language chat interface backed by `copilot.py`. Ask "Which vehicles are delayed?" or "Which warehouses are at risk?" — the copilot resolves the intent to a structured SQL query and returns a formatted response.
- **Disaster Simulation** (`DisasterSim.tsx`): Inject a rainfall event at any intensity level. The simulation engine (`simulation.py`) cascades the impact across all vehicles, road segments, and districts in real time.
- **What-If Simulator** (`WhatIfSimulator.tsx`): Close any specific road segment and immediately see which vehicles are affected, what alternate routes exist, and what the downstream supply impact is.
- **Supply Panel** (`SupplyPanel.tsx`): Live warehouse stock levels with predicted hours to shortage and pre-positioning recommendations.
- **District Score Panel** (`DistrictScorePanel.tsx`): Accessibility scores for all NER districts, color-coded from green (accessible) to red (cut off).

---

### 🚚 Driver Portal
A mobile-first interface for logistics field operators:
- **GPS Tracking**: Uses `navigator.geolocation.watchPosition()` to continuously track the driver's real-world GPS coordinates and write them to the `vehicles` Firestore document every 5 seconds.
- **Route Simulation** (`SimulationMap.tsx`): Select an origin and destination city from a curated list of NER locations. The frontend calls `POST /api/route` on the Render backend, receives both Route A and Route B polylines, and animates a truck icon along the path using `requestAnimationFrame`.
- **Look-Ahead Rerouting** (`AIRerouteEngine.ts`): The autonomous reroute engine runs in the background during simulation, scanning 10 waypoints ahead for weather hazards.
- **Emergency SOS**: A large, unmissable red button. When pressed, it writes a document to the `sos_alerts` Firestore collection with the current GPS coordinates, driver name, and severity level. The Command Center `onSnapshot` listener picks this up within 1–2 seconds.
- **Local Weather Widget** (`WeatherWidget.tsx`): Fetches Open-Meteo weather for the driver's current GPS location and displays temperature, condition, and precipitation.
- **Multi-Language UI**: The entire portal interface switches between English, Hindi (हिंदी), Assamese (অসমীয়া), and Bengali (বাংলা) via the `LanguageSwitcher` component.

---

### 🌐 Internationalization (i18n) Architecture
Language support is implemented via `i18next` with the `react-i18next` bridge. Translation JSON files are loaded from the `frontend/lib/i18n/` directory. The `i18next-browser-languagedetector` plugin automatically detects the user's browser locale on first load. The `LanguageSwitcher` component allows manual override, and the selection is persisted to `localStorage`.

---

## 🗄️ Database Schema

### SQLite (Intelligence Store — Python Backend)

```
vehicles
├── id, driver_name, status (EN_ROUTE/DELAYED/IDLE/COMPLETED)
├── payload_type, priority (Critical/High/Medium/Normal)
├── lat, lng, speed_kmh, eta_hours
├── destination_name, destination_lat, destination_lng
├── origin_name, cargo_weight_kg, capacity_kg, current_load_pct
└── → shipments (one-to-many)

incidents
├── id, incident_type (LANDSLIDE/FLOOD/ROAD_DAMAGE/BRIDGE_DAMAGE/WEATHER)
├── severity (1–5), verified, lat, lng
├── description, photo_url, voice_note_url
├── source (FIELD_OFFICER/DRIVER/SYSTEM/AI)
└── confidence_pct, created_at, report_count

warehouses
├── id, name, district, lat, lng
└── medicine_stock_pct, food_stock_pct, fuel_stock_pct, equipment_stock_pct

shipments
├── id, vehicle_id (FK → vehicles)
├── cargo_type, priority, origin, destination
├── eta_hours, status (ON_TIME/DELAYED/AT_RISK/DELIVERED)
└── weight_kg, description

road_segments
├── id, name, start_lat/lng, end_lat/lng
├── district, length_km
├── slope_risk (0–20), road_condition_score (0–15)
├── is_critical_corridor, dependent_districts
├── current_risk_score (0–100), risk_label (LOW/MODERATE/HIGH)
├── rainfall_factor, incident_factor, traffic_factor
└── blocked (boolean)

districts
├── id, name, accessibility_score
├── active_incidents_count, blocked_routes_count
├── critical_routes_count, weather_risk
└── population

weather_zones
├── id, zone_name, lat, lng
├── temperature_c, rainfall_mm_hr
├── condition (CLEAR/CLOUDY/RAINY/HEAVY_RAIN/STORM)
├── wind_speed_kmh, humidity_pct
└── forecast_24h, updated_at
```

### Firestore (Real-Time Store — Firebase)

```
vehicles/{vehicleId}
  driverName: string
  lat: number, lng: number
  speed: number, heading: number, accuracy?: number
  status: 'online' | 'offline' | 'en-route' | 'stopped'
  priority: 'HIGH' | 'MODERATE' | 'LOW'
  payloadType: string
  destinationName: string, destinationLat: number, destinationLng: number
  currentLoadPct: number
  updatedAt: Timestamp

sos_alerts/{alertId}
  vehicleId: string, driverName: string
  lat: number, lng: number
  message: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  resolved: boolean
  createdAt: Timestamp

active_routes/{vehicleId}
  segments: Array<{ lat, lng, risk: number, color: string }>
  totalRiskScore: number, estimatedTimeMin: number
  rerouteFlag: boolean
  updatedAt: Timestamp

reroute_events/{eventId}
  vehicleId: string
  reason: 'weather' | 'disaster' | 'admin'
  oldRouteSummary: string, newRouteSummary: string
  triggeredAt: Timestamp

supply_items/{itemId}
  name: string, category: string
  quantity: number, unit: string
  priority: 'HIGH' | 'MODERATE' | 'LOW'
  assignedVehicleId: string | null
  status: 'pending' | 'in-transit' | 'delivered'
  updatedAt: Timestamp
```

---

## 🔧 Local Development Setup

### Prerequisites
- Node.js 18+
- Python 3.10+
- A Firebase Project with Firestore (Native mode) enabled

### Frontend Setup

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env.local
# Fill in your Firebase credentials and set:
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
# → http://localhost:3000
```

### Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000
# → Swagger docs at http://localhost:8000/docs
```

The backend auto-creates and seeds `logistics.db` (SQLite) on first run. No database migration commands are needed.

### Environment Variables

| Variable | Where Used | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Frontend (Vercel) | Firebase project API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Frontend (Vercel) | `<project>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Frontend (Vercel) | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Frontend (Vercel) | `<project>.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Frontend (Vercel) | Numeric sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Frontend (Vercel) | Firebase app ID |
| `NEXT_PUBLIC_API_URL` | Frontend (Vercel) | Full URL of the Render backend (e.g., `https://ner-sentinel-api.onrender.com`) |
| `NEXT_PUBLIC_MAPPLS_KEY` | Frontend (optional) | MapMyIndia/Mappls key for alternate map tiles |
| `OPENWEATHER_KEY` | Backend (Render, optional) | OpenWeatherMap API key — falls back to simulated data if absent |
| `PYTHON_VERSION` | Render | Pins Python runtime to `3.11.9` |

---

## 🔄 End-to-End Data Flow: A Delivery Under Flash Flood

Here is the complete, step-by-step journey of data through the system during a real emergency:

1. **Driver opens Driver Portal** → React app loads from Vercel CDN. Firebase SDK authenticates with Firestore using the `NEXT_PUBLIC_FIREBASE_*` credentials.

2. **Driver selects route** (Guwahati → Tezpur) → Frontend calls `POST /api/route` on the Render backend. `routing.py` hits the OSRM API for a real NH15 polyline. The backend evaluates risk per segment using `risk_engine.py` and returns both Route A and Route B with color-coded segments.

3. **Simulation starts** → Frontend stores the polyline. `SimulationMap.tsx` animates a truck icon frame by frame using `requestAnimationFrame`.

4. **GPS tracking begins** → `navigator.geolocation.watchPosition()` fires every 5 seconds. `firebaseRealtimeSync.ts` calls `setDoc(doc(db, 'vehicles', vehicleId), { lat, lng, speed, updatedAt: serverTimestamp() })`.

5. **Command Center updates** → The Command Center's `onSnapshot` listener on the `vehicles` collection fires immediately. The truck marker on `CommandMap.tsx` moves to the new GPS position. No REST call is made.

6. **Weather deteriorates ahead** → `AIRerouteEngine.ts` scans 10 waypoints ahead every 3 frames. It calls Open-Meteo for that future coordinate. Rainfall of 62 mm/hr is detected. Risk score = 0.78 → exceeds 0.65 threshold.

7. **Auto-reroute triggered** → Engine calls `POST /api/route` with the hazard zone marked to avoid. New Route B is returned. The polyline in state is spliced at the current position. `addDoc(collection(db, 'reroute_events'), { ... })` is written to Firestore.

8. **Dual notification fires** → Driver sees orange toast: *"⚠️ Route altered due to severe weather ahead."* Command Center's `onSnapshot` on `reroute_events` triggers. The truck's drawn path on the master map instantly redraws to the new safe route.

9. **Physical landslide occurs** → Driver presses SOS. `addDoc(collection(db, 'sos_alerts'), { lat, lng, severity: 'CRITICAL', resolved: false, createdAt: serverTimestamp() })` is written.

10. **Command Center receives SOS in < 2 seconds** → `onSnapshot` on `sos_alerts` fires. `SOSPanel.tsx` renders a pulsing red alert. The map drops a red circle at the driver's GPS coordinates. Admin clicks "Resolve" → `updateDoc` sets `resolved: true`.

---

## 🛡️ License & Acknowledgements

Developed for the **Smart India Hackathon (SIH)**.

Special thanks to:
- [OpenStreetMap](https://www.openstreetmap.org/) — Map tile infrastructure
- [Open-Meteo](https://open-meteo.com/) — Free, open weather API
- [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/) — Real-time disaster feeds
- [OSRM](https://project-osrm.org/) — Open Source Routing Machine
- [Firebase](https://firebase.google.com/) — Real-time database infrastructure
- [Vercel](https://vercel.com/) — Frontend deployment platform
- [Render](https://render.com/) — Backend deployment platform
