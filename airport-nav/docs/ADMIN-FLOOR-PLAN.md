# Plan: Admin-Oberfläche mit Floor-Zeichenfunktion

## Ziel

- Eine **Admin-Oberfläche**, in der du **beliebige Floors beliebiger Flughäfen** bearbeiten kannst.
- „Floor zeichnen“ = das **Navigations-Graph** auf dem Floor-Bild zeichnen/bearbeiten (Knoten setzen, Kanten verbinden), sodass die bestehende App Routen berechnen kann.

---

## 1. Übersicht der bestehenden Daten

| Was | Wo | Inhalt |
|-----|-----|--------|
| Flughafen-Liste | `airport_maps/index.json` | Liste der Airports mit `id`, `name`, `path` (z.B. `./demo_airport/manifest.json`) |
| Flughafen-Manifest | z.B. `demo_airport/manifest.json` | `floors[]` (id, image, graph, width, height), `inter_floor_links`, `scale`, `pois` |
| Floor-Bild | z.B. `demo_airport/floors/F1.png` | PNG des Grundrisses (Pixelmaße aus manifest) |
| Floor-Graph | z.B. `demo_airport/graphs/F1.json` | `nodes[]` (id, x, y, type), `edges[]` (from, to, kind, accessible, weight) |
| POIs | `demo_airport/pois.json` | POIs mit `node`, `label`, `floor_id`, `category`, etc. |

Die App nutzt diese Daten für Karte, Suche und Routenberechnung. Die Admin-Oberfläche soll genau diese Struktur befüllen/bearbeiten.

---

## 2. Architektur-Entscheidungen

### 2.1 Admin-Routing

- **Frontend:** Neuer Bereich unter z.B. `/admin` (React Router).
- **Zugang:** Zunächst ohne Login (nur URL). Später optional: einfacher Passwort-Check oder API-Key.

### 2.2 Datenfluss

- **Lesen:** Backend liest weiter aus `airport_maps/` (index.json, manifest, graphs, floors).
- **Schreiben:** Backend stellt **Admin-APIs** bereit, die JSON-Dateien in `airport_maps/<airport_id>/` schreiben (graphs, ggf. manifest, pois). Keine Datenbank für Floor-Daten nötig – bleibt dateibasiert.

### 2.3 „Floor zeichnen“ – Konkret

- **Canvas:** Ein beliebiges Floor wird angezeigt (Hintergrundbild aus `floors/<id>.png`, Maße aus manifest).
- **Knoten (Nodes):**  
  - Klicken auf die Karte setzt einen Knoten (Pixel-Koordinaten x, y).  
  - Pro Knoten: **Typ** wählen (z.B. entrance, corridor, security, gate, toilet, elevator, stairs, checkin, …).  
  - Knoten-ID: z.B. `<floorId>_<typ><nr>` (z.B. F1_ENT, F1_A, F2_G01) – optional Auto-Vorschlag.  
  - Knoten verschieben per Drag.
- **Kanten (Edges):**  
  - Zwei Knoten auswählen → „Kante hinzufügen“. Oder: Kante „ziehen“ von Knoten A zu Knoten B.  
  - Optionale Eigenschaften: kind (corridor, elevator, …), accessible, weight (aus Pixelabstand berechenbar).
- **Speichern:** Graph als `graphs/<floorId>.json` (nodes + edges) an Backend senden; Backend schreibt Datei.

Damit kannst du **jede beliebige Floor** eines Flughafens „zeichnen“, indem du das Graph darauf definierst.

---

## 3. Phasen des Plans

### Phase 1: Backend-Admin-API

- **1.1** `GET /api/admin/airports`  
  - Liest `airport_maps/index.json`, gibt Liste der Airports zurück.
- **1.2** `GET /api/admin/airports/:airportId`  
  - Liest Manifest des Airports, gibt Manifest inkl. floors zurück (mit absoluten Pfaden/URLs für Bilder).
- **1.3** `GET /api/admin/airports/:airportId/floors/:floorId/graph`  
  - Liefert aktuellen Graph (nodes, edges) für die Floor.
- **1.4** `PUT /api/admin/airports/:airportId/floors/:floorId/graph`  
  - Body: `{ nodes, edges }` (wie in F1.json). Backend schreibt `airport_maps/<airportId>/graphs/<floorId>.json`.  
  - Optional: Validierung (IDs in edges müssen in nodes existieren, Koordinaten im Bereich 0..width/height).
- **1.5** Optional: `POST /api/admin/airports/:airportId/floors` – neue Floor anlegen (manifest erweitern, leeres Graph + Platzhalter-Bild oder Upload).

Datei-Schreibzugriffe nur auf `airport_maps/`; Backend muss mit Dateipfaden und ggf. Locking umgehen (eine Schreiboperation pro Graph).

### Phase 2: Admin-Frontend – Basis

