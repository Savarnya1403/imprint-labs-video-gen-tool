"""
OpusFlow Researcher — credible, primary-source intelligence.

Source priority (highest to lowest credibility):
  1. Government reports: FRED, World Bank, IMF, BLS, RBI, MOSPI
  2. Strategy consulting: McKinsey, BCG, Bain, Deloitte, PwC, Oliver Wyman
  3. VC/investment research: a16z, Sequoia, Bessemer, Accel, Lux
  4. Trusted Substack writers: Stratechery, Not Boring, The Diff, Money Stuff, Lenny's, etc.
  5. Tier-1 financial journalism: FT, Bloomberg, Economist, Reuters, WSJ
  6. YouTube transcripts: CNBC, Bloomberg, WSJ, Wendover, YC
  7. Wikipedia as LAST RESORT fallback only

Usage:
  from pipeline.researcher import research
  data = research("Why India's EV market is stalling", depth="deep")
"""

import os, sys, json, re, time, xml.etree.ElementTree as ET
import urllib.parse, urllib.request
from pathlib import Path
import requests
from bs4 import BeautifulSoup

UA      = "OpusFlow/1.0 (research@opusflow.ai; responsible bot)"
TIMEOUT = 20
FRED_KEY = os.environ.get("FRED_API_KEY", "")       # free: fred.stlouisfed.org/docs/api
WORLD_BANK_BASE = "https://api.worldbank.org/v2"
BLS_KEY = os.environ.get("BLS_API_KEY", "")

sess = requests.Session()
sess.headers["User-Agent"] = UA


def _get(url, params=None, headers=None, timeout=TIMEOUT):
    try:
        r = sess.get(url, params=params,
                     headers={**(headers or {})},
                     timeout=timeout)
        r.raise_for_status()
        return r
    except Exception as e:
        print(f"  [research] fetch error {url}: {e}", file=sys.stderr)
        return None


# ══════════════════════════════════════════════════════════════════════════════
# GOVERNMENT & ECONOMIC DATA
# ══════════════════════════════════════════════════════════════════════════════

def fred_data(series_ids: list[str], n=5) -> list[dict]:
    """St. Louis Fed FRED — economic time-series data."""
    if not FRED_KEY:
        return []
    out = []
    for sid in series_ids[:3]:
        r = _get(f"https://api.stlouisfed.org/fred/series/observations",
                 params={"series_id": sid, "api_key": FRED_KEY,
                         "file_type": "json", "sort_order": "desc", "limit": n})
        if not r:
            continue
        try:
            obs = r.json().get("observations", [])
            if obs:
                latest = next((o for o in obs if o["value"] != "."), None)
                if latest:
                    out.append({
                        "series": sid, "value": latest["value"],
                        "date": latest["date"], "source": "FRED"
                    })
        except Exception:
            pass
    return out


def world_bank_data(indicator: str, country="WLD", n=5) -> list[dict]:
    """World Bank open data API."""
    r = _get(f"{WORLD_BANK_BASE}/country/{country}/indicator/{indicator}",
             params={"format": "json", "mrv": n, "per_page": n})
    if not r:
        return []
    try:
        data = r.json()
        if isinstance(data, list) and len(data) > 1:
            return [
                {"year": d["date"], "value": d["value"],
                 "indicator": d["indicator"]["value"], "source": "World Bank"}
                for d in data[1] if d.get("value") is not None
            ][:n]
    except Exception:
        pass
    return []


def rbi_press_releases(query: str) -> list[str]:
    """RBI (Reserve Bank of India) press releases RSS."""
    r = _get("https://www.rbi.org.in/Scripts/RSS.aspx?Id=201")
    if not r:
        return []
    return _parse_rss_text(r.text, query, max_items=4)


# ══════════════════════════════════════════════════════════════════════════════
# STRATEGY CONSULTING RSS FEEDS
# ══════════════════════════════════════════════════════════════════════════════

CONSULTING_FEEDS = {
    "McKinsey": "https://www.mckinsey.com/insights/rss",
    "BCG":      "https://www.bcg.com/rss/publication-rss.ashx",
    "Bain":     "https://www.bain.com/insights/rss/",
    "Deloitte": "https://www2.deloitte.com/us/en/insights.atom",
    "PwC":      "https://www.pwc.com/gx/en/news-room/press-releases/rss-feeds/pwc-global-rss-feed.xml",
}

