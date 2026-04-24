import { useState } from 'react'
import clsx from 'clsx'
import { Check, ImageOff, X } from 'lucide-react'
import type { AgentLite, Verdict } from '../types'

interface Props {
  agent: AgentLite
  verdict: Verdict | null
  onToggle: (v: Verdict) => void
}

export function PhotoCard({ agent, verdict, onToggle }: Props) {
  const [broken, setBroken] = useState(false)
  const hasPhoto = !!agent.photo_url && !broken

  return (
    <div
      className={clsx(
        'group relative rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col transition',
        verdict === 'bon' && 'border-emerald-300 ring-2 ring-emerald-200/60',
        verdict === 'mauvais' && 'border-red-300 ring-2 ring-red-200/60',
        !verdict && 'border-slate-200 hover:border-slate-300'
      )}
    >
      <div className="relative aspect-square bg-slate-100 grid place-items-center">
        {hasPhoto ? (
          <img
            src={agent.photo_url!}
            alt={agent.nom_complet ?? ''}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400">
            <ImageOff className="h-8 w-8" />
            <span className="text-[10px] uppercase">Sans photo</span>
          </div>
        )}
        {verdict && (
          <div
            className={clsx(
              'absolute top-2 right-2 h-6 w-6 rounded-full grid place-items-center shadow',
              verdict === 'bon' ? 'bg-emerald-500' : 'bg-red-500'
            )}
          >
            {verdict === 'bon' ? <Check className="h-3.5 w-3.5 text-white" /> : <X className="h-3.5 w-3.5 text-white" />}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-slate-100">
        <div className="truncate text-[12px] font-medium text-slate-800" title={agent.nom_complet ?? ''}>
          {agent.nom_complet ?? '—'}
        </div>
        <div className="text-[11px] text-slate-500 font-mono tabular-nums">{agent.telephone}</div>
        {agent.choix1 && (
          <div className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">{agent.choix1}</div>
        )}

        <div className="mt-2 flex gap-1.5">
          <button
            onClick={() => onToggle('bon')}
            disabled={!hasPhoto}
            className={clsx(
              'flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition',
              verdict === 'bon'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
              !hasPhoto && 'opacity-40 cursor-not-allowed'
            )}
          >
            <Check className="h-3 w-3" />
            Bon
          </button>
          <button
            onClick={() => onToggle('mauvais')}
            disabled={!hasPhoto}
            className={clsx(
              'flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition',
              verdict === 'mauvais'
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-red-50 text-red-700 hover:bg-red-100',
              !hasPhoto && 'opacity-40 cursor-not-allowed'
            )}
          >
            <X className="h-3 w-3" />
            Mauvais
          </button>
        </div>
      </div>
    </div>
  )
}
