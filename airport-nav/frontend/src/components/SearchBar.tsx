import React, { useEffect, useState } from 'react'

type Props = {
  onSelectStart: (id: number | null) => void
  onSelectEnd: (id: number | null) => void
}

export default function SearchBar({ onSelectStart, onSelectEnd }: Props) {
  const [points, setPoints] = useState<any[]>([])
  const [start, setStart] = useState<number | null>(null)
  const [end, setEnd] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/points').then((r) => r.json()).then(setPoints)

    const fromSelect = (ev: any) => {
      const id = ev.detail.id
      setStart(id)
      onSelectStart(id)
    }
    const toSelect = (ev: any) => {
      const id = ev.detail.id
      setEnd(id)
      onSelectEnd(id)
    }

    window.addEventListener('select-start-in-ui', fromSelect as EventListener)
    window.addEventListener('set-end', toSelect as EventListener)

    return () => {
      window.removeEventListener('select-start-in-ui', fromSelect as EventListener)
      window.removeEventListener('set-end', toSelect as EventListener)
    }
  }, [])

  return (
    <div>
      <label>Start</label>
      <select value={start ?? ''} onChange={(e) => { const v = Number(e.target.value || 0) || null; setStart(v); onSelectStart(v); }}>
        <option value="">— pick —</option>
        {points.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <label>End</label>
      <select value={end ?? ''} onChange={(e) => { const v = Number(e.target.value || 0) || null; setEnd(v); onSelectEnd(v); }}>
        <option value="">— pick —</option>
        {points.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  )
}
