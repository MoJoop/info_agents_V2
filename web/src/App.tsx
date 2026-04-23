import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { AlertTriangle, Download, Loader2, LogIn, LogOut, Map as MapIcon, Trash2, Users, Wifi, WifiOff } from 'lucide-react'
import type { SyncState } from './lib/store'
import clsx from 'clsx'
import type { Agent, AgentsPayload, Equipe, EquipesPayload, MissingStrategy, Scenario, Weights } from './types'
import { AgentPool } from './components/AgentPool'
import { EquipeGrid } from './components/EquipeGrid'
import { AgentModal } from './components/AgentModal'
import { WeightingPanel } from './components/WeightingPanel'
import { AgentCard } from './components/AgentCard'
import { MapView } from './components/MapView'
import { LoginModal } from './components/LoginModal'
import { useToast } from './components/Toast'
import { computeGroupMeans, computeScore, computeScoreForScenario, DEFAULT_WEIGHTS } from './lib/scoring'
import { useAssignments } from './lib/store'
import { useAuth } from './lib/auth'
import { isSupabaseConfigured } from './lib/supabase'
import { exportTeamsToExcel } from './lib/export'

function SyncBadge({
  configured,
  ready,
  sync,
}: {
  configured: boolean
  ready: boolean
  sync: SyncState
}) {
  if (!configured) {
    return (
      <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
        <WifiOff className="h-3 w-3" />
        Local
      </div>
    )
  }
  if (!ready) {
    return (
      <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
        <Loader2 className="h-3 w-3 animate-spin" />
        Connexion…
      </div>
    )
  }
  if (sync === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">
        <Loader2 className="h-3 w-3 animate-spin" />
        Synchro…
      </div>
    )
  }
  if (sync === 'error') {
    return (
      <div
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-red-50 text-red-700"
        title="La dernière écriture a échoué. Les autres superviseurs ne voient pas cette modification."
      >
        <AlertTriangle className="h-3 w-3" />
        Erreur sync
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
      <Wifi className="h-3 w-3" />
      Temps réel
    </div>
  )
}

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)
  const [strategy, setStrategy] = useState<MissingStrategy>('average_present')
  const [openAgent, setOpenAgent] = useState<Agent | null>(null)
  const [activeDrag, setActiveDrag] = useState<Agent | null>(null)
  const [tab, setTab] = useState<'composition' | 'carte'>('composition')
  const [scenario, setScenario] = useState<Scenario>('scenario_1')
  const [loginOpen, setLoginOpen] = useState(false)
  const toast = useToast()
  const { isAuthed, username, logout } = useAuth()
  const { assignments, place, remove, clearAll, ready, sync } = useAssignments({
    onError: (msg) => toast.push('error', msg),
  })

  const requireAuth = () => {
    if (isAuthed) return true
    toast.push('info', 'Connectez-vous pour modifier les affectations')
    setLoginOpen(true)
    return false
  }

  useEffect(() => {
    Promise.all([
      fetch('/agents.json').then((r) => r.json() as Promise<AgentsPayload>),
      fetch('/equipes.json').then((r) => r.json() as Promise<EquipesPayload>),
    ])
      .then(([a, e]) => {
        setAgents(a.agents)
        setEquipes(e.equipes)
      })
      .catch((err) => setLoadErr(String(err)))
  }, [])

  const groupMeans = useMemo(() => computeGroupMeans(agents), [agents])

  const scoreMap = useMemo(() => {
    const m = new Map<string, number | null>()
    for (const a of agents) {
      const s = scenario === 'custom'
        ? computeScore(a, weights, strategy, groupMeans)
        : computeScoreForScenario(a, scenario)
      m.set(a.id, s)
    }
    return m
  }, [agents, weights, strategy, groupMeans, scenario])

  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      const ra = a.choix1 ?? 'ZZZ'
      const rb = b.choix1 ?? 'ZZZ'
      if (ra !== rb) return ra.localeCompare(rb)
      const sa = scoreMap.get(a.id) ?? -Infinity
      const sb = scoreMap.get(b.id) ?? -Infinity
      return sb - sa
    })
  }, [agents, scoreMap])

  const assignedIds = useMemo(() => new Set(Object.keys(assignments)), [assignments])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragStart = (e: DragStartEvent) => {
    const a = e.active.data.current?.agent as Agent | undefined
    setActiveDrag(a ?? null)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveDrag(null)
    if (!e.over) return
    if (!isAuthed) {
      requireAuth()
      return
    }
    const agent = e.active.data.current?.agent as Agent | undefined
    const target = e.over.data.current as { equipeId: string; slot: number } | undefined
    if (!agent || !target) return
    const role = target.slot === 0 ? 'CE' : 'AGENT'
    await place(agent.id, target.equipeId, role, target.slot)
  }

  const stats = useMemo(() => {
    const placed = Object.keys(assignments).length
    const total = equipes.length * 4
    const fullTeams = equipes.filter((eq) =>
      [0, 1, 2, 3].every((s) => Object.values(assignments).some((a) => a.equipe_id === eq.id && a.slot === s))
    ).length
    const ceMissing = equipes.filter(
      (eq) => !Object.values(assignments).some((a) => a.equipe_id === eq.id && a.slot === 0)
    ).length
    return { placed, total, fullTeams, ceMissing }
  }, [assignments, equipes])

  if (loadErr) {
    return (
      <div className="p-8 text-red-700">Erreur de chargement des données : {loadErr}</div>
    )
  }

  if (!agents.length || !equipes.length) {
    return (
      <div className="p-8 text-slate-500">Chargement des données…</div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="fixed inset-0 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-20">
          <div className="px-5 py-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-slate-700" />
              <h1 className="text-lg font-semibold text-slate-800">EHCVM3 — Composition des équipes</h1>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span><b className="text-slate-800">{stats.placed}</b> / {stats.total} placés</span>
              <span><b className="text-slate-800">{stats.fullTeams}</b> / {equipes.length} équipes complètes</span>
              {stats.ceMissing > 0 && (
                <span className="text-amber-700"><b>{stats.ceMissing}</b> CE manquants</span>
              )}
            </div>
            <SyncBadge configured={isSupabaseConfigured} ready={ready} sync={sync} />
            {isAuthed ? (
              <button
                onClick={() => {
                  logout()
                  toast.push('info', 'Déconnecté')
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 px-3 py-1.5 hover:bg-slate-50"
                title={`Connecté en tant que ${username}`}
              >
                <LogOut className="h-3.5 w-3.5" /> {username}
              </button>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 bg-white px-3 py-1.5 hover:bg-slate-50"
              >
                <LogIn className="h-3.5 w-3.5" /> Se connecter
              </button>
            )}
            <button
              onClick={() => {
                if (!requireAuth()) return
                exportTeamsToExcel(agents, equipes, assignments)
              }}
              className={clsx(
                'inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5',
                isAuthed ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              )}
            >
              <Download className="h-3.5 w-3.5" /> Exporter Excel
            </button>
            <button
              onClick={() => {
                if (!requireAuth()) return
                if (confirm('Vider toutes les affectations ?')) clearAll()
              }}
              className={clsx(
                'inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5',
                isAuthed
                  ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  : 'border border-slate-200 text-slate-400 cursor-not-allowed'
              )}
            >
              <Trash2 className="h-3.5 w-3.5" /> Tout vider
            </button>
          </div>
        </header>

        {/* Tabs */}
        <nav className="shrink-0 border-b border-slate-200 bg-white/60 px-5 flex items-center gap-1">
          {([
            { id: 'composition', label: 'Composition', Icon: Users },
            { id: 'carte', label: 'Carte', Icon: MapIcon },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition',
                tab === id
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        {tab === 'composition' ? (
          <>
            {/* Weighting bar — horizontal under tabs */}
            <WeightingPanel
              weights={weights}
              setWeights={setWeights}
              strategy={strategy}
              setStrategy={setStrategy}
              groupMeans={groupMeans}
              scenario={scenario}
              setScenario={setScenario}
            />

            {/* Body */}
            <div className="flex-1 min-h-0 grid grid-cols-[minmax(420px,36%)_1fr] gap-0">
              <aside className="border-r border-slate-200 bg-white/50 flex flex-col min-h-0">
                <AgentPool
                  agents={sortedAgents}
                  scoreMap={scoreMap}
                  assignedIds={assignedIds}
                  onOpenAgent={setOpenAgent}
                  draggingDisabled={!isAuthed}
                  onGatedAction={requireAuth}
                />
              </aside>

              <main className="overflow-auto">
                <EquipeGrid
                  equipes={equipes}
                  assignments={assignments}
                  agents={agents}
                  scoreMap={scoreMap}
                  onOpenAgent={setOpenAgent}
                  onRemove={remove}
                  canEdit={isAuthed}
                  onGatedAction={requireAuth}
                />
              </main>
            </div>
          </>
        ) : (
          <main className="flex-1 min-h-0 relative overflow-hidden">
            <div className="absolute inset-0 w-full h-full">
              <MapView />
            </div>
          </main>
        )}
      </div>

      <AgentModal
        agent={openAgent}
        score={openAgent ? scoreMap.get(openAgent.id) ?? null : null}
        onClose={() => setOpenAgent(null)}
      />

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />

      <DragOverlay>
        {activeDrag ? (
          <div className="w-[260px] rotate-1">
            <AgentCard agent={activeDrag} score={scoreMap.get(activeDrag.id) ?? null} draggingDisabled />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
