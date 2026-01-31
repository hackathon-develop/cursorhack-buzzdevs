# Airport Navigator (MVP)

Simple demo webapp to help navigate an airport terminal (search points, draw routes).

## Structure
- `frontend/` — React + Vite + Leaflet UI
- `backend/` — Express API and SQLite seed data

## Quick start
1. Open two terminals.

2. Backend:
   cd backend
   npm install
   npm run seed   # creates sample data
   npm start      # starts API on port 3001

3. Frontend:
   cd ../frontend
   npm install
   npm run dev    # starts Vite on port 5173

Open http://localhost:5173 and the app will fetch from `http://localhost:3001/api/*` by default.

---

This is an MVP scaffold — next steps: add offline map tiles, indoor floor switching, real flight data integration, accessibility improvements, tests and CI.
