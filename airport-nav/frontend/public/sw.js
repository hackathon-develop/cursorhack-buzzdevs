const cacheName = 'airport-nav-v1'
const assets = ['/', '/index.html', '/src/main.tsx']

// Mock airport data (same as backend seed)
const NODES = [
  { id: 1, name: 'Entrance', lat: 40.0004, lng: -73.0004 },
  { id: 2, name: 'Security', lat: 40.0006, lng: -73.0001 },
  { id: 3, name: 'Gate A1', lat: 40.0009, lng: -72.9999 },
  { id: 4, name: 'Gate A2', lat: 40.0009, lng: -73.0006 },
  { id: 5, name: 'Food Court', lat: 40.0003, lng: -73.0008 },
  { id: 6, name: 'Restroom', lat: 40.0002, lng: -73.0002 }
]
const EDGES = [
  { from_id:1, to_id:2, weight: 30 },
  { from_id:2, to_id:3, weight: 50 },
  { from_id:2, to_id:4, weight: 50 },
  { from_id:1, to_id:5, weight: 40 },
  { from_id:5, to_id:4, weight: 60 },
  { from_id:2, to_id:6, weight: 20 },
  { from_id:6, to_id:3, weight: 30 }
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)))
})

// simple Dijkstra implementation for route requests
function computeRoute(fromId, toId) {
  const nodes = NODES.map(n => ({ ...n }))
  const adj = {}
  nodes.forEach(n => adj[n.id] = [])
  EDGES.forEach(e => { if (adj[e.from_id]) adj[e.from_id].push({ to: e.to_id, w: e.weight }) })

  const dist = {}
  const prev = {}
  const Q = new Set()
  nodes.forEach(n => { dist[n.id] = Infinity; prev[n.id] = null; Q.add(n.id) })
  dist[fromId] = 0

  while (Q.size) {
    let u = null
    let best = Infinity
    for (const q of Q) if (dist[q] < best) { best = dist[q]; u = q }
    if (u === null) break
    Q.delete(u)
    if (u === toId) break
    for (const e of (adj[u] || [])) {
      const alt = dist[u] + e.w
      if (alt < dist[e.to]) { dist[e.to] = alt; prev[e.to] = u }
    }
  }

  const path = []
  let u = toId
  while (u !== null && u !== undefined) {
    const node = nodes.find(n => n.id === u)
    if (!node) break
    path.push(node)
    u = prev[u]
  }
  path.reverse()
  return { nodes: path, distance: (dist[toId] === Infinity ? null : dist[toId]) }
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (url.pathname.startsWith('/api/')) {
    // handle mock API
    let body = null
    if (url.pathname === '/api/points') {
      body = NODES
    } else if (url.pathname === '/api/edges') {
      body = EDGES
    } else if (url.pathname === '/api/route') {
      const from = Number(url.searchParams.get('from'))
      const to = Number(url.searchParams.get('to'))
      if (!from || !to) {
        body = { error: 'Missing from/to' }
      } else {
        body = computeRoute(from, to)
      }
    }
    if (body !== null) {
      e.respondWith(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }))
      return
    }
  }

  // default cache-first behavior
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)))
})
