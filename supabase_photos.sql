-- EHCVM3 — app bon_photos : table de verdicts photo par agent
-- À exécuter dans Supabase SQL Editor.

create table if not exists public.photo_reviews (
  agent_id    text primary key references public.agents(id) on delete cascade,
  verdict     text check (verdict in ('bon','mauvais')),
  updated_at  timestamptz default now()
);

create index if not exists photo_reviews_verdict_idx on public.photo_reviews(verdict);

-- Trigger updated_at
drop trigger if exists photo_reviews_updated_at on public.photo_reviews;
create trigger photo_reviews_updated_at
  before update on public.photo_reviews
  for each row execute function public.set_updated_at();

-- Realtime
alter publication supabase_realtime add table public.photo_reviews;

-- RLS : lecture + écriture publiques (pas d'auth côté client)
alter table public.photo_reviews enable row level security;

drop policy if exists "read reviews public"  on public.photo_reviews;
drop policy if exists "write reviews public" on public.photo_reviews;

create policy "read reviews public"  on public.photo_reviews for select using (true);
create policy "write reviews public" on public.photo_reviews for all   using (true) with check (true);
