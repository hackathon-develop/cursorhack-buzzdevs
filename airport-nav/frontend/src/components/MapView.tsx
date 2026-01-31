import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Props = {
  startId?: number | null
  endId?: number | null
}

export default function MapView({ startId, endId }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<number, L.Marker>>({})
  const routeLayerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!mapRef.current) return
    const map = L.map(mapRef.current).setView([40.0, -73.0], 17)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
    }).addTo(map)
    mapInstanceRef.current = map
    routeLayerRef.current = L.layerGroup().addTo(map)

    async function loadData() {
      const pts = (await (await fetch('/api/points')).json()) as any[]
      const edges = (await (await fetch('/api/edges')).json()) as any[]

      // draw edges
      edges.forEach((e) => {
        const from = pts.find((p) => p.id === e.from_id)
        const to = pts.find((p) => p.id === e.to_id)
        if (from && to) {
          L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: '#888' }).addTo(map)
        }
      })

      // place markers
      pts.forEach((p) => {
        const m = L.marker([p.lat, p.lng]).addTo(map).bindPopup(p.name)
        m.on('click', () => {
          window.dispatchEvent(new CustomEvent('point-click', { detail: { id: p.id } }))
        })
        markersRef.current[p.id] = m
      })

      // fit to points
      const group = new L.FeatureGroup(Object.values(markersRef.current))
      map.fitBounds(group.getBounds().pad(0.3))
    }

    loadData().catch(console.error)

    const routeListener = async (ev: any) => {
      const { from, to } = ev.detail
      if (!from || !to) return
      const res = await fetch(`/api/route?from=${from}&to=${to}`)
      const json = await res.json()
      drawRoute(json)
    }

    const pointClickListener = (ev: any) => {
      const { id } = ev.detail
      // simple behavior: alternate setting start/end
      if (!startId) {
        window.dispatchEvent(new CustomEvent('set-start', { detail: { id } }))
      } else {
        window.dispatchEvent(new CustomEvent('set-end', { detail: { id } }))
      }
    }

    window.addEventListener('route-request', routeListener as EventListener)
    window.addEventListener('point-click', pointClickListener as EventListener)

    return () => {
      window.removeEventListener('route-request', routeListener as EventListener)
      window.removeEventListener('point-click', pointClickListener as EventListener)
      map.remove()
    }

    // draw route function
    function drawRoute(path: any) {
      routeLayerRef.current?.clearLayers()
      if (!path || !path.nodes || path.nodes.length === 0) return
      const latlngs = path.nodes.map((n: any) => [n.lat, n.lng])
      L.polyline(latlngs, { color: '#2196f3', weight: 5 }).addTo(routeLayerRef.current!)
    }
  }, [])

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

  return <div ref={mapRef} className="leaflet-container" />
}
