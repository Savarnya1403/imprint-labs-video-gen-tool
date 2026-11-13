"""
Script Upgrader — takes any raw topic/script and upgrades to Vox creator level.

Principles (from studying best Vox/Johnny Harris/TLDR news videos):
  1. HOOK: Counter-intuitive fact or question in first 3 seconds
  2. TENSION: Establish what's broken/surprising/misunderstood
  3. EVIDENCE: 2-3 data beats — real numbers, specific sourced stats
  4. PIVOT: The twist — what's actually happening beneath the surface
  5. PAYOFF: Reframe the opening hook with the new understanding
  6. PUNCH: Short. Declarative. Max 10 words per sentence.
  7. SHOW DON'T TELL: Every claim becomes a visual moment, not just narration

Script quality checkers:
  - Reject: vague openers ("Today we're going to talk about...")
  - Reject: data-free scenes (no numbers or specific claims)
  - Reject: sentences > 20 words
  - Reject: passive voice in hooks
  - Require: at least 1 number per 3 scenes
"""
import os, json, re
import anthropic

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")

UPGRADE_SYSTEM = """You are the script writer for a top-tier Vox-style video channel. You make short-form case study explainers that go viral because they're BRUTALLY honest, data-backed, and visually dramatic.

Your scripts must follow these IRON RULES:

STRUCTURE — always use this exact arc:
1. HOOK (3-5 seconds): One surprising fact, counter-intuitive stat, or provocative question. Starts mid-action — no "today we're looking at".
2. TENSION (5-8 seconds): Why this matters. What's broken, misunderstood, or hidden.
3. DATA BEAT 1: Specific number. Source it. Make it visual (say what appears on screen).
4. PIVOT: The surprising mechanism / root cause most people don't know.
5. DATA BEAT 2: Another specific number that proves the pivot.
6. PAYOFF (3-5 seconds): One sentence that reframes the entire hook with new understanding.

WRITING RULES:
- Max 10 words per sentence. Break longer thoughts into two sentences.
- No passive voice in the first 15 words.
- Every scene description tells the camera EXACTLY what appears visually.
- Use present tense throughout.
- Never use: "basically", "essentially", "kind of", "sort of", "actually", "literally", "you know"
- Replace generic adjectives with specific numbers: not "huge" → "₹2.3 lakh crore"
- End on something the viewer can DO or THINK about differently.

OUTPUT FORMAT — return valid JSON only:
{
  "logline": "one sentence: what this video argues",
  "hook_sentence": "the first sentence spoken — 8 words max, shocking",
  "scenes": [
    {
      "id": "S1",
      "vo": "exact spoken text",
      "visual": "exact description: what the viewer sees — specific colors, layout, motion",
      "data": {"label": "...", "value": "...", "unit": "...", "source": "..."} | null,
      "scene_type": "text-slam|stat-reveal|consulting-brief|kinetic-type|newspaper|polaroid-stack|before-after|percentage-fill|chart-annotated|word-burst|ticker-reveal|sticky-board|timeline|pull-quote",
      "duration_hint": 5.5,
      "mood": "hook|tension|evidence|pivot|payoff"
    }
  ],
  "total_duration": 45,
  "cta": "one sentence call to action or thought to leave the viewer with"
}"""


def upgrade_script(raw_input: str, target_duration: int = 45,
                   style: str = "vox-pro", depth: str = "standard",
                   research_data: dict = None) -> dict:
    """
    Takes a raw topic string or rough draft script and returns a fully upgraded script JSON.
    research_data: optional dict from researcher.py to inject real facts.
    """
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    research_block = ""
    if research_data:
        facts = research_data.get("key_facts", [])[:12]
        stats = research_data.get("statistics", [])[:8]
        research_block = "\n\nRESEARCH DATA (use these real facts — cite sources in script):\n"
        for f in facts:
            research_block += f"  • {f.get('fact', '')} [{f.get('source', '')}]\n"
        for s in stats:
            research_block += f"  • {s.get('value', '')} {s.get('label', '')} [{s.get('source', '')}]\n"

    user_msg = f"""Topic / raw input:
{raw_input}

Target duration: {target_duration} seconds
Style: {style}
{research_block}

Write a Vox-creator-level script for this topic. If the input is vague, use the structure to find the most compelling angle. If it already has content, improve sentence length, punch, and add missing data beats. Output ONLY the JSON."""

    resp = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=UPGRADE_SYSTEM,
        messages=[{"role": "user", "content": user_msg}]
    )

    raw = resp.content[0].text.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        script = json.loads(raw)
    except json.JSONDecodeError:
        # extract JSON from prose if model wrapped it
        m = re.search(r'\{[\s\S]*\}', raw)
        if m:
            script = json.loads(m.group())
        else:
            raise ValueError(f"Model did not return valid JSON: {raw[:300]}")

    # quality check and auto-fix common issues
    script = _quality_pass(script, target_duration)
    return script


