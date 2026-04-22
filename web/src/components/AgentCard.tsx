import { useDraggable } from '@dnd-kit/core'
import clsx from 'clsx'
import type { Agent } from '../types'
import { regionClass } from '../lib/scoring'

interface Props {
  agent: Agent
  score: number | null
  compact?: boolean
  draggingDisabled?: boolean
  onClick?: () => void
}

export function AgentCard({ agent, score, compact, draggingDisabled, onClick }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: agent.id,
    disabled: draggingDisabled,
    data: { agent },
  })

  const initials = ((agent.prenom?.[0] ?? '') + (agent.nom?.[0] ?? '')).toUpperCase() || '?'

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // Only trigger click when not dragging
        if (!isDragging) onClick?.()
        e.stopPropagation()
      }}
      className={clsx(
        'group relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition',
        'hover:border-slate-300 hover:shadow-md cursor-grab active:cursor-grabbing select-none',
        isDragging && 'opacity-30',
        compact ? 'w-full' : 'w-full'
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        {agent.photo_url ? (
          <img
            src={agent.photo_url}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
            onError={(e) => ((e.currentTarget.style.display = 'none'))}
          />
        ) : (
          <div
            className={clsx(
              'h-9 w-9 rounded-full grid place-items-center text-[11px] font-semibold ring-1 ring-slate-200',
              regionClass(agent.choix1)
            )}
          >
            {initials}
          </div>
        )}
      </div>

      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-slate-800">
          {agent.nom_complet ?? `${agent.prenom ?? ''} ${agent.nom ?? ''}`}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className={clsx('rounded-full px-1.5 py-0.5 text-[10px] font-medium', regionClass(agent.choix1))}>
            {agent.choix1 ?? '—'}
          </span>
          {agent.sexe && <span className="text-slate-400">· {agent.sexe[0]}</span>}
        </div>
      </div>

      {/* Score */}
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold text-slate-700">
          {score != null ? score.toFixed(2) : '—'}
        </div>
        <div className="text-[9px] uppercase tracking-wide text-slate-400">/ 20</div>
      </div>
    </div>
  )
}
