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

### Echte Abflüge vom Hamburg Airport

Die App kann Abflugdaten der [Hamburg Airport Open API](https://www.hamburg-airport.de/de/open-api-20708) anzeigen:

1. Im [Developer Portal](https://portal.api.hamburg-airport.de) registrieren und einen API-Schlüssel anlegen.
2. Beim Start des Backends die Umgebungsvariable setzen:
   ```bash
   set HAMBURG_AIRPORT_API_KEY=dein-api-key
   npm start
   ```
   (Windows: `set`; Linux/macOS: `export HAMBURG_AIRPORT_API_KEY=...`)

Ohne API-Schlüssel werden Fallback-Ziele und Beispiel-Flüge angezeigt.

---

This is an MVP scaffold — next steps: add offline map tiles, indoor floor switching, real flight data integration, accessibility improvements, tests and CI.
