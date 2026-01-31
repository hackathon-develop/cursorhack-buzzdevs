import React, { useEffect, useState } from 'react'

type DepartureRow = {
  flightNumber: string
  time: string
  expectedTime: string | null
  gateName: string | null
  terminal: string | null
  destination: string | null
  destinationCode: string | null
}

/** Alle Flüge aus dem Menü (Navigation) + viele weitere – wird genutzt, wenn keine API-Daten */
const DEMO_DEPARTURES: DepartureRow[] = [
  // Aus dem Menü (Fallback Zielland)
  { flightNumber: 'LH 401', time: '08:30', expectedTime: null, gateName: 'A1', terminal: '1', destination: 'München', destinationCode: 'MUC' },
  { flightNumber: 'LH 403', time: '14:00', expectedTime: null, gateName: 'A1', terminal: '1', destination: 'Frankfurt', destinationCode: 'FRA' },
  { flightNumber: 'LH 407', time: '18:45', expectedTime: null, gateName: 'A3', terminal: '1', destination: 'Deutschland', destinationCode: 'DE' },
  { flightNumber: 'AF 102', time: '09:15', expectedTime: null, gateName: 'A2', terminal: '1', destination: 'Paris', destinationCode: 'CDG' },
  { flightNumber: 'AF 108', time: '16:30', expectedTime: null, gateName: 'A2', terminal: '1', destination: 'Frankreich', destinationCode: 'FR' },
  { flightNumber: 'IB 301', time: '10:00', expectedTime: null, gateName: 'A3', terminal: '1', destination: 'Madrid', destinationCode: 'MAD' },
  { flightNumber: 'IB 305', time: '15:20', expectedTime: null, gateName: 'A4', terminal: '1', destination: 'Barcelona', destinationCode: 'BCN' },
  { flightNumber: 'AA 501', time: '07:45', expectedTime: null, gateName: 'A4', terminal: '1', destination: 'New York', destinationCode: 'JFK' },
  { flightNumber: 'UA 612', time: '12:00', expectedTime: null, gateName: 'A5', terminal: '1', destination: 'Chicago', destinationCode: 'ORD' },
  { flightNumber: 'DL 204', time: '19:30', expectedTime: null, gateName: 'A6', terminal: '1', destination: 'Atlanta', destinationCode: 'ATL' },
  { flightNumber: 'AZ 701', time: '11:00', expectedTime: null, gateName: 'A7', terminal: '1', destination: 'Rom', destinationCode: 'FCO' },
  { flightNumber: 'AZ 705', time: '17:45', expectedTime: null, gateName: 'A8', terminal: '1', destination: 'Mailand', destinationCode: 'MXP' },
  { flightNumber: 'BA 801', time: '08:00', expectedTime: null, gateName: 'B1', terminal: '2', destination: 'London', destinationCode: 'LHR' },
  { flightNumber: 'BA 805', time: '14:30', expectedTime: null, gateName: 'B2', terminal: '2', destination: 'Manchester', destinationCode: 'MAN' },
  { flightNumber: 'LX 901', time: '09:45', expectedTime: null, gateName: 'A9', terminal: '1', destination: 'Zürich', destinationCode: 'ZRH' },
  { flightNumber: 'LX 903', time: '16:00', expectedTime: null, gateName: 'A10', terminal: '1', destination: 'Genf', destinationCode: 'GVA' },
  { flightNumber: 'OS 601', time: '10:30', expectedTime: null, gateName: 'B3', terminal: '2', destination: 'Wien', destinationCode: 'VIE' },
  { flightNumber: 'OS 603', time: '15:00', expectedTime: null, gateName: 'B4', terminal: '2', destination: 'Salzburg', destinationCode: 'SZG' },
  // Viele weitere Ziele
  { flightNumber: 'LH 2084', time: '06:15', expectedTime: null, gateName: 'A1', terminal: '1', destination: 'Berlin', destinationCode: 'BER' },
  { flightNumber: 'LH 2090', time: '13:45', expectedTime: null, gateName: 'A2', terminal: '1', destination: 'Düsseldorf', destinationCode: 'DUS' },
  { flightNumber: 'LH 3102', time: '07:20', expectedTime: null, gateName: 'A3', terminal: '1', destination: 'Köln', destinationCode: 'CGN' },
  { flightNumber: 'EW 1234', time: '08:50', expectedTime: null, gateName: 'A5', terminal: '1', destination: 'Stuttgart', destinationCode: 'STR' },
  { flightNumber: 'EW 5678', time: '11:30', expectedTime: null, gateName: 'A6', terminal: '1', destination: 'Hannover', destinationCode: 'HAJ' },
  { flightNumber: 'KL 1822', time: '09:00', expectedTime: null, gateName: 'B5', terminal: '2', destination: 'Amsterdam', destinationCode: 'AMS' },
  { flightNumber: 'KL 1826', time: '16:45', expectedTime: null, gateName: 'B6', terminal: '2', destination: 'Amsterdam', destinationCode: 'AMS' },
  { flightNumber: 'EK 062', time: '21:00', expectedTime: null, gateName: 'B52', terminal: '1', destination: 'Dubai', destinationCode: 'DXB' },
  { flightNumber: 'QR 076', time: '22:15', expectedTime: null, gateName: 'A12', terminal: '1', destination: 'Doha', destinationCode: 'DOH' },
  { flightNumber: 'TK 1622', time: '12:30', expectedTime: null, gateName: 'B8', terminal: '2', destination: 'Istanbul', destinationCode: 'IST' },
  { flightNumber: 'AY 1402', time: '10:15', expectedTime: null, gateName: 'A7', terminal: '1', destination: 'Helsinki', destinationCode: 'HEL' },
  { flightNumber: 'SK 0828', time: '14:00', expectedTime: null, gateName: 'A8', terminal: '1', destination: 'Kopenhagen', destinationCode: 'CPH' },
  { flightNumber: 'DY 1256', time: '06:45', expectedTime: null, gateName: 'B10', terminal: '2', destination: 'Oslo', destinationCode: 'OSL' },
  { flightNumber: 'W6 4750', time: '20:25', expectedTime: '20:25', gateName: 'C02', terminal: '2', destination: 'Skopje', destinationCode: 'SKP' },
  { flightNumber: 'W4 5108', time: '20:50', expectedTime: null, gateName: 'C04', terminal: '2', destination: 'Tirana', destinationCode: 'TIA' },
  { flightNumber: 'LH 2079', time: '20:30', expectedTime: null, gateName: 'C16', terminal: '2', destination: 'München', destinationCode: 'MUC' },
  { flightNumber: 'FR 1234', time: '07:10', expectedTime: null, gateName: 'B12', terminal: '2', destination: 'Dublin', destinationCode: 'DUB' },
  { flightNumber: 'U2 4567', time: '18:20', expectedTime: null, gateName: 'A14', terminal: '1', destination: 'Edinburgh', destinationCode: 'EDI' },
  { flightNumber: 'VY 8901', time: '11:45', expectedTime: null, gateName: 'A15', terminal: '1', destination: 'Barcelona', destinationCode: 'BCN' },
  { flightNumber: 'UX 3456', time: '15:10', expectedTime: null, gateName: 'A16', terminal: '1', destination: 'Madrid', destinationCode: 'MAD' },
  { flightNumber: 'TP 789', time: '13:00', expectedTime: null, gateName: 'B14', terminal: '2', destination: 'Lissabon', destinationCode: 'LIS' },
  { flightNumber: 'A3 456', time: '17:30', expectedTime: null, gateName: 'A18', terminal: '1', destination: 'Athen', destinationCode: 'ATH' },
  { flightNumber: 'LO 456', time: '08:25', expectedTime: null, gateName: 'B16', terminal: '2', destination: 'Warschau', destinationCode: 'WAW' },
  { flightNumber: 'OK 678', time: '16:15', expectedTime: null, gateName: 'A19', terminal: '1', destination: 'Prag', destinationCode: 'PRG' },
  { flightNumber: 'SU 2345', time: '12:40', expectedTime: null, gateName: 'B18', terminal: '2', destination: 'Moskau', destinationCode: 'SVO' },
  { flightNumber: 'JU 501', time: '19:00', expectedTime: null, gateName: 'A20', terminal: '1', destination: 'Belgrad', destinationCode: 'BEG' },
  { flightNumber: 'BT 345', time: '09:35', expectedTime: null, gateName: 'B20', terminal: '2', destination: 'Riga', destinationCode: 'RIX' },
  { flightNumber: 'SN 2826', time: '10:50', expectedTime: null, gateName: 'A11', terminal: '1', destination: 'Brüssel', destinationCode: 'BRU' },
  { flightNumber: 'LX 3456', time: '14:20', expectedTime: null, gateName: 'A9', terminal: '1', destination: 'Basel', destinationCode: 'BSL' },
  { flightNumber: 'EW 9012', time: '06:30', expectedTime: null, gateName: 'A4', terminal: '1', destination: 'Nürnberg', destinationCode: 'NUE' },
  { flightNumber: 'LH 3500', time: '17:00', expectedTime: null, gateName: 'A2', terminal: '1', destination: 'Hamburg', destinationCode: 'HAM' },
].sort((a, b) => a.time.localeCompare(b.time))

