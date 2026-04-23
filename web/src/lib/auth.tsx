import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

// NOTE: this is client-side only — the hash is baked into the bundle and
// anyone can inspect it. It is security-by-obscurity, suitable for a link
// shared with supervisors. For real server-side gating, migrate mama_diop
// to Supabase Auth and restrict RLS write policies to `auth.uid() IS NOT NULL`.
const EXPECTED_HASH = (import.meta.env.VITE_AUTH_CREDENTIAL_HASH as string | undefined) ?? ''

const LS_KEY = 'ehcvm3.auth'

interface AuthState {
  isAuthed: boolean
  username: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
}

const Ctx = createContext<AuthState | null>(null)

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { username?: string }
      if (parsed?.username) setUsername(parsed.username)
    } catch {}
  }, [])

  const login = useCallback(async (u: string, p: string) => {
    if (!EXPECTED_HASH) return false
    const h = await sha256Hex(`${u.trim()}:${p}`)
    if (h.toLowerCase() !== EXPECTED_HASH.toLowerCase()) return false
    setUsername(u.trim())
    localStorage.setItem(LS_KEY, JSON.stringify({ username: u.trim(), ts: Date.now() }))
    return true
  }, [])

  const logout = useCallback(() => {
    setUsername(null)
    localStorage.removeItem(LS_KEY)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ isAuthed: !!username, username, login, logout }),
    [username, login, logout]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
