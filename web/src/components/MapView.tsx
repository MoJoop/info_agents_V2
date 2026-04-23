import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type Map as MLMap, type MapGeoJSONFeature } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { distance as turfDistance, point as turfPoint } from '@turf/turf'
import { Ruler, RotateCcw, Search, Layers } from 'lucide-react'
import clsx from 'clsx'

interface GeoPoint {
  code: string | null
  nom: string | null
  dept: string | null
  region: string | null
  milieu: string | null
  nbre_men: number | null
  lon: number
  lat: number
}
interface GeoEquipe {
  id: string
  region_dominante: string | null
  nb_dr: number
  points: GeoPoint[]
  convex_hull: { type: 'Feature'; geometry: any; properties: any } | null
  concave_hull: { type: 'Feature'; geometry: any; properties: any } | null
  centroid: [number, number] | null
  area_km2: number | null
  max_diameter_km: number | null
  bbox: [number, number, number, number] | null
}
interface GeoPayload {
  metadata: {
    bbox: [number, number, number, number] | null
    total_equipes: number
    total_points: number
  }
  equipes: GeoEquipe[]
}

// 35 couleurs distinctes (HSL spread)
function teamColor(i: number): string {
  const h = Math.round((i * 360) / 35)
  return `hsl(${h}, 62%, 55%)`
}
function teamFill(i: number): string {
  const h = Math.round((i * 360) / 35)
  return `hsl(${h}, 65%, 60%)`
}

