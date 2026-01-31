const path = require('path')
const fs = require('fs')
const express = require('express')
const sqlite3 = require('sqlite3').verbose()
const cors = require('cors')

const DB_PATH = path.join(__dirname, 'data', 'airport.db')

if (!fs.existsSync(DB_PATH)) {
  console.log('No DB found. Run `npm run seed` to create sample data.')
}

const app = express()
app.use(cors())
app.use(express.json())

const db = new sqlite3.Database(DB_PATH)

function allAsync(sql, params=[]) { return new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows))) }

app.get('/api/points', async (req, res) => {
  try {
    const pts = await allAsync('SELECT * FROM nodes')
    res.json(pts)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/edges', async (req, res) => {
  try {
    const edges = await allAsync('SELECT * FROM edges')
    res.json(edges)
  } catch (e) { res.status(500).json({ error: e.message }) }
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

    const path = []
    let u = to
    while (u !== null) { const node = nodes.find(n => n.id === u); if (!node) break; path.push(node); u = prev[u] }
    path.reverse()
    res.json({ nodes: path, distance: dist[to] === Infinity ? null : dist[to] })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// static frontend for convenience
app.use('/', express.static(path.join(__dirname, '..', 'frontend', 'dist')))

const port = process.env.PORT || 3001
app.listen(port, () => console.log('API listening on', port))
