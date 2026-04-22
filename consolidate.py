"""Consolidate EHCVM3 agent data and team proposal into JSON files.

Inputs:
  - notej1_j2.xlsx (sheets: info_agents, notej1_, notej2__, note1dev)
  - PROPOSITION_REPARTITION_DR_35_EQUIPES__.xlsx

Outputs:
  - web/public/agents.json
  - web/public/equipes.json
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
NOTES_XLSX = ROOT / "notej1_j2.xlsx"
EQUIPES_XLSX = ROOT / "PROPOSITION_REPARTITION_DR_35_EQUIPES__.xlsx"
OUT_DIR = ROOT / "web" / "public"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- helpers

def clean_str(v):
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    s = str(v).strip()
    return s if s and s.lower() != "nan" else None


def tel_to_str(v):
    if v is None or pd.isna(v):
        return None
    try:
        return str(int(float(v)))
    except (TypeError, ValueError):
        s = str(v).strip()
        return s or None


def safe_num(v, ndigits=2):
    if v is None or pd.isna(v):
        return None
    try:
        return round(float(v), ndigits)
    except (TypeError, ValueError):
        return None


def normalize_region(r):
    if r is None:
        return None
    s = str(r).strip().upper()
    if not s or s == "NAN":
        return None
    s = s.replace("SAINT LOUIS", "SAINT-LOUIS")
    return s


def date_to_iso(v):
    if v is None or pd.isna(v):
        return None
    if isinstance(v, pd.Timestamp):
        return v.date().isoformat()
    try:
        return pd.to_datetime(v).date().isoformat()
    except Exception:
        return None


def find_col(df, startswith: str):
    for c in df.columns:
        if c.strip().startswith(startswith):
            return c
    return None


# ---------------------------------------------------------------- load

print("Chargement des feuilles Excel…")
info = pd.read_excel(NOTES_XLSX, sheet_name="info_agents")
j1 = pd.read_excel(NOTES_XLSX, sheet_name="notej1_")
j2 = pd.read_excel(NOTES_XLSX, sheet_name="notej2__")
dev = pd.read_excel(NOTES_XLSX, sheet_name="note1dev")
xls = pd.ExcelFile(EQUIPES_XLSX)
teams_sheet = next(s for s in xls.sheet_names if s.startswith("PROPOSITION_REPARTITION_DR_35"))
teams = pd.read_excel(EQUIPES_XLSX, sheet_name=teams_sheet)

# Strip column whitespace
for df in (info, j1, j2, dev, teams):
    df.columns = [c if isinstance(c, str) else str(c) for c in df.columns]

# ---------------------------------------------------------------- key columns

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

COL_J2_TEL = next(c for c in j2.columns if "Agent" in c and ("Tél" in c or "Tel" in c))
COL_DEV_TEL = next(c for c in dev.columns if c.strip().startswith("Tél"))

# ---------------------------------------------------------------- index notes by tel

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
    j1,
    "tel_agent",
    {"S1": "note_s1", "S2": "note_s2", "S3": "note_s3", "S9": "note_s9", "S11": "note_s11"},
    {"moyenne": "moyenne"},
)

notes_j2 = index_notes(
    j2,
    COL_J2_TEL,
    {"S7": "Note S7", "S10": "Note S10", "S13": "Note S13", "S16": "Note S16", "S17": "Note S17"},
    {"moyenne": "Moyenne", "bonus": "Bonus+ Total", "malus": "Malus"},
)

notes_dev = index_notes(
    dev,
    COL_DEV_TEL,
    {
        "S01": "Note S01",
        "S02": "Note S02",
        "S03": "Note S03",
        "S04": "Note S04",
        "S05_S06": "Note S05-S06",
        "S07": "Note S07",
        "S09": "Note S09",
        "S10": "Note S10",
    },
    {"moyenne": "Moyenne"},
)

# Tel presence diagnostics
info_tels = {tel_to_str(v) for v in info[COL_INFO_TEL] if tel_to_str(v)}
print(f"Tels info_agents: {len(info_tels)}")
print(f"Tels j1 non trouvés dans info: {len(set(notes_j1) - info_tels)}")
print(f"Tels j2 non trouvés dans info: {len(set(notes_j2) - info_tels)}")
print(f"Tels dev non trouvés dans info: {len(set(notes_dev) - info_tels)}")

# ---------------------------------------------------------------- build agents

agents = []
count_j1 = count_j2 = count_dev = count_all3 = count_photo = 0
count_dup = 0
seen_tels = set()
choix1_counter = Counter()

for _, row in info.iterrows():
    tel = tel_to_str(row[COL_INFO_TEL])
    if not tel:
        continue
    if tel in seen_tels:
        count_dup += 1
        continue
    seen_tels.add(tel)
    prenom = clean_str(row[COL_INFO_PRENOM]) or ""
    nom = clean_str(row[COL_INFO_NOM]) or ""
    nom_complet = f"{prenom} {nom}".strip().upper()

    j1_rec = notes_j1.get(tel, {})
    j2_rec = notes_j2.get(tel, {})
    dev_rec = notes_dev.get(tel, {})

    mj1 = j1_rec.get("moyenne")
    mj2 = j2_rec.get("moyenne")
    mdev = dev_rec.get("moyenne")

    if mj1 is not None:
        count_j1 += 1
    if mj2 is not None:
        count_j2 += 1
    if mdev is not None:
        count_dev += 1
    if mj1 is not None and mj2 is not None and mdev is not None:
        count_all3 += 1

    present = [x for x in (mj1, mj2, mdev) if x is not None]
    moyenne_simple = round(sum(present) / len(present), 2) if present else None

    choix1 = normalize_region(row[COL_INFO_CHOIX1]) if COL_INFO_CHOIX1 else None
    choix2 = normalize_region(row[COL_INFO_CHOIX2]) if COL_INFO_CHOIX2 else None
    choix3 = normalize_region(row[COL_INFO_CHOIX3]) if COL_INFO_CHOIX3 else None
    if choix1:
        choix1_counter[choix1] += 1

    photo_kobo = clean_str(row[COL_INFO_PHOTO]) if COL_INFO_PHOTO else None
    if photo_kobo:
        count_photo += 1

    langues_val = clean_str(row[COL_INFO_LANG]) if COL_INFO_LANG else None
    # Strip any HTML tags that may be embedded
    if langues_val:
        langues_val = re.sub(r"<[^>]+>", "", langues_val).strip()

    agents.append({
        "id": tel,
        "telephone": tel,
        "prenom": prenom or None,
        "nom": nom or None,
        "nom_complet": nom_complet or None,
        "sexe": clean_str(row[COL_INFO_SEXE]) if COL_INFO_SEXE else None,
        "date_naissance": date_to_iso(row[COL_INFO_DOB]) if COL_INFO_DOB else None,
        "adresse": clean_str(row[COL_INFO_ADR]) if COL_INFO_ADR else None,
        "photo_kobo_url": photo_kobo,
        "photo_url": None,
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
            "j1": mj1,
            "j2": mj2,
            "dev": mdev,
        },
        "moyenne_globale_simple": moyenne_simple,
    })

# Default sort: choix1 alphabetical (None last), then moyenne_globale_simple desc
def sort_key(a):
    return (
        a["choix1"] is None,
        a["choix1"] or "",
        -(a["moyenne_globale_simple"] if a["moyenne_globale_simple"] is not None else -1),
    )

agents.sort(key=sort_key)

# ---------------------------------------------------------------- build equipes

# Normalize team columns
EQ_COL = "NumDR_EQ_Prop"
teams["REG_NORM"] = teams["REG"].apply(normalize_region)

def num_of_eq(eq):
    m = re.search(r"\d+", str(eq))
    return int(m.group()) if m else 999

unique_eqs = sorted(teams[EQ_COL].dropna().unique(), key=num_of_eq)
equipes_out = []
for eq in unique_eqs:
    sub = teams[teams[EQ_COL] == eq]
    regs = [r for r in sub["REG_NORM"].tolist() if r]
    depts = [d for d in sub["DEPT"].tolist() if isinstance(d, str) and d.strip()]
    region_dom = Counter(regs).most_common(1)[0][0] if regs else None
    dr_list = []
    for _, r in sub.iterrows():
        dr_list.append({
            "code": clean_str(r.get("COD_DR_2022")),
            "nom": clean_str(r.get("COMP_DR_2022")),
            "dept": clean_str(r.get("DEPT")),
            "region": normalize_region(r.get("REG")),
            "milieu": clean_str(r.get("MILIEU")),
            "nbre_men": safe_num(r.get("Nbre_Men_RGPH5"), 1),
            "lon": safe_num(str(r.get("LONGITUDE")).replace(",", ".") if pd.notna(r.get("LONGITUDE")) else None, 6),
            "lat": safe_num(str(r.get("LATITUDE")).replace(",", ".") if pd.notna(r.get("LATITUDE")) else None, 6),
        })
    equipes_out.append({
        "id": str(eq),
        "ordre": num_of_eq(eq),
        "nb_dr": len(sub),
        "region_dominante": region_dom,
        "regions": sorted(set(regs)),
        "departements": sorted(set(depts)),
        "dr_list": dr_list,
    })

# ---------------------------------------------------------------- write JSON

agents_payload = {
    "metadata": {
        "date_export": pd.Timestamp.today().date().isoformat(),
        "total_agents": len(agents),
        "regions_choix": sorted({a["choix1"] for a in agents if a["choix1"]}),
        "regions_equipes": sorted({e["region_dominante"] for e in equipes_out if e["region_dominante"]}),
    },
    "agents": agents,
}

equipes_payload = {
    "metadata": {
        "date_export": pd.Timestamp.today().date().isoformat(),
        "total_equipes": len(equipes_out),
    },
    "equipes": equipes_out,
}

(OUT_DIR / "agents.json").write_text(json.dumps(agents_payload, ensure_ascii=False, indent=2), encoding="utf-8")
(OUT_DIR / "equipes.json").write_text(json.dumps(equipes_payload, ensure_ascii=False, indent=2), encoding="utf-8")

# ---------------------------------------------------------------- summary

print("\n====== RÉSUMÉ ======")
print(f"Total agents:           {len(agents)}")
print(f"Avec moyenne j1:        {count_j1}")
print(f"Avec moyenne j2:        {count_j2}")
print(f"Avec moyenne dev:       {count_dev}")
print(f"Avec les 3 catégories:  {count_all3}")
print(f"Avec photo Kobo URL:    {count_photo}")
print(f"Doublons ignorés:       {count_dup}")
print(f"\nRépartition choix1:")
for reg, n in choix1_counter.most_common():
    print(f"  {reg:<14} {n}")
print(f"\nTotal équipes:          {len(equipes_out)}")
print(f"\n✓ Écrit: {OUT_DIR / 'agents.json'}")
print(f"✓ Écrit: {OUT_DIR / 'equipes.json'}")
