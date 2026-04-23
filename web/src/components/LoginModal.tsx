import { useState, type FormEvent } from 'react'
import { Lock, X, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../lib/auth'

interface Props {
  open: boolean
  onClose: () => void
}

export function LoginModal({ open, onClose }: Props) {
  const { login } = useAuth()
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const ok = await login(u, p)
      if (ok) {
        onClose()
        setU('')
        setP('')
      } else {
        setErr('Identifiants incorrects')
      }
    } catch {
      setErr('Erreur durant la connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 flex items-start gap-3 border-b border-slate-100">
          <div className="h-10 w-10 rounded-xl bg-slate-100 grid place-items-center shrink-0">
            <Lock className="h-5 w-5 text-slate-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-800">Connexion superviseur</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Requis pour modifier les affectations (glisser-déposer, export, vidage).
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Identifiant</span>
            <input
              autoFocus
              value={u}
              onChange={(e) => setU(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="mama_diop"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Mot de passe</span>
            <div className="relative mt-1">
              <input
                type={showPw ? 'text' : 'password'}
                value={p}
                onChange={(e) => setP(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {err && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-600 hover:text-slate-800 px-3 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !u || !p}
              className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white px-4 py-2 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock className="h-3.5 w-3.5" />
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
