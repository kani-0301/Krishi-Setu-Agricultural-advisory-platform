from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pathlib import Path

from routes import health, voice_query, voice, price, weather

app = FastAPI(
    title="Krishi-Setu AI Backend",
    description=(
        "AI-powered crop advisory backend for Indian farmers. "
        "Integrates local Llama 3.1 (Ollama), ICAR RAG pipeline, "
        "market intelligence, real-time weather, and voice AI."
    ),
    version="0.5.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again."},
    )

# Serve generated audio files
AUDIO_DIR = Path(__file__).resolve().parent / "static" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/audio", StaticFiles(directory=str(AUDIO_DIR)), name="audio")

# Register routers
app.include_router(health.router,       tags=["Health"])
app.include_router(voice_query.router,  tags=["Crop Advisory (Text)"])
app.include_router(voice.router,        tags=["Crop Advisory (Voice)"])
app.include_router(price.router,        tags=["Market Prices"])
app.include_router(weather.router,      tags=["Weather"])
