const path = require('path')
const fs = require('fs')
const express = require('express')
const sqlite3 = require('sqlite3').verbose()
const cors = require('cors')

const DB_PATH = path.join(__dirname, 'data', 'airport.db')
const AIRPORT_MAPS_PATH = path.join(__dirname, '..', 'airport_maps')
const DEBUG_LOG_PATH = path.join(__dirname, '..', '..', '.cursor', 'debug.log')
function debugLog(payload) {
  try {
    const dir = path.dirname(DEBUG_LOG_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const line = JSON.stringify({ ...payload, timestamp: Date.now(), sessionId: 'debug-session' }) + '\n'
    fs.appendFileSync(DEBUG_LOG_PATH, line)
  } catch (_) {}
}

if (!fs.existsSync(DB_PATH)) {
  console.log('No DB found. Run `npm run seed` to create sample data.')
}

// --- Demo Airport (airport_maps) ---
function loadJson(filePath) {
  const p = path.isAbsolute(filePath) ? filePath : path.join(AIRPORT_MAPS_PATH, filePath)
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (_) {
    return null
  }
}

// Combined map: F1 = top half (lat 0.5..1), F2 = bottom half (lat 0..0.5). lng 0..1 both.
function pixelToLatLng(x, y, width, height, floorId) {
  const latNorm = 1 - y / height
  const lng = x / width
  const lat = floorId === 'F2' ? latNorm * 0.5 : 0.5 + latNorm * 0.5
  return { lat, lng }
}

function getDemoAirportData() {
  const manifest = loadJson('demo_airport/manifest.json')
  if (!manifest || !manifest.floors) return null
  const poisPath = manifest.pois ? (manifest.pois.startsWith('./') ? path.join('demo_airport', manifest.pois.slice(2)) : path.join('demo_airport', manifest.pois)) : 'demo_airport/pois.json'
  const poisData = loadJson(poisPath)
  const pois = (poisData && poisData.pois) ? poisData.pois : []
  const graphs = {}
  const nodeById = {}
  for (const floor of manifest.floors) {
    const graphPath = floor.graph ? path.join('demo_airport', path.basename(floor.graph)) : `demo_airport/graphs/${floor.id}.json`
    const g = loadJson(graphPath)
    if (g && g.nodes) {
      graphs[floor.id] = g
      g.nodes.forEach((n) => { nodeById[n.id] = { ...n, floorId: floor.id, width: floor.width || g.image?.width || 2000, height: floor.height || g.image?.height || 1200 } })
    }
  }
  return { manifest, pois, graphs, nodeById }
}

let demoAirportCache = null
function getDemoAirport() {
  if (!demoAirportCache) demoAirportCache = getDemoAirportData()
  return demoAirportCache
}

function nodeTypeToDisplayName(type, nodeId) {
  const suffix = (nodeId || '').replace(/^F\d_/, '')
  const map = {
    entrance: 'Entrance',
    security: 'Security',
    checkin: 'Check-in',
    gate: suffix ? `Gate ${suffix}` : 'Gate',
    toilet: 'WC',
    bakery: 'Bakery',
    restaurant: 'Restaurant',
    elevator: 'Elevator',
    stairs: 'Stairs',
    vertical_core: 'Elevator / Stairs',
    corridor: suffix ? `Corridor ${suffix}` : 'Corridor',
    corridor_end: 'Corridor (End)',
  }
  return map[type] || suffix || nodeId
}

function buildDemoAirportPoints(data) {
  const { nodeById, pois } = data
  const points = []
  const idByNodeId = {}
  let nextId = 1
  const add = (nodeId, name, floorId, category) => {
    if (idByNodeId[nodeId] != null) return idByNodeId[nodeId]
    const n = nodeById[nodeId]
    const floor = data.manifest.floors.find((f) => f.id === floorId)
    const w = floor ? floor.width : 2000
    const h = floor ? floor.height : 1200
    const pos = n ? pixelToLatLng(n.x, n.y, w, h, floorId) : (floorId === 'F2' ? { lat: 0.25, lng: 0.5 } : { lat: 0.75, lng: 0.5 })
    const id = nextId++
    idByNodeId[nodeId] = id
    points.push({ id, name, lat: pos.lat, lng: pos.lng, floorId, nodeId, category })
    return id
  }
  pois.forEach((p) => {
    add(p.node, p.label, p.floor_id, p.category)
  })
  Object.keys(nodeById).forEach((nodeId) => {
    if (idByNodeId[nodeId] != null) return
    const n = nodeById[nodeId]
    const name = nodeTypeToDisplayName(n.type, nodeId)
    add(nodeId, name, n.floorId, n.type)
  })
  const nodeIdById = {}
  points.forEach((p) => { nodeIdById[p.id] = p.nodeId })
  return { points, idByNodeId, nodeIdById }
}

const app = express()
app.use(cors())
app.use(express.json())

app.use('/airport-maps', express.static(AIRPORT_MAPS_PATH))

// --- Admin API (airport_maps read/write) ---
const indexPath = path.join(AIRPORT_MAPS_PATH, 'index.json')
function getAirportsList() {
  if (!fs.existsSync(indexPath)) return []
  try {
    const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
    return (data.airports || []).map((a) => ({ id: a.id, name: a.name || a.id, path: a.path }))
  } catch (_) {
    return []
  }
}

function getManifestForAirport(airportId) {
  const list = getAirportsList()
  const airport = list.find((a) => a.id === airportId)
  if (!airport) return null
  const manifestPath = path.join(AIRPORT_MAPS_PATH, airportId, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return null
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (_) {
    return null
  }
}

app.get('/api/admin/airports', (req, res) => {
  const airports = getAirportsList()
  res.json({ airports })
})

app.get('/api/admin/airports/:airportId', (req, res) => {
  const { airportId } = req.params
  const manifest = getManifestForAirport(airportId)
  if (!manifest) return res.status(404).json({ error: 'Airport not found' })
  const base = `/airport-maps/${airportId}`
  const floors = (manifest.floors || []).map((f) => ({
    id: f.id,
    image: `${base}/floors/${f.id}.png`,
    imagePath: f.image,
    graph: f.graph,
    width: f.width || 2000,
    height: f.height || 1200,
  }))
  res.json({ airport_id: manifest.airport_id, display_name: manifest.display_name, default_floor: manifest.default_floor, floors })
})

app.get('/api/admin/airports/:airportId/floors/:floorId/graph', (req, res) => {
  const { airportId, floorId } = req.params
  const manifest = getManifestForAirport(airportId)
  if (!manifest) return res.status(404).json({ error: 'Airport not found' })
  const floor = (manifest.floors || []).find((f) => f.id === floorId)
  if (!floor) return res.status(404).json({ error: 'Floor not found' })
  const graphPath = path.join(AIRPORT_MAPS_PATH, airportId, 'graphs', `${floorId}.json`)
  if (!fs.existsSync(graphPath)) {
    return res.json({ image: { width: floor.width || 2000, height: floor.height || 1200 }, nodes: [], edges: [] })
  }
  try {
    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'))
    res.json(graph)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/admin/airports/:airportId/floors/:floorId/graph', (req, res) => {
  const { airportId, floorId } = req.params
  const manifest = getManifestForAirport(airportId)
  if (!manifest) return res.status(404).json({ error: 'Airport not found' })
  const floor = (manifest.floors || []).find((f) => f.id === floorId)
  if (!floor) return res.status(404).json({ error: 'Floor not found' })
  const { nodes = [], edges = [] } = req.body
  const graphDir = path.join(AIRPORT_MAPS_PATH, airportId, 'graphs')
  fs.mkdirSync(graphDir, { recursive: true })
  const graphPath = path.join(graphDir, `${floorId}.json`)
  const width = floor.width || 2000
  const height = floor.height || 1200
  const payload = {
    image: { width, height },
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(edges) ? edges : [],
  }
  try {
    fs.writeFileSync(graphPath, JSON.stringify(payload, null, 2), 'utf8')
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Public airport-map API ---
app.get('/api/airport-map/manifest', (req, res) => {
  const data = getDemoAirport()
  if (!data) return res.status(404).json({ error: 'Demo airport not found' })
  const base = '/airport-maps/demo_airport'
  const manifest = { ...data.manifest, airport_id: data.manifest.airport_id, display_name: data.manifest.display_name, default_floor: data.manifest.default_floor }
  const floorList = data.manifest.floors || []
  manifest.floors = floorList.map((f) => {
    const isF2 = f.id === 'F2'
    const bounds = isF2 ? [[0, 0], [0.5, 1]] : [[0.5, 0], [1, 1]]
    return {
      id: f.id,
      image: f.image ? `${base}/${f.image.replace(/^\.\//, '')}` : `${base}/floors/${f.id}.png`,
      bounds,
      graph: f.graph,
      width: f.width || 2000,
      height: f.height || 1200,
    }
  })
  manifest.pois = undefined
  res.json(manifest)
})

app.get('/api/airport-map/graph/:floorId', (req, res) => {
  const data = getDemoAirport()
  if (!data) return res.status(404).json({ error: 'Demo airport not found' })
  const floorId = req.params.floorId
  const floor = (data.manifest.floors || []).find((f) => f.id === floorId)
  if (!floor) return res.status(404).json({ error: 'Floor not found' })
  const graphPath = path.join(AIRPORT_MAPS_PATH, data.manifest.airport_id, 'graphs', `${floorId}.json`)
  if (!fs.existsSync(graphPath)) {
    return res.json({ image: { width: floor.width || 2000, height: floor.height || 1200 }, nodes: [], edges: [] })
  }
  try {
    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'))
    res.json(graph)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/airport-map/points', (req, res) => {
  const data = getDemoAirport()
  if (!data) return res.status(404).json({ error: 'Demo airport not found' })
  const { points } = buildDemoAirportPoints(data)
  res.json(points)
})

app.get('/api/airport-map/restaurants', (req, res) => {
  const data = getDemoAirport()
  if (!data) return res.status(404).json({ error: 'Demo airport not found' })
  const { points } = buildDemoAirportPoints(data)
  const poisByNode = {}
  ;(data.pois || []).forEach((p) => { poisByNode[p.node] = p })
  const restaurants = points
    .filter((p) => p.category === 'restaurant' || p.category === 'bakery')
    .map((p) => {
      const poi = poisByNode[p.nodeId]
      const tags = (poi && poi.features && Array.isArray(poi.features.tags)) ? poi.features.tags : []
      const cuisine = (poi && poi.features && poi.features.cuisine) ? (Array.isArray(poi.features.cuisine) ? poi.features.cuisine : [poi.features.cuisine]) : []
      const allTags = [...tags, ...cuisine]
      return { id: p.id, name: p.name, tags: allTags }
    })
  res.json(restaurants)
})

app.get('/api/airport-map/route', async (req, res) => {
  const fromId = Number(req.query.from)
  const toId = Number(req.query.to)
  // #region agent log
  debugLog({ location: 'backend/index.js:route-handler', message: 'route request', data: { fromId, toId, fromQuery: req.query.from, toQuery: req.query.to }, hypothesisId: 'H1' })
  fetch('http://127.0.0.1:7242/ingest/663dad05-71f3-4268-9f23-559598a3a1db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'backend/index.js:route-handler', message: 'route request', data: { fromId, toId, fromQuery: req.query.from, toQuery: req.query.to }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' }) }).catch(() => {})
  // #endregion
  if (!fromId || !toId) return res.status(400).json({ error: 'Missing from/to' })
  const data = getDemoAirport()
  if (!data) return res.status(404).json({ error: 'Demo airport not found' })
  const { points, nodeIdById } = buildDemoAirportPoints(data)
  const fromNodeId = nodeIdById[fromId]
  const toNodeId = nodeIdById[toId]
  // #region agent log
  debugLog({ location: 'backend/index.js:nodeIds', message: 'nodeId lookup', data: { fromId, toId, fromNodeId: fromNodeId || null, toNodeId: toNodeId || null }, hypothesisId: 'H1' })
  fetch('http://127.0.0.1:7242/ingest/663dad05-71f3-4268-9f23-559598a3a1db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'backend/index.js:nodeIds', message: 'nodeId lookup', data: { fromId, toId, fromNodeId: fromNodeId || null, toNodeId: toNodeId || null }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' }) }).catch(() => {})
  // #endregion
  if (!fromNodeId || !toNodeId) return res.status(400).json({ error: 'Invalid from/to' })
  const adj = {}
  const addEdge = (a, b, w) => {
    if (!adj[a]) adj[a] = []
    adj[a].push({ to: b, w })
    if (!adj[b]) adj[b] = [] // ensure target is in adj so it gets dist/prev and is in Q
  }
  Object.values(data.graphs).forEach((g) => {
    (g.edges || []).forEach((e) => {
      addEdge(e.from, e.to, e.weight ?? 1)
      addEdge(e.to, e.from, e.weight ?? 1)
    })
  })
  ;(data.manifest.inter_floor_links || []).forEach((link) => {
    addEdge(link.from, link.to, 50)
    addEdge(link.to, link.from, 50)
  })
  // Ensure every node (especially from/to) is in adj so it gets dist/prev and is in Q
  Object.keys(data.nodeById).forEach((nodeId) => {
    if (!adj[nodeId]) adj[nodeId] = []
  })
  const dist = {}
  const prev = {}
  const Q = new Set(Object.keys(adj))
  Q.forEach((v) => { dist[v] = Infinity; prev[v] = null })
  dist[fromNodeId] = 0
  while (Q.size) {
    let u = null
    let best = Infinity
    for (const q of Q) if (dist[q] < best) { best = dist[q]; u = q }
    if (u === null || u === toNodeId) break
    Q.delete(u)
    for (const e of (adj[u] || [])) {
      const alt = dist[u] + e.w
      if (alt < dist[e.to]) { dist[e.to] = alt; prev[e.to] = u }
    }
  }
  const pathNodeIds = []
  let u = toNodeId
  while (u) { pathNodeIds.unshift(u); u = prev[u] }
  // #region agent log
  debugLog({ location: 'backend/index.js:path-check', message: 'path result', data: { fromNodeId, toNodeId, pathNodeIdsLength: pathNodeIds.length, pathNodeIds0: pathNodeIds[0], distToNode: dist[toNodeId], adjFromKeys: Object.keys(adj).filter((k) => k === fromNodeId || k === toNodeId) }, hypothesisId: 'H1' })
  // #endregion
  if (pathNodeIds[0] !== fromNodeId) {
    return res.json({ nodes: [], distance: null, path_length_m: null, walking_minutes: null })
  }
  const idByNodeId = {}
  points.forEach((p) => { idByNodeId[p.nodeId] = p.id })
  const pathNodes = pathNodeIds.map((nodeId) => {
    const n = data.nodeById[nodeId]
    const floor = data.manifest.floors.find((f) => f.id === (n && n.floorId))
    const w = floor ? floor.width : 2000
    const h = floor ? floor.height : 1200
    const pos = n ? pixelToLatLng(n.x, n.y, w, h, n ? n.floorId : data.manifest.default_floor) : { lat: 0.75, lng: 0.5 }
    return { id: idByNodeId[nodeId], nodeId, lat: pos.lat, lng: pos.lng, floorId: n ? n.floorId : data.manifest.default_floor }
  })
  let pathLengthM = 0
  const scale = (data.manifest.scale && data.manifest.scale.meters_per_pixel) ? data.manifest.scale.meters_per_pixel : 0.1
  for (let i = 0; i < pathNodes.length - 1; i++) {
    const a = data.nodeById[pathNodeIds[i]]
    const b = data.nodeById[pathNodeIds[i + 1]]
    if (a && b && a.floorId === b.floorId) {
      pathLengthM += Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2) * scale
    } else {
      pathLengthM += 15
    }
  }
  const walkingMinutes = pathLengthM / (80 / 60)
  // #region agent log
  debugLog({ location: 'backend/index.js:route-response', message: 'route response', data: { pathNodesLength: pathNodes.length, firstFloorId: pathNodes[0]?.floorId }, hypothesisId: 'H1' })
  fetch('http://127.0.0.1:7242/ingest/663dad05-71f3-4268-9f23-559598a3a1db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'backend/index.js:route-response', message: 'route response', data: { pathNodesLength: pathNodes.length, firstFloorId: pathNodes[0]?.floorId }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' }) }).catch(() => {})
  // #endregion
  res.json({
    nodes: pathNodes,
    distance: dist[toNodeId] === Infinity ? null : dist[toNodeId],
    path_length_m: pathLengthM,
    walking_minutes: pathLengthM > 0 ? walkingMinutes : null,
  })
})

