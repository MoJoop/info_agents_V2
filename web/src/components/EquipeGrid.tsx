import type { Agent, Assignment, Equipe } from '../types'
import { EquipeCard } from './EquipeCard'

interface Props {
  equipes: Equipe[]
  assignments: Record<string, Assignment>
  agents: Agent[]
  scoreMap: Map<string, number | null>
  onOpenAgent: (a: Agent) => void
  onRemove: (agent_id: string) => void
}

export function EquipeGrid({ equipes, assignments, agents, scoreMap, onOpenAgent, onRemove }: Props) {
  const agentsById = new Map(agents.map((a) => [a.id, a]))

  const bySlot = new Map<string, (Assignment | undefined)[]>()
  for (const eq of equipes) bySlot.set(eq.id, [undefined, undefined, undefined, undefined])
  for (const a of Object.values(assignments)) {
    const arr = bySlot.get(a.equipe_id)
    if (arr && a.slot >= 0 && a.slot < 4) arr[a.slot] = a
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3 p-3">
      {[...equipes].sort((a, b) => a.ordre - b.ordre).map((eq) => (
        <EquipeCard
          key={eq.id}
          equipe={eq}
          assignmentsBySlot={bySlot.get(eq.id) || []}
          agentsById={agentsById}
          scoreMap={scoreMap}
          onOpenAgent={onOpenAgent}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
