"""Build demo day-by-day itinerary segments from a package record."""

from __future__ import annotations

from datetime import datetime, timedelta

COUNTRY_PRIMARY_CITY: dict[str, str] = {
    "belgium": "Brussels",
    "france": "Paris",
    "netherlands": "Amsterdam",
    "italy": "Rome",
    "indonesia": "Bali",
    "uae": "Dubai",
    "switzerland": "Zurich",
    "japan": "Tokyo",
    "spain": "Madrid",
    "uk": "London",
    "germany": "Berlin",
    "thailand": "Bangkok",
    "singapore": "Singapore",
    "australia": "Sydney",
}

def _primary_city(country: str, region: str, title: str) -> str:
    for candidate in (country, region, title):
        key = (candidate or "").lower().strip()
        if key in COUNTRY_PRIMARY_CITY:
            return COUNTRY_PRIMARY_CITY[key]
    return country or region or title


def _airport_code(city: str) -> str:
    from app.services.trip_route import nearest_airport_city
    from shared.airports import airport_code_for_place

    code = airport_code_for_place(city)
    if code:
        return code
    resolved = nearest_airport_city(city)
    code = airport_code_for_place(resolved)
    if code:
        return code
    return resolved[:3].upper() if len(resolved) >= 3 else "DST"


def _parse_days(raw: int | str) -> int:
    if isinstance(raw, int):
        return max(raw, 1)
    digits = "".join(ch for ch in str(raw) if ch.isdigit())
    return max(int(digits) if digits else 5, 1)


def _travelers_from_group(group: str) -> int:
    mapping = {
        "solo": 1,
        "couple": 2,
        "family": 4,
        "group": 2,
    }
    return mapping.get((group or "").lower(), 2)


def _date_label(start: datetime, offset: int) -> str:
    d = start + timedelta(days=offset)
    return d.strftime("%a %d %B %Y")


def build_package_plan(
    *,
    title: str,
    country: str,
    region: str,
    days: int | str,
    group_type: str,
    budget_tier: str,
    image_url: str,
    start_date: str | None = None,
    departure_location: str | None = None,
) -> dict:
    """Return trip fields + segments for the itinerary page."""
    num_days = _parse_days(days)
    travelers = _travelers_from_group(group_type)
    start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.now() + timedelta(days=14)
    end = start + timedelta(days=num_days - 1)

    destination = country or region or title
    city = _primary_city(country, region, title)
    arr_code = _airport_code(city)
    dep_code = _airport_code(departure_location) if departure_location else "BLR"

    segments: list[dict] = []

    def add(day: int, item: dict) -> None:
        segments.append({"day": day, **item})

    add(
        1,
        {
            "type": "flight",
            "carrier": "Air India",
            "flightNo": "AI194",
            "class": "Economy",
            "refundable": "Partially Refundable",
            "depDate": _date_label(start, 0),
            "depTime": "02:30",
            "depCode": dep_code,
            "arrDate": _date_label(start, 0),
            "arrTime": "08:45",
            "arrCode": arr_code,
            "duration": "10h 15m",
            "stops": "1 Stop",
            "status": "Pending",
            "price": 42000,
        },
    )
    add(
        1,
        {
            "type": "car",
            "model": "Toyota Camry",
            "category": "Standard Sedan",
            "location": f"{city} Airport",
            "dates": f"{_date_label(start, 0)} – {_date_label(start, num_days - 2)}",
            "passengers": travelers,
            "gearbox": "Automatic",
            "bags": 2,
            "fuel": "Full to Full",
            "imageUrl": image_url,
            "price": 18000,
        },
    )
    add(
        1,
        {
            "type": "hotel",
            "name": f"Hotel {city} Central",
            "rating": 4.2,
            "location": f"Downtown {city}",
            "dates": f"{_date_label(start, 0)} – {_date_label(start, num_days - 2)}",
            "amenities": ["Free WiFi", "Breakfast", "Airport Shuttle"],
            "roomType": "Deluxe Double",
            "bedPreference": "Queen Bed",
            "cancellation": "Free cancellation until 48h",
            "parking": "Available",
            "imageUrl": image_url,
            "price": 12000 * max(num_days - 1, 1),
        },
    )

    day_activities = [
        (1, f"{city} Grand Place & City Walk (Morning)"),
        (2, f"{city} Museums & Historic Quarter (Fullday)"),
        (3, f"Day Trip — Nearby Highlights (Fullday)"),
        (4, f"Local Food Tour & Shopping (Evening)"),
    ]
    for day_num, act_title in day_activities:
        if day_num > num_days:
            break
        add(
            day_num,
            {
                "type": "activity",
                "time": f"{_date_label(start, day_num - 1)} - Morning",
                "title": act_title,
                "rating": 4.5,
                "location": city,
                # Leave image empty — enrich_itinerary_images fetches a unique
                # activity photo. Stamping image_url here made every card identical.
                "price": 4500,
                "duration": "3–4 hours",
                "source": "template",
                "bookable": False,
            },
        )

    if num_days >= 5:
        add(
            num_days,
            {
                "type": "activity",
                "time": f"{_date_label(start, num_days - 2)} - Morning",
                "title": f"Final {city} Highlights (Halfday)",
                "rating": 4.3,
                "location": city,
                "price": 3200,
                "source": "template",
                "bookable": False,
            },
        )

    add(
        num_days,
        {
            "type": "flight",
            "carrier": "Air India",
            "flightNo": "AI195",
            "class": "Economy",
            "refundable": "Partially Refundable",
            "depDate": _date_label(start, num_days - 1),
            "depTime": "12:15",
            "depCode": arr_code,
            "arrDate": _date_label(start, num_days - 1),
            "arrTime": "23:40",
            "arrCode": dep_code,
            "duration": "11h 25m",
            "stops": "1 Stop",
            "status": "Pending",
            "price": 43000,
        },
    )

    city_days = [{"city": city, "nights": max(num_days - 1, 1)}]
    day_rows = [
        {
            "day": i + 1,
            "title": f"Day {i + 1}: {city}",
            "activities": [s.get("title", s.get("name", "")) for s in segments if s.get("day") == i + 1],
        }
        for i in range(num_days)
    ]

    return {
        "title": title,
        "destination": destination,
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d"),
        "travelers": travelers,
        "travel_style": group_type,
        "travel_method": "flight",
        "budget": budget_tier,
        "interests": ["Sightseeing", "Culture", "Food"],
        "food_preferences": [],
        "image": image_url,
        "days": day_rows,
        "city_days": city_days,
        "segments": segments,
    }
