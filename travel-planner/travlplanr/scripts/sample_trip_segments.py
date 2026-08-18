"""Sample trip segments for seed scripts."""

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
}

CITY_AIRPORT: dict[str, str] = {
    "Paris": "CDG",
    "Brussels": "BRU",
    "Barcelona": "BCN",
    "Madrid": "MAD",
    "Amsterdam": "AMS",
    "Rome": "FCO",
    "London": "LHR",
    "Dubai": "DXB",
    "Tokyo": "HND",
    "Bali": "DPS",
    "Singapore": "SIN",
    "Bangkok": "BKK",
    "Sydney": "SYD",
}


def _city_from_destination(destination: str) -> str:
    city = destination.split(",")[0].strip()
    return COUNTRY_PRIMARY_CITY.get(city.lower(), city)


def _airport(city: str) -> str:
    return CITY_AIRPORT.get(city, city[:3].upper() if len(city) >= 3 else "DST")


def build_sample_segments(
    destination: str,
    *,
    num_days: int = 5,
    start: datetime | None = None,
    image: str = "assets/images/landing/figma/belgium.jpg",
) -> list[dict]:
    start = start or (datetime.now() + timedelta(days=21))
    city = _city_from_destination(destination)
    dest_code = _airport(city)

    def day_label(offset: int) -> str:
        return (start + timedelta(days=offset)).strftime("%a %d %B %Y")

    segments: list[dict] = [
        {
            "type": "flight",
            "day": 1,
            "carrier": "Air India",
            "flightNo": "AI194",
            "class": "Economy",
            "refundable": "Partially Refundable",
            "depDate": day_label(0),
            "depTime": "02:30",
            "depCode": "MAA",
            "arrDate": day_label(0),
            "arrTime": "08:45",
            "arrCode": dest_code,
            "duration": "10h 15m",
            "stops": "1 Stop",
            "status": "Pending",
            "price": 42000,
        },
        {
            "type": "hotel",
            "day": 1,
            "name": f"Hotel {city} Central",
            "rating": 4.3,
            "location": f"Downtown {city}",
            "dates": f"{day_label(0)} – {day_label(num_days - 2)}",
            "amenities": ["WiFi", "Breakfast", "Airport Shuttle"],
            "roomType": "Deluxe Double",
            "price": 12000 * max(num_days - 1, 1),
            "imageUrl": image,
        },
        {
            "type": "activity",
            "day": 1,
            "time": f"{day_label(0)} - Morning",
            "title": f"{city} City Highlights Tour",
            "rating": 4.6,
            "location": city,
            "refundable": "Refundable up to 24h",
            "image": image,
            "price": 4500,
        },
        {
            "type": "activity",
            "day": 2,
            "time": f"{day_label(1)} - Fullday",
            "title": f"Guided Cultural Experience in {city}",
            "rating": 4.5,
            "location": city,
            "refundable": "Refundable up to 24h",
            "image": image,
            "price": 5200,
        },
        {
            "type": "car",
            "day": 2,
            "model": "Toyota Camry",
            "category": "Standard Sedan",
            "location": f"{city} Airport",
            "dates": f"{day_label(1)} – {day_label(num_days - 2)}",
            "passengers": 2,
            "gearbox": "Automatic",
            "bags": 2,
            "fuel": "Full to Full",
            "imageUrl": image,
            "price": 15000,
        },
        {
            "type": "activity",
            "day": num_days,
            "time": f"{day_label(num_days - 1)} - Morning",
            "title": f"Final {city} Highlights",
            "rating": 4.4,
            "location": city,
            "refundable": "Refundable up to 24h",
            "image": image,
            "price": 3200,
        },
        {
            "type": "flight",
            "day": num_days,
            "carrier": "Air India",
            "flightNo": "AI195",
            "class": "Economy",
            "refundable": "Partially Refundable",
            "depDate": day_label(num_days - 1),
            "depTime": "12:15",
            "depCode": dest_code,
            "arrDate": day_label(num_days - 1),
            "arrTime": "23:40",
            "arrCode": "MAA",
            "duration": "11h 25m",
            "stops": "1 Stop",
            "status": "Pending",
            "price": 43000,
        },
    ]
    return segments


def build_day_rows(destination: str, num_days: int, segments: list[dict]) -> list[dict]:
    city = destination.split(",")[0].strip()
    rows = []
    for i in range(num_days):
        day_num = i + 1
        acts = [
            s.get("title") or s.get("name", "")
            for s in segments
            if s.get("day") == day_num
        ]
        rows.append({"day": day_num, "title": f"Day {day_num}: {city}", "activities": acts})
    return rows
