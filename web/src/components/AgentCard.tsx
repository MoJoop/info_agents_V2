import { useDraggable } from '@dnd-kit/core'
import clsx from 'clsx'
import type { Agent } from '../types'
import { regionClass } from '../lib/scoring'

interface Props {
  agent: Agent
  score: number | null
  draggingDisabled?: boolean
  onClick?: () => void
}

export function AgentCard({ agent, score, draggingDisabled, onClick }: Props) {
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
        'group relative flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 shadow-sm transition min-w-0',
        'hover:border-slate-300 hover:shadow-md cursor-grab active:cursor-grabbing select-none',
        isDragging && 'opacity-30'
      )}
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
