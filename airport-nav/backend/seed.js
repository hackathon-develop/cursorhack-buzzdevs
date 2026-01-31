const fs = require('fs')
const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, 'data', 'airport.db')
if (fs.existsSync(DB_PATH)) {
  console.log('DB already exists at', DB_PATH)
  process.exit(0)
}

const db = new sqlite3.Database(DB_PATH)

// Reihenfolge: 1 Eingang, 2 Security, 3–22 Bereich A, 23–42 Bereich B, 43+ Restaurants
const nodes = [
  { id: 1, name: 'Eingang', lat: 40.0000, lng: -73.0005, type: 'entrance' },
  { id: 2, name: 'Security', lat: 40.0005, lng: -73.0005, type: 'security' },
]

const baseLatA = 40.0012
const baseLngA = -73.002
const stepLng = (0.004 / 19)
for (let i = 1; i <= 20; i++) {
  nodes.push({
    id: 2 + i,
    name: `A${i}`,
    lat: baseLatA,
    lng: baseLngA + (i - 1) * stepLng,
    type: 'gate',
  })
}

const baseLatB = 39.9998
const baseLngB = -73.002
for (let i = 1; i <= 20; i++) {
  nodes.push({
    id: 22 + i,
    name: `B${i}`,
    lat: baseLatB,
    lng: baseLngB + (i - 1) * stepLng,
    type: 'gate',
  })
}

// Restaurants / Essen (IDs 43–46) mit Tags für Suche (Burger, Getränke, …)
nodes.push({ id: 43, name: 'Food Court', lat: 40.0003, lng: -73.0008, type: 'restaurant', tags: '["Burger","Hamburger","Getränke","Drinks","Snacks","Pizza"]' })
nodes.push({ id: 44, name: 'Café Central', lat: 40.0006, lng: -73.0003, type: 'restaurant', tags: '["Getränke","Drinks","Kaffee","Kuchen","Snacks"]' })
nodes.push({ id: 45, name: 'Restaurant Lounge', lat: 40.0008, lng: -73.0010, type: 'restaurant', tags: '["Burger","Getränke","Drinks","Steak","Salat"]' })
nodes.push({ id: 46, name: 'Bistro Gate A', lat: 40.0010, lng: -73.0005, type: 'restaurant', tags: '["Hamburger","Getränke","Drinks","Sandwich","Snacks"]' })

const edges = []

function addEdge(from, to, w = 20) {
  edges.push({ from, to, w })
}

// Eingang → Security
addEdge(1, 2, 30)

// Security → Weg zu Bereich A (erstes Gate A1), Weg zu Bereich B (erstes Gate B1)
addEdge(2, 3, 40)   // Security → A1
addEdge(2, 23, 40)  // Security → B1

// Korridor Bereich A: A1–A2–…–A20
for (let i = 3; i <= 21; i++) addEdge(i, i + 1, 15)

// Korridor Bereich B: B1–B2–…–B20
for (let i = 23; i <= 41; i++) addEdge(i, i + 1, 15)

// Wege zu Restaurants (von Security / Korridor)
addEdge(2, 43, 25)   // Security → Food Court
addEdge(2, 44, 15)   // Security → Café Central
addEdge(3, 45, 20)   // A1 → Restaurant Lounge
addEdge(3, 46, 18)   // A1 → Bistro Gate A
addEdge(43, 3, 30)   // Food Court → A1
addEdge(44, 2, 15)

db.serialize(() => {
  db.run('CREATE TABLE nodes (id INTEGER PRIMARY KEY, name TEXT, lat REAL, lng REAL, type TEXT, tags TEXT)')
  db.run('CREATE TABLE edges (id INTEGER PRIMARY KEY AUTOINCREMENT, from_id INTEGER, to_id INTEGER, weight REAL)')
  const insNode = db.prepare('INSERT INTO nodes (id,name,lat,lng,type,tags) VALUES (?,?,?,?,?,?)')
  nodes.forEach(n => insNode.run(n.id, n.name, n.lat, n.lng, n.type || 'gate', n.tags || null))
  insNode.finalize()
  const insEdge = db.prepare('INSERT INTO edges (from_id,to_id,weight) VALUES (?,?,?)')
  edges.forEach(e => {
    insEdge.run(e.from, e.to, e.w)
    insEdge.run(e.to, e.from, e.w)
  })
  insEdge.finalize()
  console.log('Seeded DB at', DB_PATH)
  db.close()
})