def _quality_pass(script: dict, target_duration: int) -> dict:
    """Auto-fix common script quality issues."""
    scenes = script.get("scenes", [])

    for scene in scenes:
        vo = scene.get("vo", "")

        # fix: split sentences > 20 words at natural boundary
        sentences = re.split(r'(?<=[.!?])\s+', vo)
        fixed = []
        for sent in sentences:
            words = sent.split()
            if len(words) > 20:
                # find a comma split near the middle
                parts = re.split(r',\s+', sent)
                if len(parts) >= 2:
                    half = len(parts) // 2
                    fixed.append(", ".join(parts[:half]) + ".")
                    fixed.append(", ".join(parts[half:]))
                else:
                    fixed.append(sent)
            else:
                fixed.append(sent)
        scene["vo"] = " ".join(fixed)

        # fix: assign scene_type if missing
        if not scene.get("scene_type"):
            mood = scene.get("mood", "evidence")
            if mood == "hook":       scene["scene_type"] = "text-slam"
            elif mood == "tension":  scene["scene_type"] = "kinetic-type"
            elif mood == "evidence": scene["scene_type"] = "stat-reveal"
            elif mood == "pivot":    scene["scene_type"] = "consulting-brief"
            elif mood == "payoff":   scene["scene_type"] = "pull-quote"
            else:                    scene["scene_type"] = "text-slam"

        # fix: estimate duration_hint if missing
        if not scene.get("duration_hint"):
            words = len(vo.split())
            scene["duration_hint"] = round(words / 2.1 + 0.5, 1)

    # re-number scenes sequentially
    for i, s in enumerate(scenes):
        s["id"] = f"S{i+1}"

    script["scenes"] = scenes
    return script


def check_script_quality(script: dict) -> dict:
    """
    Returns a quality report dict with issues and score (0-100).
    Used for feedback in the UI / director.
    """
    issues = []
    score  = 100
    scenes = script.get("scenes", [])

    for s in scenes:
        vo = s.get("vo", "")
        words = vo.split()

        # check for banned phrases
        banned = ["today we", "in this video", "basically", "essentially", "going to talk about"]
        for b in banned:
            if b in vo.lower():
                issues.append(f"[{s['id']}] Contains banned phrase: '{b}'")
                score -= 5

        # check sentence length
        for sent in re.split(r'(?<=[.!?])\s+', vo):
            if len(sent.split()) > 22:
                issues.append(f"[{s['id']}] Sentence too long ({len(sent.split())} words): '{sent[:50]}...'")
                score -= 3

        # check for data
        has_number = bool(re.search(r'\d', vo))
        if not has_number and s.get("mood") == "evidence":
            issues.append(f"[{s['id']}] Evidence scene has no numbers")
            score -= 8

    # check hook quality
    if scenes:
        hook_vo = scenes[0].get("vo", "")
        if hook_vo.lower().startswith(("today", "in this", "welcome", "hi ", "hello")):
            issues.append("[S1] Hook starts too generically — needs a surprising fact or question")
            score -= 15

    return {"score": max(0, score), "issues": issues, "scenes_count": len(scenes)}


if __name__ == "__main__":
    import sys
    topic = " ".join(sys.argv[1:]) or "Why Indian roads kill 150,000 people a year"
    print(f"Upgrading script for: {topic!r}\n")
    result = upgrade_script(topic, target_duration=45)
    print(json.dumps(result, indent=2))
    quality = check_script_quality(result)
    print(f"\nQuality score: {quality['score']}/100")
    if quality["issues"]:
        for issue in quality["issues"]:
            print(f"  ⚠ {issue}")
