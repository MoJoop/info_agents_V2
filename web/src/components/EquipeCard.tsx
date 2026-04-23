import { useDroppable } from '@dnd-kit/core'
import clsx from 'clsx'
import { Star, X } from 'lucide-react'
import type { Agent, Assignment, Equipe } from '../types'
import { AgentCard } from './AgentCard'
import { regionBg, regionClass } from '../lib/scoring'

interface Props {
  equipe: Equipe
  assignmentsBySlot: (Assignment | undefined)[] // [CE, A1, A2, A3]
  agentsById: Map<string, Agent>
  scoreMap: Map<string, number | null>
  onOpenAgent: (a: Agent) => void
  onRemove: (agent_id: string) => void
  canEdit?: boolean
  onGatedAction?: () => void
}

export function EquipeCard({
  equipe,
  assignmentsBySlot,
  agentsById,
  scoreMap,
  onOpenAgent,
  onRemove,
  canEdit = true,
  onGatedAction,
}: Props) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden',
        regionBg(equipe.region_dominante)
      )}
    >
      <div className="px-3 py-2 border-b border-slate-200/70 flex items-center justify-between bg-white/60">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800">{equipe.id}</span>
          {equipe.region_dominante && (
            <span className={clsx('text-[10px] rounded-full px-2 py-0.5 font-medium', regionClass(equipe.region_dominante))}>
              {equipe.region_dominante}
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-500 font-medium">{equipe.nb_dr} DR</span>
      </div>
      <div className="p-2 flex flex-col gap-1.5">
        {[0, 1, 2, 3].map((slot) => (
          <Slot
            key={slot}
            equipeId={equipe.id}
            slot={slot}
            assignment={assignmentsBySlot[slot]}
            agentsById={agentsById}
            scoreMap={scoreMap}
            onOpenAgent={onOpenAgent}
            onRemove={onRemove}
            canEdit={canEdit}
            onGatedAction={onGatedAction}
          />
        ))}
      </div>
    </div>
  )
}

interface SlotProps {
  equipeId: string
  slot: number
  assignment: Assignment | undefined
  agentsById: Map<string, Agent>
  scoreMap: Map<string, number | null>
  onOpenAgent: (a: Agent) => void
  onRemove: (agent_id: string) => void
  canEdit: boolean
  onGatedAction?: () => void
}

function Slot({ equipeId, slot, assignment, agentsById, scoreMap, onOpenAgent, onRemove, canEdit, onGatedAction }: SlotProps) {
  const droppableId = `${equipeId}::${slot}`
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    disabled: !canEdit,
    data: { equipeId, slot },
  })

  const agent = assignment ? agentsById.get(assignment.agent_id) : null

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'relative rounded-lg border border-dashed transition',
        isOver ? 'border-slate-500 bg-slate-50' : 'border-slate-300/70',
        !agent && 'py-2 px-2 text-[11px] text-slate-400 flex items-center gap-1',
        slot === 0 && !agent && 'bg-amber-50/50'
      )}
    >
      {!agent && (
        <>
          {slot === 0 ? <Star className="h-3.5 w-3.5 text-amber-500" /> : null}
          <span>{slot === 0 ? 'Chef d’équipe' : `Agent ${slot}`}</span>
        </>
      )}
      {agent && (
        <div className="relative">
          {slot === 0 && (
            <div className="absolute -top-1.5 -left-1.5 z-10 h-5 w-5 rounded-full bg-amber-400 grid place-items-center shadow">
              <Star className="h-3 w-3 text-white" fill="currentColor" />
            </div>
          )}
          <AgentCard
            agent={agent}
            score={scoreMap.get(agent.id) ?? null}
            onClick={() => onOpenAgent(agent)}
            draggingDisabled={!canEdit}
            onGatedAction={onGatedAction}
          />
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove(agent.id)
              }}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white border border-slate-300 text-slate-500 hover:text-red-600 hover:border-red-300 grid place-items-center shadow-sm"
              title="Retirer de l'équipe"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