VC_FEEDS = {
    "a16z":        "https://a16z.com/feed/",
    "Sequoia":     "https://www.sequoiacap.com/feed/",
    "Bessemer":    "https://www.bvp.com/atlas/feed.rss",
    "NFX":         "https://www.nfx.com/post/feed.xml",
    "FirstMark":   "https://firstmark.com/feed/",
    "YCombinator": "https://news.ycombinator.com/rss",
}

TRUSTED_SUBSTACK = {
    "Stratechery (Ben Thompson)":   "https://stratechery.com/feed/",
    "Not Boring (Packy McCormick)": "https://www.notboring.co/feed",
    "The Diff (Byrne Hobart)":      "https://thediff.co/feed",
    "Money Stuff (Matt Levine)":    "https://feeds.bloomberg.com/money-stuff/news.rss",
    "Lenny's Newsletter":           "https://www.lennysnewsletter.com/feed",
    "The Generalist":               "https://www.thegeneralist.io/feed",
    "Tanay Jaipuria":               "https://tanay.substack.com/feed",
    "Sajith Pai (Blume)":           "https://sajithpai.substack.com/feed",
    "Nikhil Kamath":                "https://nikhilkamath.substack.com/feed",
    "Works in Progress":            "https://worksinprogress.co/feed.rss",
    "Noahpinion":                   "https://noahpinion.substack.com/feed",
    "Dror Poleg":                   "https://www.drorpoleg.com/feed/",
    "Napkin Math":                  "https://www.napkinmath.com/feed/",
}

TIER1_NEWS_FEEDS = {
    "Reuters":      "https://feeds.reuters.com/reuters/businessNews",
    "FT":           "https://www.ft.com/?format=rss",
    "Economist":    "https://www.economist.com/finance-and-economics/rss.xml",
    "AP Business":  "https://feeds.apnews.com/rss/APf1f0e7e1f7a14ae5bc10843dd5e9ea5b",
    "Bloomberg":    "https://feeds.bloomberg.com/technology/news.rss",
}


def _parse_rss_text(xml_text: str, query: str, max_items=6) -> list[str]:
    """Parse RSS XML and return relevant item descriptions/summaries."""
    keywords = set(re.findall(r'\b\w{4,}\b', query.lower()))
    items    = []
    try:
        root = ET.fromstring(xml_text)
        ns   = {"atom": "http://www.w3.org/2005/Atom"}
        # RSS 2.0
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            desc  = (item.findtext("description") or "").strip()
            # Atom
            if not desc:
                desc = (item.findtext("atom:summary", namespaces=ns) or "").strip()
            # Strip HTML
            desc = BeautifulSoup(desc, "lxml").get_text(separator=" ") if desc else ""
            combined = f"{title}. {desc}"
            # Relevance score
            words = set(re.findall(r'\b\w{4,}\b', combined.lower()))
            score = len(keywords & words)
            if score > 0 or len(items) < 2:
                items.append((score, combined[:600]))
        # Atom feeds
        for entry in root.findall(".//atom:entry", ns):
            title = (entry.findtext("atom:title", namespaces=ns) or "").strip()
            desc  = (entry.findtext("atom:summary", namespaces=ns) or
                     entry.findtext("atom:content", namespaces=ns) or "").strip()
            desc  = BeautifulSoup(desc, "lxml").get_text(separator=" ") if desc else ""
            combined = f"{title}. {desc}"
            words = set(re.findall(r'\b\w{4,}\b', combined.lower()))
            score = len(keywords & words)
            if score > 0 or len(items) < 2:
                items.append((score, combined[:600]))
    except Exception as e:
        print(f"  [research] RSS parse error: {e}", file=sys.stderr)

    items.sort(key=lambda x: -x[0])
    return [text for _, text in items[:max_items]]


def _fetch_feed(name: str, url: str, query: str, max_items=4) -> list[dict]:
    r = _get(url)
    if not r:
        return []
    texts = _parse_rss_text(r.text, query, max_items)
    return [{"source": name, "text": t, "type": "feed"} for t in texts]


def consulting_insights(query: str, max_per_source=2) -> list[dict]:
    """Pull relevant excerpts from consulting firm RSS feeds."""
    results = []
    # Try 3 sources, stop if we have enough
    for name, url in list(CONSULTING_FEEDS.items())[:4]:
        hits = _fetch_feed(name, url, query, max_per_source)
        results.extend(hits)
        if len(results) >= 6:
            break
        time.sleep(0.3)
    return results


