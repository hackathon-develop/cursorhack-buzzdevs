import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type FloorItem = { id: string; image: string; width?: number; height?: number }

type Props = {
  demoMapMode?: boolean
  selectedFloor?: string
  floors?: FloorItem[]
  startId?: number | null
  endId?: number | null
  onSuggestFloor?: (floorId: string) => void
}

const IMG_W = 2000
const IMG_H = 1200

export default function MapView({ demoMapMode = false, selectedFloor = 'F1', floors = [], startId, endId, onSuggestFloor }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const floorWrapRef = useRef<HTMLDivElement | null>(null)
  const STORAGE_KEY = 'airport-floor-gate-positions'
  const [customPositions, setCustomPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s) return JSON.parse(s) as Record<string, { x: number; y: number }>
    } catch (_) {}
    return {}
  })
  const [positioningGate, setPositioningGate] = useState<string | null>(null)
  const PATH_STORAGE_KEY = 'airport-floor-path'
  const [pathPoints, setPathPoints] = useState<{ x: number; y: number }[]>(() => {
    try {
      const s = localStorage.getItem(PATH_STORAGE_KEY)
      if (s) return JSON.parse(s) as { x: number; y: number }[]
    } catch (_) {}
    return []
  })
  const [drawingMode, setDrawingMode] = useState(false)
  const [routePoints, setRoutePoints] = useState<{ x: number; y: number }[]>([])
  const [routeNodes, setRouteNodes] = useState<{ lat: number; lng: number; floorId: string; nodeId?: string }[]>([])
  const [graphData, setGraphData] = useState<{
    nodes: { id: string; x: number; y: number; type: string }[]
    edges: { from: string; to: string }[]
    width: number
    height: number
  } | null>(null)

  useEffect(() => {
    if (Object.keys(customPositions).length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customPositions))
      } catch (_) {}
    }
  }, [customPositions])
  useEffect(() => {
    if (pathPoints.length > 0) {
      try {
        localStorage.setItem(PATH_STORAGE_KEY, JSON.stringify(pathPoints))
      } catch (_) {}
    }
  }, [pathPoints])
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<number, L.Marker>>({})
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  const startIdRef = useRef<number | null>(null)
  startIdRef.current = startId ?? null

  useEffect(() => {
    if (!mapRef.current) return
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    const map = demoMapMode
      ? L.map(mapRef.current, {
          crs: L.CRS.Simple,
          minZoom: -1,
          maxZoom: 2,
        }).setView([0.5, 0.5], 0)
      : L.map(mapRef.current).setView([40.0, -73.0], 17)
    mapInstanceRef.current = map
    routeLayerRef.current = L.layerGroup().addTo(map)

    if (demoMapMode) {
      map.setMaxBounds(L.latLngBounds([0, 0], [1, 1]))
      const floorImageUrl =
        selectedFloor === 'F1'
          ? '/demo_airport/floors/F1.png'
          : '/demo_airport/floors/F2.png'
      L.imageOverlay(floorImageUrl, L.latLngBounds([0, 0], [1, 1]), { zIndex: 0 }).addTo(map)
      return () => map.remove()
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)
    map.setView([20, 0], 2)
    resizeTimer = setTimeout(() => {
      map.invalidateSize()
    }, 100)

    async function loadData() {
      const pts = (await (await fetch('/api/points')).json()) as { id: number; name?: string; lat: number; lng: number }[]
      const edges = (await (await fetch('/api/edges')).json()) as { from_id: number; to_id: number }[]

      edges.forEach((e) => {
        const from = pts.find((p) => p.id === e.from_id)
        const to = pts.find((p) => p.id === e.to_id)
        if (from && to) {
          L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: '#888' }).addTo(map)
        }
      })

      pts.forEach((p) => {
        const m = L.marker([p.lat, p.lng]).addTo(map).bindPopup(p.name ?? `Gate ${p.id}`)
        m.bindTooltip(p.name ?? `Gate ${p.id}`, {
          permanent: true,
          direction: 'top',
          className: 'gate-label',
          offset: [0, -8],
        })
        m.on('click', () => {
          window.dispatchEvent(new CustomEvent('point-click', { detail: { id: p.id } }))
        })
        markersRef.current[p.id] = m
      })

      const group = new L.FeatureGroup(Object.values(markersRef.current))
      map.fitBounds(group.getBounds().pad(0.3))
    }

    loadData().catch(console.error)

    const routeListener = async (ev: CustomEvent<{ from: number; to: number }>) => {
      const { from, to } = ev.detail
      if (!from || !to) return
      const res = await fetch(`/api/route?from=${from}&to=${to}`)
      const json = await res.json()
      routeLayerRef.current?.clearLayers()
      if (json?.nodes?.length) {
        const latlngs = json.nodes.map((n: { lat: number; lng: number }) => [n.lat, n.lng])
        L.polyline(latlngs, { color: '#2196f3', weight: 5 }).addTo(routeLayerRef.current!)
      }
    }

    const pointClickListener = (ev: CustomEvent<{ id: number }>) => {
      const { id } = ev.detail
      if (!startIdRef.current) {
        window.dispatchEvent(new CustomEvent('set-start', { detail: { id } }))
      } else {
        window.dispatchEvent(new CustomEvent('set-end', { detail: { id } }))
      }
    }

    window.addEventListener('route-request', routeListener as unknown as EventListener)
    window.addEventListener('point-click', pointClickListener as unknown as EventListener)

    return () => {
      if (resizeTimer != null) clearTimeout(resizeTimer)
      window.removeEventListener('route-request', routeListener as unknown as EventListener)
      window.removeEventListener('point-click', pointClickListener as unknown as EventListener)
      map.remove()
    }
  }, [demoMapMode, selectedFloor])

  // react to start/end changes
  useEffect(() => {
    if (startId && endId) {
      window.dispatchEvent(new CustomEvent('route-request', { detail: { from: startId, to: endId } }))
    }
  }, [startId, endId])

  // Graph der aktuellen Floor laden – direkt aus statischer Datei (wie im Admin)
  useEffect(() => {
    if (!demoMapMode || !selectedFloor) {
      setGraphData(null)
      return
    }
    const staticUrl = `/airport-maps/demo_airport/graphs/${selectedFloor}.json`
    const apiUrl = `/api/airport-map/graph/${selectedFloor}`
    const load = (url: string) =>
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status))
          return r.json()
        })
        .then((data: { nodes?: { id: string; x: number; y: number; type: string }[]; edges?: { from: string; to: string }[]; image?: { width: number; height: number } }) => {
          const nodes = data.nodes || []
          const edges = data.edges || []
          const w = data.image?.width ?? IMG_W
          const h = data.image?.height ?? IMG_H
          setGraphData({ nodes, edges, width: w, height: h })
        })
    load(staticUrl).catch(() => load(apiUrl).catch(() => setGraphData(null)))
  }, [demoMapMode, selectedFloor])

  // Route laden wenn Standort + Ziel gewählt; Karte auf Floor der Route stellen
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/663dad05-71f3-4268-9f23-559598a3a1db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'MapView.tsx:route-effect', message: 'route effect run', data: { startId, endId, startIdType: typeof startId, endIdType: typeof endId }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H2' }) }).catch(() => {})
    // #endregion
    if (!demoMapMode || startId == null || endId == null || startId === 0 || endId === 0) {
      setRouteNodes([])
      return
    }
    let cancelled = false
    fetch(`/api/airport-map/route?from=${startId}&to=${endId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Route ${r.status}`)
        return r.json()
      })
      .then((data: { nodes?: { lat: number; lng: number; floorId: string; nodeId?: string }[] }) => {
        if (cancelled) return
        const nodes = Array.isArray(data?.nodes) ? data.nodes : []
        const firstFloorId = nodes[0]?.floorId
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/663dad05-71f3-4268-9f23-559598a3a1db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'MapView.tsx:route-then', message: 'route response in MapView', data: { nodesLength: nodes.length, firstFloorId }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' }) }).catch(() => {})
        // #endregion
        setRouteNodes(nodes)
        if (nodes.length > 0 && onSuggestFloor) {
          onSuggestFloor(nodes[0].floorId)
        }
      })
      .catch(() => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/663dad05-71f3-4268-9f23-559598a3a1db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'MapView.tsx:route-catch', message: 'route fetch failed in MapView', data: {}, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' }) }).catch(() => {})
        // #endregion
        if (!cancelled) setRouteNodes([])
      })
    return () => { cancelled = true }
  }, [demoMapMode, startId, endId, onSuggestFloor])

  // Route-Punkte für aktuell gewählte Floor aus gespeicherter Route ableiten
  useEffect(() => {
    if (routeNodes.length === 0) {
      setRoutePoints([])
      return
    }
    const nodesOnFloor = routeNodes.filter((n) => n.floorId === selectedFloor)
    const display: { x: number; y: number }[] = nodesOnFloor.map((n) => {
      const lng = n.lng
      const lat = n.lat
      const displayLng = lng
      const displayLat =
        selectedFloor === 'F1' ? (lat - 0.5) * 2 : selectedFloor === 'F2' ? lat * 2 : lat
      return { x: displayLng, y: 1 - displayLat }
    })
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/663dad05-71f3-4268-9f23-559598a3a1db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'MapView.tsx:routePoints-effect', message: 'routePoints derived', data: { routeNodesLength: routeNodes.length, selectedFloor, nodesOnFloorLength: nodesOnFloor.length, displayLength: display.length }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H3' }) }).catch(() => {})
    // #endregion
    setRoutePoints(display)
  }, [routeNodes, selectedFloor])

  // react to external set-start / set-end
  useEffect(() => {
    const setStart = (ev: any) => {
      const id = ev.detail.id
      window.dispatchEvent(new CustomEvent('select-start-in-ui', { detail: { id } }))
    }
    window.addEventListener('set-start', setStart as EventListener)
    return () => window.removeEventListener('set-start', setStart as EventListener)
  }, [])

  if (demoMapMode) {
    const floorSrc =
      floors.find((f) => f.id === selectedFloor)?.image ??
      `/airport-maps/demo_airport/floors/${selectedFloor}.png`

    const hasGraph = graphData && (graphData.nodes.length > 0 || graphData.edges.length > 0)
    const nodeById = graphData ? Object.fromEntries(graphData.nodes.map((n) => [n.id, n])) : {}
    const gw = graphData?.width ?? IMG_W
    const gh = graphData?.height ?? IMG_H
    const viewBox = `0 0 ${gw} ${gh}`
    const routeStartNodeId = routeNodes.length > 0 ? routeNodes[0].nodeId : null
    const routeEndNodeId = routeNodes.length > 1 ? routeNodes[routeNodes.length - 1].nodeId : null

    return (
      <div
        ref={floorWrapRef}
        className="leaflet-container leaflet-container-demo floor-image-wrap nav-map-wrap"
      >
        <img
          src={floorSrc}
          alt={selectedFloor === 'F1' ? 'Floor 1' : 'Floor 2'}
          className="floor-image"
        />
        <svg
          className="path-overlay-svg nav-graph-overlay"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          {hasGraph && (
            <>
              {graphData!.edges.map((ed) => {
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
                    className="nav-graph-edge"
                  />
                )
              })}
              {graphData!.nodes.map((n) => {
                const isRouteStart = n.id === routeStartNodeId && routeNodes[0]?.floorId === selectedFloor
                const isRouteEnd = n.id === routeEndNodeId && routeNodes[routeNodes.length - 1]?.floorId === selectedFloor
                const extraClass = isRouteStart ? ' nav-graph-node-route-start' : isRouteEnd ? ' nav-graph-node-route-end' : ''
                return (
                  <circle
                    key={n.id}
                    cx={n.x}
                    cy={n.y}
                    r={18}
                    className={`nav-graph-node nav-graph-node-${n.type}${extraClass}`}
                  />
                )
              })}
            </>
          )}
          {routePoints.length >= 2 && (
            <path
              d={`M ${routePoints.map((p) => `${p.x * gw},${p.y * gh}`).join(' L ')}`}
              className="route-overlay-line"
              fill="none"
            />
          )}
        </svg>
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      className="leaflet-container"
    />
  )
}
