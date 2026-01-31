import React, { useCallback, useEffect, useRef, useState } from 'react'

export type GraphNode = { id: string; x: number; y: number; type: string }
export type GraphEdge = { from: string; to: string; kind?: string; accessible?: boolean; weight?: number }

const NODE_TYPES = [
  'entrance',
  'corridor',
  'security',
  'gate',
  'toilet',
  'elevator',
  'stairs',
  'checkin',
  'bakery',
  'restaurant',
  'vertical_core',
  'corridor_end',
] as const

type Props = {
  airportId: string
  floorId: string
  floorImageUrl: string
  width: number
  height: number
}

export default function FloorEditor({
  airportId,
  floorId,
  floorImageUrl,
  width,
  height,
}: Props) {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [edgeFromId, setEdgeFromId] = useState<string | null>(null)
  const [addNodeType, setAddNodeType] = useState<string>(NODE_TYPES[0])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nextNodeNumRef = useRef(0)

  const loadGraph = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/admin/airports/${airportId}/floors/${floorId}/graph`)
      .then((r) => r.json())
      .then((data) => {
        const loadedNodes = data.nodes || []
        setNodes(loadedNodes)
        setEdges(data.edges || [])
        setSelectedNodeId(null)
        setEdgeFromId(null)
        nextNodeNumRef.current = loadedNodes.length
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [airportId, floorId])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  const saveGraph = () => {
    setSaving(true)
    setError(null)
    fetch(`/api/admin/airports/${airportId}/floors/${floorId}/graph`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes, edges }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((j) => Promise.reject(new Error(j.error || 'Speichern fehlgeschlagen')))
        return r.json()
      })
      .then(() => loadGraph())
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false))
  }

  const getPixelFromEvent = (e: React.MouseEvent): { x: number; y: number } | null => {
    const el = containerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * width
    const y = ((e.clientY - rect.top) / rect.height) * height
    return { x: Math.max(0, Math.min(width, x)), y: Math.max(0, Math.min(height, y)) }
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.floor-editor-node, .floor-editor-edge')) return
    const pos = getPixelFromEvent(e)
    if (!pos) return
    nextNodeNumRef.current += 1
    const newNodeId = `${floorId}_${addNodeType.toUpperCase().slice(0, 3)}${nextNodeNumRef.current}`
    setNodes((prev) => [...prev, { id: newNodeId, x: pos.x, y: pos.y, type: addNodeType }])
  }

  const handleNodeClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (edgeFromId) {
      if (edgeFromId === id) {
        setEdgeFromId(null)
        return
      }
      const exists = edges.some((ed) => (ed.from === edgeFromId && ed.to === id) || (ed.from === id && ed.to === edgeFromId))
      if (!exists) {
        setEdges((prev) => [...prev, { from: edgeFromId, to: id, kind: 'corridor', accessible: true, weight: 100 }])
      }
      setEdgeFromId(null)
      return
    }
    setSelectedNodeId((prev) => (prev === id ? null : id))
  }

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const pos = getPixelFromEvent(e)
    if (pos) {
      setDraggingId(id)
      setDragStart(pos)
    }
  }

  useEffect(() => {
    if (!draggingId || !dragStart) return
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * width
      const y = ((e.clientY - rect.top) / rect.height) * height
      const dx = x - dragStart.x
      const dy = y - dragStart.y
      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggingId
            ? { ...n, x: Math.max(0, Math.min(width, n.x + dx)), y: Math.max(0, Math.min(height, n.y + dy)) }
            : n
        )
      )
      setDragStart({ x, y })
    }
    const onUp = () => {
      setDraggingId(null)
      setDragStart(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggingId, dragStart, width, height])

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id))
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id))
    setSelectedNodeId((prev) => (prev === id ? null : prev))
    setEdgeFromId((prev) => (prev === id ? null : prev))
  }

  const deleteEdge = (from: string, to: string) => {
    setEdges((prev) => prev.filter((e) => !(e.from === from && e.to === to)))
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]))

  if (loading) {
    return (
      <div className="floor-editor">
        <p className="admin-muted">Graph wird geladen …</p>
      </div>
    )
  }

  return (
    <div className="floor-editor">
      {error && (
        <div className="floor-editor-error" role="alert">
          {error}
        </div>
      )}
      <div className="floor-editor-toolbar">
        <label>
          Neuer Knoten-Typ:{' '}
          <select
            value={addNodeType}
            onChange={(e) => setAddNodeType(e.target.value)}
            className="floor-editor-select"
          >
            {NODE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <span className="floor-editor-hint">Klick auf die Karte fügt einen Knoten hinzu.</span>
        {edgeFromId ? (
          <span className="floor-editor-hint">Klicke den Ziel-Knoten für die Kante.</span>
        ) : (
          <button
            type="button"
            className="floor-editor-btn"
            onClick={() => setEdgeFromId(selectedNodeId)}
            disabled={!selectedNodeId}
          >
            Kante von ausgewähltem Knoten
          </button>
        )}
        <button type="button" className="floor-editor-btn primary" onClick={saveGraph} disabled={saving}>
          {saving ? 'Speichern …' : 'Graph speichern'}
        </button>
      </div>
      <div className="floor-editor-content">
        <div
          ref={containerRef}
          className="floor-editor-canvas-wrap"
          style={{ aspectRatio: `${width} / ${height}` }}
          onClick={handleCanvasClick}
          role="button"
          tabIndex={0}
          aria-label="Klicken zum Hinzufügen eines Knotens"
        >
          <img
            src={floorImageUrl}
            alt={`Floor ${floorId}`}
            className="floor-editor-image"
          />
          <svg
            className="floor-editor-svg"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {edges.map((ed) => {
              const a = nodeById[ed.from]
              const b = nodeById[ed.to]
              if (!a || !b) return null
              return (
                <line
                  key={`${ed.from}-${ed.to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className="floor-editor-edge"
                />
              )
            })}
            {nodes.map((n) => (
              <circle
                key={n.id}
                cx={n.x}
                cy={n.y}
                r={12}
                className={`floor-editor-node ${selectedNodeId === n.id ? 'selected' : ''} ${edgeFromId === n.id ? 'edge-from' : ''}`}
                onClick={(e) => handleNodeClick(e, n.id)}
                onMouseDown={(e) => handleNodeMouseDown(e, n.id)}
              />
            ))}
          </svg>
        </div>
        <aside className="floor-editor-sidebar">
          <section>
            <h3 className="floor-editor-sidebar-title">Knoten ({nodes.length})</h3>
            <ul className="floor-editor-list">
              {nodes.map((n) => (
                <li key={n.id} className={selectedNodeId === n.id ? 'selected' : ''}>
                  <button
                    type="button"
                    className="floor-editor-list-btn"
                    onClick={() => setSelectedNodeId(n.id)}
                  >
                    {n.id} ({n.type})
                  </button>
                  <button
                    type="button"
                    className="floor-editor-delete"
                    onClick={() => deleteNode(n.id)}
                    aria-label={`Knoten ${n.id} löschen`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="floor-editor-sidebar-title">Kanten ({edges.length})</h3>
            <ul className="floor-editor-list">
              {edges.map((ed) => (
                <li key={`${ed.from}-${ed.to}`}>
                  <span className="floor-editor-edge-label">
                    {ed.from} → {ed.to}
                  </span>
                  <button
                    type="button"
                    className="floor-editor-delete"
                    onClick={() => deleteEdge(ed.from, ed.to)}
                    aria-label="Kante löschen"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {selectedNode && (
            <section>
              <h3 className="floor-editor-sidebar-title">Knoten bearbeiten</h3>
              <p className="floor-editor-node-id">{selectedNode.id}</p>
              <label>
                Typ:{' '}
                <select
                  value={selectedNode.type}
                  onChange={(e) =>
                    setNodes((prev) =>
                      prev.map((n) => (n.id === selectedNode.id ? { ...n, type: e.target.value } : n))
                    )
                  }
                  className="floor-editor-select"
                >
                  {NODE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