def vc_insights(query: str, max_per_source=2) -> list[dict]:
    """Pull relevant excerpts from VC firm feeds."""
    results = []
    for name, url in list(VC_FEEDS.items())[:4]:
        hits = _fetch_feed(name, url, query, max_per_source)
        results.extend(hits)
        if len(results) >= 6:
            break
        time.sleep(0.3)
    return results


def substack_insights(query: str, max_per_source=2) -> list[dict]:
    """Pull relevant excerpts from trusted Substack writers."""
    results = []
    for name, url in list(TRUSTED_SUBSTACK.items())[:6]:
        hits = _fetch_feed(name, url, query, max_per_source)
        results.extend(hits)
        if len(results) >= 8:
            break
        time.sleep(0.2)
    return results


def news_insights(query: str, max_per_source=2) -> list[dict]:
    """Pull from Tier-1 news feeds."""
    results = []
    for name, url in list(TIER1_NEWS_FEEDS.items())[:3]:
        hits = _fetch_feed(name, url, query, max_per_source)
        results.extend(hits)
        if len(results) >= 6:
            break
        time.sleep(0.3)
    return results


# ══════════════════════════════════════════════════════════════════════════════
# YOUTUBE TRANSCRIPT
# ══════════════════════════════════════════════════════════════════════════════

TRUSTED_YT_CHANNELS = {
    # Format: search query suffix → channel name
    "site:youtube.com CNBC":           "CNBC",
    "site:youtube.com Bloomberg":      "Bloomberg",
    "site:youtube.com WSJ":            "WSJ",
    "site:youtube.com Wendover":       "Wendover Productions",
    "site:youtube.com YCombinator":    "Y Combinator",
    "site:youtube.com FT":             "Financial Times",
}


def youtube_transcript(video_id: str) -> str:
    """Fetch YouTube auto-captions via timedtext API (no auth required for public videos)."""
    try:
        # First get available tracks
        r = _get(f"https://www.youtube.com/watch", params={"v": video_id})
        if not r:
            return ""
        # Find timedtext base URL
        m = re.search(r'"captionTracks":\[(.*?)\]', r.text)
        if not m:
            return ""
        tracks_json = "[" + m.group(1) + "]"
        tracks = json.loads(tracks_json)
        en_track = next((t for t in tracks if t.get("languageCode", "").startswith("en")), None)
        if not en_track:
            return ""
        cap_url = en_track.get("baseUrl", "")
        if not cap_url:
            return ""
        cr = _get(cap_url + "&fmt=json3")
        if not cr:
            return ""
        events = cr.json().get("events", [])
        words  = []
        for ev in events:
            for seg in ev.get("segs", []):
                words.append(seg.get("utf8", ""))
        return " ".join(words).replace("\n", " ").strip()[:2000]
    except Exception:
        return ""


def search_youtube_transcripts(topic: str, max_videos=2) -> list[dict]:
    """Search DuckDuckGo for YouTube videos on topic, fetch transcripts."""
    results = []
    try:
        query = f"{topic} explained youtube"
        r = _get("https://api.duckduckgo.com/", params={
            "q": query, "format": "json", "no_html": 1
        })
        if not r:
            return []
        d = r.json()
        for rel in d.get("RelatedTopics", [])[:5]:
            if isinstance(rel, dict):
                url = rel.get("FirstURL", "")
                m   = re.search(r'v=([A-Za-z0-9_-]{11})', url)
                if m:
                    vid_id = m.group(1)
                    transcript = youtube_transcript(vid_id)
                    if len(transcript) > 100:
                        results.append({
                            "source": "YouTube",
                            "text":   transcript[:800],
                            "type":   "transcript"
                        })
                    if len(results) >= max_videos:
                        break
    except Exception:
        pass
    return results


# ══════════════════════════════════════════════════════════════════════════════
# WIKIPEDIA (FALLBACK ONLY)
# ══════════════════════════════════════════════════════════════════════════════

def _wiki_fallback(topic: str) -> dict:
    """Wikipedia as last resort — returns plain-text summary only."""
    try:
        r = _get("https://en.wikipedia.org/api/rest_v1/page/summary/" +
                 urllib.parse.quote(topic.replace(" ", "_")))
        if not r:
            return {}
        d = r.json()
        return {
            "source": "Wikipedia (fallback)",
            "title":  d.get("title", topic),
            "text":   d.get("extract", "")[:600],
            "type":   "wiki",
        }
    except Exception:
        return {}


