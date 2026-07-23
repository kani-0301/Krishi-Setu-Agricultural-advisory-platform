"""
market_service.py — Multi-Market Price Intelligence (Phase 10).

Loads market_trends.json (multi-market + 7-day historical data) and computes:
  - Best market to sell in (highest absolute price)
  - Price arbitrage vs. local market (₹ difference + % gain)
  - 7-day trend momentum (rising / falling / stable + slope)
  - Human-readable sell timing recommendation (sell now / wait / consider transport)

Returns a structured MarketInsight dict for injection into the Llama advisory prompt.
"""
import json
from pathlib import Path

_DATA_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "market_trends.json"

_TRANSPORT_COST_PER_KM = 3   # ₹ per km (rough haulage estimate per quintal)
_MIN_PROFIT_THRESHOLD  = 200  # Minimum net gain (₹/qtl) to justify distant market


def _load_trends() -> dict:
    try:
        with open(_DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def _momentum(history: list[float]) -> tuple[str, float]:
    """
    Calculate trend momentum from a 7-day price list.
    Returns: (label: "rising"/"falling"/"stable", slope: ₹/day)
    """
    if len(history) < 2:
        return "stable", 0.0
    slope = (history[-1] - history[0]) / max(len(history) - 1, 1)
    if slope > 30:
        return "rising", round(slope, 1)
    if slope < -30:
        return "falling", round(slope, 1)
    return "stable", round(slope, 1)


def get_market_insight(crop: str) -> dict | None:
    """
    Analyze multi-market data for a crop and return a MarketInsight dict.

    Returns None if no data exists for the crop.

    Dict shape:
    {
        "crop": str,
        "local_market": { "name": str, "price": int, "distance_km": int },
        "best_market":  { "name": str, "price": int, "distance_km": int },
        "arbitrage":    { "gross_gain": int, "transport_cost": int, "net_gain": int, "gain_pct": float },
        "trend":        { "label": "rising"|"falling"|"stable", "slope_per_day": float, "forecast": str },
        "recommendation": str,
        "sell_now": bool,
    }
    """
    data = _load_trends()
    crop_key = crop.lower().strip()
    if crop_key not in data:
        return None

    entry    = data[crop_key]
    markets  = entry.get("markets", [])
    history  = entry.get("history_7d", [])
    forecast = entry.get("forecast", "stable")

    if not markets:
        return None

    # Local market = first entry (nearest mandi)
    local  = markets[0]
    # Best market = highest absolute price
    best   = max(markets, key=lambda m: m["current_price"])

    gross_gain     = best["current_price"] - local["current_price"]
    transport_cost = round(_TRANSPORT_COST_PER_KM * best["distance_km"])
    net_gain       = gross_gain - transport_cost
    gain_pct       = round(gross_gain / local["current_price"] * 100, 1) if local["current_price"] else 0

    trend_label, slope = _momentum(history if history else [local["current_price"]])

    # ── Recommendation logic ──────────────────────────────────────────────
    if trend_label == "rising" and net_gain < _MIN_PROFIT_THRESHOLD:
        recommendation = (
            f"Prices are rising (≈₹{abs(slope)}/day). Wait 2–3 days for higher local prices "
            f"at {local['name']} before transporting further."
        )
        sell_now = False
    elif net_gain >= _MIN_PROFIT_THRESHOLD:
        recommendation = (
            f"Transport to {best['name']} (₹{best['current_price']}/qtl) for a net gain of "
            f"₹{net_gain}/qtl after ₹{transport_cost} haulage cost."
        )
        sell_now = True
    elif trend_label == "falling":
        recommendation = (
            f"Prices are falling (≈₹{abs(slope)}/day). Sell locally at {local['name']} "
            f"now to avoid further losses. Store only if you have cold storage."
        )
        sell_now = True
    else:
        recommendation = (
            f"Prices are stable near ₹{local['current_price']}/qtl. "
            f"Sell locally at {local['name']} when convenient."
        )
        sell_now = True

    return {
        "crop":         crop_key,
        "local_market": {"name": local["name"],  "price": local["current_price"],  "distance_km": local["distance_km"]},
        "best_market":  {"name": best["name"],   "price": best["current_price"],   "distance_km": best["distance_km"]},
        "arbitrage":    {
            "gross_gain":     gross_gain,
            "transport_cost": transport_cost,
            "net_gain":       net_gain,
            "gain_pct":       gain_pct,
        },
        "trend": {
            "label":         trend_label,
            "slope_per_day": slope,
            "forecast":      forecast,
        },
        "recommendation": recommendation,
        "sell_now":       sell_now,
    }
