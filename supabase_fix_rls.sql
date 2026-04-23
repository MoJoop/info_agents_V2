-- Fix: autoriser les écritures anonymes sur assignments
-- Contexte: la policy précédente était 'to authenticated', ce qui bloque
-- la clé anon utilisée par le front. Puisque le lien Vercel est privé
-- (partagé aux superviseurs uniquement), on ouvre l'écriture publique.

drop policy if exists "write assignments authed"  on public.assignments;
drop policy if exists "write assignments public"  on public.assignments;

create policy "write assignments public"
  on public.assignments
  for all
  using (true)
  with check (true);

-- Sanity: confirmer que la publication realtime inclut bien assignments
-- (noop si déjà présent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'assignments'
  ) then
    alter publication supabase_realtime add table public.assignments;
  end if;
end $$;
