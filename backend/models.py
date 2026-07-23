from pydantic import BaseModel
from typing import Optional


class VoiceQueryRequest(BaseModel):
    text: str
    target_lang: str = "en"


class VoiceQueryResponse(BaseModel):
    response: str


class VoiceAudioResponse(BaseModel):
    transcription: str
    response_text: str
    audio_url: str


class MarketInsight(BaseModel):
    crop:           str
    local_market:   dict
    best_market:    dict
    arbitrage:      dict
    trend:          dict
    recommendation: str
    sell_now:       bool


class AdvisoryResponse(BaseModel):
    advice:          str
    price:           Optional[dict]  = None
    weather:         Optional[dict]  = None
    sources:         list[str]       = []
    market_insight:  Optional[dict]  = None
    community_tips:  list[dict]      = []


class PriceResponse(BaseModel):
    crop: str
    modal_price: int
    trend: str
    market: str
    demand_forecast: Optional[str] = None


class WeatherResponse(BaseModel):
    city: str
    temperature: float
    humidity: int
    condition: str
    soil_temp: float | None = None
    soil_moisture: float | None = None


class HealthResponse(BaseModel):
    status: str
    ollama: str
