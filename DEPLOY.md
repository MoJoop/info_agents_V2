# Déploiement — EHCVM3 Composition d'équipes

## 0. Test local (sans Supabase, mode "brouillon")

```bash
cd web
npm run dev
# ouvrir http://localhost:5173
```

Les affectations sont sauvegardées dans `localStorage` (pas partagées). Le drag-and-drop, le tri, la pondération et l'export Excel fonctionnent déjà.

## 1. Créer le projet Supabase

1. Aller sur https://supabase.com → **New Project** (plan free).
2. Noter :
   - `Project URL` (ex: `https://xxxxxxxx.supabase.co`)
   - `anon` key (public, safe pour le front)
   - `service_role` key (secret, pour seed uniquement)
3. Ouvrir **SQL Editor** → coller le contenu de `supabase_schema.sql` → **Run**.
4. Ouvrir **Storage** → **New bucket** → nom `agent-photos` → cocher **Public bucket** → créer.

## 2. Télécharger les photos Kobo → Supabase Storage

```bash
export SUPABASE_URL="https://xxxxxxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
export KOBO_USER="mama_diop"
export KOBO_PASSWORD="ryoikitenkai"
env/Scripts/python.exe download_photos.py
```

Le script :
- télécharge chaque photo via Basic Auth Kobo,
- les uploade dans le bucket `agent-photos`,
- enregistre l'URL publique dans `web/public/agents.json` (champ `photo_url`).

Reprise automatique : relancer le script ignore les photos déjà uploadées.

## 3. Seed des tables Supabase

```bash
env/Scripts/python.exe seed_supabase.py
```

Crée/met à jour les lignes dans `agents` et `equipes`.

## 4. Configurer le front

Dans `web/`, créer un `.env.local` :

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   # anon key, PAS service_role
```

## 5. Déployer sur Vercel

1. Pousser le repo sur GitHub (ou GitLab/Bitbucket).
2. Sur https://vercel.com → **Add New Project** → importer le repo.
3. **Root Directory** : `web`
4. **Framework preset** : Vite (auto-détecté)
5. **Environment Variables** : ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
6. Deploy.
7. Lien public généré : `https://<nom>.vercel.app` → partageable aux superviseurs.

## 6. (Optionnel) Auth superviseurs

Par défaut, les policies RLS permettent l'écriture aux utilisateurs authentifiés. Deux options :

- **Simple** : Supabase UI → Authentication → Providers → activer **Email** (magic link). Créer les comptes superviseurs en avance. Ajouter un mini formulaire login dans le front.
- **Partagé** : laisser les policies ouvertes en lecture/écriture publique (suffisant si le lien n'est diffusé qu'aux superviseurs). Pour cela, remplacer la policy `write assignments authed` par :
  ```sql
  create policy "write assignments public" on public.assignments
    for all using (true) with check (true);
  ```

## 7. Régénérer les données si les Excel changent

```bash
env/Scripts/python.exe consolidate.py   # régénère agents.json / equipes.json
env/Scripts/python.exe seed_supabase.py  # re-upsert dans Supabase
```

Le front se met à jour au prochain déploiement Vercel (rebuild auto sur push Git).
