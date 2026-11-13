"""
AI Script writer: uses Claude to write data-backed scripts for any topic.
Accepts research data → returns structured script with scenes, VO lines, visual cues.
"""
import os, sys, json, re
import anthropic

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-6")


SYSTEM_PROMPT = """You are a Vox-style video director writing a tightly structured short-form video script.
You write scripts that:
- Open with a genuinely surprising or counter-intuitive hook in the first 3 seconds
- Use REAL data and statistics (from the research provided) as story beats
- Each fact or number becomes a VISUAL MOMENT, not just narration
- Write in punchy, declarative sentences (5-10 words each)
- End with a payoff that reframes the opening hook
- Total VO duration: approximately the requested length (count ~2.5 words per second)

Output ONLY valid JSON matching this schema:
{
  "logline": "one sentence story premise",
  "hook": "opening 1-2 sentences (3s max)",
  "scenes": [
    {
      "id": "S1",
      "vo": "exact voice-over text for this scene",
      "visual": "describe what appears on screen",
      "data": {"label": "...", "value": "...", "unit": "..."} | null,
      "duration_hint": 4.5,
      "sfx": "paper_slam | card_drop | counter_tick | whoosh | ding | null",
      "image_query": "search term for real photo to composite" | null
    }
  ],
  "image_queries": ["query1", "query2", "query3"],
  "color_theme": "cream-navy | dark-editorial | warm-orange | cool-blue",
  "data_points": [
    {"label": "...", "value": "...", "unit": "..."}
  ]
}"""


def write_script(topic: str, research: dict, duration: int = 45,
                 style: str = "vox-pro") -> dict:
    """
    Write a complete video script backed by real research data.
    Returns structured script dict.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("  [scripter] WARNING: No ANTHROPIC_API_KEY — using template script", file=sys.stderr)
        return _fallback_script(topic, research, duration)

    client = anthropic.Anthropic(api_key=api_key)

    facts_block = "\n".join(f"- {f}" for f in research.get("facts", [])[:8])
    numbers_block = "\n".join(
        f"- {n['value']} {n['unit']}: {n['context']}"
        for n in research.get("numbers", [])[:6]
    )

    prompt = f"""Topic: {topic}

Research Summary:
{research.get('summary', '')[:600]}

Key Facts:
{facts_block}

Key Numbers / Statistics:
{numbers_block}

Style: {style}
Target duration: ~{duration} seconds
Approximate VO words needed: {int(duration * 2.5)}

Write a complete video script. Use the real statistics as visual data moments.
Every scene should have a clear visual idea that can be drawn in code or composited with a real photo.
Make the hook surprising. Make the ending reframe the hook."""

    print(f"  [scripter] calling Claude ({MODEL})...", file=sys.stderr)
    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = message.content[0].text.strip()
        # Extract JSON block if wrapped in markdown
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw, re.DOTALL)
        if json_match:
            raw = json_match.group(1)
        script = json.loads(raw)
        print(f"  [scripter] ✓ {len(script.get('scenes', []))} scenes, logline: {script.get('logline', '')[:60]}", file=sys.stderr)
        return script
    except json.JSONDecodeError as e:
        print(f"  [scripter] JSON parse error: {e} — using fallback", file=sys.stderr)
        return _fallback_script(topic, research, duration)
    except anthropic.APIError as e:
        print(f"  [scripter] API error: {e} — using fallback", file=sys.stderr)
        return _fallback_script(topic, research, duration)


def _fallback_script(topic: str, research: dict, duration: int) -> dict:
    """Generate a reasonable fallback script when no API key is available"""
    facts = research.get("facts", [])[:3]
    numbers = research.get("numbers", [])[:3]
    summary = research.get("summary", f"{topic} is a subject worth exploring.")[:200]

    base = topic.upper().split(".")[-1].strip()

    scenes = [
        {
            "id": "S1",
            "vo": f"Here's what nobody tells you about {topic.split('.')[-1].strip()}.",
            "visual": "Bold headline slams onto paper background",
            "data": None,
            "duration_hint": 4.0,
            "sfx": "paper_slam",
            "image_query": research.get("img_queries", [topic])[0]
        }
    ]

    for i, fact in enumerate(facts[:2]):
        clean = re.sub(r'\[.*?\]', '', fact).strip()[:120]
        scenes.append({
            "id": f"S{i+2}",
            "vo": clean,
            "visual": f"Infographic showing key fact {i+1}",
            "data": numbers[i] if i < len(numbers) else None,
            "duration_hint": 8.0,
            "sfx": "card_drop",
            "image_query": research.get("img_queries", [topic])[min(i+1, len(research.get("img_queries",[topic]))-1)]
        })

    # Payoff scene
    scenes.append({
        "id": f"S{len(scenes)+1}",
        "vo": f"The story of {topic.split('.')[-1].strip()} is really a story about you.",
        "visual": "Final reveal — full screen statement",
        "data": None,
        "duration_hint": 5.0,
        "sfx": "ding",
        "image_query": None
    })

    return {
        "logline": f"How {topic.split('.')[-1].strip()} reveals something about all of us.",
        "hook": f"Here's what nobody tells you about {topic.split('.')[-1].strip()}.",
        "scenes": scenes,
        "image_queries": research.get("img_queries", [topic])[:4],
        "color_theme": "cream-navy",
        "data_points": numbers[:3]
    }


if __name__ == "__main__":
    topic = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Spotify Wrapped"
    # Quick test with mock research
    mock_research = {
        "topic": topic,
        "summary": f"{topic} is an annual data campaign.",
        "facts": ["Over 600 million users receive Wrapped data",
                  "Wrapped drives 20% of Spotify's new installs in December"],
        "numbers": [{"value": "600", "unit": "million", "context": "active users"}],
        "img_queries": ["spotify app", "music listening headphones"]
    }
    script = write_script(topic, mock_research, duration=45)
    print(json.dumps(script, indent=2))
