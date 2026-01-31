import React, { Component, useState, useRef, useEffect } from 'react'
import MapView from './components/MapView'
import SearchBar from './components/SearchBar'
import DepartureList from './components/DepartureList'

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

type FloorId = 'F1' | 'F2'

export default function App() {
  const [start, setStart] = useState<number | null>(null)
  const [end, setEnd] = useState<number | null>(null)
  const [view, setView] = useState<ViewMode>('navigation')
  const [demoMapMode] = useState(true)
  const [selectedFloor, setSelectedFloor] = useState<FloorId>('F1')
  const [floorDropdownOpen, setFloorDropdownOpen] = useState(false)
  const floorSelectorRef = useRef<HTMLDivElement>(null)

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
      <div className="app">
        <header className="header">
          <h1 className="header-title">Airport Navigator</h1>
          <nav className="header-nav" aria-label="Hauptmenü">
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
                  key={`demo-${selectedFloor}`}
                  demoMapMode={demoMapMode}
                  selectedFloor={selectedFloor}
                  startId={start}
                  endId={end}
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
                      {selectedFloor === 'F1' ? 'Floor 1' : 'Floor 2'}
                    </span>
                    <span className="floor-selector-chevron" aria-hidden>▼</span>
                  </button>
                  {floorDropdownOpen && (
                    <ul
                      className="floor-selector-dropdown"
                      role="listbox"
                      aria-label="Etage"
                    >
                      <li role="option">
                        <button
                          type="button"
                          className={`floor-selector-option ${selectedFloor === 'F1' ? 'active' : ''}`}
                          onClick={() => { setSelectedFloor('F1'); setFloorDropdownOpen(false) }}
                        >
                          <span className="floor-option-icon" aria-hidden />
                          Floor 1
                        </button>
                      </li>
                      <li role="option">
                        <button
                          type="button"
                          className={`floor-selector-option ${selectedFloor === 'F2' ? 'active' : ''}`}
                          onClick={() => { setSelectedFloor('F2'); setFloorDropdownOpen(false) }}
                        >
                          <span className="floor-option-icon" aria-hidden />
                          Floor 2
                        </button>
                      </li>
                    </ul>
                  )}
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
    </ErrorBoundary>
  )
}
