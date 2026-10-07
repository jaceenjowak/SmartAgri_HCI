# SmartAgri Dark UI + Supabase Test Build

This build focuses on UI/database integration before ESP32 hardware work.

## Scope
- React dark-theme homepage, login, register, dashboard, logs, notifications, settings
- Node.js/Express API with JWT authentication
- One Supabase database for users, thresholds, pump state, sensor readings, logs, notifications
- Authenticated sensor/pump **simulation** for end-to-end testing
- ESP32 ingestion intentionally disabled until the UI/database flow is verified
- No solar, temperature, or water-tank percentage fields

## Required Supabase schema
The project expects the schema in `backend/migrations/001_smartagri_supabase.sql` — the same six-table structure created during Phase 2.

## Configure the backend on Windows
From the project folder run:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-env.ps1
```

Paste your **Supabase Project URL** and **secret key** when prompted. The script writes `backend/.env` and generates a private JWT secret. The Supabase secret stays in the Express backend and is never sent to React.

Or create `backend/.env` manually from `backend/.env.example`.

## Start the app
You can double-click `start-dev.bat`, or use two terminals:

```powershell
cd backend
npm install
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Testing order
1. Open `http://localhost:5000/api/health`. It should report `status: ok` and `database: supabase`.
2. Register a new account through the dark UI. Check Supabase `users`, `thresholds`, and `pump_state`.
3. On Dashboard add a simulated reading. Check `sensor_readings` and verify the same value appears in the cards/chart.
4. Test water detected = false. Pump ON should be blocked and a notification should be created.
5. Change thresholds in Settings and confirm Supabase updates.
6. Test simulated manual pump ON/OFF; confirm `pump_state`, `irrigation_logs`, and `notifications`.
7. Refresh the browser and confirm the UI reads the same data back from Supabase.

## Important
The physical ESP32, relay and water pump are NOT connected by this build. `/api/sensor/reading` intentionally returns a disabled response. Hardware integration is the next phase after the database/UI tests pass.
