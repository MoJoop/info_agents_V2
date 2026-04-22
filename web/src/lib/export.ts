import * as XLSX from 'xlsx'
import type { Agent, Assignment, Equipe } from '../types'

export function exportTeamsToExcel(
  agents: Agent[],
  equipes: Equipe[],
  assignments: Record<string, Assignment>
) {
  const agentsById = new Map(agents.map((a) => [a.id, a]))

  const teamRows: Record<string, unknown>[] = []
  for (const eq of [...equipes].sort((a, b) => a.ordre - b.ordre)) {
    // CE first, then agents 1..3
    for (let slot = 0; slot < 4; slot++) {
      const assign = Object.values(assignments).find(
        (a) => a.equipe_id === eq.id && a.slot === slot
      )
      const agent = assign ? agentsById.get(assign.agent_id) : null
      teamRows.push({
        Equipe: eq.id,
        Region_Dominante: eq.region_dominante,
        Nb_DR: eq.nb_dr,
        Role: slot === 0 ? 'CE' : `Agent ${slot}`,
        Nom_Complet: agent?.nom_complet ?? '',
        Prenom: agent?.prenom ?? '',
        Nom: agent?.nom ?? '',
        Telephone: agent?.telephone ?? '',
        Sexe: agent?.sexe ?? '',
        Choix_1: agent?.choix1 ?? '',
        Choix_2: agent?.choix2 ?? '',
        Choix_3: agent?.choix3 ?? '',
        Moyenne_Simple: agent?.moyenne_globale_simple ?? '',
      })
    }
  }

  const assignedIds = new Set(Object.values(assignments).map((a) => a.agent_id))
  const unassigned = agents
    .filter((a) => !assignedIds.has(a.id))
    .map((a) => ({
      Nom_Complet: a.nom_complet ?? '',
      Prenom: a.prenom ?? '',
      Nom: a.nom ?? '',
      Telephone: a.telephone,
      Sexe: a.sexe ?? '',
      Choix_1: a.choix1 ?? '',
      Choix_2: a.choix2 ?? '',
      Choix_3: a.choix3 ?? '',
      Moyenne_Simple: a.moyenne_globale_simple ?? '',
      Moyenne_J1: a.moyennes_categorie.j1 ?? '',
      Moyenne_J2: a.moyennes_categorie.j2 ?? '',
      Moyenne_Dev: a.moyennes_categorie.dev ?? '',
    }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teamRows), 'Equipes')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unassigned), 'Non_affectes')

  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `EHCVM3_equipes_${today}.xlsx`)
}
