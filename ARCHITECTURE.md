# NER-SENTINEL: Architecture & Algorithm Blueprint

This document outlines the deep technical architecture, technology stack, algorithmic blueprints, and the step-by-step working mechanism of the NER-SENTINEL emergency logistics system.

---

## 1. 🛠️ Detailed Tech Stack

### Frontend (Client Layer)
* **Framework:** Next.js 16.3 (React 19)
* **Styling:** Tailwind CSS 4 (Custom White/Red design system, CSS custom properties)
* **GIS & Mapping:** Leaflet 1.9 (`react-leaflet` v5) with OpenStreetMap (OSM) and OpenTopoMap tiles.
* **Localization:** `i18next` & `react-i18next` (English, Hindi, Assamese, Bengali).
* **State Management:** React Hooks + Firebase `onSnapshot` real-time listeners.

### Backend (Compute Layer)
* **Framework:** Python 3.10+, FastAPI
* **Server:** Uvicorn (ASGI server)
* **Purpose:** Handles complex, stateless mathematical routing operations and geographic calculations that are too heavy for the client browser.

### Database & Real-Time Sync Layer
* **Platform:** Firebase Firestore (NoSQL Document Database)
* **Role:** Acts as the central nervous system. Provides zero-latency bi-directional synchronization between field drivers and the Command Center.

### External APIs (Data Ingestion)
* **Weather Data:** Open-Meteo API (Free, no-auth, high-precision local weather).
* **Disaster Data:** USGS Earthquake Hazards Program (Real-time GeoJSON feeds).
* **Routing Geometry:** OSRM (Open Source Routing Machine) / Custom Backend logic.

---

## 2. 🏗️ High-Level System Architecture

The system operates on a **Decoupled Real-Time Pub/Sub Architecture**:

```mermaid
graph TD
    subgraph Client Layer
        DP[Driver Portal / Mobile]
        CC[Command Center / Desktop]
    end

    subgraph Real-Time Sync Layer (Firebase)
        FS[(Firestore Collections)]
        FS -->|vehicles| V_Doc
        FS -->|sos_alerts| SOS_Doc
        FS -->|active_routes| R_Doc
    end

    subgraph Compute Layer (Python)
        FA[FastAPI Routing Engine]
    end

    subgraph External APIs
        OM[Open-Meteo API]
        US[USGS Earthquake API]
    end

    DP -- Pushes GPS & SOS --> FS
    FS -- onSnapshot Updates --> CC
    CC -- Updates Priorities --> FS
    
    DP -- Checks Look-Ahead Weather --> OM
    CC -- Fetches Global Weather/Disaster --> OM & US
    
    DP -- Requests Alternate Path --> FA
    FA -- Returns Polyline Segments --> DP
```

---

## 3. 🧠 Algorithm Blueprints

### A. The 5-Factor Dynamic Risk Algorithm (Hazard Scoring)
Instead of static routes, every road segment is evaluated dynamically. The **`checkSegmentHazard()`** engine calculates a normalized risk score ($R$) between $0.0$ (Safe) and $1.0$ (Impassable).

**Risk Function:**
$R = (W_c \times 0.4) + (P_r \times 0.3) + (W_s \times 0.2) + (E_q \times 0.1)$

* **$W_c$ (Weather Condition Penalty):** Mapped from WMO codes (e.g., Clear=0.0, Fog=0.3, Rain=0.6, Storm=1.0).
* **$P_r$ (Precipitation):** Normalized mm/hr rainfall data.
* **$W_s$ (Wind Speed):** Normalized km/h wind gusts.
* **$E_q$ (Earthquake/Disaster Proximity):** Inverse square distance to nearest active USGS disaster epicenter.

**Threshold Logic:**
If $R > 0.65$ for any segment $n$ steps ahead of the driver, the system triggers the **Reroute Protocol**.

### B. AI Dynamic Rerouting Engine (Look-Ahead Algorithm)
The `SimulationMap` and `AIRerouteEngine` use a "Look-Ahead" strategy to prevent drivers from walking into a trap.

1. **Interpolation:** The route polyline is broken into discrete micro-segments using the Haversine formula.
2. **Frame-by-Frame Execution:** As the vehicle moves (simulated via `requestAnimationFrame` style loops), the engine tracks the `currentIndex`.
3. **Look-Ahead Window:** Every 3rd frame, the engine scans the segment located at `currentIndex + 10`.
4. **Validation:** It hits the Open-Meteo API for that specific future coordinate.
5. **Divergence:** If risk > 0.65, the frontend halts the vehicle, requests a new path from FastAPI (excluding the hazard zone), and splices the new route into the active state.

---

## 4. ⚙️ Step-by-Step Working of the Software

### Scenario: A routine delivery encounters a sudden flash flood.

#### Step 1: Initialization & Route Planning
1. The **Driver** logs into the Driver Portal, selects their origin (e.g., Guwahati) and destination (e.g., Shillong).
2. The portal hits the **Python FastAPI** backend to generate the optimal polyline route.
3. The driver clicks "Start Tracking". The app begins pushing GPS coordinates to the Firebase `vehicles` collection every 5 seconds.

#### Step 2: Command Center Monitoring
1. The **Logistics Manager** sits at the Command Center.
2. Firebase `onSnapshot` hooks detect the new GPS data.
3. The truck marker instantly appears on the Master Leaflet Map. The marker is color-coded by the cargo's priority (e.g., 🔴 High Priority Medical Supplies).

#### Step 3: Hazard Ingestion
1. A severe storm develops halfway along the route.
2. The **Open-Meteo API** updates its grid data.
3. The **Command Center** map automatically renders a purple "Storm" weather circle over the highway.

#### Step 4: Autonomous Look-Ahead & Reroute
1. The Driver's app, constantly scanning ahead, calculates the risk score of the upcoming storm zone. It returns a Risk Score of **0.85**.
2. The risk exceeds the `0.65` threshold.
3. The Driver Portal immediately queries the FastAPI backend for an alternate route that circumvents the storm coordinates.
4. The new route is drawn on the driver's screen.
5. The portal pushes a **Reroute Event** to the Firebase `active_routes` collection.

#### Step 5: Dual Notification
1. **Driver View:** A high-visibility orange toast notification appears: *"⚠️ Route altered due to severe weather ahead."*
2. **Command Center View:** The manager's dashboard flashes a Reroute notification. The truck's drawn path on the master map instantly shifts to the new safe route.

#### Step 6: Emergency SOS (Failsafe)
1. If the driver hits a physical roadblock not caught by APIs (e.g., a sudden landslide), they press the giant red **🚨 SOS** button.
2. The app writes an emergency document to Firebase `sos_alerts`.
3. The Command Center map instantly pulses red around the driver's location, accompanied by the SOS details, allowing the Admin to deploy rescue or alternate logistics immediately.
