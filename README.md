# 🛰️ NER-SENTINEL

> **Real-Time Emergency Logistics & Intelligent Routing Platform**  
> *Built for Northeast India's complex terrain and disaster-prone environment.*

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/UI-React%2018-61DAFB?logo=react)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Backend-Firebase-FFCA28?logo=firebase)](https://firebase.google.com/)
[![Tailwind](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![FastAPI](https://img.shields.io/badge/Routing-Python%20FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)

---

## 📌 Overview
The Northeastern Region (NER) of India suffers frequent transit disruptions due to monsoons, flash floods, landslides, and steep terrain. **NER-SENTINEL** is a unified, real-time intelligence platform designed to ensure life-saving supplies (medicines, food, fuel) reach their destinations safely.

By combining **Firebase real-time synchronization**, **AI dynamic rerouting**, and **live weather/disaster overlays**, NER-SENTINEL keeps command centers and field drivers seamlessly connected.

---

## 🌟 Key Features

### 1. ⚡ Firebase Real-Time Synchronization
- **Zero-Latency Sync**: Replaced legacy polling with `onSnapshot` Firestore listeners.
- **Bi-Directional Communication**: Instant updates between the Command Center and Driver Portals.
- **Offline Resilience**: Firebase SDK handles temporary drops in connectivity gracefully.

### 2. 🌍 Unified Logistics Command Center
*A single, powerful dashboard replacing fragmented admin panels.*
- **Master GIS Map**: Live vehicle tracking colored by priority (🔴 High, 🟡 Moderate, 🟢 Low).
- **Live Overlays**: Integrates **Open-Meteo API** (real-time storm/rain data) and **USGS API** (earthquake data).
- **SOS Management**: Instantly receive, view, and resolve emergency alerts from drivers.
- **Supply Priority Table**: Manage critical cargo assignments on the fly.

### 3. 🚚 Advanced Driver Portal
*The mobile-responsive interface for field operators.*
- **Live Navigation & Simulation**: Select an origin and destination to visualize AI-computed routes.
- **Look-Ahead Hazard Detection**: The simulation engine automatically scans the route ahead for weather/disaster risks and **dynamically reroutes** if the hazard threshold is exceeded.
- **Emergency SOS Panic Button**: Instantly alerts the Command Center with current GPS coordinates.
- **Local Weather Widget**: Fetches live weather conditions for the driver's current location.

### 4. 🌐 Localization (i18n)
Full support for local languages to ensure accessibility for drivers across the region:
- 🇬🇧 English
- 🇮🇳 Hindi (हिंदी)
- 🇮🇳 Assamese (অসমীয়া)
- 🇮🇳 Bengali (বাংলা)

### 5. 🎨 UI/UX Design System
- **White/Red Palette**: High-contrast, humanized design focusing on readability and urgency.
- **Satoshi Font**: Clean, modern typography loaded via Fontshare.
- **Fluid Animations**: Pulsing SOS indicators, sliding toast notifications, and smooth truck route simulations.

---

## 🚀 Local Setup Instructions

### Prerequisites
- Node.js 18+
- Python 3.10+
- A Firebase Project (Firestore enabled)

### 1. Frontend Setup (Next.js)
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Create your environment variables file
touch .env.local
```

**Add the following to `.env.local`:**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Map key (if using Mappls fallback)
NEXT_PUBLIC_MAPPLS_KEY=your-mappls-key

# Points to your local Python backend for route generation
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Run the Development Server:**
```bash
npm run dev
# The frontend will be available at http://localhost:3000
```

### 2. Backend Setup (Python FastAPI)
*The backend is used strictly for AI route generation and geographic math.*
```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload
# The backend API will be available at http://localhost:8000
```

---

## 🌐 Deployment Guide (Step-by-Step)

### Phase 1: Firebase Setup (Do This First)
1. Go to [Firebase Console](https://console.firebase.google.com) and create a project ("NER-SENTINEL").
2. Navigate to **Firestore Database** and create a database (Native mode, e.g., `asia-south1` region).
3. Go to **Project Settings > General > Your apps > Add web app**.
4. Copy the `firebaseConfig` object values to your frontend's `.env.local`.
5. Set **Firestore Security Rules** (development):
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} { allow read, write: if true; }
     }
   }
   ```
*(In production, restrict rules using Firebase Auth.)*

#### Firestore Collections Schema
The app automatically creates and manages these collections:
- `vehicles`: Real-time driver GPS tracking (`lat`, `lng`, `speed`, `status`).
- `sos_alerts`: Emergency alerts triggered by drivers.
- `active_routes`: The computed safe route geometries currently being followed.
- `reroute_events`: History of dynamic rerouting actions due to hazards.
- `supply_items`: Inventory of critical cargo and priority.

### Phase 2: Backend Deployment (Render.com)
1. Log in to [Render](https://render.com) and click **New Web Service**.
2. Connect your GitHub account and select the `NER-SENTINEL` repository.
3. Set the **Root Directory** to `backend`.
4. Set the **Build Command** to: `pip install -r requirements.txt`
5. Set the **Start Command** to: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Click **Create Web Service**.
7. Once deployed, copy the Render URL (e.g., `https://ner-sentinel-api.onrender.com`).

### Phase 3: Frontend Deployment (Vercel)
1. Log in to [Vercel](https://vercel.com) and click **Add New Project**.
2. Import the `NER-SENTINEL` GitHub repository.
3. Set the **Root Directory** to `frontend`.
4. Open the **Environment Variables** section and add:
   - `NEXT_PUBLIC_FIREBASE_API_KEY=...`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID=...`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...`
   - `NEXT_PUBLIC_FIREBASE_APP_ID=...`
   - `NEXT_PUBLIC_API_URL=https://ner-sentinel-api.onrender.com` (from Phase 2)
5. Click **Deploy**.

### Phase 4: Real-Time Connection Verification
1. Open the deployed Vercel URL in two separate browser windows.
2. In Window 1: Navigate to the **Command Center** (`/`).
3. In Window 2: Navigate to the **Driver Portal** (`/driver`).
4. On the Driver Portal, click **Enable GPS**. You should be prompted for your name.
5. Watch the truck marker appear live on the Command Center map.
6. Press the **SOS** button on the Driver Portal — the alert will flash on the Command Center within 1-2 seconds.

---

## 🛡️ License & Acknowledgements
Developed for the Smart India Hackathon.  
Special thanks to OpenStreetMap, Open-Meteo, USGS, and Firebase for providing the critical infrastructure data.
