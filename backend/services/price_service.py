"""
price_service.py — Market Intelligence service.

Reads crop pricing data from data/prices.json and returns structured
market information including modal price, trend, and source market.
"""
import json
from pathlib import Path

from config import PRICES_JSON_PATH


def get_crop_price(crop_name: str) -> dict:
    """
    Look up price data for a given crop (case-insensitive).

    Returns:
        dict with keys: crop, modal_price, trend, market

    Raises:
        FileNotFoundError: if prices.json does not exist or is empty.
        ValueError:        if the crop is not found in the dataset.
    """
    if not PRICES_JSON_PATH.exists():
        raise FileNotFoundError("Price data file not found. Please ensure data/prices.json exists.")

    content = PRICES_JSON_PATH.read_text(encoding="utf-8").strip()
    if not content:
        raise FileNotFoundError("Price data file is empty.")

    prices: list[dict] = json.loads(content)
    crop_lower = crop_name.strip().lower()

    for entry in prices:
        if entry.get("crop", "").lower() == crop_lower:
            return {
                "crop":            entry["crop"],
                "modal_price":     entry["modal_price"],
                "trend":           entry["trend"],
                "market":          entry.get("market", "Local Market"),
                "demand_forecast": entry.get("demand_forecast"),  # new
            }

    available = ", ".join(e["crop"] for e in prices)
    raise ValueError(
        f"No price data found for crop: '{crop_name}'. "
        f"Available crops: {available}"
    )
