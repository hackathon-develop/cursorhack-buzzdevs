import React, { useEffect, useRef, useState } from 'react'

/** Fallback-Ziele, wenn Hamburg Airport API nicht verfügbar */
const FALLBACK_DESTINATIONS = [
  'Deutschland',
  'Frankreich',
  'Spanien',
  'USA',
  'Italien',
  'Vereinigtes Königreich',
  'Schweiz',
  'Österreich',
]

/** Flug: Flugnummer, Abflugzeit, Gate (Node-ID), Gate-Name */
type FlightOption = { flightNumber: string; time: string; gateId: number; gateName: string }

/** Roh-Flug von Hamburg Airport API */
type ApiFlight = { flightNumber: string; time: string; gateName: string | null; destination: string | null; destinationCode?: string }

/** Gate-String von API (z.B. "A12", "1/12") auf unseren Knotennamen (A1–A20, B1–B20) mappen */
function resolveGateName(apiGate: string | null, points: { id: number; name?: string }[]): string | null {
  if (!apiGate || typeof apiGate !== 'string' || !apiGate.trim()) return null
  const raw = apiGate.trim().toUpperCase()
  const safeName = (p: { name?: string }) => (p.name && typeof p.name === 'string' ? p.name.toUpperCase() : '')
  // Direkt "A12" oder "B3"
  if (/^[AB]\d{1,2}$/.test(raw)) {
    const found = points.find((p) => safeName(p) === raw)
    return found && found.name ? found.name : raw
  }
  // Terminal/Gate "1/12" oder "2/5" → A12, B5
  const match = raw.match(/^(\d+)[\/\-](\d+)$/)
  if (match) {
    const terminal = parseInt(match[1], 10)
    const gate = match[2]
    const name = terminal === 1 ? `A${gate}` : `B${gate}`
    const found = points.find((p) => safeName(p) === name)
    return found && found.name ? found.name : name
  }
  const found = points.find((p) => safeName(p) === raw)
  return found && found.name ? found.name : raw
}

type Props = {
  demoMapMode?: boolean
  onSelectStart: (id: number | null) => void
  onSelectEnd: (id: number | null) => void
}

/** Fallback-Restaurants, wenn API leer oder fehlschlägt – immer Vorschläge anzeigen */
const FALLBACK_RESTAURANTS: { id: number; name: string; tags: string[] }[] = [
  { id: 43, name: 'Food Court', tags: ['Burger', 'Hamburger', 'Getränke', 'Drinks', 'Snacks', 'Pizza'] },
  { id: 44, name: 'Café Central', tags: ['Getränke', 'Drinks', 'Kaffee', 'Kuchen', 'Snacks'] },
  { id: 45, name: 'Restaurant Lounge', tags: ['Burger', 'Getränke', 'Drinks', 'Steak', 'Salat'] },
  { id: 46, name: 'Bistro Gate A', tags: ['Hamburger', 'Getränke', 'Drinks', 'Sandwich', 'Snacks'] },
]

/** Fallback-Flüge pro Zielland (wenn API nicht verfügbar) */
const FALLBACK_FLIGHTS: Record<string, FlightOption[]> = {
  Deutschland: [
    { flightNumber: 'LH 401', time: '08:30', gateId: 3, gateName: 'A1' },
    { flightNumber: 'LH 403', time: '14:00', gateId: 3, gateName: 'A1' },
  ],
  Frankreich: [
    { flightNumber: 'AF 102', time: '09:15', gateId: 4, gateName: 'A2' },
  ],
  Spanien: [{ flightNumber: 'IB 301', time: '10:00', gateId: 5, gateName: 'A3' }],
  USA: [{ flightNumber: 'AA 501', time: '07:45', gateId: 6, gateName: 'A4' }],
  Italien: [{ flightNumber: 'AZ 701', time: '11:00', gateId: 9, gateName: 'A7' }],
  'Vereinigtes Königreich': [{ flightNumber: 'BA 801', time: '08:00', gateId: 23, gateName: 'B1' }],
  Schweiz: [{ flightNumber: 'LX 901', time: '09:45', gateId: 11, gateName: 'A9' }],
  Österreich: [{ flightNumber: 'OS 601', time: '10:30', gateId: 25, gateName: 'B3' }],
}

