"""Download agent photos from Kobo and upload to Supabase Storage.

Requires env vars:
  KOBO_USER                 (default: mama_diop)
  KOBO_PASSWORD             (default: ryoikitenkai)
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (service role key — gives Storage write access)
  SUPABASE_BUCKET           (default: agent-photos)

Reads:  web/public/agents.json
Writes: web/public/agents.json (updated with photo_url), photos/<tel>.jpg (local cache)
"""
from __future__ import annotations

import base64
import json
import mimetypes
import os
import sys
import time
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent
AGENTS_JSON = ROOT / "web" / "public" / "agents.json"
PHOTO_DIR = ROOT / "photos_cache"
PHOTO_DIR.mkdir(exist_ok=True)

KOBO_USER = os.environ.get("KOBO_USER", "mama_diop")
KOBO_PASSWORD = os.environ.get("KOBO_PASSWORD", "ryoikitenkai")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "agent-photos")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis en variables d'environnement.")
    print("   (Copier l'URL et la 'service_role' key depuis Supabase > Project Settings > API)")
    sys.exit(1)

# ---------------------------------------------------------------- read

payload = json.loads(AGENTS_JSON.read_text(encoding="utf-8"))
agents = payload["agents"]
print(f"Agents à traiter: {len(agents)}")

session = requests.Session()
session.auth = (KOBO_USER, KOBO_PASSWORD)

# ---------------------------------------------------------------- helpers

def kobo_download(url: str) -> tuple[bytes, str] | None:
    """Download a Kobo attachment. Returns (bytes, content_type) or None."""
    try:
        r = session.get(url, timeout=30, allow_redirects=True)
        if r.status_code != 200:
            print(f"  ✗ HTTP {r.status_code} pour {url[:70]}")
            return None
        return r.content, r.headers.get("content-type", "image/jpeg")
    except Exception as e:
        print(f"  ✗ Erreur download: {e}")
        return None


def supabase_upload(key: str, data: bytes, content_type: str) -> str | None:
    """Upload to Supabase Storage (upsert). Returns public URL or None."""
    up_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{key}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    try:
        r = requests.post(up_url, headers=headers, data=data, timeout=30)
        if r.status_code not in (200, 201):
            print(f"  ✗ Upload HTTP {r.status_code}: {r.text[:120]}")
            return None
        return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{key}"
    except Exception as e:
        print(f"  ✗ Erreur upload: {e}")
        return None


# ---------------------------------------------------------------- run

ok = skip = fail = 0
for i, agent in enumerate(agents, 1):
    tel = agent["id"]
    url = agent.get("photo_kobo_url")
    if not url:
        skip += 1
        continue
    if agent.get("photo_url"):
        # Already uploaded
        skip += 1
        continue

    print(f"[{i:3d}/{len(agents)}] {agent['nom_complet']} ({tel})")

    # Download
    result = kobo_download(url)
    if not result:
        fail += 1
        continue
    data, ct = result
    ext = mimetypes.guess_extension(ct.split(";")[0].strip()) or ".jpg"
    local_path = PHOTO_DIR / f"{tel}{ext}"
    local_path.write_bytes(data)

    # Upload to Supabase
    key = f"{tel}{ext}"
    public_url = supabase_upload(key, data, ct)
    if not public_url:
        fail += 1
        continue

    agent["photo_url"] = public_url
    ok += 1
    print(f"  ✓ {public_url}")

    # Save JSON after each successful upload (resumable)
    AGENTS_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    time.sleep(0.2)  # be nice to the API

print(f"\n====== RÉSUMÉ ======")
print(f"  ✓ Uploadées : {ok}")
print(f"  ⊘ Ignorées  : {skip}")
print(f"  ✗ Échecs    : {fail}")
