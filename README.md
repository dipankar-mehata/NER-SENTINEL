# 🛰️ NER-SENTINEL

> **Northeast India Disaster-Aware Logistics Intelligence & Resilient Routing Platform**  
> *Built for the Smart India Hackathon (SIH)*

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostGIS](https://img.shields.io/badge/GIS-PostGIS%2015-336791?logo=postgresql)](https://postgis.net/)
[![Leaflet](https://img.shields.io/badge/Maps-Leaflet%20GIS-199900?logo=leaflet)](https://leafletjs.com/)
[![OSRM](https://img.shields.io/badge/Routing-OpenStreetMap%20OSRM-blue)](https://project-osrm.org/)

---

## 📌 Problem Context
The Northeastern Region (NER) of India suffers frequent transit disruptions due to monsoons, flash floods, landslides, and steep terrain across states like Assam, Meghalaya, Manipur, and Nagaland. Conventional mapping and delivery systems lack real-time terrain risk awareness, stranding essential shipments (medicines, vaccines, emergency food, and fuel).

**NER-SENTINEL** solves this through a unified intelligence organism combining **real-time 5-factor risk scoring**, **dynamic AI rerouting on genuine highway geometry**, **offline-first field incident reporting**, **disaster simulation**, and **specialized role-based operational dashboards**.

---

## 🌟 Key Features

### 1. 🗺️ Live GIS Map & Real Highway Geometry
- Interactive GIS map spanning major Northeast Indian hubs (Guwahati, Shillong, Tezpur, Silchar, Imphal, Kohima).
- Road corridors color-coded dynamically: 🟢 Safe, 🟡 Moderate Risk, 🔴 High Risk.
- **Genuine OpenStreetMap (OSRM) Road Curves**: No crude straight lines or synthetic grids—vehicles and alternative routes traverse actual national highways (NH15, NH6, NH27).

### 2. 🚚 Vehicle & Delivery Tracking
- In-flight monitoring with cargo type, priority classification (Critical/High/Medium/Normal), live coordinates, ETA, and capacity load gauges.
- Real-time GPS broadcasting from driver handhelds.

### 3. 🚨 Offline-First Field Incident Reporting (PWA)
- Automatic device geolocation acquisition.
- Photo capture and Web Speech voice transcription.
- Bilingual interface (English & हिन्दी).
- Offline `localStorage` queue that auto-syncs when cellular or Wi-Fi reconnects.

### 4. 🧮 5-Factor Dynamic Risk Engine
Computes road segment and corridor hazards every 15 seconds:
$$\text{Risk (0--100)} = \text{Rainfall (0--25)} + \text{Slope Risk (0--20)} + \text{Incidents (0--30)} + \text{Traffic (0--10)} + \text{Road Condition (0--15)}$$

### 5. 🔀 Dual Route Recommendation (Shortest vs Safest)
- **Route A (Shortest)**: Quickest path regardless of hazard exposure.
- **Route B (Safest)**: Hazard-avoiding detour weighting risk penalties.
- **AI Recommendation Engine**: Clear narrative rationale comparing time penalty vs. safety score.

### 6. 🎮 Disaster & "What-If?" Scenario Engine
- **Stress-Test Simulator**: Slide rainfall intensity, blocked corridors, and demand surge to assess cascading regional impacts.
- **What-If Corridor Closure**: Select any highway segment to immediately compute cut-off districts, affected vehicles, and emergency resupply deadlines.

### 7. 🤖 Logistics AI Copilot
- Natural language queries routed directly to live database state.
- Ask: *"Which critical deliveries are at risk?"*, *"What happens if NH6 closes?"*, or *"Show warehouse stockouts"*.

---

## 👥 5 Role-Based Dashboards

| Role | Route | Description |
|---|---|---|
| **Landing Hub** | `/` | Operational role picker and real-time system heartbeat |
| **Command Center (Admin)** | `/admin` | State HQ view: Live GIS, AI Copilot, Disaster Sim, What-If, 24-72h ML Forecast |
| **Field Officer (PWA)** | `/field` | Offline-ready incident logger with GPS, photo, and voice description |
| **Driver In-Cab Assistant** | `/driver` | Dual-route visualizer (Route A vs B), turn guidance, and GPS sync |
| **District Officer** | `/district` | District accessibility score (0–100), hazard breakdown, corridor alerts |
| **Logistics Manager** | `/logistics` | Fleet tracking, warehouse inventory health, backhaul truck fill optimization |

---

## 🛠️ Tech Stack
- **Frontend**: Next.js 16 (Pages Router), React 19, TypeScript, Tailwind CSS v4, Leaflet & React-Leaflet
- **Backend**: FastAPI, SQLAlchemy 2.0, Pydantic v2, GeoAlchemy2, NetworkX, HTTPX, Uvicorn
- **Database**: PostgreSQL 15 + PostGIS extension
- **Routing**: OpenStreetMap OSRM API with national highway curve algorithms

---

## ⚡ Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Python 3.10+
- Node.js 18+ and npm

### 1. Clone & Database
```bash
git clone https://github.com/<your-username>/ner-sentinel.git
cd ner-sentinel

# Start PostGIS
docker-compose up -d
```

### 2. Start Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Launch FastAPI
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)*

### 3. Start Frontend
```bash
cd ../frontend
npm install
npm run dev
```
*Open application: [http://localhost:3000](http://localhost:3000)*

---

## 🚀 Deploying to Vercel

### Step 1: Deploy the Backend
Since Vercel is designed for serverless frontend applications, host the FastAPI backend on a free/affordable container platform such as:
- **Render** ([render.com](https://render.com))
- **Railway** ([railway.app](https://railway.app))
- **Fly.io** ([fly.io](https://fly.io))

Provide the database connection string `DATABASE_URL` pointing to your hosted PostgreSQL + PostGIS instance (e.g. via Supabase, Neon with PostGIS, or Railway).

### Step 2: Deploy Frontend on Vercel
1. Push this repository to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com/new) and click **Import Project**.
3. Select your repository `ner-sentinel`.
4. Configure the project:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click *Edit* and select `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
5. Add an Environment Variable:
   - `NEXT_PUBLIC_API_URL`: URL of your deployed backend (e.g., `https://ner-sentinel-api.onrender.com`)
6. Click **Deploy**!

---

## 📄 License
Developed for Smart India Hackathon (SIH). Open-source under the MIT License.
