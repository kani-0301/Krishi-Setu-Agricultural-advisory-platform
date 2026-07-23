"""
weather_service.py — Real-time weather via AgroMonitoring, with Open-Meteo free fallback.

Pipeline (Priority order):
    1. AgroMonitoring (lat/lon, API key, soil data included)
    2. Open-Meteo (free, no API key, no soil, always works)

Geocoding: OSM Nominatim (free, no API key).
"""
import httpx
from config import AGRO_API_KEY, WEATHER_BASE_URL, SOIL_BASE_URL, NOMINATIM_URL

NOMINATIM_HEADERS = {"User-Agent": "KrishiSetu/1.0 (agricultural-advisory-app)"}

# WMO weather condition codes → readable condition string
_WMO_CONDITIONS: dict[int, str] = {
    0: "Clear", 1: "Clear", 2: "Clouds", 3: "Clouds",
    45: "Fog", 48: "Fog",
    51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
    61: "Rain", 63: "Rain", 65: "Rain",
    71: "Snow", 73: "Snow", 75: "Snow", 77: "Snow",
    80: "Rain", 81: "Rain", 82: "Rain",
    85: "Snow", 86: "Snow",
    95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
}


def _geocode(city: str, client: httpx.Client) -> tuple[float, float, str]:
    """Convert a city name to (lat, lon, display_name) via OSM Nominatim."""
    resp = client.get(
        NOMINATIM_URL,
        params={"q": city.strip(), "format": "json", "limit": 1},
        headers=NOMINATIM_HEADERS,
        timeout=10.0,
    )
    resp.raise_for_status()
    results = resp.json()
    if not results:
        raise ValueError(f"City '{city}' not found. Check spelling and try again.")
    r = results[0]
    return float(r["lat"]), float(r["lon"]), r.get("display_name", city)


def _fetch_agro_weather(lat: float, lon: float, client: httpx.Client) -> dict:
    """Call AgroMonitoring current weather endpoint (lat/lon based)."""
    resp = client.get(
        WEATHER_BASE_URL,
        params={"lat": lat, "lon": lon, "appid": AGRO_API_KEY},
        timeout=10.0,
    )
    if resp.status_code == 401:
        raise ValueError("Invalid AgroMonitoring API key.")
    resp.raise_for_status()
    return resp.json()


def _fetch_agro_soil(lat: float, lon: float, client: httpx.Client) -> dict | None:
    """Call AgroMonitoring soil endpoint. Returns None if unavailable."""
    try:
        resp = client.get(
            SOIL_BASE_URL,
            params={"lat": lat, "lon": lon, "appid": AGRO_API_KEY},
            timeout=10.0,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None


def _fetch_open_meteo(lat: float, lon: float, city: str, client: httpx.Client) -> dict:
    """
    Free Open-Meteo API fallback — no API key required, highly reliable.
    https://open-meteo.com/en/docs
    """
    resp = client.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,weather_code",
            "forecast_days": 1,
        },
        timeout=10.0,
    )
    resp.raise_for_status()
    data = resp.json()
    current = data["current"]

    temp_c = round(current["temperature_2m"], 1)
    humidity = current["relative_humidity_2m"]
    wmo_code = current.get("weather_code", 0)
    condition = _WMO_CONDITIONS.get(wmo_code, "Clear")

    return {
        "city": city.title(),
        "temperature": temp_c,
        "humidity": humidity,
        "condition": condition,
        "soil_temp": None,
        "soil_moisture": None,
    }


def _kelvin_to_celsius(k: float) -> float:
    return round(k - 273.15, 1)


def get_weather(city: str) -> dict:
    """
    Fetch current weather for a city.

    Tries AgroMonitoring first (includes soil data).
    Falls back to Open-Meteo (free, no key, always available).

    Returns:
        dict with keys: city, temperature, humidity, condition,
                        soil_temp (None if fallback), soil_moisture (None if fallback)

    Raises:
        ValueError:      city not found via geocoding.
        ConnectionError: network completely unreachable.
    """
    try:
        with httpx.Client() as client:
            # Step 1 — Geocode city → lat/lon (free, always works)
            lat, lon, display_name = _geocode(city, client)
            city_label = city.title()

            # Step 2 — Try AgroMonitoring (preferred, has soil data)
            if AGRO_API_KEY:
                try:
                    weather = _fetch_agro_weather(lat, lon, client)
                    soil    = _fetch_agro_soil(lat, lon, client)

                    city_name = weather.get("name") or city_label
                    result = {
                        "city":          city_name,
                        "temperature":   round(weather["main"]["temp"] - 273.15, 1),
                        "humidity":      weather["main"]["humidity"],
                        "condition":     weather["weather"][0]["main"],
                        "soil_temp":     None,
                        "soil_moisture": None,
                    }
                    if soil:
                        result["soil_temp"]     = _kelvin_to_celsius(soil.get("t0", 0))
                        result["soil_moisture"] = round(soil.get("moisture", 0), 4)
                    return result
                except Exception:
                    # AgroMonitoring failed — fall through to Open-Meteo
                    pass

            # Step 3 — Open-Meteo free fallback (always reliable, no key)
            return _fetch_open_meteo(lat, lon, city_label, client)

    except ValueError:
        raise
    except httpx.RequestError as exc:
        raise ConnectionError(
            f"Unable to reach weather API: {exc}. Check your internet connection."
        )
    except Exception as exc:
        raise ConnectionError(f"Weather lookup failed: {exc}")