# ══════════════════════════════════════════════════════════════════════════════
# NUMBER EXTRACTION
# ══════════════════════════════════════════════════════════════════════════════

NUMBER_RE = re.compile(
    r'(\$?\d[\d,\.]*\s*(?:trillion|billion|million|thousand|bn|mn|tn|k)?'
    r')\s*(revenue|ARR|GMV|valuation|users|monthly|daily|annually|'
    r'percent|%|growth|CAGR|margin|TAM|SAM|SOM|employees|stores|countries'
    r'|downloads|installs|streams|views|impressions|MoM|YoY|QoQ|basis points|bps)',
    re.I
)


def extract_numbers(texts: list[str]) -> list[dict]:
    """Extract business-grade statistics from text corpus."""
    seen   = set()
    output = []
    for text in texts:
        for m in NUMBER_RE.finditer(text):
            val = m.group(1).strip().replace(",", "")
            unit = m.group(2).strip()
            context = text[max(0, m.start()-60):m.end()+80].strip()
            context = re.sub(r'\s+', ' ', context)
            key = f"{val}_{unit}".lower()
            if key not in seen:
                seen.add(key)
                output.append({"value": val, "unit": unit,
                                "context": context[:200]})
    return output[:12]


# ══════════════════════════════════════════════════════════════════════════════
# IMAGE QUERY GENERATION
# ══════════════════════════════════════════════════════════════════════════════

def generate_image_queries(topic: str, sources: list[dict]) -> list[str]:
    """Generate specific, visually rich image search queries."""
    base   = topic.lower().split(":")[-1].strip()
    words  = re.findall(r'\b[A-Z][a-z]+\b', topic)
    brand  = words[0] if words else base.split()[0]
    queries = [
        base,
        f"{base} editorial photography",
        f"{brand} office headquarters aerial",
        f"{base} data chart infographic",
        f"{base} market consumer product",
    ]
    # Extract proper nouns from sources for more precise queries
    for src in sources[:4]:
        text = src.get("text", "")
        nouns = re.findall(r'\b[A-Z][A-Za-z]{3,}\b', text)[:3]
        for noun in nouns:
            if noun not in queries:
                queries.append(noun.lower() + " photography")
    return list(dict.fromkeys(queries))[:8]


# ══════════════════════════════════════════════════════════════════════════════
# MAIN RESEARCH ORCHESTRATOR
# ══════════════════════════════════════════════════════════════════════════════

