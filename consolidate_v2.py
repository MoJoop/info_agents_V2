"""Rebuild agents.json from note_final_v2_ehcvm3.xlsx.

Adds two scenario-based aggregate scores:
  - moyenne_scenario_1
  - moyenne_scenario_2
from the `classement_final__` sheet.

Preserves existing photo_url values (already hosted on Supabase Storage)
by reading them from the previous agents.json.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent
XLSX = ROOT / "note_final_v2_ehcvm3.xlsx"
OLD_AGENTS = ROOT / "web" / "public" / "agents.json"
OUT = ROOT / "web" / "public" / "agents.json"


def clean_str(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    return s if s and s.lower() != "nan" else None


def tel_to_str(v):
    if v is None or pd.isna(v):
        return None
    try:
        return str(int(float(v)))
    except (TypeError, ValueError):
        return str(v).strip() or None


def safe_num(v, nd=2):
    if v is None or pd.isna(v):
        return None
    try:
        return round(float(v), nd)
    except (TypeError, ValueError):
        return None


def normalize_region(r):
    if r is None:
        return None
    s = str(r).strip().upper()
    if not s or s == "NAN":
        return None
    return s.replace("SAINT LOUIS", "SAINT-LOUIS")


def date_to_iso(v):
    if v is None or pd.isna(v):
        return None
    if isinstance(v, pd.Timestamp):
        return v.date().isoformat()
    try:
        return pd.to_datetime(v).date().isoformat()
    except Exception:
        return None


def find_col(df, startswith):
    for c in df.columns:
        if c.strip().startswith(startswith):
            return c
    return None


# ---------------------------------------------------------------- load

print("Chargement…")
info = pd.read_excel(XLSX, sheet_name="info_agent")
j1 = pd.read_excel(XLSX, sheet_name="examj1")
j2 = pd.read_excel(XLSX, sheet_name="examj2")
dev = pd.read_excel(XLSX, sheet_name="devoir")
classement = pd.read_excel(XLSX, sheet_name="classement_final__")

for df in (info, j1, j2, dev, classement):
    df.columns = [str(c) for c in df.columns]

# ---------------------------------------------------------------- identity cols

COL_INFO_TEL = find_col(info, "I.10")
COL_INFO_PRENOM = find_col(info, "I.1 ")
COL_INFO_NOM = find_col(info, "I.2 ")
COL_INFO_SEXE = find_col(info, "I.3 ")
COL_INFO_DOB = find_col(info, "I.4 ")
COL_INFO_ADR = find_col(info, "I.8 ")
COL_INFO_PHOTO = find_col(info, "I.15 ")
COL_INFO_CHOIX1 = find_col(info, "II.2 ")
COL_INFO_CHOIX2 = find_col(info, "II.3 ")
COL_INFO_CHOIX3 = find_col(info, "II.4 ")
COL_INFO_LANG = find_col(info, "III.3 ")

COL_J2_TEL = "Tél. Agent"
COL_DEV_TEL = "Téléphone"
COL_CLA_TEL = "Téléphone"

# ---------------------------------------------------------------- index by tel

def index_notes(df, tel_col, num_cols, extras=None):
    out = {}
    for _, row in df.iterrows():
        tel = tel_to_str(row[tel_col])
        if not tel:
            continue
        rec = {}
        for label, col in num_cols.items():
            if col in df.columns:
                rec[label] = safe_num(row[col])
        if extras:
            for label, col in extras.items():
                if col in df.columns:
                    rec[label] = safe_num(row[col])
        out[tel] = rec
    return out


notes_j1 = index_notes(
    j1, "tel_agent",
    {"S1": "note_s1", "S2": "note_s2", "S3": "note_s3",
     "S4": "note_s4", "S9": "note_s9", "S11": "note_s11"},
    {"moyenne": "moyenne"},
)

notes_j2 = index_notes(
    j2, COL_J2_TEL,
    {"S7": "Note S7", "S10": "Note s10",
     "S13": "Note S13", "S16": "Note S16", "S17": "Note S17"},
    {"moyenne": "Moyenne", "bonus": "Bonus+ Total", "malus": "Malus"},
)

notes_dev = index_notes(
    dev, COL_DEV_TEL,
    {"S01": "Note S01", "S02": "Note S02", "S03": "Note S03",
     "S04": "Note S04", "S05_S06": "Note S05-S06",
     "S07": "Note S07", "S09": "Note S09", "S10": "Note S10"},
    {"moyenne": "Moyenne"},
)

# Scenarios index
scenarios = {}
for _, row in classement.iterrows():
    tel = tel_to_str(row.get(COL_CLA_TEL))
    if not tel:
        continue
    scenarios[tel] = {
        "scenario_1": safe_num(row.get("moyenne_general_scenario_1")),
        "scenario_2": safe_num(row.get("moyenne_general_scenario_2")),
        "moyenne_exam": safe_num(row.get("Moyenne_exam")),
    }

# ---------------------------------------------------------------- preserve photos

photo_by_tel = {}
if OLD_AGENTS.exists():
    try:
        prev = json.loads(OLD_AGENTS.read_text(encoding="utf-8"))
        for a in prev.get("agents", []):
            if a.get("photo_url"):
                photo_by_tel[a["id"]] = a["photo_url"]
        print(f"Photos préservées depuis l'ancien JSON : {len(photo_by_tel)}")
    except Exception as e:
        print(f"(ancien JSON illisible: {e})")

# ---------------------------------------------------------------- build agents

agents = []
count_j1 = count_j2 = count_dev = count_s1 = count_s2 = count_photo = count_dup = 0
count_no_info = 0
choix1_counter = Counter()

# Index info_agent rows by telephone (first occurrence wins)
info_by_tel = {}
for _, row in info.iterrows():
    tel = tel_to_str(row[COL_INFO_TEL])
    if not tel:
        continue
    if tel in info_by_tel:
        count_dup += 1
        continue
    info_by_tel[tel] = row

# Build fallback names from classement / exam sheets (for agents not in info)
name_fallback = {}
for _, row in classement.iterrows():
    tel = tel_to_str(row.get(COL_CLA_TEL))
    if tel and tel not in name_fallback:
        nm = clean_str(row.get("Prénom & Nom"))
        if nm:
            name_fallback[tel] = nm
for _, row in j1.iterrows():
    tel = tel_to_str(row.get("tel_agent"))
    if tel and tel not in name_fallback:
        nm = clean_str(row.get("prenom_nom"))
        if nm:
            name_fallback[tel] = nm
for _, row in j2.iterrows():
    tel = tel_to_str(row.get(COL_J2_TEL))
    if tel and tel not in name_fallback:
        nm = clean_str(row.get("Prénom Nom"))
        if nm:
            name_fallback[tel] = nm
for _, row in dev.iterrows():
    tel = tel_to_str(row.get(COL_DEV_TEL))
    if tel and tel not in name_fallback:
        nm = clean_str(row.get("Prénom & Nom"))
        if nm:
            name_fallback[tel] = nm

# Union of all phone numbers from every source
all_tels = set(info_by_tel) | set(notes_j1) | set(notes_j2) | set(notes_dev) | set(scenarios)
print(f"Téléphones uniques dans toutes les sources : {len(all_tels)}")

for tel in sorted(all_tels):
    info_row = info_by_tel.get(tel)

    if info_row is not None:
        prenom = clean_str(info_row[COL_INFO_PRENOM]) or ""
        nom = clean_str(info_row[COL_INFO_NOM]) or ""
        nom_complet = f"{prenom} {nom}".strip().upper()
    else:
        count_no_info += 1
        nm = name_fallback.get(tel, "")
        nom_complet = nm.upper() if nm else f"AGENT {tel}"
        # Try to split last word as nom
        parts = nm.split() if nm else []
        prenom = " ".join(parts[:-1]) if len(parts) > 1 else (parts[0] if parts else "")
        nom = parts[-1] if len(parts) > 1 else ""

    j1_rec = notes_j1.get(tel, {})
    j2_rec = notes_j2.get(tel, {})
    dev_rec = notes_dev.get(tel, {})
    sc = scenarios.get(tel, {})

    mj1 = j1_rec.get("moyenne")
    mj2 = j2_rec.get("moyenne")
    mdev = dev_rec.get("moyenne")
    s1 = sc.get("scenario_1")
    s2 = sc.get("scenario_2")

    if mj1 is not None: count_j1 += 1
    if mj2 is not None: count_j2 += 1
    if mdev is not None: count_dev += 1
    if s1 is not None: count_s1 += 1
    if s2 is not None: count_s2 += 1

    present = [x for x in (mj1, mj2, mdev) if x is not None]
    moyenne_simple = round(sum(present) / len(present), 2) if present else None

    if info_row is not None:
        choix1 = normalize_region(info_row[COL_INFO_CHOIX1]) if COL_INFO_CHOIX1 else None
        choix2 = normalize_region(info_row[COL_INFO_CHOIX2]) if COL_INFO_CHOIX2 else None
        choix3 = normalize_region(info_row[COL_INFO_CHOIX3]) if COL_INFO_CHOIX3 else None
        sexe = clean_str(info_row[COL_INFO_SEXE]) if COL_INFO_SEXE else None
        date_n = date_to_iso(info_row[COL_INFO_DOB]) if COL_INFO_DOB else None
        adresse = clean_str(info_row[COL_INFO_ADR]) if COL_INFO_ADR else None
        photo_kobo = clean_str(info_row[COL_INFO_PHOTO]) if COL_INFO_PHOTO else None
        langues_val = clean_str(info_row[COL_INFO_LANG]) if COL_INFO_LANG else None
    else:
        choix1 = choix2 = choix3 = sexe = date_n = adresse = photo_kobo = langues_val = None

    if choix1:
        choix1_counter[choix1] += 1
    if photo_kobo:
        count_photo += 1
    if langues_val:
        langues_val = re.sub(r"<[^>]+>", "", langues_val).strip()

    agents.append({
        "id": tel,
        "telephone": tel,
        "prenom": prenom or None,
        "nom": nom or None,
        "nom_complet": nom_complet or None,
        "sexe": sexe,
        "date_naissance": date_n,
        "adresse": adresse,
        "photo_kobo_url": photo_kobo,
        "photo_url": photo_by_tel.get(tel),
        "choix1": choix1,
        "choix2": choix2,
        "choix3": choix3,
        "langues": langues_val,
        "notes": {
            "j1": j1_rec or None,
            "j2": j2_rec or None,
            "dev": dev_rec or None,
        },
        "moyennes_categorie": {
            "j1": mj1, "j2": mj2, "dev": mdev,
        },
        "moyenne_globale_simple": moyenne_simple,
        "moyenne_scenario_1": s1,
        "moyenne_scenario_2": s2,
        "moyenne_exam": sc.get("moyenne_exam"),
    })


def sort_key(a):
    return (
        a["choix1"] is None,
        a["choix1"] or "",
        -(a["moyenne_scenario_1"] if a["moyenne_scenario_1"] is not None else -1),
    )

agents.sort(key=sort_key)

# ---------------------------------------------------------------- write

payload = {
    "metadata": {
        "date_export": pd.Timestamp.today().date().isoformat(),
        "source": "note_final_v2_ehcvm3.xlsx",
        "total_agents": len(agents),
        "regions_choix": sorted({a["choix1"] for a in agents if a["choix1"]}),
        "scenarios": ["scenario_1", "scenario_2"],
    },
    "agents": agents,
}

OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

print("\n====== RÉSUMÉ ======")
print(f"Total agents:           {len(agents)}")
print(f"Avec moyenne j1:        {count_j1}")
print(f"Avec moyenne j2:        {count_j2}")
print(f"Avec moyenne dev:       {count_dev}")
print(f"Avec scénario 1:        {count_s1}")
print(f"Avec scénario 2:        {count_s2}")
print(f"Avec photo Supabase:    {sum(1 for a in agents if a['photo_url'])}")
print(f"Avec photo Kobo URL:    {count_photo}")
print(f"Doublons info ignorés:  {count_dup}")
print(f"Sans fiche info_agent:  {count_no_info}  (identité minimale: nom depuis exam/classement)")
print(f"\nRépartition choix1:")
for reg, n in choix1_counter.most_common():
    print(f"  {reg:<14} {n}")
print(f"\n✓ Écrit: {OUT}")
