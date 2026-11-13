"""
Multi-source image fetcher: Pexels, Unsplash, Wikimedia Commons, DuckDuckGo fallback.
Usage:
  from core.assets.fetch_images import ImageFetcher
  fetcher = ImageFetcher(out_dir="films/my-film/assets/images")
  paths = fetcher.fetch(["spotify app", "music headphones", "sound wave"], count=3)
"""
import os, sys, json, time, hashlib, requests, urllib.parse
from pathlib import Path
from typing import Optional


PEXELS_KEY    = os.environ.get("PEXELS_API_KEY", "")
UNSPLASH_KEY  = os.environ.get("UNSPLASH_ACCESS_KEY", "")
UA            = "OpusFlow/1.0 (github.com/opusflow)"
TIMEOUT       = 15


def _slug(s): return hashlib.md5(s.encode()).hexdigest()[:10]


class ImageFetcher:
    def __init__(self, out_dir: str, verbose: bool = True):
        self.out_dir = Path(out_dir)
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.verbose = verbose
        self._session = requests.Session()
        self._session.headers["User-Agent"] = UA

    def _log(self, msg):
        if self.verbose:
            print(f"  [fetch] {msg}", file=sys.stderr)

    # ── Pexels ──────────────────────────────────────────────────────────────
    def _pexels(self, query: str, count: int = 5) -> list[dict]:
        if not PEXELS_KEY:
            return []
        url = "https://api.pexels.com/v1/search"
        headers = {"Authorization": PEXELS_KEY}
        params  = {"query": query, "per_page": min(count, 15), "orientation": "landscape"}
        try:
            r = self._session.get(url, headers=headers, params=params, timeout=TIMEOUT)
            r.raise_for_status()
            photos = r.json().get("photos", [])
            return [{"url": p["src"]["large"], "credit": p["photographer"],
                     "source": "pexels", "id": str(p["id"])} for p in photos]
        except Exception as e:
            self._log(f"Pexels error: {e}")
            return []

    # ── Unsplash ─────────────────────────────────────────────────────────────
    def _unsplash(self, query: str, count: int = 5) -> list[dict]:
        if not UNSPLASH_KEY:
            return []
        url = "https://api.unsplash.com/search/photos"
        params = {"query": query, "per_page": min(count, 10),
                  "client_id": UNSPLASH_KEY, "orientation": "landscape"}
        try:
            r = self._session.get(url, params=params, timeout=TIMEOUT)
            r.raise_for_status()
            results = r.json().get("results", [])
            return [{"url": p["urls"]["regular"], "credit": p["user"]["name"],
                     "source": "unsplash", "id": p["id"]} for p in results]
        except Exception as e:
            self._log(f"Unsplash error: {e}")
            return []

    # ── Wikimedia Commons ─────────────────────────────────────────────────────
    def _wikimedia(self, query: str, count: int = 5) -> list[dict]:
        url = "https://commons.wikimedia.org/w/api.php"
        params = {
            "action": "query", "generator": "search",
            "gsrsearch": f"{query} filetype:bitmap",
            "gsrnamespace": 6, "gsrlimit": min(count * 3, 20),
            "prop": "imageinfo", "iiprop": "url|extmetadata",
            "iiurlwidth": 1200, "format": "json"
        }
        try:
            r = self._session.get(url, params=params, timeout=TIMEOUT)
            r.raise_for_status()
            pages = r.json().get("query", {}).get("pages", {})
            out = []
            for page in pages.values():
                info = page.get("imageinfo", [{}])[0]
                img_url = info.get("thumburl") or info.get("url", "")
                if not img_url or not any(img_url.lower().endswith(ext)
                                          for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                    continue
                meta = info.get("extmetadata", {})
                credit = meta.get("Artist", {}).get("value", "Wikimedia Commons")
                # strip HTML from credit
                credit = credit.replace("<span>", "").replace("</span>", "").replace("<a href", "").split(">")[-1]
                out.append({"url": img_url, "credit": credit, "source": "wikimedia",
                            "id": str(page.get("pageid", ""))})
                if len(out) >= count:
                    break
            return out
        except Exception as e:
            self._log(f"Wikimedia error: {e}")
            return []

    # ── DuckDuckGo Images fallback (no key needed) ────────────────────────────
    def _duckduckgo(self, query: str, count: int = 5) -> list[dict]:
        try:
            token_r = self._session.get(
                f"https://duckduckgo.com/?q={urllib.parse.quote(query)}&iax=images&ia=images",
                timeout=TIMEOUT)
            import re
            token_match = re.search(r'vqd=([0-9-]+)', token_r.text)
            if not token_match:
                return []
            vqd = token_match.group(1)
            r = self._session.get(
                "https://duckduckgo.com/i.js",
                params={"l": "us-en", "o": "json", "q": query, "vqd": vqd,
                        "f": ",,,,,", "p": "1"},
                headers={"Referer": "https://duckduckgo.com/"},
                timeout=TIMEOUT)
            results = r.json().get("results", [])
            out = []
            for res in results[:count * 2]:
                url = res.get("image", "")
                if any(url.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png"]):
                    out.append({"url": url, "credit": res.get("source", "web"),
                                "source": "duckduckgo", "id": _slug(url)})
                if len(out) >= count:
                    break
            return out
        except Exception as e:
            self._log(f"DuckDuckGo error: {e}")
            return []

    # ── Download ──────────────────────────────────────────────────────────────
    def _download(self, item: dict, name: str) -> Optional[Path]:
        url   = item["url"]
        ext   = Path(urllib.parse.urlparse(url).path).suffix or ".jpg"
        fname = f"{name}{ext}"
        dest  = self.out_dir / fname
        if dest.exists():
            return dest
        try:
            r = self._session.get(url, timeout=TIMEOUT, stream=True)
            r.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in r.iter_content(8192):
                    f.write(chunk)
            return dest
        except Exception as e:
            self._log(f"download failed {url}: {e}")
            return None

    # ── Public API ────────────────────────────────────────────────────────────
    def fetch(self, queries: list[str], count_per_query: int = 3,
              prefer: str = "pexels") -> list[dict]:
        """
        Fetch images for a list of queries. Returns list of dicts:
          {"path": "/abs/path/to/img.jpg", "credit": "...", "source": "...", "query": "..."}
        """
        manifest = []
        seen_ids = set()

        for query in queries:
            self._log(f"searching: {query!r}")
            candidates = []

            if prefer == "pexels":
                candidates = (self._pexels(query, count_per_query * 2) or
                              self._unsplash(query, count_per_query * 2) or
                              self._wikimedia(query, count_per_query * 2) or
                              self._duckduckgo(query, count_per_query * 2))
            elif prefer == "unsplash":
                candidates = (self._unsplash(query, count_per_query * 2) or
                              self._pexels(query, count_per_query * 2) or
                              self._wikimedia(query, count_per_query * 2))
            elif prefer == "wikimedia":
                candidates = (self._wikimedia(query, count_per_query * 2) or
                              self._pexels(query, count_per_query * 2))

            fetched = 0
            for item in candidates:
                if fetched >= count_per_query:
                    break
                uid = f"{item['source']}_{item['id']}"
                if uid in seen_ids:
                    continue
                seen_ids.add(uid)
                slug = f"{_slug(query)}_{fetched:02d}"
                path = self._download(item, slug)
                if path:
                    manifest.append({
                        "path": str(path),
                        "rel":  str(path.relative_to(self.out_dir.parent.parent)),
                        "credit": item["credit"],
                        "source": item["source"],
                        "query": query,
                    })
                    fetched += 1
                    self._log(f"  ✓ {path.name} ({item['source']})")
                time.sleep(0.1)

        # Save manifest
        manifest_path = self.out_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)
        self._log(f"manifest → {manifest_path}")
        return manifest


def build_credits(manifest: list[dict]) -> str:
    lines = ["## Images\n"]
    for m in manifest:
        lines.append(f"- [{m['query']}]({m.get('url', '')}) · {m['credit']} · {m['source']}")
    return "\n".join(lines)
