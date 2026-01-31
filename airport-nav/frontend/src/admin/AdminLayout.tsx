import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import FloorEditor from './FloorEditor'

type Airport = { id: string; name: string; path: string }
type Floor = { id: string; image: string; width: number; height: number }

export default function AdminLayout() {
  const [airports, setAirports] = useState<Airport[]>([])
  const [selectedAirportId, setSelectedAirportId] = useState<string | null>(null)
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/airports')
      .then((r) => {
        const ct = r.headers.get('content-type') || ''
        if (!ct.includes('application/json')) {
          throw new Error('Backend antwortet nicht mit JSON. Ist das Backend gestartet? (Im Ordner backend: npm start)')
        }
        if (!r.ok) throw new Error(`API: ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setAirports(data.airports || [])
        setError(null)
        if ((data.airports || []).length > 0 && !selectedAirportId) {
          setSelectedAirportId(data.airports[0].id)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedAirportId) {
      setFloors([])
      setSelectedFloorId(null)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/admin/airports/${selectedAirportId}`)
      .then((r) => {
        const ct = r.headers.get('content-type') || ''
        if (!ct.includes('application/json')) {
          throw new Error('Backend antwortet nicht mit JSON. Backend starten? (backend: npm start)')
        }
        if (!r.ok) throw new Error('Flughafen nicht gefunden')
        return r.json()
      })
      .then((data) => {
        setFloors(data.floors || [])
        setSelectedFloorId(
          (data.floors || []).length > 0
            ? (data.floors[0] as Floor).id
            : null
        )
      })
      .catch((e) => {
        setError(e.message)
        setFloors([])
        setSelectedFloorId(null)
      })
      .finally(() => setLoading(false))
  }, [selectedAirportId])

  const selectedFloor = floors.find((f) => f.id === selectedFloorId)

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <Link to="/" className="admin-back">
          ← Zurück
        </Link>
        <h1 className="admin-title">Admin – Floor zeichnen</h1>
      </header>
      <div className="admin-body">
        <aside className="admin-sidebar">
          <section className="admin-section">
            <h2 className="admin-section-title">Flughafen</h2>
            {loading && !airports.length ? (
              <p className="admin-muted">Lade …</p>
            ) : error && !airports.length ? (
              <p className="admin-error">{error}</p>
            ) : (
              <ul className="admin-list">
                {airports.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className={`admin-list-btn ${selectedAirportId === a.id ? 'active' : ''}`}
                      onClick={() => setSelectedAirportId(a.id)}
                    >
                      {a.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="admin-section">
            <h2 className="admin-section-title">Floor</h2>
            {loading && !floors.length ? (
              <p className="admin-muted">Lade …</p>
            ) : (
              <ul className="admin-list">
                {floors.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className={`admin-list-btn ${selectedFloorId === f.id ? 'active' : ''}`}
                      onClick={() => setSelectedFloorId(f.id)}
                    >
                      {f.id}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
        <main className="admin-main">
          {selectedAirportId && selectedFloor ? (
            <FloorEditor
              airportId={selectedAirportId}
              floorId={selectedFloor.id}
              floorImageUrl={selectedFloor.image}
              width={selectedFloor.width}
              height={selectedFloor.height}
            />
          ) : (
            <div className="admin-placeholder">
              Wähle einen Flughafen und eine Floor.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
