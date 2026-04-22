import { Sliders, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import type { MissingStrategy, Weights } from '../types'

interface Props {
  weights: Weights
  setWeights: (w: Weights) => void
  strategy: MissingStrategy
  setStrategy: (s: MissingStrategy) => void
  groupMeans: Weights
}

export function WeightingPanel({ weights, setWeights, strategy, setStrategy, groupMeans }: Props) {
  const reset = () => setWeights({ j1: 1, j2: 1, dev: 1 })

  return (
    <div className="flex items-center gap-4 flex-wrap px-5 py-2.5 bg-white/70 border-b border-slate-200">
      <div className="flex items-center gap-1.5 text-slate-700 shrink-0">
        <Sliders className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">Pondération</span>
      </div>

      <div className="flex items-center gap-5 flex-wrap">
        {(['j1', 'j2', 'dev'] as const).map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-600 w-12">
              {k === 'dev' ? 'Dév.' : `Jour ${k[1]}`}
            </span>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={weights[k]}
              onChange={(e) => setWeights({ ...weights, [k]: parseFloat(e.target.value) })}
              className="w-24 accent-slate-700"
            />
            <span className="text-[11px] tabular-nums text-slate-500 w-16">
              {weights[k].toFixed(1)} <span className="text-slate-400">({groupMeans[k].toFixed(1)})</span>
            </span>
          </div>
        ))}
      </div>

      <div className="h-6 w-px bg-slate-200" />

      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-slate-600">Manquantes</span>
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
          {(
            [
              { v: 'average_present', label: 'Présentes' },
              { v: 'group_mean', label: 'Groupe' },
              { v: 'zero', label: 'Zéro' },
            ] as { v: MissingStrategy; label: string }[]
          ).map((o) => (
            <button
              key={o.v}
              onClick={() => setStrategy(o.v)}
              className={clsx(
                'text-[11px] rounded-md px-2 py-1 transition',
                strategy === o.v
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
              title={
                o.v === 'average_present'
                  ? 'Moyenne des notes présentes uniquement'
                  : o.v === 'group_mean'
                  ? 'Remplacer par la moyenne du groupe'
                  : 'Zéro pour les notes manquantes'
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1" />

      <button
        onClick={reset}
        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800"
      >
        <RotateCcw className="h-3 w-3" /> Réinitialiser
      </button>
    </div>
  )
}
