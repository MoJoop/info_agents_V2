import { useDraggable } from '@dnd-kit/core'
import clsx from 'clsx'
import { Lock } from 'lucide-react'
import type { Agent } from '../types'
import { regionClass } from '../lib/scoring'

interface Props {
  agent: Agent
  score: number | null
  draggingDisabled?: boolean
  onClick?: () => void
  onGatedAction?: () => void
}

export function AgentCard({ agent, score, draggingDisabled, onClick, onGatedAction }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: agent.id,
    disabled: draggingDisabled,
    data: { agent },
  })

  const initials = ((agent.prenom?.[0] ?? '') + (agent.nom?.[0] ?? '')).toUpperCase() || '?'

  return (
    <div
      ref={setNodeRef}
      {...(draggingDisabled ? {} : listeners)}
      {...attributes}
      onPointerDown={(e) => {
        if (draggingDisabled && onGatedAction && e.button === 0) {
          onGatedAction()
        }
      }}
      onClick={(e) => {
        if (!isDragging) onClick?.()
        e.stopPropagation()
      }}
      className={clsx(
        'group relative flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 shadow-sm transition min-w-0',
        'hover:border-slate-300 hover:shadow-md select-none',
        draggingDisabled ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-30'
      )}
      title={draggingDisabled ? 'Connectez-vous pour déplacer' : undefined}
    >
      <div className="relative shrink-0">
        {agent.photo_url ? (
          <img
            src={agent.photo_url}
            alt=""
            className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
            onError={(e) => ((e.currentTarget.style.display = 'none'))}
          />
        ) : (
          <div
            className={clsx(
              'h-8 w-8 rounded-full grid place-items-center text-[10px] font-semibold ring-1 ring-slate-200',
              regionClass(agent.choix1)
            )}
          >
            {initials}
          </div>
        )}
        {draggingDisabled && (
          <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-slate-400 grid place-items-center ring-1 ring-white">
            <Lock className="h-2 w-2 text-white" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium text-slate-800 leading-tight">
          {agent.nom_complet ?? `${agent.prenom ?? ''} ${agent.nom ?? ''}`}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
          <span className="font-semibold text-slate-700 tabular-nums">
            {score != null ? score.toFixed(1) : '—'}
          </span>
          <span className="text-slate-300">·</span>
          <span className="truncate text-slate-500">{agent.choix1 ?? '—'}</span>
        </div>
      </div>
    </div>
  )
}
