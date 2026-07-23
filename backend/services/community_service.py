"""
community_service.py — Community Knowledge Network (Phase 11).

Loads community_tips.json and returns the top-voted farmer experiences
for a given crop. These are injected into the Llama prompt so the AI can
weave real-world community wisdom into its advisory responses.
"""
import json
from pathlib import Path

_DATA_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "community_tips.json"


def _load_tips() -> dict:
    try:
        with open(_DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def get_community_tips(crop: str, max_tips: int = 2) -> list[dict]:
    """
    Retrieve the top-voted community tips for a given crop.

    Args:
        crop:     Canonical crop name (e.g. "tomato", "wheat").
        max_tips: Maximum number of tips to return (default 2).

    Returns:
        Sorted list of tip dicts, highest upvotes first. Empty list if none found.
        Each dict: { "author", "location", "topic", "upvotes", "tip" }
    """
    data = _load_tips()
    tips = data.get(crop.lower().strip(), [])
    # Sort by upvotes descending, return top N
    return sorted(tips, key=lambda t: t.get("upvotes", 0), reverse=True)[:max_tips]


def format_community_prompt(tips: list[dict]) -> str:
    """Format community tips as a readable block for LLM injection."""
    if not tips:
        return ""
    lines = ["FARMER COMMUNITY TIPS (Real-world verified experiences):"]
    for t in tips:
        lines.append(
            f"- {t['author']} ({t['location']}, 👍 {t['upvotes']} upvotes) [{t['topic']}]: {t['tip']}"
        )
    return "\n".join(lines)
