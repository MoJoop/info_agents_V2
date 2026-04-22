import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Assignment, Role } from '../types'

const LS_KEY = 'ehcvm3_assignments_v1'

type AssignmentMap = Record<string, Assignment> // keyed by agent_id

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

export function useAssignments() {
  const [assignments, setAssignments] = useState<AssignmentMap>(loadFromLS)
  const [ready, setReady] = useState(false)

  // Initial load + realtime subscription (Supabase if configured, else localStorage)
  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }
    let active = true
    supabase.from('assignments').select('*').then(({ data, error }) => {
      if (!active) return
      if (error) {
        console.warn('[assignments] load error', error)
      } else if (data) {
        const map: AssignmentMap = {}
        for (const a of data as Assignment[]) map[a.agent_id] = a
        setAssignments(map)
        saveToLS(map)
      }
      setReady(true)
    })

    const channel = supabase
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

    const sb = supabase
    return () => {
      active = false
      sb.removeChannel(channel)
    }
  }, [])

  const place = async (agent_id: string, equipe_id: string, role: Role, slot: number) => {
    const next: Assignment = {
      agent_id,
      equipe_id,
      role,
      slot,
      updated_at: new Date().toISOString(),
    }
    setAssignments((prev) => {
      const copy = { ...prev }
      // Clear any other assignment in the same slot of target team
      for (const [aid, a] of Object.entries(copy)) {
        if (a.equipe_id === equipe_id && a.slot === slot) {
          delete copy[aid]
        }
      }
      copy[agent_id] = next
      saveToLS(copy)
      return copy
    })
    if (supabase) {
      const sb = supabase
      const { error } = await sb.from('assignments').upsert(next, { onConflict: 'agent_id' })
      if (error) console.warn('[assignments] upsert error', error)
    }
  }

  const remove = async (agent_id: string) => {
    setAssignments((prev) => {
      const copy = { ...prev }
      delete copy[agent_id]
      saveToLS(copy)
      return copy
    })
    if (supabase) {
      await supabase.from('assignments').delete().eq('agent_id', agent_id)
    }
  }

  const clearAll = async () => {
    setAssignments({})
    saveToLS({})
    if (supabase) {
      await supabase.from('assignments').delete().neq('agent_id', '')
    }
  }

  return { assignments, place, remove, clearAll, ready }
}