- **2.1** React Router: Route `/admin` mit Layout (z.B. Seitenleiste „Flughäfen / Floors“, Hauptbereich „Floor-Editor“).
- **2.2** **Flughafen-Auswahl:** Dropdown/Liste aus `GET /api/admin/airports`. Nach Auswahl: Floors aus Manifest laden.
- **2.3** **Floor-Auswahl:** Liste aller Floors des gewählten Flughafens (z.B. F1, F2, …). Auswahl lädt Floor-Bild + Graph.

Damit ist „jede beliebige Floor eines Flughafens“ auswählbar (sobald mehrere Airports/Floors in index/manifest stehen).

### Phase 3: Floor-Editor – Zeichnen

- **3.1** **Anzeige:**  
  - Hintergrund: Floor-Bild (URL vom Backend, z.B. `/airport-maps/<airportId>/floors/<floorId>.png`).  
  - Koordinatensystem: Pixel (0..width, 0..height) wie in den Graph-JSONs; Anzeige skaliert (z.B. max width/height im Container, aspect ratio beibehalten).
- **3.2** **Knoten:**  
  - Tool „Knoten hinzufügen“: Klick auf Karte → neuer Knoten (x, y aus Klickposition).  
  - Sidebar/Modal: Typ wählen (entrance, corridor, gate, toilet, elevator, stairs, security, checkin, …), ID editierbar.  
  - Knoten in der Liste anzeigen; Klick auf Knoten in der Liste oder auf der Karte selektieren.  
  - Ausgewählten Knoten per Drag verschieben (x, y aktualisieren).
- **3.3** **Kanten:**  
  - Zwei Knoten auswählen → Button „Kante hinzufügen“ (oder: „Von-Knoten“ klicken, dann „Zu-Knoten“ klicken).  
  - Weight optional aus Pixelabstand berechnen (z.B. `scale.meters_per_pixel` aus manifest).  
  - Kanten-Liste mit Möglichkeit, Kante zu löschen.
- **3.4** **Speichern:** Button „Graph speichern“ → `PUT .../graph` mit aktuellem nodes/edges; Erfolg/Fehler anzeigen.
- **3.5** **Laden:** Beim Wechsel der Floor oder beim ersten Öffnen: `GET .../graph` und Floor-Bild laden; Editor mit diesen Daten füllen.

Optional später: Undo/Redo, Copy/Paste von Knoten, Import/Export JSON.

### Phase 4: Erweiterungen (optional)

- **Neue Floor anlegen:** Dialog „Neue Floor“ (ID, Bild-Upload oder Platzhalter), Backend legt Eintrag in manifest an + leeres Graph + Ordner `floors/` und `graphs/`.
- **Neuen Flughafen anlegen:** Dialog „Neuer Flughafen“ (ID, Name), Backend legt Ordner + `manifest.json` + Eintrag in `index.json`.
- **Inter-Floor-Links:** In der Admin-UI inter_floor_links des Manifests bearbeiten (from/to = Knoten-IDs verschiedener Floors).
- **POIs:** Einfache Liste/Editor für pois.json (node, label, floor_id, category) mit Verknüpfung zu Graph-Knoten.
- **Zugriffsschutz:** Einfache Admin-Route mit Passwort oder API-Key, nur dann Schreib-APIs erlauben.

---

## 4. Technische Stichpunkte

- **Frontend:** Bestehendes React/Vite-Projekt erweitern; neue Seiten/Komponenten unter z.B. `src/admin/` (AdminLayout, AirportList, FloorList, FloorEditor, NodeList, EdgeList, Toolbar).
- **State im Editor:** Lokaler State für nodes/edges; beim Speichern an Backend senden. Kein zwingendes Echtzeit-Multi-User – eine Person bearbeitet einen Graph.
- **Koordinaten:** Überall Pixel (x, y) mit 0 ≤ x ≤ width, 0 ≤ y ≤ height; Backend und Frontend nutzen dieselbe Konvention (wie in den bestehenden F1.json/F2.json).
- **Knoten-Typen:** Entweder feste Liste (entrance, corridor, security, gate, toilet, elevator, stairs, checkin, bakery, restaurant, vertical_core, corridor_end, …) oder aus bestehenden Graphs ableiten und erweiterbar halten.

---

## 5. Reihenfolge der Umsetzung (Empfehlung)

1. Backend: Admin-APIs lesend (airports, airport, graph) + schreibend (PUT graph).  
2. Frontend: Route `/admin`, Flughafen- und Floor-Auswahl, Anzeige einer Floor mit Bild.  
3. Frontend: Graph laden und Knoten/Kanten anzeigen (read-only).  
4. Frontend: Knoten hinzufügen (Klick), verschieben, Typ/ID bearbeiten; Kanten hinzufügen/entfernen; Speichern.  
5. Optional: Neue Floor/Neuer Flughafen, Inter-Floor-Links, POIs, Zugriffsschutz.

Damit hast du eine klare Admin-Oberfläche, in der du **jede beliebige Floor eines Flughafens** auswählst und das zugehörige Navigations-Graph zeichnen bzw. bearbeiten kannst; die bestehende App nutzt die gespeicherten Daten weiter unverändert.
