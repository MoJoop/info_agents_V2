-- EHCVM3 — Schéma Supabase pour la plateforme de composition d'équipes
-- À exécuter dans Supabase SQL Editor après création du projet.

-- =====================================================================
-- TABLES
-- =====================================================================

-- Référentiel des agents (seed depuis agents.json, read-only pour l'UI)
create table if not exists public.agents (
  id                      text primary key,           -- téléphone
  telephone               text not null,
  prenom                  text,
  nom                     text,
  nom_complet             text,
  sexe                    text,
  date_naissance          date,
  adresse                 text,
  photo_url               text,                       -- URL Supabase Storage
  photo_kobo_url          text,
  choix1                  text,
  choix2                  text,
  choix3                  text,
  langues                 text,
  notes                   jsonb,                      -- {j1:{...}, j2:{...}, dev:{...}}
  moyennes_categorie      jsonb,                      -- {j1:.., j2:.., dev:..}
  moyenne_globale_simple  numeric(5,2)
);

create index if not exists agents_choix1_idx on public.agents(choix1);
create index if not exists agents_moyenne_idx on public.agents(moyenne_globale_simple desc);

-- Référentiel des équipes
create table if not exists public.equipes (
  id                 text primary key,                -- EQ1..EQ35
  ordre              int,                             -- 1..35 pour tri numérique
  nb_dr              int,
  region_dominante   text,
  regions            text[],
  departements       text[],
  dr_list            jsonb
);

create index if not exists equipes_ordre_idx on public.equipes(ordre);

-- Affectations (état partagé et modifié en temps réel)
create table if not exists public.assignments (
  agent_id    text primary key references public.agents(id) on delete cascade,
  equipe_id   text references public.equipes(id) on delete set null,
  role        text check (role in ('CE', 'AGENT')),
  slot        int check (slot between 0 and 3),       -- 0 = CE, 1-3 = agents
  updated_at  timestamptz default now(),
  updated_by  text,
  unique (equipe_id, slot)
);

create index if not exists assignments_equipe_idx on public.assignments(equipe_id);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists assignments_updated_at on public.assignments;
create trigger assignments_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

-- =====================================================================
-- REALTIME
-- =====================================================================
alter publication supabase_realtime add table public.assignments;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.agents      enable row level security;
alter table public.equipes     enable row level security;
alter table public.assignments enable row level security;

-- Lecture publique (dashboard accessible à tous les superviseurs)
create policy "read agents public"       on public.agents      for select using (true);
create policy "read equipes public"      on public.equipes     for select using (true);
create policy "read assignments public"  on public.assignments for select using (true);

-- Écriture sur assignments : authentifiés uniquement
create policy "write assignments authed" on public.assignments
  for all to authenticated using (true) with check (true);

-- =====================================================================
-- STORAGE BUCKET (à créer via UI ou CLI : 'agent-photos', public)
-- =====================================================================
-- Dans Supabase UI : Storage > New bucket > name: 'agent-photos' > Public: yes
