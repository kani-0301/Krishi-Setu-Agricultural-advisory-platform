"""
price.py — GET /price endpoint.
Example: GET /price?crop=tomato
"""
from fastapi import APIRouter, HTTPException, Query
from models import PriceResponse
from services.price_service import get_crop_price

router = APIRouter()


@router.get("/price", response_model=PriceResponse)
def get_price(
    crop: str = Query(..., description="Name of the crop, e.g. tomato"),
):
    """Return modal market price, trend, and source market for a given crop."""
    if not crop.strip():
        raise HTTPException(status_code=400, detail="Crop name cannot be empty.")

    try:
        data = get_crop_price(crop)
        return PriceResponse(**data)

    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
