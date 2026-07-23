"""
voice_query.py — POST /voice-query (text input).

Full advisory pipeline with top-level exception safety for demo stability.
"""
from fastapi import APIRouter, HTTPException
from models import VoiceQueryRequest, AdvisoryResponse
from services.advisory_service import generate_advisory, FALLBACK_ADVICE

router = APIRouter()


@router.post("/voice-query", response_model=AdvisoryResponse)
def voice_query(request: VoiceQueryRequest):
    """
    Accept a text question, run the full unified advisory pipeline
    (crop detect → price → weather → RAG → Llama), and return
    structured advice with market and weather reasoning.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Query text cannot be empty.")

    try:
        result = generate_advisory(question=request.text)
        return AdvisoryResponse(**result)
    except Exception as exc:
        # Never let an unhandled exception surface during demo.
        # Return graceful fallback advice instead of a 500 error.
        return AdvisoryResponse(
            advice=FALLBACK_ADVICE,
            price=None,
            weather=None,
            sources=[],
            market_insight=None,
            community_tips=[],
        )