def research(topic: str, depth: str = "standard") -> dict:
    """
    Full research pipeline. Returns structured dict for the scripter.

    depth:
      "quick"    → news + substack only  (~5s)
      "standard" → all feeds + number extraction  (~15s)
      "deep"     → all feeds + economic data + YT transcripts  (~30s)
    """
    print(f"\n  [research] ▶ {topic!r}  (depth={depth})", file=sys.stderr)
    t0 = time.time()

    all_sources = []
    summary_text = ""

    # ── 1. Consulting reports (highest credibility) ──────────────────────────
    if depth in ("standard", "deep"):
        print("  [research] consulting feeds...", file=sys.stderr)
        consulting = consulting_insights(topic, max_per_source=2)
        all_sources.extend(consulting)
        print(f"    → {len(consulting)} hits", file=sys.stderr)

    # ── 2. VC + startup research ─────────────────────────────────────────────
    if depth in ("standard", "deep"):
        print("  [research] VC/startup feeds...", file=sys.stderr)
        vc = vc_insights(topic, max_per_source=2)
        all_sources.extend(vc)
        print(f"    → {len(vc)} hits", file=sys.stderr)

    # ── 3. Trusted Substack writers ──────────────────────────────────────────
    print("  [research] Substack feeds...", file=sys.stderr)
    substacks = substack_insights(topic, max_per_source=2)
    all_sources.extend(substacks)
    print(f"    → {len(substacks)} hits", file=sys.stderr)

    # ── 4. Tier-1 news ───────────────────────────────────────────────────────
    print("  [research] news feeds...", file=sys.stderr)
    news = news_insights(topic, max_per_source=2)
    all_sources.extend(news)
    print(f"    → {len(news)} hits", file=sys.stderr)

    # ── 5. Economic data APIs ────────────────────────────────────────────────
    econ_data = []
    if depth == "deep" and FRED_KEY:
        # Map common topic keywords to FRED series
        FRED_SERIES_MAP = {
            "inflation": ["CPIAUCSL", "CPILFESL"],
            "gdp":       ["GDP", "A191RL1Q225SBEA"],
            "employment": ["UNRATE", "PAYEMS"],
            "india":     ["INDIRSA01GPCA"],
            "interest rate": ["FEDFUNDS", "DGS10"],
            "consumer spending": ["PCE", "DPCERO1Q156SBEA"],
        }
        for kw, series in FRED_SERIES_MAP.items():
            if kw in topic.lower():
                econ = fred_data(series[:2], n=4)
                econ_data.extend(econ)

    if depth == "deep":
        # World Bank for major indicators
        WB_INDICATOR_MAP = {
            "gdp":        "NY.GDP.MKTP.CD",
            "population": "SP.POP.TOTL",
            "poverty":    "SI.POV.DDAY",
            "education":  "SE.ADT.LITR.ZS",
            "trade":      "NE.TRD.GNFS.ZS",
        }
        for kw, ind in WB_INDICATOR_MAP.items():
            if kw in topic.lower():
                wb = world_bank_data(ind, country="WLD", n=5)
                econ_data.extend(wb)

    # ── 6. YouTube transcripts (deep only) ───────────────────────────────────
    yt_sources = []
    if depth == "deep":
        print("  [research] YouTube transcripts...", file=sys.stderr)
        yt_sources = search_youtube_transcripts(topic, max_videos=2)
        all_sources.extend(yt_sources)
        print(f"    → {len(yt_sources)} transcripts", file=sys.stderr)

    # ── 7. Wikipedia as absolute fallback ────────────────────────────────────
    if len(all_sources) < 3:
        print("  [research] falling back to Wikipedia...", file=sys.stderr)
        wiki = _wiki_fallback(topic)
        if wiki:
            all_sources.append(wiki)
            summary_text = wiki.get("text", "")

    # ── Synthesize ────────────────────────────────────────────────────────────
    all_texts = [s.get("text", "") for s in all_sources if s.get("text")]

    # Build a coherent summary from best sources
    if not summary_text and all_texts:
        # Take the most relevant source (highest keyword overlap)
        summary_text = max(
            all_texts,
            key=lambda t: len(set(re.findall(r'\b\w{4,}\b', t.lower())) &
                               set(re.findall(r'\b\w{4,}\b', topic.lower())))
        )[:600]

    # Extract numbers
    numbers = extract_numbers(all_texts)

    # Build facts list (clean sentences with ≥1 number or proper noun)
    facts = []
    for text in all_texts[:10]:
        for sent in re.split(r'(?<=[.!?])\s+', text):
            sent = sent.strip()
            if 20 < len(sent) < 300:
                has_number = bool(re.search(r'\d', sent))
                has_noun   = bool(re.search(r'\b[A-Z][a-z]+\b', sent))
                if has_number or has_noun:
                    source_label = next(
                        (s.get("source", "") for s in all_sources
                         if sent[:30] in s.get("text", "")), ""
                    )
                    facts.append(f"{sent} [{source_label}]" if source_label else sent)
    facts = list(dict.fromkeys(facts))[:12]

    # Build source attribution list
    sources_used = list({s["source"] for s in all_sources if s.get("source")})

    img_queries = generate_image_queries(topic, all_sources)

    result = {
        "topic":          topic,
        "summary":        summary_text,
        "facts":          facts,
        "numbers":        numbers,
        "sources":        sources_used,
        "econ_data":      econ_data,
        "raw_sources":    all_sources[:20],  # keep for scripter context
        "img_queries":    img_queries,
        "research_depth": depth,
        "research_time":  round(time.time() - t0, 1),
    }

    print(f"  [research] ✓ {len(facts)} facts | {len(numbers)} stats | "
          f"{len(sources_used)} sources | {result['research_time']}s", file=sys.stderr)
    return result


def save_research(data: dict, path: str):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  [research] saved → {path}", file=sys.stderr)


if __name__ == "__main__":
    topic = " ".join(sys.argv[1:]) or "Why India's EV market is stalling"
    depth = "standard"
    if "--deep" in sys.argv:
        depth = "deep"
        topic = topic.replace("--deep", "").strip()
    data = research(topic, depth=depth)
    print(json.dumps(data, indent=2))
