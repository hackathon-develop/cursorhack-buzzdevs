import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Props = {
  demoMapMode?: boolean
  selectedFloor?: 'F1' | 'F2'
  startId?: number | null
  endId?: number | null
}

const IMG_W = 2000
const IMG_H = 1200

export default function MapView({ demoMapMode = false, selectedFloor = 'F1', startId, endId }: Props) {
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
        const m = L.marker([p.lat, p.lng]).addTo(map).bindPopup(p.name)
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

    window.addEventListener('route-request', routeListener as EventListener)
    window.addEventListener('point-click', pointClickListener as EventListener)

    return () => {
      if (resizeTimer != null) clearTimeout(resizeTimer)
      window.removeEventListener('route-request', routeListener as EventListener)
      window.removeEventListener('point-click', pointClickListener as EventListener)
      map.remove()
    }
  }, [demoMapMode, selectedFloor])

  // react to start/end changes
  useEffect(() => {
    if (startId && endId) {
      window.dispatchEvent(new CustomEvent('route-request', { detail: { from: startId, to: endId } }))
    }
  }, [startId, endId])

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
    const floorSrc = selectedFloor === 'F1' ? '/demo_airport/floors/F1.png' : '/demo_airport/floors/F2.png'
    const F2_GATES = [
      { id: 'G01', x: 435, y: 320 },
      { id: 'G02', x: 645, y: 320 },
      { id: 'G03', x: 855, y: 320 },
      { id: 'G04', x: 1145, y: 320 },
      { id: 'G05', x: 1355, y: 320 },
      { id: 'G06', x: 1565, y: 320 },
    ] as const

    const getGatePos = (gate: { id: string; x: number; y: number }) => {
      const custom = customPositions[gate.id]
      if (custom) return { left: `${custom.x * 100}%`, top: `${custom.y * 100}%` }
      return {
        left: `${(gate.x / IMG_W) * 100}%`,
        top: `${(gate.y / IMG_H) * 100}%`,
      }
    }

    const handleFloorClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('.floor-pin-positioning-bar, .floor-pin, .path-drawing-bar')) return
      if (!floorWrapRef.current) return
      const wrap = floorWrapRef.current
      const rect = wrap.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
      if (positioningGate && selectedFloor === 'F2') {
        setCustomPositions((prev) => ({ ...prev, [positioningGate]: { x, y } }))
        setPositioningGate(null)
        return
      }
      if (drawingMode) {
        setPathPoints((prev) => [...prev, { x, y }])
      }
    }

    const pathPointsForSvg = pathPoints.length < 2 ? [] : pathPoints
    const pathD = pathPointsForSvg.length
      ? `M ${pathPointsForSvg.map((p) => `${p.x},${p.y}`).join(' L ')}`
      : ''

    return (
      <div
        ref={floorWrapRef}
        className={`leaflet-container leaflet-container-demo floor-image-wrap ${positioningGate || drawingMode ? 'floor-positioning-mode' : ''}`}
        onClick={handleFloorClick}
        role={positioningGate || drawingMode ? 'button' : undefined}
        aria-label={positioningGate ? `Klicken Sie auf die Karte, um Gate ${positioningGate} zu positionieren` : drawingMode ? 'Klicken Sie, um einen Punkt zum Weg hinzuzufügen' : undefined}
      >
        <img
          src={floorSrc}
          alt={selectedFloor === 'F1' ? 'Floor 1' : 'Floor 2'}
          className="floor-image"
        />
        {pathPoints.length > 0 && (
          <svg
            className="path-overlay-svg"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path d={pathD} className="path-overlay-line" fill="none" />
            {pathPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={0.012} className="path-overlay-dot" />
            ))}
          </svg>
        )}
        <div className="floor-bottom-bars">
          <div className="path-drawing-bar">
            <button
              type="button"
              className={`path-draw-btn ${drawingMode ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setDrawingMode((on) => !on); if (positioningGate) setPositioningGate(null); }}
            >
              {drawingMode ? 'Zeichnen beenden' : 'Weg zeichnen'}
            </button>
            <button
              type="button"
              className="path-clear-btn"
              onClick={(e) => { e.stopPropagation(); setPathPoints([]); }}
            >
              Weg löschen
            </button>
            {drawingMode && (
              <span className="path-draw-hint">Klicken Sie auf die Karte, um Punkte zu setzen.</span>
            )}
          </div>
          {selectedFloor === 'F2' && (
            <div className="floor-pin-positioning-bar">
              <span className="floor-position-label">Gate-Position setzen:</span>
              {F2_GATES.map((gate) => (
                <button
                  key={gate.id}
                  type="button"
                  className={`floor-position-btn ${positioningGate === gate.id ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setPositioningGate((g) => (g === gate.id ? null : gate.id)) }}
                >
                  {gate.id}
                </button>
              ))}
              {positioningGate && (
                <span className="floor-position-hint">Klicken Sie auf die Karte, um Gate {positioningGate} zu platzieren.</span>
              )}
            </div>
          )}
        </div>
        {selectedFloor === 'F2' && (
            <div className={`floor-pins-overlay ${positioningGate ? 'floor-pins-overlay-pass-through' : ''}`} aria-hidden>
              {F2_GATES.map((gate) => (
                <div
                  key={gate.id}
                  className="floor-pin floor-pin-label-only"
                  style={getGatePos(gate)}
                  title={`Gate ${gate.id}`}
                >
                  <span className="floor-pin-label">Gate {gate.id}</span>
                </div>
              ))}
            </div>
        )}
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
