"""
voice.py — POST /voice endpoint (audio input).

Phase 7 Update: now calls advisory_service.generate_advisory()
so the full pipeline produces market + weather + ICAR-grounded advice.

Full pipeline:
    Upload audio
        ↓  Whisper STT
    Transcription + detected language
        ↓  deep-translator → English
    English query
        ↓  advisory_service.generate_advisory()
            ← crop detect + price + weather + RAG + Llama
    English advice (with DO/DON'T + price/weather reasoning)
        ↓  deep-translator → farmer's language
    Regional advice text
        ↓  gTTS TTS → .mp3
    audio_url
        ↓
    {transcription, response_text, audio_url}
"""
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from models import VoiceAudioResponse
from services.voice_service import speech_to_text, text_to_speech
from services.translation_service import translate_to_english, translate_to_regional
from services.advisory_service import generate_advisory

router = APIRouter()

ACCEPTED_TYPES = {
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
    "audio/ogg", "audio/webm", "audio/m4a", "audio/mp4",
}


@router.post("/voice", response_model=VoiceAudioResponse)
async def voice_pipeline(
    audio_file: UploadFile = File(..., description="Farmer's spoken question (MP3/WAV/OGG/WebM)"),
    target_lang: str = Form(default="en", description="Language code for response (hi/ta/te/en …)"),
    city: str = Form(default="Madurai", description="City for weather lookup (default: Madurai)"),
):
    """
    Full end-to-end voice advisory pipeline with market + weather reasoning.

    1. Upload audio → Whisper STT → transcription
    2. Translate to English
    3. advisory_service: crop detect → price → weather → RAG → Llama
    4. Translate advice back to target language
    5. gTTS → MP3
    6. Return {transcription, response_text, audio_url}
    """
    # ── Validate file type ─────────────────────────────────────────────────
    if audio_file.content_type and audio_file.content_type not in ACCEPTED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio format '{audio_file.content_type}'. Use MP3, WAV, OGG, or WebM.",
        )

    # ── Step 1: Save uploaded audio to a temp file ─────────────────────────
    suffix = Path(audio_file.filename or "audio.mp3").suffix or ".mp3"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(audio_file.file, tmp)
        tmp_path = tmp.name

    try:
        # ── Step 2: Speech-to-Text (local Whisper) ─────────────────────────
        try:
            transcription, detected_lang = speech_to_text(tmp_path)
        except (FileNotFoundError, RuntimeError) as e:
            raise HTTPException(status_code=422, detail=f"Transcription failed: {e}")

        # ── Step 3: Translate to English ───────────────────────────────────
        query_english = translate_to_english(transcription, source_lang=detected_lang)

        # ── Step 4: Full advisory pipeline (Phase 7) ───────────────────────
        advisory = generate_advisory(question=query_english, city=city)
        response_english = advisory["advice"]

        # ── Step 5: Translate advice back to farmer's language ─────────────
        lang_out = target_lang if target_lang else detected_lang
        response_regional = translate_to_regional(response_english, target_lang=lang_out)

        # ── Step 6: Text-to-Speech via gTTS ───────────────────────────────
        try:
            audio_url = text_to_speech(response_regional, lang=lang_out)
        except (ValueError, RuntimeError) as e:
            raise HTTPException(status_code=500, detail=f"TTS failed: {e}")

    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return VoiceAudioResponse(
        transcription=transcription,
        response_text=response_regional,
        audio_url=audio_url,
    )