type HullMode = 'convex' | 'concave'

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const [payload, setPayload] = useState<GeoPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [hull, setHull] = useState<HullMode>('convex')
  const [query, setQuery] = useState('')
  const [measuring, setMeasuring] = useState(false)
  const measurePtsRef = useRef<[number, number][]>([])
  const [measurePts, setMeasurePts] = useState<[number, number][]>([])

  // Fetch data
  useEffect(() => {
    fetch('/equipes_geo.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setPayload)
      .catch((e) => setErr(String(e)))
  }, [])

  // Build feature collections (memoized)
  const { polyFC, pointFC } = useMemo(() => {
    if (!payload) return { polyFC: null, pointFC: null }
    const polyFeatures: any[] = []
    const pointFeatures: any[] = []
    payload.equipes.forEach((eq, i) => {
      const color = teamColor(i)
      const fill = teamFill(i)
      const h = hull === 'concave' ? eq.concave_hull || eq.convex_hull : eq.convex_hull
      if (h) {
        polyFeatures.push({
          type: 'Feature',
          geometry: h.geometry,
          properties: {
            equipe_id: eq.id,
            region: eq.region_dominante,
            nb_dr: eq.nb_dr,
            area_km2: eq.area_km2,
            max_diameter_km: eq.max_diameter_km,
            color,
            fill,
          },
        })
      }
      for (const p of eq.points) {
        pointFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: {
            equipe_id: eq.id,
            nom: p.nom,
            dept: p.dept,
            region: p.region,
            milieu: p.milieu,
            nbre_men: p.nbre_men,
            color,
          },
        })
      }
    })
    return {
      polyFC: { type: 'FeatureCollection', features: polyFeatures } as any,
      pointFC: { type: 'FeatureCollection', features: pointFeatures } as any,
    }
  }, [payload, hull])

  // Init map
  useEffect(() => {
    if (!payload || !containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          basemap: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
          },
        },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
      },
      center: [-15.0, 14.5],
      zoom: 6.2,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    // Force resize once the container has its real dimensions
    const resizeTimer = window.setTimeout(() => map.resize(), 100)
    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(containerRef.current)
    map.on('error', (e) => {
      // eslint-disable-next-line no-console
      console.warn('[MapView] tile/style error', e?.error?.message || e)
    })

    map.on('load', () => {
      if (payload.metadata.bbox) {
        const [w, s, e, n] = payload.metadata.bbox
        map.fitBounds([[w, s], [e, n]], { padding: 40, duration: 0 })
      }

      map.addSource('teams-poly', { type: 'geojson', data: polyFC! })
      map.addSource('teams-pts', { type: 'geojson', data: pointFC! })
      map.addSource('measure', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'teams-poly-fill',
        type: 'fill',
        source: 'teams-poly',
        paint: {
          'fill-color': ['get', 'fill'],
          'fill-opacity': [
            'case',
            ['==', ['get', 'equipe_id'], ['literal', '__sel__']],
            0.45,
            0.22,
          ],
        },
      })
      map.addLayer({
        id: 'teams-poly-line',
        type: 'line',
        source: 'teams-poly',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'case',
            ['==', ['get', 'equipe_id'], ['literal', '__sel__']],
            2.5,
            1,
          ],
        },
      })
      map.addLayer({
        id: 'teams-pts-circle',
        type: 'circle',
        source: 'teams-pts',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'equipe_id'], ['literal', '__sel__']],
            6,
            4,
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.2,
        },
      })

      // Measure layers
      map.addLayer({
        id: 'measure-line',
        type: 'line',
        source: 'measure',
        paint: {
          'line-color': '#dc2626',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
        filter: ['==', '$type', 'LineString'],
      })
      map.addLayer({
        id: 'measure-points',
        type: 'circle',
        source: 'measure',
        paint: {
          'circle-radius': 5,
          'circle-color': '#dc2626',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
        filter: ['==', '$type', 'Point'],
      })

      // Tooltip on point hover
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })
      map.on('mouseenter', 'teams-pts-circle', (e) => {
        map.getCanvas().style.cursor = measureRef.current ? 'crosshair' : 'pointer'
        const f = e.features?.[0] as MapGeoJSONFeature | undefined
        if (!f) return
        const p = f.properties as any
        const html = `
          <div style="font-size:12px;line-height:1.35">
            <div style="font-weight:600;color:#1f2937">${p.nom ?? '—'}</div>
            <div style="color:#6b7280">${p.dept ?? ''}${p.region ? ' · ' + p.region : ''}</div>
            ${p.milieu ? `<div style="color:#9ca3af">${p.milieu}</div>` : ''}
            ${p.nbre_men != null ? `<div style="color:#374151;margin-top:2px">${Math.round(p.nbre_men)} ménages</div>` : ''}
            <div style="color:#64748b;margin-top:2px">Équipe <b>${p.equipe_id}</b></div>
          </div>`
        popup.setLngLat((f.geometry as any).coordinates).setHTML(html).addTo(map)
      })
      map.on('mouseleave', 'teams-pts-circle', () => {
        map.getCanvas().style.cursor = measureRef.current ? 'crosshair' : ''
        popup.remove()
      })
      map.on('click', 'teams-poly-fill', (e) => {
        if (measureRef.current) return
        const f = e.features?.[0]
        if (!f) return
        const eid = (f.properties as any).equipe_id as string
        setSelected((prev) => (prev === eid ? null : eid))
      })
    })

    return () => {
      window.clearTimeout(resizeTimer)
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload])

  // keep a ref of "measuring" for event handlers that were bound once at init
  const measureRef = useRef(false)
  useEffect(() => {
    measureRef.current = measuring
  }, [measuring])

  // Update sources when hull mode changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !polyFC || !pointFC) return
    if (!map.isStyleLoaded()) return
    const ps = map.getSource('teams-poly') as any
    const pp = map.getSource('teams-pts') as any
    if (ps && typeof ps.setData === 'function') ps.setData(polyFC)
    if (pp && typeof pp.setData === 'function') pp.setData(pointFC)
  }, [polyFC, pointFC])

  // Apply selection highlight via filter updates
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer) return
    if (!map.getLayer('teams-poly-fill')) return
    const seed = selected ?? '__none__'
    map.setPaintProperty('teams-poly-fill', 'fill-opacity', [
      'case',
      ['==', ['get', 'equipe_id'], seed],
      0.5,
      selected ? 0.12 : 0.22,
    ])
    map.setPaintProperty('teams-poly-line', 'line-width', [
      'case',
      ['==', ['get', 'equipe_id'], seed],
      2.8,
      selected ? 0.6 : 1,
    ])
    map.setPaintProperty('teams-pts-circle', 'circle-radius', [
      'case',
      ['==', ['get', 'equipe_id'], seed],
      6,
      selected ? 3 : 4,
    ])
  }, [selected])

  // Measure tool — handle clicks
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const handler = (e: maplibregl.MapMouseEvent) => {
      if (!measureRef.current) return
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      let next: [number, number][]
      if (measurePtsRef.current.length >= 2) {
        next = [lngLat]
      } else {
        next = [...measurePtsRef.current, lngLat]
      }
      measurePtsRef.current = next
      setMeasurePts(next)
    }
    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [])

  // Update measure source
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const src = map.getSource('measure') as any
    if (!src || typeof src.setData !== 'function') return
    const features: any[] = measurePts.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: c },
      properties: {},
    }))
    if (measurePts.length === 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: measurePts },
        properties: {},
      })
    }
    src.setData({ type: 'FeatureCollection', features })
  }, [measurePts])

  // Cursor for measure mode
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = measuring ? 'crosshair' : ''
  }, [measuring])

  // Fly to selected
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selected || !payload) return
    const eq = payload.equipes.find((e) => e.id === selected)
    if (!eq) return
    if (eq.bbox) {
      const [w, s, e, n] = eq.bbox
      // For very small bbox, use a min-zoom fly
      const zw = Math.abs(e - w), zh = Math.abs(n - s)
      if (zw < 0.005 && zh < 0.005) {
        map.flyTo({ center: eq.centroid || [(w + e) / 2, (s + n) / 2], zoom: 13, duration: 700 })
      } else {
        map.fitBounds([[w, s], [e, n]], { padding: 80, duration: 700, maxZoom: 12 })
      }
    } else if (eq.centroid) {
      map.flyTo({ center: eq.centroid, zoom: 10, duration: 700 })
    }
  }, [selected, payload])

  const measureKm =
    measurePts.length === 2
      ? turfDistance(turfPoint(measurePts[0]), turfPoint(measurePts[1]), { units: 'kilometers' })
      : null

  const selectedEq = selected && payload ? payload.equipes.find((e) => e.id === selected) : null

  const filteredEqs = useMemo(() => {
    if (!payload) return []
    const q = query.trim().toLowerCase()
    if (!q) return payload.equipes
    return payload.equipes.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        (e.region_dominante ?? '').toLowerCase().includes(q)
    )
  }, [payload, query])

  if (err) return <div className="p-8 text-red-600">Erreur : {err}</div>
  if (!payload)
    return (
      <div className="absolute inset-0 grid place-items-center text-slate-500">
        Chargement de la carte…
      </div>
    )

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Toolbar top-left */}
      <div className="absolute top-3 left-3 z-10 rounded-xl bg-white/90 backdrop-blur shadow-sm border border-slate-200 p-1.5 flex items-center gap-1">
        <div className="flex items-center rounded-lg bg-slate-50 p-0.5">
          {(['convex', 'concave'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setHull(m)}
              className={clsx(
                'px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1',
                hull === m ? 'bg-slate-800 text-white' : 'text-slate-600'
              )}
            >
              <Layers className="h-3 w-3" />
              {m === 'convex' ? 'Convex' : 'Concave'}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setMeasuring((v) => !v)
            measurePtsRef.current = []
            setMeasurePts([])
          }}
          className={clsx(
            'px-2.5 py-1 text-xs font-medium rounded-md inline-flex items-center gap-1',
            measuring ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <Ruler className="h-3 w-3" />
          Mesurer
        </button>
        <button
          onClick={() => {
            const map = mapRef.current
            if (!map || !payload.metadata.bbox) return
            const [w, s, e, n] = payload.metadata.bbox
            map.fitBounds([[w, s], [e, n]], { padding: 40, duration: 500 })
            setSelected(null)
          }}
          className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md inline-flex items-center gap-1"
        >
          <RotateCcw className="h-3 w-3" />
          Vue Sénégal
        </button>
      </div>

      {/* Measure result */}
      {measuring && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-xl bg-white/95 backdrop-blur shadow-sm border border-red-200 px-3 py-1.5 text-xs text-red-700">
          {measurePts.length === 0 && 'Cliquez un premier point sur la carte'}
          {measurePts.length === 1 && 'Cliquez un deuxième point pour mesurer'}
          {measureKm != null && (
            <span>
              Distance :{' '}
              <b className="tabular-nums">{measureKm.toFixed(2)} km</b>
            </span>
          )}
        </div>
      )}

      {/* Team list top-right */}
      <div className="absolute top-3 right-3 z-10 w-72 max-h-[calc(100%-1.5rem)] rounded-xl bg-white/90 backdrop-blur shadow-sm border border-slate-200 flex flex-col">
        <div className="p-2.5 border-b border-slate-200">
          <div className="text-xs font-semibold text-slate-700 mb-1.5">
            Équipes ({payload.equipes.length})
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer EQ ou région…"
              className="w-full pl-7 pr-2 py-1 text-xs rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>
        <div className="overflow-y-auto py-1">
          {filteredEqs.map((eq) => {
            const origIndex = payload.equipes.findIndex((e) => e.id === eq.id)
            const color = teamColor(origIndex)
            const active = selected === eq.id
            return (
              <button
                key={eq.id}
                onClick={() => setSelected((s) => (s === eq.id ? null : eq.id))}
                className={clsx(
                  'w-full text-left px-2.5 py-1.5 flex items-center gap-2 transition',
                  active ? 'bg-slate-100' : 'hover:bg-slate-50'
                )}
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0 ring-1 ring-white"
                  style={{ background: color }}
                />
                <span className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-slate-800">{eq.id}</span>
                  <span className="ml-1 text-[10px] text-slate-500">
                    {eq.region_dominante ?? '—'}
                  </span>
                </span>
                <span className="text-[10px] text-slate-500 tabular-nums text-right">
                  <div>{eq.area_km2 != null ? `${eq.area_km2.toFixed(0)} km²` : '—'}</div>
                  <div className="text-slate-400">
                    {eq.max_diameter_km != null ? `Ø ${eq.max_diameter_km.toFixed(0)} km` : ''}
                  </div>
                </span>
              </button>
            )
          })}
          {!filteredEqs.length && (
            <div className="p-3 text-center text-xs text-slate-400">Aucune équipe</div>
          )}
        </div>
      </div>

      {/* Selection stats bottom-left */}
      {selectedEq && (
        <div className="absolute bottom-3 left-3 z-10 rounded-xl bg-white/95 backdrop-blur shadow-sm border border-slate-200 p-3 min-w-[240px]">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-bold text-slate-800">{selectedEq.id}</div>
              <div className="text-xs text-slate-500">{selectedEq.region_dominante ?? '—'}</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-[10px] text-slate-400 hover:text-slate-700"
            >
              ×
            </button>
          </div>
          <dl className="mt-2 space-y-0.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">DR</dt>
              <dd className="font-mono text-slate-700">{selectedEq.nb_dr}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Surface</dt>
              <dd className="font-mono text-slate-700">
                {selectedEq.area_km2 != null ? `${selectedEq.area_km2.toFixed(1)} km²` : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Diamètre max</dt>
              <dd className="font-mono text-slate-700">
                {selectedEq.max_diameter_km != null ? `${selectedEq.max_diameter_km.toFixed(1)} km` : '—'}
              </dd>
            </div>
            {selectedEq.centroid && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Centroïde</dt>
                <dd className="font-mono text-[10px] text-slate-500">
                  {selectedEq.centroid[1].toFixed(3)}, {selectedEq.centroid[0].toFixed(3)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}
