import * as XLSX from 'xlsx'
import type { AgentLite, Review } from '../types'

export function exportPhotoReviews(agents: AgentLite[], reviews: Record<string, Review>) {
  const bon: Record<string, unknown>[] = []
  const mauvais: Record<string, unknown>[] = []
  const pending: Record<string, unknown>[] = []

  for (const a of agents) {
    const r = reviews[a.id]
    const row = {
      Nom_Complet: a.nom_complet ?? '',
      Prenom: a.prenom ?? '',
      Nom: a.nom ?? '',
      Telephone: a.telephone,
      Region_Choix1: a.choix1 ?? '',
      Photo_URL: a.photo_url ?? '',
      A_Photo: a.photo_url ? 'oui' : 'non',
      Verdict: r?.verdict ?? 'non_evalue',
      Date_Verdict: r?.updated_at ?? '',
    }
    if (r?.verdict === 'bon') bon.push(row)
    else if (r?.verdict === 'mauvais') mauvais.push(row)
    else pending.push(row)
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bon), 'Bon')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mauvais), 'Mauvais')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pending), 'Non_evalues')

  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `EHCVM3_photos_verdicts_${today}.xlsx`)
}
