"""Seed Supabase tables `agents` and `equipes` from the JSON files.

Requires env vars:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Run once after creating the Supabase project and applying supabase_schema.sql.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent
AGENTS_JSON = ROOT / "web" / "public" / "agents.json"
EQUIPES_JSON = ROOT / "web" / "public" / "equipes.json"

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
}


def upsert(table: str, rows: list[dict]):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    # Batches of 100 to avoid payload limits
    for i in range(0, len(rows), 100):
        batch = rows[i:i + 100]
        r = requests.post(url, headers=HEADERS, data=json.dumps(batch), timeout=60)
        if r.status_code >= 300:
            print(f"  ✗ HTTP {r.status_code}: {r.text[:300]}")
            sys.exit(1)
        print(f"  ✓ {table} {i + len(batch)}/{len(rows)}")


# Agents
agents_payload = json.loads(AGENTS_JSON.read_text(encoding="utf-8"))
agents_rows = []
for a in agents_payload["agents"]:
    agents_rows.append({
        "id": a["id"],
        "telephone": a["telephone"],
        "prenom": a["prenom"],
        "nom": a["nom"],
        "nom_complet": a["nom_complet"],
        "sexe": a["sexe"],
        "date_naissance": a["date_naissance"],
        "adresse": a["adresse"],
        "photo_url": a["photo_url"],
        "photo_kobo_url": a["photo_kobo_url"],
        "choix1": a["choix1"],
        "choix2": a["choix2"],
        "choix3": a["choix3"],
        "langues": a["langues"],
        "notes": a["notes"],
        "moyennes_categorie": a["moyennes_categorie"],
        "moyenne_globale_simple": a["moyenne_globale_simple"],
    })
print(f"Upsert agents ({len(agents_rows)})…")
upsert("agents", agents_rows)

# Equipes
equipes_payload = json.loads(EQUIPES_JSON.read_text(encoding="utf-8"))
equipes_rows = []
for e in equipes_payload["equipes"]:
    equipes_rows.append({
        "id": e["id"],
        "ordre": e["ordre"],
        "nb_dr": e["nb_dr"],
        "region_dominante": e["region_dominante"],
        "regions": e["regions"],
        "departements": e["departements"],
        "dr_list": e["dr_list"],
    })
print(f"Upsert equipes ({len(equipes_rows)})…")
upsert("equipes", equipes_rows)

print("\n✓ Seed terminé.")
