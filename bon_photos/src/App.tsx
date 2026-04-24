import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  Check,
  Download,
  ImageOff,
  Loader2,
  Search,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import type { AgentLite, Filter } from './types'
import { PhotoCard } from './components/PhotoCard'
import { useToast } from './components/Toast'
import { useReviews, type SyncState } from './lib/store'
import { isSupabaseConfigured } from './lib/supabase'
import { exportPhotoReviews } from './lib/export'

interface AgentsPayload {
  agents: Array<{
    id: string
    telephone: string
    prenom: string | null
    nom: string | null
    nom_complet: string | null
    photo_url: string | null
    photo_kobo_url: string | null
    choix1: string | null
  }>
}

function SyncBadge({ ready, sync, configured }: { ready: boolean; sync: SyncState; configured: boolean }) {
  if (!configured) return <Pill className="bg-slate-100 text-slate-600"><WifiOff className="h-3 w-3" />Local</Pill>
  if (!ready) return <Pill className="bg-slate-100 text-slate-600"><Loader2 className="h-3 w-3 animate-spin" />Connexion…</Pill>
  if (sync === 'syncing') return <Pill className="bg-amber-50 text-amber-700"><Loader2 className="h-3 w-3 animate-spin" />Synchro…</Pill>
  if (sync === 'error') return <Pill className="bg-red-50 text-red-700"><AlertTriangle className="h-3 w-3" />Erreur sync</Pill>
  return <Pill className="bg-emerald-50 text-emerald-700"><Wifi className="h-3 w-3" />Temps réel</Pill>
}
function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx('flex items-center gap-1.5 text-xs px-2 py-1 rounded-full', className)}>{children}</div>
}

export default function App() {
  const [agents, setAgents] = useState<AgentLite[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const toast = useToast()
  const { reviews, setVerdict, clearAll, ready, sync } = useReviews({
    onError: (m) => toast.push('error', m),
  })

  useEffect(() => {
    fetch('/agents.json')
      .then((r) => r.json() as Promise<AgentsPayload>)
      .then((p) => setAgents(p.agents.map((a) => ({
        id: a.id, telephone: a.telephone, prenom: a.prenom, nom: a.nom,
        nom_complet: a.nom_complet, photo_url: a.photo_url,
        photo_kobo_url: a.photo_kobo_url, choix1: a.choix1,
      }))))
      .catch((e) => setLoadErr(String(e)))
  }, [])

  const stats = useMemo(() => {
    let bon = 0, mauvais = 0, noPhoto = 0
    for (const a of agents) {
      if (!a.photo_url) noPhoto += 1
      const v = reviews[a.id]?.verdict
      if (v === 'bon') bon += 1
      else if (v === 'mauvais') mauvais += 1
    }
    const pending = agents.length - bon - mauvais - noPhoto
    return { bon, mauvais, noPhoto, pending, total: agents.length }
  }, [agents, reviews])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return agents.filter((a) => {
      if (filter === 'bon' && reviews[a.id]?.verdict !== 'bon') return false
      if (filter === 'mauvais' && reviews[a.id]?.verdict !== 'mauvais') return false
      if (filter === 'pending' && (reviews[a.id]?.verdict || !a.photo_url)) return false
      if (filter === 'no_photo' && a.photo_url) return false
      if (q) {
        const h = `${a.nom_complet ?? ''} ${a.telephone} ${a.choix1 ?? ''}`.toLowerCase()
        if (!h.includes(q)) return false
      }
      return true
    })
  }, [agents, reviews, filter, query])

  const toggle = (id: string, v: 'bon' | 'mauvais') => {
    const current = reviews[id]?.verdict ?? null
    setVerdict(id, current === v ? null : v)
  }

  if (loadErr) return <div className="p-8 text-red-700">Erreur : {loadErr}</div>
  if (!agents.length) return <div className="p-8 text-slate-500">Chargement…</div>

  return (
    <div className="min-h-screen flex flex-col">
      <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="px-5 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-slate-700" />
            <h1 className="text-lg font-semibold text-slate-800">EHCVM3 — Revue des photos</h1>
          </div>
          <div className="flex-1" />
          <SyncBadge configured={isSupabaseConfigured} ready={ready} sync={sync} />
          <button
            onClick={() => exportPhotoReviews(agents, reviews)}
            className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white px-3 py-1.5 hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" /> Exporter Excel
          </button>
          <button
            onClick={() => { if (confirm('Réinitialiser tous les verdicts ?')) clearAll() }}
            className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 px-3 py-1.5 hover:bg-slate-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Tout réinitialiser
          </button>
        </div>
      </header>

      <div className="shrink-0 px-5 py-2.5 bg-white/70 border-b border-slate-200 flex items-center gap-3 flex-wrap">
        <StatChip color="emerald" icon={<Check className="h-3 w-3" />} label="Bon" count={stats.bon} active={filter === 'bon'} onClick={() => setFilter(filter === 'bon' ? 'all' : 'bon')} />
        <StatChip color="red" icon={<X className="h-3 w-3" />} label="Mauvais" count={stats.mauvais} active={filter === 'mauvais'} onClick={() => setFilter(filter === 'mauvais' ? 'all' : 'mauvais')} />
        <StatChip color="slate" icon={<Loader2 className="h-3 w-3" />} label="À évaluer" count={stats.pending} active={filter === 'pending'} onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')} />
        <StatChip color="amber" icon={<ImageOff className="h-3 w-3" />} label="Sans photo" count={stats.noPhoto} active={filter === 'no_photo'} onClick={() => setFilter(filter === 'no_photo' ? 'all' : 'no_photo')} />
        <div className="h-5 w-px bg-slate-200" />
        <span className="text-xs text-slate-500">
          <b className="text-slate-800">{stats.bon + stats.mauvais}</b> / {stats.total - stats.noPhoto} évalués
        </span>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, téléphone, région…"
            className="w-72 max-w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} className="text-[11px] text-slate-500 hover:text-slate-800">
            Effacer filtre
          </button>
        )}
      </div>

      <main className="flex-1 min-h-0 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="text-center text-slate-400 py-20 text-sm">Aucun agent ne correspond.</div>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {filtered.map((a) => (
              <PhotoCard
                key={a.id}
                agent={a}
                verdict={reviews[a.id]?.verdict ?? null}
                onToggle={(v) => toggle(a.id, v)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function StatChip({
  color, icon, label, count, active, onClick,
}: {
  color: 'emerald' | 'red' | 'slate' | 'amber'
  icon: React.ReactNode
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  const activeClass = {
    emerald: 'bg-emerald-500 text-white border-emerald-500',
    red:     'bg-red-500 text-white border-red-500',
    slate:   'bg-slate-700 text-white border-slate-700',
    amber:   'bg-amber-500 text-white border-amber-500',
  }[color]
  const inactiveClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    red:     'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    slate:   'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
    amber:   'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  }[color]
  return (
    <button
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 text-xs font-medium rounded-full border px-2.5 py-1 transition',
        active ? activeClass : inactiveClass
      )}
    >
      {icon}
      <span>{label}</span>
      <span className="tabular-nums font-semibold">{count}</span>
    </button>
  )
}
