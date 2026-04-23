"""Build geo payload for each team (convex hull, concave hull, area, diameter).

Reads:  PROPOSITION_REPARTITION_DR_35_EQUIPES__.xlsx
Writes: web/public/equipes_geo.json
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

import pandas as pd
from shapely.geometry import MultiPoint, mapping

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent
XLSX = ROOT / "PROPOSITION_REPARTITION_DR_35_EQUIPES__.xlsx"
OUT = ROOT / "web" / "public" / "equipes_geo.json"
OUT.parent.mkdir(parents=True, exist_ok=True)

try:
    from shapely import concave_hull as _concave
    HAS_CONCAVE = True
except Exception:
    HAS_CONCAVE = False
    print("⚠ shapely < 2.0: concave_hull indisponible, fallback convex")


def parse_coord(v):
    if v is None or pd.isna(v):
        return None
    try:
        return float(str(v).strip().replace(",", "."))
    except ValueError:
        return None


def clean_str(v):
    if v is None or pd.isna(v):
        return None
    s = str(v).strip()
    return s if s and s.lower() != "nan" else None


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


def num_of_eq(s):
    m = re.search(r"\d+", str(s))
    return int(m.group()) if m else 999


def haversine_km(lon1, lat1, lon2, lat2):
    R = 6371.0088
    a1, a2 = math.radians(lat1), math.radians(lat2)
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2) ** 2 + math.cos(a1) * math.cos(a2) * math.sin(dLon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def feature(geom, props=None):
    return {"type": "Feature", "geometry": mapping(geom), "properties": props or {}}


# ------------------------------------------------------------ load

xls = pd.ExcelFile(XLSX)
sheet = next(s for s in xls.sheet_names if s.startswith("PROPOSITION_REPARTITION_DR_35"))
df = pd.read_excel(XLSX, sheet_name=sheet)

df["lon"] = df["LONGITUDE"].apply(parse_coord)
df["lat"] = df["LATITUDE"].apply(parse_coord)
df["REG_NORM"] = df["REG"].apply(normalize_region)

all_lons, all_lats = [], []
equipes_out = []

unique_eqs = sorted(df["NumDR_EQ_Prop"].dropna().unique(), key=num_of_eq)

for eq in unique_eqs:
    sub = df[df["NumDR_EQ_Prop"] == eq]
    pts = []
    for _, r in sub.iterrows():
        if r["lon"] is None or r["lat"] is None:
            continue
        pts.append({
            "code": clean_str(r.get("COD_DR_2022")),
            "nom": clean_str(r.get("COMP_DR_2022")),
            "dept": clean_str(r.get("DEPT")),
            "region": normalize_region(r.get("REG")),
            "milieu": clean_str(r.get("MILIEU")),
            "nbre_men": safe_num(r.get("Nbre_Men_RGPH5"), 1),
            "lon": round(r["lon"], 6),
            "lat": round(r["lat"], 6),
        })

    if not pts:
        equipes_out.append({
            "id": str(eq), "region_dominante": None, "nb_dr": 0, "points": [],
            "convex_hull": None, "concave_hull": None, "centroid": None,
            "area_km2": None, "max_diameter_km": None, "bbox": None,
        })
        continue

    coords = [(p["lon"], p["lat"]) for p in pts]
    lons = [p["lon"] for p in pts]
    lats = [p["lat"] for p in pts]
    all_lons.extend(lons)
    all_lats.extend(lats)

    centroid = [round(sum(lons) / len(lons), 6), round(sum(lats) / len(lats), 6)]
    bbox = [min(lons), min(lats), max(lons), max(lats)]

    # regions dominante
    from collections import Counter
    regs = [p["region"] for p in pts if p["region"]]
    region_dom = Counter(regs).most_common(1)[0][0] if regs else None

    convex_gj = concave_gj = None
    area_km2 = None
    mp = MultiPoint(coords)
    unique_coords = {tuple(c) for c in coords}

    if len(unique_coords) >= 3:
        hull = mp.convex_hull
        if hull.geom_type == "Polygon":
            convex_gj = feature(hull)
            # Equirectangular area approximation at centroid latitude
            lat_rad = math.radians(centroid[1])
            area_km2 = round(hull.area * (111.32 ** 2) * math.cos(lat_rad), 2)
        if HAS_CONCAVE:
            try:
                ch = _concave(mp, ratio=0.3)
                if ch.geom_type == "Polygon":
                    concave_gj = feature(ch)
            except Exception:
                concave_gj = convex_gj
        else:
            concave_gj = convex_gj

    # Max pairwise diameter
    max_diam = 0.0
    for i in range(len(coords)):
        for j in range(i + 1, len(coords)):
            d = haversine_km(coords[i][0], coords[i][1], coords[j][0], coords[j][1])
            if d > max_diam:
                max_diam = d
    max_diameter_km = round(max_diam, 2) if len(coords) >= 2 else None

    equipes_out.append({
        "id": str(eq),
        "region_dominante": region_dom,
        "nb_dr": len(pts),
        "points": pts,
        "convex_hull": convex_gj,
        "concave_hull": concave_gj,
        "centroid": centroid,
        "area_km2": area_km2,
        "max_diameter_km": max_diameter_km,
        "bbox": bbox,
    })

global_bbox = [min(all_lons), min(all_lats), max(all_lons), max(all_lats)] if all_lons else None

payload = {
    "metadata": {
        "date_export": pd.Timestamp.today().date().isoformat(),
        "total_equipes": len(equipes_out),
        "total_points": sum(e["nb_dr"] for e in equipes_out),
        "bbox": global_bbox,
    },
    "equipes": equipes_out,
}

OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"✓ Total points:    {payload['metadata']['total_points']}")
print(f"✓ Total équipes:   {payload['metadata']['total_equipes']}")
print(f"✓ BBox:            {global_bbox}")
print(f"✓ Écrit: {OUT}")
print()
print("Aperçu des 3 premières équipes:")
for e in equipes_out[:3]:
    print(f"  {e['id']:5s}  {e['region_dominante']:<12} nb_dr={e['nb_dr']:2d} area={e['area_km2']} km² diam={e['max_diameter_km']} km")
