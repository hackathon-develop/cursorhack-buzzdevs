import React, { Component, useState, useRef, useEffect } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import MapView from './components/MapView'
import SearchBar from './components/SearchBar'
import DepartureList from './components/DepartureList'
import AdminLayout from './admin/AdminLayout'

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="app" style={{ padding: 20 }}>
          <h1>Fehler</h1>
          <pre style={{ background: '#f0f0f0', padding: 12, overflow: 'auto' }}>
            {this.state.error.message}
          </pre>
          <button type="button" onClick={() => this.setState({ hasError: false, error: null })}>
            Erneut versuchen
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

type ViewMode = 'navigation' | 'abfluge'

type FloorItem = { id: string; image: string; width?: number; height?: number }

export default function App() {
  const [start, setStart] = useState<number | null>(null)
  const [end, setEnd] = useState<number | null>(null)
  const [view, setView] = useState<ViewMode>('navigation')
  const [demoMapMode] = useState(true)
  const [manifest, setManifest] = useState<{ floors: FloorItem[]; default_floor: string } | null>(null)
  const [selectedFloor, setSelectedFloor] = useState<string>('F1')
  const [floorDropdownOpen, setFloorDropdownOpen] = useState(false)
  const floorSelectorRef = useRef<HTMLDivElement>(null)
  const manifestInitialFloorSet = useRef(false)

  useEffect(() => {
    if (!demoMapMode) return
    fetch('/api/airport-map/manifest')
      .then((r) => r.json())
      .then((data) => {
        const floors = (data.floors || []) as FloorItem[]
        const defaultFloor = data.default_floor || (floors[0]?.id ?? 'F1')
        setManifest({ floors, default_floor: defaultFloor })
        if (!manifestInitialFloorSet.current) {
          manifestInitialFloorSet.current = true
          setSelectedFloor(defaultFloor)
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/663dad05-71f3-4268-9f23-559598a3a1db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'App.tsx:manifest-then', message: 'manifest set initial floor', data: { defaultFloor }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H5' }) }).catch(() => {})
          // #endregion
        }
      })
      .catch(() => setManifest(null))
  }, [demoMapMode])

  // Sobald Standort + Ziel gewählt: Route laden und automatisch zur Etage des Starts wechseln (z. B. F2 bei G01/G02)
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/663dad05-71f3-4268-9f23-559598a3a1db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'App.tsx:route-effect', message: 'route effect run', data: { demoMapMode, start, end, startType: typeof start, endType: typeof end }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H2,H4' }) }).catch(() => {})
    // #endregion
    if (!demoMapMode || start == null || end == null || start === 0 || end === 0) return
    let cancelled = false
    fetch(`/api/airport-map/route?from=${start}&to=${end}`)
      .then((r) => r.json())
      .then((data: { nodes?: { floorId: string }[] }) => {
        if (cancelled) return
        const nodes = Array.isArray(data?.nodes) ? data.nodes : []
        const firstFloorId = nodes[0]?.floorId
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/663dad05-71f3-4268-9f23-559598a3a1db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'App.tsx:route-then', message: 'route response in App', data: { nodesLength: nodes.length, firstFloorId }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H4' }) }).catch(() => {})
        // #endregion
        if (nodes.length > 0) setSelectedFloor(firstFloorId)
      })
      .catch(() => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/663dad05-71f3-4268-9f23-559598a3a1db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'App.tsx:route-catch', message: 'route fetch failed in App', data: {}, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H4' }) }).catch(() => {})
        // #endregion
      })
    return () => { cancelled = true }
  }, [demoMapMode, start, end])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (floorSelectorRef.current && !floorSelectorRef.current.contains(e.target as Node)) {
        setFloorDropdownOpen(false)
      }
    }
    if (floorDropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [floorDropdownOpen])

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/admin/*" element={<AdminLayout />} />
        <Route
          path="/*"
          element={
            <div className="app">
              <header className="header">
                <h1 className="header-title">Airport Navigator</h1>
                <nav className="header-nav" aria-label="Hauptmenü">
                  <Link to="/admin" className="header-nav-btn">Admin</Link>
                  <button
                    type="button"
                    className={`header-nav-btn ${view === 'navigation' ? 'active' : ''}`}
                    onClick={() => setView('navigation')}
                  >
                    Navigation
                  </button>
                  <button
                    type="button"
                    className={`header-nav-btn ${view === 'abfluge' ? 'active' : ''}`}
                    onClick={() => setView('abfluge')}
                  >
                    Abflüge
                  </button>
                </nav>
              </header>
        <main className="main">
          {view === 'navigation' ? (
            <>
              <aside className="sidebar">
                <SearchBar demoMapMode={demoMapMode} onSelectStart={setStart} onSelectEnd={setEnd} />
              </aside>
              <section className="map-container">
                <MapView
                  demoMapMode={demoMapMode}
                  selectedFloor={selectedFloor}
                  floors={manifest?.floors ?? []}
                  startId={start}
                  endId={end}
                  onSuggestFloor={setSelectedFloor}
                />
                <div className="floor-selector-wrap" ref={floorSelectorRef}>
                  <button
                    type="button"
                    className="floor-selector-trigger"
                    onClick={() => setFloorDropdownOpen((o) => !o)}
                    aria-expanded={floorDropdownOpen}
                    aria-haspopup="listbox"
                    aria-label="Etage wählen"
                  >
                    <span className="floor-selector-icon" aria-hidden />
                    <span className="floor-selector-label">
                      {selectedFloor || 'Floor'}
                    </span>
                    <span className="floor-selector-chevron" aria-hidden>▼</span>
                  </button>
                  {floorDropdownOpen && (manifest?.floors?.length ? (
                    <ul
                      className="floor-selector-dropdown"
                      role="listbox"
                      aria-label="Etage"
                    >
                      {manifest.floors.map((f) => (
                        <li key={f.id} role="option">
                          <button
                            type="button"
                            className={`floor-selector-option ${selectedFloor === f.id ? 'active' : ''}`}
                            onClick={() => { setSelectedFloor(f.id); setFloorDropdownOpen(false) }}
                          >
                            <span className="floor-option-icon" aria-hidden />
                            {f.id}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="floor-selector-dropdown" role="listbox" aria-label="Etage">
                      <li role="option">
                        <button type="button" className={`floor-selector-option ${selectedFloor === 'F1' ? 'active' : ''}`} onClick={() => { setSelectedFloor('F1'); setFloorDropdownOpen(false) }}>
                          F1
                        </button>
                      </li>
                      <li role="option">
                        <button type="button" className={`floor-selector-option ${selectedFloor === 'F2' ? 'active' : ''}`} onClick={() => { setSelectedFloor('F2'); setFloorDropdownOpen(false) }}>
                          F2
                        </button>
                      </li>
                    </ul>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="departure-container">
              <DepartureList />
            </section>
          )}
        </main>
            </div>
          }
        />
      </Routes>
    </ErrorBoundary>
  )
}
