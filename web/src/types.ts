export type CategoryMean = 'j1' | 'j2' | 'dev'

export type MissingStrategy = 'average_present' | 'group_mean' | 'zero'

export type Scenario = 'scenario_1' | 'scenario_2' | 'custom'

export interface Weights {
  j1: number
  j2: number
  dev: number
}

export interface NoteDetails {
  [section: string]: number | null | undefined
  moyenne?: number | null
  bonus?: number | null
  malus?: number | null
}

export interface Agent {
  id: string
  telephone: string
  prenom: string | null
  nom: string | null
  nom_complet: string | null
  sexe: string | null
  date_naissance: string | null
  adresse: string | null
  photo_kobo_url: string | null
  photo_url: string | null
  choix1: string | null
  choix2: string | null
  choix3: string | null
  langues: string | null
  notes: {
    j1: NoteDetails | null
    j2: NoteDetails | null
    dev: NoteDetails | null
  }
  moyennes_categorie: {
    j1: number | null
    j2: number | null
    dev: number | null
  }
  moyenne_globale_simple: number | null
  moyenne_scenario_1?: number | null
  moyenne_scenario_2?: number | null
  moyenne_exam?: number | null
}

export interface DR {
  code: string | null
  nom: string | null
  dept: string | null
  region: string | null
  milieu: string | null
  nbre_men: number | null
  lon: number | null
  lat: number | null
}

export interface Equipe {
  id: string
  ordre: number
  nb_dr: number
  region_dominante: string | null
  regions: string[]
  departements: string[]
  dr_list: DR[]
}

export interface AgentsPayload {
  metadata: {
    date_export: string
    total_agents: number
    regions_choix: string[]
    regions_equipes: string[]
  }
  agents: Agent[]
}

export interface EquipesPayload {
  metadata: {
    date_export: string
    total_equipes: number
  }
  equipes: Equipe[]
}

export type Role = 'CE' | 'AGENT'

export interface Assignment {
  agent_id: string
  equipe_id: string
  role: Role
  slot: number // 0 = CE, 1..3 = agents
  updated_at?: string
  updated_by?: string | null
}
