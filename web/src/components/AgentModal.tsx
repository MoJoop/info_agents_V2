import { X } from 'lucide-react'
import type { Agent } from '../types'
import { regionClass } from '../lib/scoring'
import clsx from 'clsx'

interface Props {
  agent: Agent | null
  score: number | null
  onClose: () => void
}

export function AgentModal({ agent, score, onClose }: Props) {
  if (!agent) return null

  const j1 = agent.notes.j1
  const j2 = agent.notes.j2
  const dev = agent.notes.dev

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-start gap-4">
          {agent.photo_url ? (
            <img src={agent.photo_url} alt="" className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200" />
          ) : (
            <div className={clsx(
              'h-20 w-20 rounded-xl grid place-items-center text-2xl font-bold ring-1 ring-slate-200',
              regionClass(agent.choix1)
            )}>
              {(agent.prenom?.[0] ?? '') + (agent.nom?.[0] ?? '')}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-semibold text-slate-800">{agent.nom_complet}</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {agent.sexe} {agent.date_naissance && `· Né(e) le ${agent.date_naissance}`}
            </p>
            <p className="text-sm text-slate-600 mt-1">📞 {agent.telephone}</p>
            {agent.adresse && <p className="text-xs text-slate-500 mt-0.5">📍 {agent.adresse}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Choix régions */}
          <section>
            <h4 className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">
              Choix d'affectation
            </h4>
            <div className="flex gap-2 flex-wrap">
              {[agent.choix1, agent.choix2, agent.choix3].map((r, i) =>
                r ? (
                  <span key={i} className={clsx('rounded-full px-3 py-1 text-xs font-medium', regionClass(r))}>
                    {i + 1}. {r}
                  </span>
                ) : null
              )}
            </div>
          </section>

          {/* Langues */}
          {agent.langues && (
            <section>
              <h4 className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">
                Langues
              </h4>
              <p className="text-sm text-slate-700">{agent.langues}</p>
            </section>
          )}

          {/* Score courant */}
          <section className="bg-slate-50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Score actuel (pondéré)</div>
              <div className="text-2xl font-bold text-slate-800">{score != null ? score.toFixed(2) : '—'}<span className="text-sm font-normal text-slate-500"> / 20</span></div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>Simple : <b>{agent.moyenne_globale_simple?.toFixed(2) ?? '—'}</b></div>
            </div>
          </section>

          {/* Notes détaillées */}
          <section>
            <h4 className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">
              Notes détaillées
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <NoteBlock title="Jour 1" moyenne={agent.moyennes_categorie.j1} notes={j1} keys={['S1','S2','S3','S9','S11']} />
              <NoteBlock title="Jour 2" moyenne={agent.moyennes_categorie.j2} notes={j2} keys={['S7','S10','S13','S16','S17']} extras={j2 ? { bonus: j2.bonus, malus: j2.malus } : null} />
              <NoteBlock title="Développement" moyenne={agent.moyennes_categorie.dev} notes={dev} keys={['S01','S02','S03','S04','S05_S06','S07','S09','S10']} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function NoteBlock({
  title,
  moyenne,
  notes,
  keys,
  extras,
}: {
  title: string
  moyenne: number | null
  notes: Record<string, number | null | undefined> | null
  keys: string[]
  extras?: Record<string, number | null | undefined> | null
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-700">{title}</span>
        <span className="text-sm font-bold text-slate-800">
          {moyenne != null ? moyenne.toFixed(2) : '—'}
        </span>
      </div>
      <dl className="space-y-0.5 text-[11px]">
        {keys.map((k) => (
          <div key={k} className="flex justify-between">
            <dt className="text-slate-500">{k.replace('_', '-')}</dt>
            <dd className="font-mono text-slate-700">{notes?.[k] != null ? Number(notes[k]).toFixed(2) : '—'}</dd>
          </div>
        ))}
        {extras && Object.entries(extras).map(([k, v]) => v != null ? (
          <div key={k} className="flex justify-between pt-1 mt-1 border-t border-slate-100">
            <dt className="text-slate-500 capitalize">{k}</dt>
            <dd className={clsx('font-mono', Number(v) < 0 ? 'text-red-600' : 'text-emerald-600')}>
              {Number(v) > 0 ? '+' : ''}{Number(v).toFixed(2)}
            </dd>
          </div>
        ) : null)}
      </dl>
    </div>
  )
}