export default function SearchBar({ demoMapMode = false, onSelectStart, onSelectEnd }: Props) {
  const [points, setPoints] = useState<{ id: number; name: string }[]>([])
  const [startId, setStartId] = useState<number | null>(null)
  const [countryInput, setCountryInput] = useState('')
  const [countrySelected, setCountrySelected] = useState<string | null>(null)
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [selectedFlight, setSelectedFlight] = useState<FlightOption | null>(null)
  const [endIdFromMap, setEndIdFromMap] = useState<number | null>(null)
  const [showStandortDropdown, setShowStandortDropdown] = useState(false)
  const [showZielDropdown, setShowZielDropdown] = useState(false)
  const [routeWalkingMinutes, setRouteWalkingMinutes] = useState<number | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [apiFlights, setApiFlights] = useState<ApiFlight[]>([])
  const [apiError, setApiError] = useState<string | null>(null)
  const [wantFood, setWantFood] = useState<boolean | null>(null)
  const [foodWish, setFoodWish] = useState('Hamburger')
  const [restaurants, setRestaurants] = useState<{ id: number; name: string; tags?: string[] }[]>([])
  const countryDropdownRef = useRef<HTMLDivElement>(null)
  const standortDropdownRef = useRef<HTMLDivElement>(null)
  const zielDropdownRef = useRef<HTMLDivElement>(null)

  const endId = selectedFlight?.gateId ?? endIdFromMap

  const apiRestaurants = demoMapMode ? '/api/airport-map/restaurants' : '/api/restaurants'
  useEffect(() => {
    fetch(apiRestaurants)
      .then((r) => r.json())
      .then((data: unknown) => {
        const list = Array.isArray(data) ? data : []
        const mapped = list.map((r: { id?: number; name?: string; tags?: string[] }) => ({
          id: r.id ?? 0,
          name: typeof r.name === 'string' ? r.name : '',
          tags: Array.isArray(r.tags) ? r.tags : [],
        })).filter((r) => r.id && r.name)
        setRestaurants(mapped.length > 0 ? mapped : FALLBACK_RESTAURANTS)
      })
      .catch(() => setRestaurants(FALLBACK_RESTAURANTS))
  }, [demoMapMode])

  // Hamburg Airport API: Abflüge laden
  useEffect(() => {
    fetch('/api/departures')
      .then((r) => r.json())
      .then((data: { flights?: ApiFlight[]; error?: string }) => {
        setApiError(data.error || null)
        setApiFlights(Array.isArray(data.flights) ? data.flights : [])
      })
      .catch(() => {
        setApiError('Abflüge konnten nicht geladen werden.')
        setApiFlights([])
      })
  }, [])

  // Update current time every second for departure countdown
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const apiRoute = demoMapMode ? '/api/airport-map/route' : '/api/route'
  useEffect(() => {
    if (!startId || !endId) {
      setRouteWalkingMinutes(null)
      return
    }
    fetch(`${apiRoute}?from=${startId}&to=${endId}`)
      .then((r) => r.json())
      .then((data: { walking_minutes?: number | null }) => {
        const m = data.walking_minutes
        setRouteWalkingMinutes(typeof m === 'number' && Number.isFinite(m) && m >= 0 ? m : null)
      })
      .catch(() => setRouteWalkingMinutes(null))
  }, [demoMapMode, startId, endId])

  // Zielliste: aus Hamburg API (einmalige Ziele) oder Fallback
  const destinationNames: string[] =
    apiFlights.length > 0
      ? [...new Set(apiFlights.map((f) => f.destination).filter((d): d is string => typeof d === 'string' && d.length > 0))].sort()
      : FALLBACK_DESTINATIONS

  const countryMatches = countryInput.trim()
    ? destinationNames.filter((c) =>
        typeof c === 'string' && c.toLowerCase().includes(countryInput.trim().toLowerCase())
      )
    : destinationNames

  // Flüge für gewähltes Ziel: aus API (mit Gate-Mapping) oder Fallback
  const flights: FlightOption[] = (() => {
    if (!countrySelected) return []
    if (apiFlights.length === 0) return FALLBACK_FLIGHTS[countrySelected] ?? []
    return apiFlights
      .filter((f) => f.destination === countrySelected)
      .map((f): FlightOption => {
        const gateName = resolveGateName(f.gateName, points)
        const point = gateName ? points.find((p) => p.name === gateName) : null
        const gateId = point ? point.id : 3
        const displayGate = gateName || f.gateName || '-'
        return {
          flightNumber: f.flightNumber,
          time: f.time,
          gateName: displayGate,
          gateId,
        }
      })
      .filter((f) => f.flightNumber)
  })()

  const apiPoints = demoMapMode ? '/api/airport-map/points' : '/api/points'
  useEffect(() => {
    fetch(apiPoints)
      .then((r) => r.json())
      .then((data: unknown) => {
        const list = Array.isArray(data) ? (data as { id: number; name: string }[]) : []
        setPoints(list.sort((a, b) => a.id - b.id))
      })
      .catch(() => setPoints([]))

    const fromSelect = (ev: CustomEvent<{ id: number }>) => {
      setStartId(ev.detail.id)
      onSelectStart(ev.detail.id)
    }
    const toSelect = (ev: CustomEvent<{ id: number }>) => {
      setEndIdFromMap(ev.detail.id)
      setCountrySelected(null)
      setCountryInput('')
      setSelectedFlight(null)
      onSelectEnd(ev.detail.id)
    }

    window.addEventListener('select-start-in-ui', fromSelect as EventListener)
    window.addEventListener('set-end', toSelect as EventListener)

    return () => {
      window.removeEventListener('select-start-in-ui', fromSelect as EventListener)
      window.removeEventListener('set-end', toSelect as EventListener)
    }
  }, [demoMapMode, onSelectStart, onSelectEnd])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(target)) {
        setShowCountryDropdown(false)
      }
      if (standortDropdownRef.current && !standortDropdownRef.current.contains(target)) {
        setShowStandortDropdown(false)
      }
      if (zielDropdownRef.current && !zielDropdownRef.current.contains(target)) {
        setShowZielDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleStandortSelect = (id: number | null) => {
    setStartId(id)
    onSelectStart(id)
    setShowStandortDropdown(false)
  }

  const selectedStandortName = startId ? points.find((p) => p.id === startId)?.name ?? '' : ''
  const pointsSorted = [...points].sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  const handleCountryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCountryInput(e.target.value)
    setCountrySelected(null)
    setSelectedFlight(null)
    setShowCountryDropdown(true)
    onSelectEnd(null)
  }

  const handleCountrySelect = (country: string) => {
    setCountryInput(country)
    setCountrySelected(country)
    setShowCountryDropdown(false)
    setSelectedFlight(null)
    onSelectEnd(null)
  }

  const handleFlightSelect = (flight: FlightOption) => {
    setSelectedFlight(flight)
    onSelectEnd(flight.gateId)
  }

  // Abflug-Countdown: immer aktuelle PC-Uhrzeit (new Date()) verwenden
  const currentTime = new Date()
  const timeStr = selectedFlight?.time != null && typeof selectedFlight.time === 'string' ? selectedFlight.time.trim() : ''
  const timeUntilDeparture =
    timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)
      ? (() => {
          const [h, m] = timeStr.split(':').map(Number)
          const dep = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), h, m ?? 0, 0, 0)
          if (dep.getTime() <= currentTime.getTime()) dep.setDate(dep.getDate() + 1)
          const ms = dep.getTime() - currentTime.getTime()
          if (ms <= 0) return null
          const totalSec = Math.floor(ms / 1000)
          const hours = Math.floor(totalSec / 3600)
          const min = Math.floor((totalSec % 3600) / 60)
          if (hours > 0) return `${hours}h ${min}min`
          return `${min}min`
        })()
      : null

  const departed = timeStr && /^\d{1,2}:\d{2}$/.test(timeStr) && (() => {
    const [h, m] = timeStr.split(':').map(Number)
    const dep = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), h, m ?? 0, 0, 0)
    return dep.getTime() <= currentTime.getTime()
  })()

  const walkingTimeText =
    routeWalkingMinutes != null
      ? routeWalkingMinutes < 1
        ? '< 1 min'
        : `${Math.round(routeWalkingMinutes * 10) / 10} min`
      : null

  return (
    <div className="nav-panel">
      <section className="nav-section" ref={standortDropdownRef}>
        <h3 className="nav-section-title">Ihr Standort</h3>
        <p className="nav-section-desc">Wo stehen Sie gerade?</p>
        <div className="standort-dropdown-wrap">
          <button
            type="button"
            className="standort-trigger"
            onClick={() => setShowStandortDropdown((v) => !v)}
            aria-expanded={showStandortDropdown}
            aria-haspopup="listbox"
            aria-label="Standort auswählen"
          >
            <span className={!selectedStandortName ? 'placeholder' : ''}>
              {selectedStandortName || '- Standort wählen -'}
            </span>
            <span className="standort-chevron" aria-hidden>▼</span>
          </button>
          {showStandortDropdown && (
            <ul
              className="standort-list"
              role="listbox"
              aria-label="Standort"
            >
              <li role="option">
                <button
                  type="button"
                  className={`standort-option ${startId === null ? 'active' : ''}`}
                  onClick={() => handleStandortSelect(null)}
                >
                  - Standort wählen -
                </button>
              </li>
              {pointsSorted.map((p) => (
                <li key={p.id} role="option">
                  <button
                    type="button"
                    className={`standort-option ${startId === p.id ? 'active' : ''}`}
                    onClick={() => handleStandortSelect(p.id)}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {demoMapMode ? (
        <section className="nav-section" ref={zielDropdownRef}>
          <h3 className="nav-section-title">Ziel</h3>
          <p className="nav-section-desc">Wohin möchten Sie? (wie auf der Karte)</p>
          <div className="standort-dropdown-wrap">
            <button
              type="button"
              className="standort-trigger"
              onClick={() => setShowZielDropdown((v) => !v)}
              aria-expanded={showZielDropdown}
              aria-haspopup="listbox"
              aria-label="Ziel auswählen"
            >
              <span className={!endId ? 'placeholder' : ''}>
                {endId ? (points.find((p) => p.id === endId)?.name ?? '') : '- Ziel wählen -'}
              </span>
              <span className="standort-chevron" aria-hidden>▼</span>
            </button>
            {showZielDropdown && (
              <ul
                className="standort-list"
                role="listbox"
                aria-label="Ziel"
              >
                {pointsSorted.map((p) => (
                  <li key={p.id} role="option">
                    <button
                      type="button"
                      className={`standort-option ${endId === p.id ? 'active' : ''}`}
                      onClick={() => {
                        setCountrySelected(null)
                        setCountryInput('')
                        setSelectedFlight(null)
                        setEndIdFromMap(p.id)
                        onSelectEnd(p.id)
                        setShowZielDropdown(false)
                      }}
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : (
        <section className="nav-section nav-section-zielland" ref={countryDropdownRef}>
          <h3 className="nav-section-title">Zielland</h3>
          <p className="nav-section-desc">
            {apiFlights.length > 0
              ? 'Abflüge vom Hamburg Airport – Ziel eintippen'
              : 'Land eintippen, Vorschläge auswählen'}
          </p>
          {apiError && (
            <p className="nav-section-api-hint" title={apiError}>
              Hinweis: Echte Abflüge nur mit API-Schlüssel (Fallback-Daten).
            </p>
          )}
          <div className="autocomplete-wrap">
            <input
              type="text"
              className="nav-input"
              value={countryInput}
              onChange={handleCountryInputChange}
              onFocus={() => setShowCountryDropdown(true)}
              placeholder={apiFlights.length > 0 ? 'z.B. München, Frankfurt…' : 'z.B. Deutschland, Frankreich…'}
              aria-label="Zielland eingeben"
              autoComplete="off"
            />
            {showCountryDropdown && countryMatches.length > 0 && (
              <ul className="autocomplete-dropdown" role="listbox">
                {countryMatches.map((c) => (
                  <li
                    key={c}
                    className="autocomplete-option"
                    role="option"
                    onClick={() => handleCountrySelect(c)}
                  >
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {countrySelected && flights.length > 0 && (
            <div className="flight-suggestions">
              <p className="flight-suggestions-title">Flüge nach {countrySelected}</p>
              <ul className="flight-list">
                {flights.map((f) => (
                  <li key={`${f.flightNumber}-${f.time}`}>
                    <button
                      type="button"
                      className={`flight-option ${selectedFlight?.flightNumber === f.flightNumber && selectedFlight?.time === f.time ? 'active' : ''}`}
                      onClick={() => handleFlightSelect(f)}
                    >
                      <span className="flight-number">{f.flightNumber}</span>
                      <span className="flight-time">{f.time}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="nav-section nav-section-essen">
        <h3 className="nav-section-title">Essen & Trinken</h3>
        <p className="nav-section-desc">Möchten Sie etwas essen?</p>
        <div className="essen-buttons">
          <button
            type="button"
            className={`essen-btn ${wantFood === true ? 'active' : ''}`}
            onClick={() => setWantFood(true)}
          >
            Ja
          </button>
          <button
            type="button"
            className={`essen-btn ${wantFood === false ? 'active' : ''}`}
            onClick={() => setWantFood(false)}
          >
            Nein
          </button>
        </div>
        {wantFood === true && (
          <>
            <label className="essen-wish-label">
              <span className="essen-wish-desc">Was möchten Sie? (z.B. Hamburger, Getränke)</span>
              <input
                type="text"
                className="nav-input essen-wish-input"
                value={foodWish}
                onChange={(e) => setFoodWish(e.target.value)}
                placeholder="z.B. Hamburger und Getränke"
                aria-label="Was möchten Sie essen oder trinken?"
              />
            </label>
            {foodWish.trim() && (
              <p className="essen-your-choice">Ihre Auswahl: {foodWish.trim()}</p>
            )}
            {(() => {
              const list = restaurants.length > 0 ? restaurants : FALLBACK_RESTAURANTS
              const words = foodWish.trim()
                ? foodWish.trim().toLowerCase().split(/[\s,]+/).filter(Boolean)
                : []
              const filtered = words.length === 0
                ? list
                : list.filter((r) => {
                    const tags = (r.tags || []).map((t) => t.toLowerCase())
                    return words.some((w) => tags.some((t) => t.includes(w) || w.includes(t)))
                  })
              const toShow = filtered.length > 0 ? filtered : list
              return (
              <div className="restaurant-suggestions">
                <p className="restaurant-suggestions-title">
                  {foodWish.trim()
                    ? (toShow.length === list.length ? 'Restaurants in Ihrer Nähe' : 'Passende Restaurants')
                    : 'Restaurants in Ihrer Nähe'}
                </p>
                <ul className="restaurant-list">
                  {toShow.map((r) => (
                      <li key={r.id} className="restaurant-item">
                        <span className="restaurant-name">{r.name}</span>
                        <button
                          type="button"
                          className="restaurant-on-map"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('point-click', { detail: { id: r.id } }))
                          }}
                        >
                          Auf Karte anzeigen
                        </button>
                      </li>
                  ))}
                </ul>
              </div>
              )
            })()}
          </>
        )}
      </section>

      {(selectedFlight || (demoMapMode && endId)) && (
        <section className="nav-section gate-result">
          <h3 className="nav-section-title">{demoMapMode ? 'Ihr Ziel' : 'Ihr Gate'}</h3>
          <p className="gate-value">{selectedFlight ? selectedFlight.gateName : (points.find((p) => p.id === endId)?.name ?? '')}</p>
        </section>
      )}

      {(selectedFlight || walkingTimeText != null) && (
        <section className="nav-section time-info">
          <h3 className="nav-section-title">Zeit</h3>
          {selectedFlight && (
            <div className="time-row">
              <span className="time-label">Bis Abflug:</span>
              <span className="time-value">
                {departed ? 'Abgeflogen' : timeUntilDeparture ?? '-'}
              </span>
            </div>
          )}
          {walkingTimeText != null && (
            <div className="time-row">
              <span className="time-label">{demoMapMode ? 'Gehzeit zum Ziel:' : 'Gehzeit zum Gate:'}</span>
              <span className="time-value">{walkingTimeText}</span>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