const TIME_RANGES = [
  '00:00 - 02:00',
  '02:00 - 04:00',
  '04:00 - 06:00',
  '06:00 - 08:00',
  '08:00 - 10:00',
  '10:00 - 12:00',
  '12:00 - 14:00',
  '14:00 - 16:00',
  '16:00 - 18:00',
  '18:00 - 20:00',
  '20:00 - 22:00',
  '22:00 - 00:00',
]

function timeInRange(time: string, range: string): boolean {
  const [start, end] = range.split(' - ').map((t) => t.trim())
  const [h] = time.split(':').map(Number)
  const [startH] = start.split(':').map(Number)
  let endH = parseInt(end.slice(0, 2), 10)
  if (end === '00:00') endH = 24
  return h >= startH && h < endH
}

export default function DepartureList() {
  const [flights, setFlights] = useState<DepartureRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState(TIME_RANGES[Math.min(10, TIME_RANGES.length - 1)])
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/departures')
      .then((r) => r.json())
      .then((data: { flights?: DepartureRow[]; error?: string }) => {
        setError(data.error || null)
        const list = Array.isArray(data.flights) && data.flights.length > 0 ? data.flights : DEMO_DEPARTURES
        setFlights(list)
      })
      .catch(() => {
        setError('Abflüge konnten nicht geladen werden. Es werden Demo-Daten angezeigt.')
        setFlights(DEMO_DEPARTURES)
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = flights.filter((f) => timeInRange(f.time, timeRange))
  const toggleSaved = (key: string) => {
    setSaved((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const currentRangeIndex = TIME_RANGES.indexOf(timeRange)
  const goToEarlier = () => {
    if (currentRangeIndex <= 0) {
      const d = new Date(selectedDate + 'T12:00:00')
      d.setDate(d.getDate() - 1)
      setSelectedDate(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      )
      setTimeRange(TIME_RANGES[TIME_RANGES.length - 1])
    } else {
      setTimeRange(TIME_RANGES[currentRangeIndex - 1])
    }
  }
  const goToLater = () => {
    if (currentRangeIndex >= TIME_RANGES.length - 1 || currentRangeIndex < 0) {
      const d = new Date(selectedDate + 'T12:00:00')
      d.setDate(d.getDate() + 1)
      setSelectedDate(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      )
      setTimeRange(TIME_RANGES[0])
    } else {
      setTimeRange(TIME_RANGES[currentRangeIndex + 1])
    }
  }

  return (
    <div className="departure-overview">
      <div className="departure-controls">
        <button type="button" className="departure-nav-btn" onClick={goToEarlier} aria-label="Frühere Flüge">
          &lt; Frühere Flüge
        </button>
        <label className="departure-date">
          <span className="departure-icon" aria-hidden>📅</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="departure-date-input"
          />
        </label>
        <label className="departure-time-range">
          <span className="departure-icon" aria-hidden>🕐</span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="departure-time-select"
          >
            {TIME_RANGES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="departure-nav-btn" onClick={goToLater} aria-label="Spätere Flüge">
          Spätere Flüge &gt;
        </button>
      </div>

      {error && (
        <p className="departure-error">
          {error}
        </p>
      )}

      {loading ? (
        <p className="departure-loading">Abflüge werden geladen…</p>
      ) : (
        <div className="departure-table-wrap">
          <table className="departure-table">
            <thead>
              <tr>
                <th>Geplant</th>
                <th>Erwartet</th>
                <th>Zielort</th>
                <th>Flugnummer</th>
                <th>Terminal / Gate / Status</th>
                <th>Merken</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="departure-empty">
                    Keine Abflüge in diesem Zeitraum.
                  </td>
                </tr>
              ) : (
                filtered.map((f) => {
                  const key = `${f.flightNumber}-${f.time}-${f.destination || ''}`
                  const destLabel = f.destinationCode
                    ? `${f.destination || f.destinationCode} (${f.destinationCode})`
                    : (f.destination || '-')
                  return (
                    <tr key={key}>
                      <td className="departure-time-cell">{f.time}</td>
                      <td className="departure-time-cell">{f.expectedTime || ''}</td>
                      <td>
                        <span className="departure-destination">{destLabel}</span>
                      </td>
                      <td>
                        <span className="departure-flight-num">✈ {f.flightNumber}</span>
                      </td>
                      <td>
                        <div className="departure-badges">
                          {f.terminal && (
                            <span className="departure-badge">{`Terminal ${f.terminal}`}</span>
                          )}
                          {f.gateName && (
                            <span className="departure-badge">{`Gate ${f.gateName.replace(/^\d\//, '')}`}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`departure-star ${saved.has(key) ? 'saved' : ''}`}
                          onClick={() => toggleSaved(key)}
                          aria-label={saved.has(key) ? 'Nicht merken' : 'Merken'}
                          title={saved.has(key) ? 'Nicht merken' : 'Merken'}
                        >
                          ★
                        </button>
                      </td>
                      <td>
                        <button type="button" className="departure-details">
                          Details →
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
