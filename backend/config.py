import os
from pathlib import Path

# Ollama settings
OLLAMA_BASE_URL    = "http://localhost:11434"
OLLAMA_MODEL       = "llama3.1:8b"
OLLAMA_TEMPERATURE = 0.2
OLLAMA_MAX_TOKENS  = 200

# System prompt
SYSTEM_PROMPT = (
    "You are Krishi-Setu, a village agronomist. "
    "Answer using simple language. "
    "Always provide one DO and one DON'T. "
    "If unsure say consult a Krishi Mitra."
)

# Data paths
PROJECT_ROOT     = Path(__file__).resolve().parent.parent
PRICES_JSON_PATH = PROJECT_ROOT / "data" / "prices.json"

# AgroMonitoring / OpenWeatherMap API
# Set via environment variable: $env:AGRO_API_KEY = "your_key_here"
AGRO_API_KEY = os.environ.get("AGRO_API_KEY", "")

WEATHER_BASE_URL = "http://api.agromonitoring.com/agro/1.0/weather"
SOIL_BASE_URL    = "http://api.agromonitoring.com/agro/1.0/soil"
NOMINATIM_URL    = "https://nominatim.openstreetmap.org/search"
