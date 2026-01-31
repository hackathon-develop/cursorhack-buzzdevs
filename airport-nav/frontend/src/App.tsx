import React, { useState } from 'react'
import MapView from './components/MapView'
import SearchBar from './components/SearchBar'

export default function App() {
  const [start, setStart] = useState<number | null>(null)
  const [end, setEnd] = useState<number | null>(null)

  return (
    <div className="app">
      <header className="header">
        <h1>Airport Navigator (MVP)</h1>
      </header>
      <main className="main">
        <aside className="sidebar">
          <SearchBar onSelectStart={setStart} onSelectEnd={setEnd} />
          <div className="actions">
            <button
              onClick={async () => {
                if (start && end) {
                  // trigger map to fetch route via custom event
                  window.dispatchEvent(
                    new CustomEvent('route-request', { detail: { from: start, to: end } })
                  )
                }
              }}
            >
              Show Route
            </button>
          </div>
        </aside>
        <section className="map-container">
          <MapView startId={start} endId={end} />
        </section>
      </main>
    </div>
  )
}
