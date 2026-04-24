import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import clsx from 'clsx'

type Kind = 'error' | 'success' | 'info'
interface T { id: number; kind: Kind; message: string }
interface Ctx { push: (k: Kind, m: string) => void }

const C = createContext<Ctx | null>(null)
export const useToast = () => {
  const c = useContext(C); if (!c) throw new Error('ToastProvider missing'); return c
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<T[]>([])
  const push = (kind: Kind, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts, { id, kind, message }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3000)
  }
  return (
    <C.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => <Item key={t.id} toast={t} onClose={() => setToasts((s) => s.filter((x) => x.id !== t.id))} />)}
      </div>
    </C.Provider>
  )
}

function Item({ toast, onClose }: { toast: T; onClose: () => void }) {
  const [show, setShow] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setShow(true)) }, [])
  const Icon = toast.kind === 'error' ? AlertCircle : toast.kind === 'success' ? CheckCircle2 : Info
  return (
    <div className={clsx(
      'flex items-start gap-2 rounded-xl border shadow-lg px-3 py-2.5 bg-white transition-all duration-200',
      show ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      toast.kind === 'error' && 'border-red-200',
      toast.kind === 'success' && 'border-emerald-200',
      toast.kind === 'info' && 'border-slate-200',
    )}>
      <Icon className={clsx('h-4 w-4 mt-0.5 shrink-0',
        toast.kind === 'error' && 'text-red-500',
        toast.kind === 'success' && 'text-emerald-500',
        toast.kind === 'info' && 'text-slate-500')} />
      <div className="text-xs text-slate-700 flex-1 leading-relaxed">{toast.message}</div>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-3.5 w-3.5" /></button>
    </div>
  )
}
