import { useMemo, useState } from 'react'
import { ChevronDown, Search, Filter } from 'lucide-react'
import clsx from 'clsx'
import type { Agent } from '../types'
import { AgentCard } from './AgentCard'
import { REGION_ORDER, regionBg, regionClass } from '../lib/scoring'

interface Props {
  agents: Agent[]
  scoreMap: Map<string, number | null>
  assignedIds: Set<string>
  onOpenAgent: (a: Agent) => void
}

export function AgentPool({ agents, scoreMap, assignedIds, onOpenAgent }: Props) {
  const [query, setQuery] = useState('')
  const [hideAssigned, setHideAssigned] = useState(true)
  const [regionFilter, setRegionFilter] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const availableRegions = useMemo(() => {
    const set = new Set<string>()
    for (const a of agents) if (a.choix1) set.add(a.choix1)
    return REGION_ORDER.filter((r) => set.has(r)).concat(set.has('SANS CHOIX') ? ['SANS CHOIX'] : [])
  }, [agents])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return agents.filter((a) => {
      if (hideAssigned && assignedIds.has(a.id)) return false
      if (regionFilter.size > 0) {
        const r = a.choix1 ?? 'SANS CHOIX'
        if (!regionFilter.has(r)) return false
      }
      if (!q) return true
      const hay = `${a.nom_complet ?? ''} ${a.telephone} ${a.choix1 ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [agents, assignedIds, query, hideAssigned, regionFilter])

  const grouped = useMemo(() => {
    const m = new Map<string, Agent[]>()
    for (const a of filtered) {
      const k = a.choix1 ?? 'SANS CHOIX'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(a)
    }
    for (const arr of m.values()) {
      arr.sort((x, y) => {
        const sx = scoreMap.get(x.id) ?? -Infinity
        const sy = scoreMap.get(y.id) ?? -Infinity
        return sy - sx
      })
    }
    const ordered: [string, Agent[]][] = []
    for (const r of [...REGION_ORDER, 'SANS CHOIX']) {
      if (m.has(r)) ordered.push([r, m.get(r)!])
    }
    return ordered
  }, [filtered, scoreMap])

  const toggleRegion = (r: string) => {
    setRegionFilter((prev) => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-10 space-y-2">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center justify-between">
          <span>Agents à classer</span>
          <span className="text-xs font-normal text-slate-500">
            {filtered.length} / {agents.length}
          </span>
        </h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, téléphone, région…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        {/* Region filter pills */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
              <Filter className="h-3 w-3" /> Région
            </div>
            {regionFilter.size > 0 && (
              <button
                onClick={() => setRegionFilter(new Set())}
                className="text-[10px] text-slate-500 hover:text-slate-800"
              >
                Tout désélectionner
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {availableRegions.map((r) => {
              const active = regionFilter.has(r)
              return (
                <button
                  key={r}
                  onClick={() => toggleRegion(r)}
                  className={clsx(
                    'text-[10px] rounded-full px-2 py-0.5 border transition font-medium',
                    active
                      ? regionClass(r) + ' ring-2 ring-offset-1 ring-slate-400 border-transparent'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  )}
                >
                  {r}
                </button>
              )
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={hideAssigned}
            onChange={(e) => setHideAssigned(e.target.checked)}
            className="rounded border-slate-300"
          />
          Masquer les agents déjà placés
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {grouped.map(([region, list]) => {
          const isCollapsed = !!collapsed[region]
          return (
            <div key={region} className={clsx('rounded-xl border border-slate-200', regionBg(region))}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [region]: !isCollapsed }))}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <span>
                  {region} <span className="font-normal text-slate-500">({list.length})</span>
                </span>
                <ChevronDown
                  className={clsx('h-4 w-4 transition-transform', isCollapsed && '-rotate-90')}
                />
              </button>
              {!isCollapsed && (
                <div className="px-2 pb-2 grid grid-cols-2 gap-1.5">
                  {list.map((a) => (
                    <AgentCard
                      key={a.id}
                      agent={a}
                      score={scoreMap.get(a.id) ?? null}
                      onClick={() => onOpenAgent(a)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {!grouped.length && (
          <div className="text-center text-sm text-slate-400 py-8">Aucun agent ne correspond.</div>
        )}
      </div>
    </div>
  )
}
