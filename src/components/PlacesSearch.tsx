import React, { useState, useRef, useEffect } from 'react'

export interface PlaceResult {
  name: string
  address: string
  phone: string
  website: string
  lat: number | null
  lng: number | null
  neighborhood: string
}

interface PlacesSearchProps {
  onSelect: (place: PlaceResult) => void
  placeholder?: string
}

interface Suggestion {
  place_id: string
  description: string
}

export function PlacesSearch({ onSelect, placeholder = 'Search for a bar or restaurant...' }: PlacesSearchProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout>()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchSuggestions(input: string) {
    if (!input.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/places-autocomplete?input=${encodeURIComponent(input)}`)
      const data = await res.json()
      if (data.predictions) {
        setSuggestions(data.predictions.slice(0, 5).map((p: any) => ({
          place_id: p.place_id,
          description: p.description,
        })))
        setOpen(true)
      }
    } catch {
      // silently fail
    }
    setLoading(false)
  }

  async function fetchPlaceDetails(placeId: string, description: string) {
    setFetching(true)
    setError(null)
    try {
      const res = await fetch(`/api/places-details?place_id=${encodeURIComponent(placeId)}`)
      const data = await res.json()
      const r = data.result

      if (!r) throw new Error('No result')

      const comps = r.address_components ?? []
      const neighborhood =
        comps.find((c: any) => c.types.includes('neighborhood'))?.long_name ||
        comps.find((c: any) => c.types.includes('sublocality'))?.long_name ||
        ''

      const result: PlaceResult = {
        name: r.name ?? '',
        address: r.formatted_address ?? '',
        phone: r.formatted_phone_number ?? '',
        website: r.website ?? '',
        lat: r.geometry?.location?.lat ?? null,
        lng: r.geometry?.location?.lng ?? null,
        neighborhood,
      }

      onSelect(result)
      setQuery(r.name ?? description)
      setOpen(false)
      setSuggestions([])
    } catch {
      setError('Could not load place details. Please fill in manually.')
    }
    setFetching(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    if (val.length > 2) {
      debounceRef.current = setTimeout(() => fetchSuggestions(val), 350)
    } else {
      setSuggestions([])
      setOpen(false)
    }
  }

  return (
    <div className="places-wrap" ref={wrapRef}>
      <div className="places-input-row">
        <div className="places-search-icon">
          {fetching ? <span className="cf-spinner" /> : '🔍'}
        </div>
        <input
          className="places-input"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && !fetching && <span className="places-loading">...</span>}
      </div>

      {error && <div className="places-error">{error}</div>}

      {open && suggestions.length > 0 && (
        <div className="places-dropdown">
          {suggestions.map(s => (
            <button
              key={s.place_id}
              className="places-suggestion"
              type="button"
              onClick={() => fetchPlaceDetails(s.place_id, s.description)}
            >
              <span className="places-suggestion-icon">📍</span>
              <span className="places-suggestion-text">{s.description}</span>
            </button>
          ))}
          <div className="places-powered">Powered by Google</div>
        </div>
      )}
    </div>
  )
}
