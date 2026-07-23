"""
voice_service.py — Speech-to-Text (Whisper) and Text-to-Speech (gTTS).

STT Pipeline:
    audio file path → whisper model → transcribed text

TTS Pipeline:
    text + language → gTTS → saves .mp3 → returns file path
"""
import uuid
import whisper
from gtts import gTTS
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────
BACKEND_ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR    = BACKEND_ROOT / "static" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# ── Whisper model (loaded once at module level for performance) ─────────────
# Options: tiny | base | small | medium | large
# 'base' is fast and accurate enough for Indian languages on i9 CPU.
# GPU will be auto-used if cuda is available.
_whisper_model: whisper.Whisper | None = None


def _get_whisper_model() -> whisper.Whisper:
    """Lazy-load the Whisper model (avoids slow startup at import time)."""
    global _whisper_model
    if _whisper_model is None:
        _whisper_model = whisper.load_model("base")
    return _whisper_model


# ── Speech-to-Text ─────────────────────────────────────────────────────────

def speech_to_text(audio_file_path: str) -> tuple[str, str]:
    """
    Transcribe an audio file using local OpenAI Whisper.

    Returns:
        (transcribed_text, detected_language_code)
        e.g. ("Mera tamatar peela pad raha hai", "hi")

    Raises:
        FileNotFoundError: if the audio file path does not exist.
        RuntimeError: if Whisper fails to transcribe.
    """
    path = Path(audio_file_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_file_path}")

    model = _get_whisper_model()
    result = model.transcribe(str(path), task="transcribe")

    text = result.get("text", "").strip()
    lang = result.get("language", "en")

    if not text:
        raise RuntimeError("Whisper returned an empty transcription. Check audio quality.")

    return text, lang


# ── Text-to-Speech ─────────────────────────────────────────────────────────

def text_to_speech(text: str, lang: str = "en") -> str:
    """
    Convert text to speech using gTTS and save as an .mp3 file.

    Args:
        text: The text to convert.
        lang: BCP-47 language code (e.g. 'hi', 'ta', 'te', 'en').

    Returns:
        Relative URL path of the saved audio file.
        e.g. "/audio/response_<uuid>.mp3"

    Raises:
        ValueError: if text is empty.
        RuntimeError: if gTTS fails.
    """
    if not text.strip():
        raise ValueError("Cannot convert empty text to speech.")

    filename = f"response_{uuid.uuid4().hex[:10]}.mp3"
    output_path = AUDIO_DIR / filename

    try:
        tts = gTTS(text=text, lang=lang, slow=False)
        tts.save(str(output_path))
    except Exception as exc:
        raise RuntimeError(f"gTTS failed to generate audio: {exc}")

    return f"/audio/{filename}"
