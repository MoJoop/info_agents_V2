import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Assignment, Role } from '../types'

const LS_KEY = 'ehcvm3_assignments_v1'

type AssignmentMap = Record<string, Assignment>
export type SyncState = 'idle' | 'syncing' | 'error' | 'offline'

function loadFromLS(): AssignmentMap {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveToLS(m: AssignmentMap) {
  localStorage.setItem(LS_KEY, JSON.stringify(m))
}

interface Options {
  onError?: (msg: string) => void
}

export function useAssignments(opts: Options = {}) {
  const [assignments, setAssignments] = useState<AssignmentMap>(loadFromLS)
  const [ready, setReady] = useState(false)
  const [sync, setSync] = useState<SyncState>(supabase ? 'idle' : 'offline')
  const pendingCountRef = useRef(0)
  const onErrorRef = useRef(opts.onError)
  useEffect(() => {
    onErrorRef.current = opts.onError
  }, [opts.onError])

  const markStart = () => {
    pendingCountRef.current += 1
    setSync('syncing')
  }
  const markDone = (err?: string) => {
    pendingCountRef.current = Math.max(0, pendingCountRef.current - 1)
    if (err) {
      setSync('error')
      onErrorRef.current?.(err)
    } else if (pendingCountRef.current === 0) {
      setSync('idle')
    }
  }

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }
    let active = true
    const sb = supabase
    sb.from('assignments').select('*').then(({ data, error }) => {
      if (!active) return
      if (error) {
        onErrorRef.current?.(`Chargement impossible : ${error.message}`)
        setSync('error')
      } else if (data) {
        const map: AssignmentMap = {}
        for (const a of data as Assignment[]) map[a.agent_id] = a
        setAssignments(map)
        saveToLS(map)
      }
      setReady(true)
    })

    const channel = sb
      .channel('assignments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, (payload) => {
        setAssignments((prev) => {
          const next = { ...prev }
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as Assignment)?.agent_id
            if (id) delete next[id]
          } else {
            const row = payload.new as Assignment
            if (row?.agent_id) next[row.agent_id] = row
          }
          saveToLS(next)
          return next
        })
      })
      .subscribe()

    return () => {
      active = false
      sb.removeChannel(channel)
    }
  }, [])

  const place = useCallback(
    async (agent_id: string, equipe_id: string, role: Role, slot: number) => {
      const next: Assignment = {
        agent_id,
        equipe_id,
        role,
        slot,
        updated_at: new Date().toISOString(),
      }
      // Optimistic local update — find who was in target slot, move them aside
      let displacedId: string | null = null
      setAssignments((prev) => {
        const copy = { ...prev }
        for (const [aid, a] of Object.entries(copy)) {
          if (a.equipe_id === equipe_id && a.slot === slot && aid !== agent_id) {
            displacedId = aid
            delete copy[aid]
          }
        }
        copy[agent_id] = next
        saveToLS(copy)
        return copy
      })

      if (!supabase) return
      const sb = supabase
      markStart()
      try {
        // Remove any row occupying (equipe_id, slot) to avoid unique conflict
        if (displacedId) {
          const { error: dErr } = await sb.from('assignments').delete().eq('agent_id', displacedId)
          if (dErr) throw new Error(dErr.message)
        }
        const { error } = await sb.from('assignments').upsert(next, { onConflict: 'agent_id' })
        if (error) throw new Error(error.message)
        markDone()
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        markDone(`Écriture refusée : ${msg}. Les autres superviseurs ne verront pas ce changement.`)
      }
    },
    []
  )

  const remove = useCallback(async (agent_id: string) => {
    setAssignments((prev) => {
      const copy = { ...prev }
      delete copy[agent_id]
      saveToLS(copy)
      return copy
    })
    if (!supabase) return
    const sb = supabase
    markStart()
    try {
      const { error } = await sb.from('assignments').delete().eq('agent_id', agent_id)
      if (error) throw new Error(error.message)
      markDone()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      markDone(`Suppression refusée : ${msg}`)
    }
  }, [])

  const clearAll = useCallback(async () => {
    setAssignments({})
    saveToLS({})
    if (!supabase) return
    const sb = supabase
    markStart()
    try {
      const { error } = await sb.from('assignments').delete().neq('agent_id', '')
      if (error) throw new Error(error.message)
      markDone()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      markDone(`Réinitialisation refusée : ${msg}`)
    }
  }, [])

  return { assignments, place, remove, clearAll, ready, sync }
}
