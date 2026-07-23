"""
advisory_service.py — Unified AI Advisory Engine (Phase 7).

Combines:
  1. Crop keyword detection (from question text)
  2. Real-time market price   (price_service)
  3. Real-time weather + soil (weather_service)
  4. ICAR RAG context         (FAISS retrieval)
  → Single power-packed Llama 3.1:8b prompt
  → Structured JSON response with advice, price, weather, source

Pipeline:
    question
        ↓ detect_crop()
    crop name
        ↓ price_service.get_crop_price() + weather_service.get_weather()
    price & weather dicts
        ↓ rag.retriever.retrieve_docs()
    ICAR context chunks
        ↓ build_advisory_prompt()
    full context prompt
        ↓ ollama_client.generate_with_system()
    LLM advice text
        ↓ pack into JSON
    {"advice", "price", "weather", "sources"}
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import ollama_client
from rag.retriever import retrieve_docs
from services.price_service import get_crop_price
from services.weather_service import get_weather
from services.market_service import get_market_insight
from services.community_service import get_community_tips, format_community_prompt

# ── Crop keyword map ──────────────────────────────────────────────────────
# Maps keywords found in questions to canonical crop names in prices.json.
CROP_KEYWORDS: dict[str, str] = {
    "tomato": "tomato",   "tamatar": "tomato",  "thakkali": "tomato",
    "onion":  "onion",    "pyaz":    "onion",   "vengayam": "onion",
    "potato": "potato",   "aloo":    "potato",  "aalu":     "potato",
    "wheat":  "wheat",    "gehun":   "wheat",   "godhumai": "wheat",
    "rice":   "rice",     "chawal":  "rice",    "arisi":    "rice",
    "cotton": "cotton",   "kapas":   "cotton",  "paruthi":  "cotton",
    "maize":  "maize",    "makka":   "maize",   "cholam":   "maize",
    "chilli": "chilli",   "mirchi":  "chilli",  "milagai":  "chilli",
    "soybean":"soybean",  "soya":    "soybean",
    "banana": "banana",   "kela":    "banana",   "vazhai":  "banana",
    "sugarcane": "sugarcane", "ganna": "sugarcane",
    "groundnut": "groundnut", "mungfali": "groundnut",
}

ADVISORY_SYSTEM_PROMPT = (
    "You are Krishi-Setu, an expert village agronomist with 20 years of experience. "
    "You have access to real-time market prices, weather data, and multi-market comparisons. "
    "Use ALL the provided data to give SPECIFIC, ACTIONABLE advice. "
    "You MUST structure your response EXACTLY as:\n"
    "DO: [one specific action the farmer should take today]\n"
    "DON'T: [one specific action to avoid]\n"
    "Then add 1-2 sentences of reasoning mentioning the price, weather, or best market."
)

SELL_INTENT_KEYWORDS = [
    "sell", "selling", "sold", "price", "mandi", "market", "where to sell",
    "best time", "best place", "when to sell", "should i sell",
]

FALLBACK_ADVICE = (
    "DO: Consult your local Krishi Vigyan Kendra for crop-specific advice.\n"
    "DON'T: Make decisions without checking today's mandi prices and weather."
)


def detect_crop(question: str) -> str | None:
    """
    Scan the question for known crop keywords (English + Hindi + Tamil).
    Strips punctuation and uses space-padded substring match so both
    'tomatoes' and 'tamatar?' are detected correctly.
    Returns the canonical crop name, or None if not detected.
    """
    import string
    clean = question.lower().translate(str.maketrans(string.punctuation, " " * len(string.punctuation)))
    q = " " + clean + " "
    for keyword, crop in CROP_KEYWORDS.items():
        if f" {keyword} " in q or f" {keyword}s " in q or f" {keyword}es " in q:
            return crop
    return None


def detect_sell_intent(question: str) -> bool:
    """Return True if the question is about selling, pricing, or market timing."""
    q = question.lower()
    return any(kw in q for kw in SELL_INTENT_KEYWORDS)


def _format_price(price: dict | None) -> str:
    if not price:
        return "Price data unavailable."
    return (
        f"Crop: {price['crop'].title()}, "
        f"Price: ₹{price['modal_price']}/qtl, "
        f"Trend: {price['trend'].upper()}, "
        f"Market: {price['market']}"
    )


def _format_weather(weather: dict | None) -> str:
    if not weather:
        return "Weather data unavailable."
    parts = [
        f"Location: {weather['city']}",
        f"Temp: {weather['temperature']}°C",
        f"Humidity: {weather['humidity']}%",
        f"Condition: {weather['condition']}",
    ]
    if weather.get("soil_temp") is not None:
        parts.append(f"Soil Temp: {weather['soil_temp']}°C")
    if weather.get("soil_moisture") is not None:
        parts.append(f"Soil Moisture: {round(weather['soil_moisture'] * 100, 1)}%")
    return ", ".join(parts)


def _format_rag(docs: list) -> tuple[str, list[str]]:
    """Extract context text and citation list from retrieved FAISS documents."""
    if not docs:
        return "No ICAR knowledge found for this query.", []

    context = "\n\n".join(
        f"[Chunk {i + 1}]\n{doc.page_content}" for i, doc in enumerate(docs)
    )

    seen: set[str] = set()
    sources: list[str] = []
    for doc in docs:
        source_path = doc.metadata.get("source", "")
        page_num    = doc.metadata.get("page", None)
        name = Path(source_path).stem if source_path else "Unknown Source"
        citation = f"{name} (Page {page_num + 1})" if page_num is not None else name
        if citation not in seen:
            sources.append(citation)
            seen.add(citation)

    return context, sources


def build_advisory_prompt(
    question: str,
    price_str: str,
    weather_str: str,
    rag_context: str,
    market_insight: dict | None = None,
    community_prompt: str = "",
) -> str:
    market_section = ""
    if market_insight:
        mi = market_insight
        arb = mi["arbitrage"]
        trend = mi["trend"]
        market_section = (
            f"\nMARKET INTELLIGENCE (for sell decision):\n"
            f"  Local market:  {mi['local_market']['name']} @ ₹{mi['local_market']['price']}/qtl\n"
            f"  Best market:   {mi['best_market']['name']} @ ₹{mi['best_market']['price']}/qtl"
            f" ({mi['best_market']['distance_km']} km away)\n"
            f"  Net gain if transported: ₹{arb['net_gain']}/qtl"
            f" (after ₹{arb['transport_cost']} haulage)\n"
            f"  7-day trend:   {trend['label'].upper()} (≈₹{trend['slope_per_day']}/day)\n"
            f"  Recommendation: {mi['recommendation']}\n"
        )

    community_section = f"\n{community_prompt}\n" if community_prompt else ""

    return (
        f"FARMER'S QUESTION:\n{question}\n\n"
        f"CURRENT WEATHER:\n{weather_str}\n\n"
        f"MARKET PRICE:\n{price_str}\n"
        f"{market_section}"
        f"{community_section}\n"
        f"VERIFIED ICAR KNOWLEDGE:\n{rag_context}\n\n"
        "INSTRUCTIONS:\n"
        "1. Combine weather, market price, and ICAR knowledge to give advice.\n"
        "2. Start with 'DO:' then 'DON'T:' on separate lines.\n"
        "3. If market intelligence is provided, use it to advise on WHEN and WHERE to sell.\n"
        "4. If community tips are provided, weave ONE relevant real-world farmer experience into your reasoning.\n"
        "5. Reference the actual price, trend, and best market in your reasoning.\n"
        "6. If unsure, say 'Consult a Krishi Mitra.'"
    )


def generate_advisory(
    question: str,
    city: str = "Madurai",
) -> dict:
    """
    Full unified advisory pipeline.

    Args:
        question: Farmer's question in English.
        city:     City name for weather lookup (default: Madurai).

    Returns:
        {
            "advice":  str,
            "price":   dict | None,
            "weather": dict | None,
            "sources": list[str],
        }
    """
    # ── Step 1: Detect crop ───────────────────────────────────────────────
    crop = detect_crop(question)

    # ── Step 2: Fetch price (non-blocking if crop unknown) ────────────────
    price_data: dict | None = None
    if crop:
        try:
            price_data = get_crop_price(crop)
        except (ValueError, FileNotFoundError):
            price_data = None

    # ── Step 3: Fetch weather + soil (non-blocking) ───────────────────────
    weather_data: dict | None = None
    try:
        weather_data = get_weather(city)
    except (ValueError, ConnectionError):
        weather_data = None

    # ── Step 4: Retrieve ICAR RAG context ─────────────────────────────────
    docs = retrieve_docs(question)
    rag_context, sources = _format_rag(docs)

    # ── Step 5 (Phase 10): Market intelligence for sell-intent queries ─────
    market_insight: dict | None = None
    if crop and detect_sell_intent(question):
        try:
            market_insight = get_market_insight(crop)
        except Exception:
            market_insight = None

    # ── Step 5b (Phase 11): Community knowledge tips ───────────────────────
    community_tips: list[dict] = []
    community_prompt_str: str = ""
    if crop:
        try:
            community_tips = get_community_tips(crop, max_tips=2)
            community_prompt_str = format_community_prompt(community_tips)
        except Exception:
            community_tips = []

    # ── Step 6: Build prompt and call Llama ──────────────────────────────
    prompt = build_advisory_prompt(
        question         = question,
        price_str        = _format_price(price_data),
        weather_str      = _format_weather(weather_data),
        rag_context      = rag_context,
        market_insight   = market_insight,
        community_prompt = community_prompt_str,
    )

    raw_response = ollama_client.generate_with_system(
        prompt=prompt,
        system=ADVISORY_SYSTEM_PROMPT,
    )

    # ── Step 7: Safety fallback if LLM fails ──────────────────────────────
    if not raw_response or "error" in raw_response.lower()[:30]:
        advice = FALLBACK_ADVICE
    else:
        advice = raw_response.strip()

    # ── Step 8: Append source citations ───────────────────────────────────
    if sources:
        advice = advice.rstrip() + "\n\nSource: " + ", ".join(sources)

    return {
        "advice":         advice,
        "price":          price_data,
        "weather":        weather_data,
        "sources":        sources,
        "market_insight": market_insight,
        "community_tips": community_tips,
    }
