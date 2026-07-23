import httpx
from fastapi import APIRouter
from config import OLLAMA_BASE_URL, OLLAMA_MODEL
from models import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check():
    """Check that the backend is running and that the Ollama model is accessible."""
    ollama_status = "disconnected"
    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{OLLAMA_BASE_URL}/api/tags")
            response.raise_for_status()
            data = response.json()
            model_names = [m["name"] for m in data.get("models", [])]
            if any(OLLAMA_MODEL in name for name in model_names):
                ollama_status = "connected"
            else:
                ollama_status = f"model '{OLLAMA_MODEL}' not found"
    except Exception:
        ollama_status = "disconnected"

    return HealthResponse(status="ok", ollama=ollama_status)
