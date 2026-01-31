const fs = require('fs')
const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH = path.join(__dirname, 'data', 'airport.db')
if (fs.existsSync(DB_PATH)) {
  console.log('DB already exists at', DB_PATH)
  process.exit(0)
}

const db = new sqlite3.Database(DB_PATH)

const nodes = [
  { id: 1, name: 'Entrance', lat: 40.0004, lng: -73.0004 },
  { id: 2, name: 'Security', lat: 40.0006, lng: -73.0001 },
  { id: 3, name: 'Gate A1', lat: 40.0009, lng: -72.9999 },
  { id: 4, name: 'Gate A2', lat: 40.0009, lng: -73.0006 },
  { id: 5, name: 'Food Court', lat: 40.0003, lng: -73.0008 },
  { id: 6, name: 'Restroom', lat: 40.0002, lng: -73.0002 }
]

const edges = [
  { from:1, to:2, w: 30 },
  { from:2, to:3, w: 50 },
  { from:2, to:4, w: 50 },
  { from:1, to:5, w: 40 },
  { from:5, to:4, w: 60 },
  { from:2, to:6, w: 20 },
  { from:6, to:3, w: 30 }
]

db.serialize(() => {
  db.run('CREATE TABLE nodes (id INTEGER PRIMARY KEY, name TEXT, lat REAL, lng REAL)')
  db.run('CREATE TABLE edges (id INTEGER PRIMARY KEY AUTOINCREMENT, from_id INTEGER, to_id INTEGER, weight REAL)')
  const insNode = db.prepare('INSERT INTO nodes (id,name,lat,lng) VALUES (?,?,?,?)')
  nodes.forEach(n => insNode.run(n.id,n.name,n.lat,n.lng))
  insNode.finalize()
  const insEdge = db.prepare('INSERT INTO edges (from_id,to_id,weight) VALUES (?,?,?)')
  edges.forEach(e => { insEdge.run(e.from,e.to,e.w); insEdge.run(e.to,e.from,e.w); })
  insEdge.finalize()
  console.log('Seeded DB at', DB_PATH)
  db.close()
})