const db = new sqlite3.Database(DB_PATH)

function allAsync(sql, params=[]) { return new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows))) }

// Streckenlänge zwischen zwei Punkten in Metern (Haversine)
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

app.get('/api/points', async (req, res) => {
  try {
    const pts = await allAsync('SELECT * FROM nodes')
    res.json(pts)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/restaurants', async (req, res) => {
  try {
    const pts = await allAsync('SELECT * FROM nodes')
    const restaurants = pts.filter((p) => p.type === 'restaurant')
    if (restaurants.length === 0) {
      res.json([
        { id: 43, name: 'Food Court', lat: 40.0003, lng: -73.0008, type: 'restaurant', tags: ['Burger', 'Hamburger', 'Getränke', 'Drinks', 'Snacks', 'Pizza'] },
        { id: 44, name: 'Café Central', lat: 40.0006, lng: -73.0003, type: 'restaurant', tags: ['Getränke', 'Drinks', 'Kaffee', 'Kuchen', 'Snacks'] },
        { id: 45, name: 'Restaurant Lounge', lat: 40.0008, lng: -73.0010, type: 'restaurant', tags: ['Burger', 'Getränke', 'Drinks', 'Steak', 'Salat'] },
        { id: 46, name: 'Bistro Gate A', lat: 40.0010, lng: -73.0005, type: 'restaurant', tags: ['Hamburger', 'Getränke', 'Drinks', 'Sandwich', 'Snacks'] },
      ])
      return
    }
    const defaultTagsByName = {
      'Food Court': ['Burger', 'Hamburger', 'Getränke', 'Drinks', 'Snacks', 'Pizza'],
      'Café Central': ['Getränke', 'Drinks', 'Kaffee', 'Kuchen', 'Snacks'],
      'Restaurant Lounge': ['Burger', 'Getränke', 'Drinks', 'Steak', 'Salat'],
      'Bistro Gate A': ['Hamburger', 'Getränke', 'Drinks', 'Sandwich', 'Snacks'],
    }
    const withTags = restaurants.map((r) => {
      let tags = []
      if (r.tags) {
        if (typeof r.tags === 'string') {
          try { tags = JSON.parse(r.tags) } catch (_) { tags = [] }
        } else if (Array.isArray(r.tags)) tags = r.tags
      }
      if (tags.length === 0 && r.name && defaultTagsByName[r.name])
        tags = defaultTagsByName[r.name]
      return { ...r, tags }
    })
    res.json(withTags)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/edges', async (req, res) => {
  try {
    const edges = await allAsync('SELECT * FROM edges')
    res.json(edges)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Hamburg Airport Open API – Abflüge (https://www.hamburg-airport.de/de/open-api-20708)
const HAMBURG_API_KEY = process.env.HAMBURG_AIRPORT_API_KEY
const HAMBURG_DEPARTURES_URL = 'https://rest.api.hamburg-airport.de/v2/flights/departures'

app.get('/api/departures', async (req, res) => {
  if (!HAMBURG_API_KEY) {
    return res.status(503).json({
      error: 'HAMBURG_AIRPORT_API_KEY nicht gesetzt. API-Schlüssel unter https://portal.api.hamburg-airport.de registrieren.',
      flights: [],
    })
  }
  try {
    const response = await fetch(HAMBURG_DEPARTURES_URL, {
      headers: { 'Ocp-Apim-Subscription-Key': HAMBURG_API_KEY },
    })
    if (!response.ok) {
      const text = await response.text()
      return res.status(response.status).json({
        error: `Hamburg API: ${response.status}`,
        flights: [],
        details: text.slice(0, 200),
      })
    }
    const data = await response.json()
    // API liefert Array oder Objekt mit Einträgen; einheitlich als Array
    const raw = Array.isArray(data) ? data : (data.flights || data.departures || [])
    const toTime = (v) => {
      if (!v || typeof v !== 'string') return null
      if (v.length >= 16) return v.slice(11, 16)
      if (v.length >= 5) return v.slice(0, 5)
      return null
    }
    const flights = raw.map((f) => {
      const planned = f.plannedDepartureTime || f.scheduledDepartureTime || f.departureTime || f.time || ''
      const timeStr = toTime(planned) || '--:--'
      const expected = f.expectedDepartureTime || f.estimatedDepartureTime || ''
      const expectedStr = toTime(expected)
      const gate = (f.departureGate || f.gate || f.departureTerminal || '').toString().trim()
      const terminal = (f.departureTerminal || f.terminal || '').toString().trim()
      const gateName = gate ? (terminal ? `${terminal}/${gate}` : gate) : (terminal || null)
      return {
        flightNumber: (f.flightnumber || f.flightNumber || f.flight_number || '').trim() || null,
        time: timeStr,
        expectedTime: expectedStr || null,
        gateName: gateName || null,
        terminal: terminal || null,
        destination: (f.destinationAirportName || f.destinationAirportLongName || f.destination || f.destinationName || '').trim() || null,
        destinationCode: (f.destinationAirport3LCode || f.destinationAirportIata || f.destinationIata || '').trim() || null,
      }
    }).filter((f) => f.flightNumber && f.time !== '--:--')
    res.json({ flights })
  } catch (e) {
    res.status(500).json({ error: e.message, flights: [] })
  }
})

// simple Dijkstra
app.get('/api/route', async (req, res) => {
  const from = Number(req.query.from)
  const to = Number(req.query.to)
  if (!from || !to) return res.status(400).json({ error: 'Missing from/to' })
  try {
    const nodes = await allAsync('SELECT * FROM nodes')
    const edges = await allAsync('SELECT * FROM edges')
    const adj = {}
    nodes.forEach(n => adj[n.id] = [])
    edges.forEach(e => adj[e.from_id].push({ to: e.to_id, w: e.weight }))

    const dist = {}
    const prev = {}
    const Q = new Set()
    nodes.forEach(n => { dist[n.id] = Infinity; prev[n.id] = null; Q.add(n.id) })
    dist[from] = 0

    while (Q.size) {
      let u = null
      let best = Infinity
      for (const q of Q) if (dist[q] < best) { best = dist[q]; u = q }
      if (u === null) break
      Q.delete(u)
      if (u === to) break
      for (const e of adj[u]) {
        const alt = dist[u] + e.w
        if (alt < dist[e.to]) { dist[e.to] = alt; prev[e.to] = u }
      }
    }

    const pathNodes = []
    let u = to
    while (u !== null) { const node = nodes.find(n => n.id === u); if (!node) break; pathNodes.push(node); u = prev[u] }
    pathNodes.reverse()

    // Gehzeit aus Länge der Striche (Meter) → Minuten (~80 m/min ≈ 4,8 km/h)
    let pathLengthM = 0
    for (let i = 0; i < pathNodes.length - 1; i++) {
      const a = pathNodes[i], b = pathNodes[i + 1]
      pathLengthM += haversineMeters(a.lat, a.lng, b.lat, b.lng)
    }
    const WALKING_M_PER_MIN = 80
    const walkingMinutes = pathLengthM / WALKING_M_PER_MIN

    res.json({
      nodes: pathNodes,
      distance: dist[to] === Infinity ? null : dist[to],
      path_length_m: pathLengthM,
      walking_minutes: pathLengthM > 0 ? walkingMinutes : null,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// static frontend for convenience
app.use('/', express.static(path.join(__dirname, '..', 'frontend', 'dist')))

const port = process.env.PORT || 3002
app.listen(port, () => console.log('API listening on', port))
