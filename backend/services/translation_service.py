"""
translation_service.py — Text translation using deep-translator (Google Translate backend).

deep-translator is more reliable than googletrans==4.0.0-rc1 for production use.
It uses the public Google Translate API with robust timeout handling.

Supported Indian language codes (BCP-47):
    hi — Hindi       | ta — Tamil    | te — Telugu
    kn — Kannada     | mr — Marathi  | pa — Punjabi
    gu — Gujarati    | bn — Bengali  | ml — Malayalam
    en — English
"""
from deep_translator import GoogleTranslator


def translate_to_english(text: str, source_lang: str = "auto") -> str:
    """
    Translate text from any Indian language to English.

    Args:
        text:        Input text (e.g. Hindi, Tamil, Telugu query from farmer).
        source_lang: BCP-47 code ('hi', 'ta', …) or 'auto' to detect automatically.

    Returns:
        English string suitable for RAG + Llama processing.
        Returns original text unchanged if it is already English or blank.
    """
    if not text.strip() or source_lang == "en":
        return text

    try:
        translated = GoogleTranslator(source=source_lang, target="en").translate(text)
        return translated or text
    except Exception:
        # Graceful fallback — return original text and let RAG try to handle it
        return text


def translate_to_regional(text: str, target_lang: str) -> str:
    """
    Translate English advisory text back to a regional Indian language.

    Args:
        text:        English text to translate (LLM response).
        target_lang: BCP-47 language code for the target language.

    Returns:
        Translated text, or original English text if translation fails.
    """
    if not text.strip() or target_lang == "en":
        return text

    try:
        translated = GoogleTranslator(source="en", target=target_lang).translate(text)
        return translated or text
    except Exception:
        # Non-blocking fallback to English
        return text
