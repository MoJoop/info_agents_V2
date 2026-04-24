import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Review, Verdict } from '../types'

const LS_KEY = 'ehcvm3_photo_reviews_v1'
type ReviewMap = Record<string, Review>
export type SyncState = 'idle' | 'syncing' | 'error' | 'offline'

const loadLS = (): ReviewMap => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
const saveLS = (m: ReviewMap) => localStorage.setItem(LS_KEY, JSON.stringify(m))

interface Opts { onError?: (msg: string) => void }

export function useReviews(opts: Opts = {}) {
  const [reviews, setReviews] = useState<ReviewMap>(loadLS)
  const [ready, setReady] = useState(false)
  const [sync, setSync] = useState<SyncState>(supabase ? 'idle' : 'offline')
  const pending = useRef(0)
  const onErrRef = useRef(opts.onError)
  useEffect(() => { onErrRef.current = opts.onError }, [opts.onError])

  const markStart = () => { pending.current += 1; setSync('syncing') }
  const markDone = (err?: string) => {
    pending.current = Math.max(0, pending.current - 1)
    if (err) { setSync('error'); onErrRef.current?.(err) }
    else if (pending.current === 0) setSync('idle')
  }

  useEffect(() => {
    if (!supabase) { setReady(true); return }
    let active = true
    const sb = supabase
    sb.from('photo_reviews').select('*').then(({ data, error }) => {
      if (!active) return
      if (error) { onErrRef.current?.(`Chargement impossible : ${error.message}`); setSync('error') }
      else if (data) {
        const m: ReviewMap = {}
        for (const r of data as Review[]) m[r.agent_id] = r
        setReviews(m); saveLS(m)
      }
      setReady(true)
    })
    const channel = sb
      .channel('photo-reviews-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photo_reviews' }, (payload) => {
        setReviews((prev) => {
          const next = { ...prev }
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as Review)?.agent_id
            if (id) delete next[id]
          } else {
            const row = payload.new as Review
            if (row?.agent_id) next[row.agent_id] = row
          }
          saveLS(next); return next
        })
      })
      .subscribe()
    return () => { active = false; sb.removeChannel(channel) }
  }, [])

  const setVerdict = useCallback(async (agent_id: string, verdict: Verdict | null) => {
    // Toggle logic: passed null = delete. Otherwise upsert.
    setReviews((prev) => {
      const next = { ...prev }
      if (verdict == null) delete next[agent_id]
      else next[agent_id] = { agent_id, verdict, updated_at: new Date().toISOString() }
      saveLS(next); return next
    })
    if (!supabase) return
    const sb = supabase
    markStart()
    try {
      if (verdict == null) {
        const { error } = await sb.from('photo_reviews').delete().eq('agent_id', agent_id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await sb
          .from('photo_reviews')
          .upsert({ agent_id, verdict }, { onConflict: 'agent_id' })
        if (error) throw new Error(error.message)
      }
      markDone()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      markDone(`Écriture refusée : ${msg}`)
    }
  }, [])

  const clearAll = useCallback(async () => {
    setReviews({}); saveLS({})
    if (!supabase) return
    const sb = supabase
    markStart()
    try {
      const { error } = await sb.from('photo_reviews').delete().neq('agent_id', '')
      if (error) throw new Error(error.message)
      markDone()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      markDone(`Réinitialisation refusée : ${msg}`)
    }
  }, [])

  return { reviews, setVerdict, clearAll, ready, sync }
}
