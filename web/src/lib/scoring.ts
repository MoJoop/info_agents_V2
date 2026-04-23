import type { Agent, Scenario, Weights, MissingStrategy } from '../types'

export const DEFAULT_WEIGHTS: Weights = { j1: 1, j2: 1, dev: 1 }

export function computeScoreForScenario(agent: Agent, scenario: Scenario): number | null {
  if (scenario === 'scenario_1') return agent.moyenne_scenario_1 ?? null
  if (scenario === 'scenario_2') return agent.moyenne_scenario_2 ?? null
  return null
}

export function computeScore(
  agent: Agent,
  weights: Weights,
  strategy: MissingStrategy,
  groupMeans: Weights
): number | null {
  const cats = ['j1', 'j2', 'dev'] as const
  let num = 0
  let den = 0
  let anyValue = false

  for (const c of cats) {
    const w = weights[c]
    if (w <= 0) continue
    let val = agent.moyennes_categorie[c]

    if (val == null) {
      if (strategy === 'average_present') continue
      if (strategy === 'group_mean') val = groupMeans[c] ?? 0
      if (strategy === 'zero') val = 0
    }

    if (val != null) {
      num += val * w
      den += w
      anyValue = true
    }
  }

  if (!anyValue || den === 0) return null
  return Math.round((num / den) * 100) / 100
}

export function computeGroupMeans(agents: Agent[]): Weights {
  const sums: Weights = { j1: 0, j2: 0, dev: 0 }
  const counts: Weights = { j1: 0, j2: 0, dev: 0 }
  for (const a of agents) {
    for (const c of ['j1', 'j2', 'dev'] as const) {
      const v = a.moyennes_categorie[c]
      if (v != null) {
        sums[c] += v
        counts[c] += 1
      }
    }
  }
  return {
    j1: counts.j1 ? Math.round((sums.j1 / counts.j1) * 100) / 100 : 0,
    j2: counts.j2 ? Math.round((sums.j2 / counts.j2) * 100) / 100 : 0,
    dev: counts.dev ? Math.round((sums.dev / counts.dev) * 100) / 100 : 0,
  }
}

export const REGION_ORDER = [
  'DAKAR',
  'THIES',
  'DIOURBEL',
  'FATICK',
  'KAOLACK',
  'KAFFRINE',
  'LOUGA',
  'SAINT-LOUIS',
  'MATAM',
  'TAMBACOUNDA',
  'KEDOUGOU',
  'KOLDA',
  'SEDHIOU',
  'ZIGUINCHOR',
]

export function regionClass(region: string | null | undefined): string {
  if (!region) return 'bg-slate-100 text-slate-700'
  const map: Record<string, string> = {
    DAKAR: 'bg-rose-100 text-rose-800',
    THIES: 'bg-sky-100 text-sky-800',
    DIOURBEL: 'bg-amber-100 text-amber-800',
    FATICK: 'bg-emerald-100 text-emerald-800',
    KAOLACK: 'bg-pink-100 text-pink-800',
    KAFFRINE: 'bg-indigo-100 text-indigo-800',
    LOUGA: 'bg-orange-100 text-orange-800',
    'SAINT-LOUIS': 'bg-violet-100 text-violet-800',
    MATAM: 'bg-cyan-100 text-cyan-800',
    TAMBACOUNDA: 'bg-yellow-100 text-yellow-800',
    KEDOUGOU: 'bg-red-100 text-red-800',
    KOLDA: 'bg-teal-100 text-teal-800',
    SEDHIOU: 'bg-lime-100 text-lime-800',
    ZIGUINCHOR: 'bg-purple-100 text-purple-800',
  }
  return map[region] || 'bg-slate-100 text-slate-700'
}

export function regionBg(region: string | null | undefined): string {
  if (!region) return 'bg-slate-50'
  const map: Record<string, string> = {
    DAKAR: 'bg-rose-50',
    THIES: 'bg-sky-50',
    DIOURBEL: 'bg-amber-50',
    FATICK: 'bg-emerald-50',
    KAOLACK: 'bg-pink-50',
    KAFFRINE: 'bg-indigo-50',
    LOUGA: 'bg-orange-50',
    'SAINT-LOUIS': 'bg-violet-50',
    MATAM: 'bg-cyan-50',
    TAMBACOUNDA: 'bg-yellow-50',
    KEDOUGOU: 'bg-red-50',
    KOLDA: 'bg-teal-50',
    SEDHIOU: 'bg-lime-50',
    ZIGUINCHOR: 'bg-purple-50',
  }
  return map[region] || 'bg-slate-50'
}
