"""Deep analysis: unique agents, region values, phone consistency."""
import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

info = pd.read_excel("notej1_j2.xlsx", sheet_name="info_agents")
j1 = pd.read_excel("notej1_j2.xlsx", sheet_name="notej1_")
j2 = pd.read_excel("notej1_j2.xlsx", sheet_name="notej2__")
dev = pd.read_excel("notej1_j2.xlsx", sheet_name="note1dev")
equipes = pd.read_excel("PROPOSITION_REPARTITION_DR_35_EQUIPES__.xlsx")

print(f"info_agents:  {len(info)} lignes")
print(f"notej1_:      {len(j1)} lignes")
print(f"notej2__:     {len(j2)} lignes")
print(f"note1dev:     {len(dev)} lignes")
print(f"equipes DR:   {len(equipes)} lignes")

# Normalize column names
info.columns = [c.strip() for c in info.columns]
phone_col_info = [c for c in info.columns if 'phone' in c.lower() or 'tel' in c.lower() or 'I.10' in c][0]
print(f"\nPhone col info_agents: {phone_col_info!r}")

phones_info = set(info[phone_col_info].dropna().astype(str))
phones_j1 = set(j1['tel_agent'].dropna().astype(str))
phones_j2_col = [c for c in j2.columns if 'Agent' in c or 'tel' in c.lower()][0]
phones_j2 = set(j2[phones_j2_col].dropna().astype(str))

print(f"\nTel uniques info_agents: {len(phones_info)}")
print(f"Tel uniques notej1_:     {len(phones_j1)}")
print(f"Tel uniques notej2__:    {len(phones_j2)}")
print(f"Dans info ET j1:  {len(phones_info & phones_j1)}")
print(f"Dans info ET j2:  {len(phones_info & phones_j2)}")
print(f"Dans info MAIS pas j1:  {len(phones_info - phones_j1)}")
print(f"Dans j1 MAIS pas info:  {len(phones_j1 - phones_info)}")

# Region choices
region_cols = [c for c in info.columns if 'choix' in c.lower() and 'r' in c.lower()]
print(f"\nColonnes de choix région: {region_cols}")

for c in region_cols:
    vals = info[c].dropna().value_counts()
    print(f"\n--- {c[:50]} ---")
    print(vals.head(20))

# Teams structure
print(f"\n--- Répartition des 35 équipes ---")
eq_col = [c for c in equipes.columns if 'EQ' in c.upper() and 'NUM' in c.upper()][-1]
print(f"Col équipe: {eq_col}")
print(equipes[eq_col].value_counts().sort_index().head(10))
print(f"\nTotal équipes distinctes: {equipes[eq_col].nunique()}")
print(f"Régions dans proposition DR:")
print(equipes['REG'].value_counts())

# Sample agent to verify structure
print(f"\n--- Exemple agent (index 0) ---")
for col in info.columns:
    val = info.iloc[0][col]
    if isinstance(val, str) and len(val) > 60:
        val = val[:60] + "..."
    print(f"  {col[:60]:60s} = {val}")
