"""
weather.py — GET /weather endpoint.

Returns real-time weather data for a given city via OpenWeatherMap.

Example:
    GET /weather?city=madurai
"""
from fastapi import APIRouter, HTTPException, Query
from models import WeatherResponse
from services.weather_service import get_weather

router = APIRouter()


@router.get("/weather", response_model=WeatherResponse)
def weather_query(
    city: str = Query(..., description="Name of the city, e.g. madurai"),
):
    """
    Return current weather conditions for a given city.

    Example:
        GET /weather?city=madurai
    """
    if not city.strip():
        raise HTTPException(status_code=400, detail="City name cannot be empty.")

    try:
        data = get_weather(city)
        return WeatherResponse(**data)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
