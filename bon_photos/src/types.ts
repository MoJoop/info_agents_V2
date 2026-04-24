export type Verdict = 'bon' | 'mauvais'

export interface AgentLite {
  id: string
  telephone: string
  prenom: string | null
  nom: string | null
  nom_complet: string | null
  photo_url: string | null
  photo_kobo_url: string | null
  choix1: string | null
}

export interface Review {
  agent_id: string
  verdict: Verdict | null
  updated_at?: string
}

export type Filter = 'all' | 'bon' | 'mauvais' | 'pending' | 'no_photo'
