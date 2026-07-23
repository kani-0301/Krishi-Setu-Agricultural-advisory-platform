import httpx
from config import (
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_TEMPERATURE,
    OLLAMA_MAX_TOKENS,
    SYSTEM_PROMPT,
)


def generate_response(prompt: str) -> str:
    """Send prompt using the default SYSTEM_PROMPT from config."""
    return generate_with_system(prompt=prompt, system=SYSTEM_PROMPT)


def generate_with_system(prompt: str, system: str) -> str:
    """
    Send a prompt to the local Ollama Llama 3.1:8b model and return the text response.
    """
    payload = {
        "model": OLLAMA_MODEL,
        "system": system,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": OLLAMA_TEMPERATURE,
            "num_predict": OLLAMA_MAX_TOKENS,
        },
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "No response from model.")
    except httpx.RequestError as e:
        return f"Error connecting to Ollama: {str(e)}"
    except httpx.HTTPStatusError as e:
        return f"Ollama returned an error: {e.response.status_code}"
