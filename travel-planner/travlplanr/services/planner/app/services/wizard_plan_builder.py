"""Build a complete fallback itinerary when AI generation is unavailable."""

from __future__ import annotations

from datetime import datetime, timedelta

from app.services.package_plan_builder import _airport_code, _date_label, _primary_city

# ---------------------------------------------------------------------------
# Activity & transport catalogues — unique, city-aware suggestions
# ---------------------------------------------------------------------------

INTEREST_ACTIVITIES: dict[str, list[str]] = {
    "adventure": [
        "{city} Zip-line & Canyon Adventure (Fullday)",
        "{city} Kayaking & River Rafting (Morning)",
        "{city} Mountain Biking Trail (Halfday)",
        "{city} Rock Climbing Experience (Morning)",
    ],
    "beach": [
        "{city} Beach Club & Water Sports (Fullday)",
        "{city} Snorkelling & Coral Reef Tour (Morning)",
        "{city} Sunset Beach Walk & BBQ (Evening)",
        "{city} Island Hopping Cruise (Fullday)",
    ],
    "culture": [
        "{city} Old Town Heritage Walk (Morning)",
        "{city} Museum & Gallery Pass (Fullday)",
        "{city} Traditional Craft Workshop (Afternoon)",
        "{city} Historic Quarter Night Tour (Evening)",
    ],
    "food": [
        "{city} Street Food Tasting Tour (Evening)",
        "{city} Local Market & Cooking Class (Morning)",
        "{city} Michelin-Guide Food Crawl (Evening)",
        "{city} Wine / Tea Pairing Experience (Afternoon)",
    ],
    "nightlife": [
        "{city} Rooftop Bar Hop (Evening)",
        "{city} Live Music & Jazz Club (Night)",
        "{city} Night Market & Street Performers (Evening)",
    ],
    "nature": [
        "{city} National Park Day Trip (Fullday)",
        "{city} Botanical Garden & Birdwatching (Morning)",
        "{city} Scenic Hiking Trail (Halfday)",
        "{city} Waterfall & Forest Walk (Fullday)",
    ],
    "city": [
        "{city} Skyline Observation Deck (Morning)",
        "{city} Neighbourhood Walking Tour (Morning)",
        "{city} Urban Architecture Tour (Afternoon)",
        "{city} City Lights Night Cruise (Evening)",
    ],
    "shopping": [
        "{city} Designer Outlet Shopping Trip (Fullday)",
        "{city} Local Artisan Market Tour (Morning)",
        "{city} Luxury Mall & Souvenir Hunt (Afternoon)",
    ],
}

CITY_LANDMARKS: dict[str, list[str]] = {
    "paris": [
        "Eiffel Tower Skip-the-Line Tour (Morning)",
        "Louvre Museum Masterpieces (Fullday)",
        "Montmartre & Sacré-Cœur Walk (Evening)",
        "Versailles Palace Day Trip (Fullday)",
        "Seine River Dinner Cruise (Evening)",
    ],
    "london": [
        "Tower of London & Crown Jewels (Morning)",
        "British Museum Highlights (Fullday)",
        "Westminster & Big Ben Walk (Afternoon)",
        "Buckingham Palace Changing of the Guard (Morning)",
        "Thames River Cruise (Evening)",
    ],
    "barcelona": [
        "Sagrada Família Guided Tour (Morning)",
        "Gothic Quarter & Las Ramblas (Afternoon)",
        "Park Güell & Gaudí Architecture (Fullday)",
        "Tapas & Flamenco Evening (Evening)",
    ],
    "madrid": [
        "Royal Palace & Almudena Cathedral (Morning)",
        "Prado Museum Art Tour (Fullday)",
        "Retiro Park & Crystal Palace (Afternoon)",
        "Flamenco Show & Dinner (Evening)",
    ],
    "amsterdam": [
        "Canal Cruise & Anne Frank House (Morning)",
        "Van Gogh Museum & Rijksmuseum (Fullday)",
        "Jordaan District Food Walk (Evening)",
        "Keukenhof / Tulip Fields Day Trip (Fullday)",
    ],
    "berlin": [
        "Brandenburg Gate & Reichstag Tour (Morning)",
        "East Side Gallery & Cold War Walk (Afternoon)",
        "Museum Island Pass (Fullday)",
        "Kreuzberg Street Art Tour (Evening)",
    ],
    "prague": [
        "Prague Castle & St Vitus Cathedral (Morning)",
        "Charles Bridge & Old Town Square (Afternoon)",
        "Bohemian Dinner & Folk Show (Evening)",
        "Český Krumlov Day Trip (Fullday)",
    ],
    "vienna": [
        "Schönbrunn Palace & Gardens (Morning)",
        "Hofburg & Spanish Riding School (Afternoon)",
        "Classical Concert at Musikverein (Evening)",
        "Wachau Valley Wine Tour (Fullday)",
    ],
    "dubai": [
        "Burj Khalifa At the Top (Morning)",
        "Desert Safari & Dune Bashing (Evening)",
        "Dubai Marina Yacht Cruise (Evening)",
        "Old Dubai Souks & Abra Ride (Morning)",
    ],
    "abu dhabi": [
        "Sheikh Zayed Grand Mosque Tour (Morning)",
        "Louvre Abu Dhabi (Fullday)",
        "Yas Island Theme Park Day (Fullday)",
        "Corniche Sunset Walk (Evening)",
    ],
    "singapore": [
        "Gardens by the Bay & Cloud Forest (Morning)",
        "Marina Bay Sands SkyPark (Afternoon)",
        "Chinatown Heritage Trail (Morning)",
        "Night Safari Experience (Night)",
    ],
    "bali": [
        "Ubud Rice Terraces & Temple Tour (Fullday)",
        "Tanah Lot Sunset Temple (Evening)",
        "Balinese Cooking Class (Morning)",
        "Mount Batur Sunrise Trek (Morning)",
    ],
    "tokyo": [
        "Senso-ji Temple & Asakusa Walk (Morning)",
        "Shibuya & Harajuku Culture Tour (Afternoon)",
        "Tsukiji Outer Market Food Tour (Morning)",
        "TeamLab Borderless (Evening)",
    ],
    "bangkok": [
        "Grand Palace & Wat Pho (Morning)",
        "Floating Market Day Trip (Fullday)",
        "Chinatown Street Food Tour (Evening)",
        "Rooftop Bar Sunset (Evening)",
    ],
    "athens": [
        "Acropolis & Parthenon Guided Tour (Morning)",
        "Plaka District Walk (Afternoon)",
        "Delphi Day Trip (Fullday)",
        "Greek Taverna Dinner (Evening)",
    ],
    "sydney": [
        "Sydney Opera House Guided Tour (Morning)",
        "Bondi to Coogee Coastal Walk (Afternoon)",
        "Harbour Bridge Climb Experience (Morning)",
        "Blue Mountains Day Trip (Fullday)",
        "Darling Harbour Dinner Cruise (Evening)",
    ],
    "melbourne": [
        "Federation Square & Street Art Tour (Morning)",
        "Great Ocean Road Day Trip (Fullday)",
        "Queen Victoria Market Food Walk (Morning)",
        "Phillip Island Penguin Parade (Evening)",
        "Yarra Valley Wine Tasting (Afternoon)",
    ],
    "brisbane": [
        "South Bank Parklands & Wheel (Morning)",
        "Lone Pine Koala Sanctuary (Afternoon)",
        "Moreton Island Snorkel Day Trip (Fullday)",
        "Story Bridge Adventure Climb (Evening)",
    ],
    "cairns": [
        "Great Barrier Reef Snorkel Cruise (Fullday)",
        "Daintree Rainforest & Cape Tribulation (Fullday)",
        "Kuranda Scenic Railway (Morning)",
        "Esplanade Lagoon Sunset Walk (Evening)",
    ],
    "perth": [
        "Kings Park Botanic Garden Walk (Morning)",
        "Rottnest Island Quokka Day Trip (Fullday)",
        "Fremantle Markets & Prison Tour (Afternoon)",
        "Swan Valley Wine & Cheese Tasting (Afternoon)",
    ],
    "gold coast": [
        "Surfers Paradise Beach & SkyPoint (Morning)",
        "Theme Park Day — Movie World (Fullday)",
        "Currumbin Wildlife Sanctuary (Afternoon)",
        "Hinterland Rainforest Waterfall Walk (Fullday)",
    ],
    "australia": [
        "Iconic Landmarks & Harbour Cruise (Fullday)",
        "Indigenous Culture & Art Experience (Afternoon)",
        "Coastal Scenic Drive & Lookouts (Fullday)",
        "Wildlife Park & Native Animal Encounter (Morning)",
    ],
}

DEFAULT_LANDMARKS = [
    "{city} Iconic Landmarks Tour (Morning)",
    "{city} Hidden Gems Walking Tour (Afternoon)",
    "{city} Local Market & Culture Walk (Morning)",
    "{city} Sunset Viewpoint Experience (Evening)",
    "{city} Countryside Day Excursion (Fullday)",
    "{city} Food & Nightlife Discovery (Evening)",
]

STOPOVER_ACTIVITIES = [
    "Scenic Stopover — Historic Town Walk (Halfday)",
    "En-route Wine Tasting Break (Afternoon)",
    "Layover City Highlights Express Tour (Halfday)",
    "Countryside Photo Stop & Local Lunch (Afternoon)",
    "Border Town Market Visit (Morning)",
]

TIME_SLOTS = ["Morning", "Afternoon", "Evening", "Fullday", "Halfday", "Night"]


def _budget_multiplier(budget: str | None) -> float:
    key = (budget or "standard").lower()
    if "budget" in key or "economy" in key:
        return 0.85
    if "premium" in key or "luxury" in key:
        return 1.25
    if "mid" in key:
        return 1.1
    return 1.0


def _parse_start(start_date: str | None) -> datetime:
    if start_date:
        try:
            return datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            pass
    return datetime.now() + timedelta(days=14)


def _city_key(city: str) -> str:
    return city.lower().strip().split(",")[0]


def _landmarks_for_city(city: str) -> list[str]:
    key = _city_key(city)
    for candidate in (key, key.split()[0]):
        if candidate in CITY_LANDMARKS:
            return CITY_LANDMARKS[candidate]
    return [t.replace("{city}", city) for t in DEFAULT_LANDMARKS]


def _interest_pool(interests: list[str], city: str) -> list[str]:
    pool: list[str] = []
    for interest in interests:
        key = interest.lower().strip()
        for catalog_key, templates in INTEREST_ACTIVITIES.items():
            if catalog_key in key or key in catalog_key:
                pool.extend(t.replace("{city}", city) for t in templates)
    return pool


class _ActivityPicker:
    """Pick unique activity titles across the whole trip."""

    def __init__(self, interests: list[str]) -> None:
        self._used: set[str] = set()
        self._interests = interests
        self._global_idx = 0

    def pick(self, city: str, *, stopover: bool = False) -> tuple[str, str]:
        if stopover:
            title = STOPOVER_ACTIVITIES[self._global_idx % len(STOPOVER_ACTIVITIES)]
            self._global_idx += 1
            time_label = "Afternoon"
            return title, time_label

        candidates: list[str] = []
        candidates.extend(_landmarks_for_city(city))
        candidates.extend(_interest_pool(self._interests, city))

        # De-dupe candidate list while preserving order
        seen: set[str] = set()
        unique_candidates = []
        for c in candidates:
            if c not in seen:
                seen.add(c)
                unique_candidates.append(c)

        title = None
        for _ in range(len(unique_candidates) + 5):
            if unique_candidates:
                candidate = unique_candidates[self._global_idx % len(unique_candidates)]
            else:
                candidate = DEFAULT_LANDMARKS[self._global_idx % len(DEFAULT_LANDMARKS)].replace("{city}", city)
            self._global_idx += 1
            if candidate not in self._used:
                title = candidate
                break
            # Append a variant suffix if we've exhausted unique titles
            variant = f"{candidate} — Day {self._global_idx}"
            if variant not in self._used:
                title = variant
                break

        title = title or f"{city} Local Experience ({TIME_SLOTS[self._global_idx % len(TIME_SLOTS)]})"
        self._used.add(title)

        time_label = "Morning"
        for slot in TIME_SLOTS:
            if f"({slot})" in title:
                time_label = slot
                break
        return title, time_label


def _choose_inter_city_transport(
    from_city: str,
    to_city: str,
    travel_method: str | None,
    budget: str | None,
    day_index: int,
) -> str:
    """Return segment type: train, flight, bus, or car."""
    method = (travel_method or "").lower()
    if method in {"rental_car", "car", "rental car"}:
        return "car"
    if method in {"cab_taxi", "cab", "taxi"}:
        return "bus"  # rendered as ground transfer in UI

    budget_key = (budget or "").lower()
    if "budget" in budget_key or "economy" in budget_key:
        return "bus" if day_index % 2 == 0 else "train"
    # Alternate between train and flight for variety on standard/premium
    return "train" if day_index % 2 == 0 else "flight"


def build_wizard_plan(
    *,
    destination: str,
    city_days: list[dict] | None,
    start_date: str,
    end_date: str,
    travelers: int,
    travel_style: str | None,
    travel_method: str | None,
    budget: str | None,
    interests: list[str] | None,
    image: str | None = None,
    departure_location: str | None = None,
    arrival_location: str | None = None,
) -> dict:
    """Return segments + day rows shaped like package_plan_builder output."""
    image_url = image or "assets/images/landing/journey-thailand.jpg"
    budget_mult = _budget_multiplier(budget)
    interests = interests or ["Sightseeing", "Culture", "Food"]
    start = _parse_start(start_date)
    picker = _ActivityPicker(interests)

    if city_days:
        plan_cities = [
            {"city": str(c.get("city") or destination).strip(), "nights": max(int(c.get("nights") or 1), 1)}
            for c in city_days
            if str(c.get("city") or "").strip()
        ]
    else:
        cities = [c.strip() for c in destination.split(",") if c.strip()]
        if not cities:
            cities = [destination or "Destination"]
        nights_each = max(
            1,
            (
                datetime.strptime(end_date, "%Y-%m-%d") - datetime.strptime(start_date, "%Y-%m-%d")
            ).days
            // max(len(cities), 1),
        ) if start_date and end_date else 3
        plan_cities = [{"city": c, "nights": nights_each} for c in cities]

    if not plan_cities:
        plan_cities = [{"city": _primary_city(destination, destination, destination), "nights": 3}]

    total_nights = sum(c["nights"] for c in plan_cities)
    num_days = max(total_nights + 1, 2)
    end = start + timedelta(days=num_days - 1)

    segments: list[dict] = []
    day_city_map: dict[int, str] = {}

    def add(day: int, item: dict) -> None:
        segments.append({"day": day, **item})

    first_city = plan_cities[0]["city"]
    first_label = _primary_city(first_city, first_city, first_city)
    first_code = _airport_code(arrival_location or first_label)
    last_city = plan_cities[-1]["city"]
    last_label = _primary_city(last_city, last_city, last_city)
    last_code = _airport_code(arrival_location or last_label)
    origin_label = (
        _primary_city(departure_location, departure_location, departure_location)
        if departure_location
        else "Chennai"
    )
    origin_code = _airport_code(origin_label) if departure_location else "MAA"
    use_rental_car = (travel_method or "").lower() in {"rental_car", "car", "rental car"}

    # Outbound flight
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
            "depCode": origin_code,
            "depLocation": origin_label,
            "arrDate": _date_label(start, 0),
            "arrTime": "08:45",
            "arrCode": first_code,
            "arrLocation": first_label,
            "duration": "10h 15m",
            "stops": "1 Stop",
            "status": "Pending",
            "price": int(42000 * budget_mult),
        },
    )

    # Airport → hotel transfer
    add(
        1,
        {
            "type": "bus",
            "carrier": "Airport Express Shuttle",
            "route": f"{first_code} Airport → {first_label} Hotel",
            "depDate": _date_label(start, 0),
            "depTime": "09:30",
            "depLocation": f"{first_label} Airport",
            "arrDate": _date_label(start, 0),
            "arrTime": "10:30",
            "arrLocation": f"Downtown {first_label}",
            "duration": "1h 00m",
            "stops": "Direct",
            "price": int(1200 * budget_mult),
            "imageUrl": image_url,
        },
    )

    day_cursor = 1
    for idx, entry in enumerate(plan_cities):
        city = entry["city"]
        nights = entry["nights"]
        city_label = _primary_city(city, city, city)
        arr_code = _airport_code(city_label)
        hotel_start_offset = day_cursor - 1
        hotel_end_offset = hotel_start_offset + max(nights - 1, 0)

        for night_idx in range(nights):
            day_city_map[day_cursor + night_idx] = city_label

        if use_rental_car and idx == 0:
            add(
                day_cursor,
                {
                    "type": "car",
                    "model": "Toyota Camry",
                    "category": "Standard Sedan",
                    "location": f"{city_label} — trip-wide rental",
                    "dates": f"{_date_label(start, hotel_start_offset)} – {_date_label(start, total_nights - 1)}",
                    "passengers": travelers,
                    "gearbox": "Automatic",
                    "bags": 2,
                    "fuel": "Full to Full",
                    "imageUrl": image_url,
                    "price": int(18000 * budget_mult),
                },
            )

        add(
            day_cursor,
            {
                "type": "hotel",
                "name": f"Hotel {city_label} Central",
                "rating": 4.2,
                "location": f"Downtown {city_label}",
                "dates": f"{_date_label(start, hotel_start_offset)} – {_date_label(start, hotel_end_offset)}",
                "amenities": ["Free WiFi", "Breakfast", "Airport Shuttle"],
                "roomType": "Deluxe Double",
                "bedPreference": "Queen Bed",
                "cancellation": "Free cancellation until 48h",
                "parking": "Available",
                "imageUrl": image_url,
                "price": int(12000 * nights * budget_mult),
            },
        )

        for night_idx in range(nights):
            current_day = day_cursor + night_idx
            if current_day >= num_days:
                break
            title, time_label = picker.pick(city_label)
            add(
                current_day,
                {
                    "type": "activity",
                    "time": f"{_date_label(start, current_day - 1)} - {time_label}",
                    "title": title,
                    "rating": round(4.2 + (night_idx % 3) * 0.1, 1),
                    "location": city_label,
                    # Leave empty so enrich_itinerary_images can fetch unique photos.
                    "price": int((3800 + night_idx * 400 + idx * 300) * budget_mult),
                    "duration": "3–5 hours" if time_label in {"Fullday", "Halfday"} else "2–3 hours",
                    "source": "template",
                    "bookable": False,
                },
            )

        # Inter-city transfer + optional stopover activity
        if idx < len(plan_cities) - 1:
            next_city = plan_cities[idx + 1]["city"]
            next_label = _primary_city(next_city, next_city, next_city)
            transfer_day = day_cursor + nights - 1
            if transfer_day < num_days:
                day_city_map[transfer_day] = f"{city_label} → {next_label}"
                transport_type = _choose_inter_city_transport(
                    city_label, next_label, travel_method, budget, idx
                )

                if transport_type == "train":
                    add(
                        transfer_day,
                        {
                            "type": "train",
                            "carrier": "EuroRail Express" if idx % 2 == 0 else "Renfe AVE",
                            "route": f"{city_label} → {next_label}",
                            "depDate": _date_label(start, transfer_day - 1),
                            "depTime": "08:00",
                            "depLocation": f"{city_label} Central Station",
                            "arrDate": _date_label(start, transfer_day - 1),
                            "arrTime": "12:30",
                            "arrLocation": f"{next_label} Central Station",
                            "duration": "4h 30m",
                            "stops": "Direct",
                            "price": int(8500 * budget_mult),
                            "imageUrl": image_url,
                        },
                    )
                elif transport_type == "bus":
                    add(
                        transfer_day,
                        {
                            "type": "bus",
                            "carrier": "FlixBus Intercity",
                            "route": f"{city_label} → {next_label}",
                            "depDate": _date_label(start, transfer_day - 1),
                            "depTime": "07:30",
                            "depLocation": f"{city_label} Bus Terminal",
                            "arrDate": _date_label(start, transfer_day - 1),
                            "arrTime": "13:00",
                            "arrLocation": f"{next_label} Bus Terminal",
                            "duration": "5h 30m",
                            "stops": "1 Stop",
                            "price": int(3500 * budget_mult),
                            "imageUrl": image_url,
                        },
                    )
                elif transport_type == "car":
                    add(
                        transfer_day,
                        {
                            "type": "car",
                            "model": "Toyota Camry" if use_rental_car else "Private Transfer Sedan",
                            "category": "Self-drive Route" if use_rental_car else "Inter-city Transfer",
                            "location": f"{city_label} → {next_label}",
                            "dates": _date_label(start, transfer_day - 1),
                            "passengers": travelers,
                            "gearbox": "Automatic",
                            "bags": 2,
                            "fuel": "Included" if use_rental_car else "Full to Full",
                            "imageUrl": image_url,
                            "price": 0 if use_rental_car else int(6500 * budget_mult),
                        },
                    )
                else:
                    add(
                        transfer_day,
                        {
                            "type": "flight",
                            "carrier": "Regional Air",
                            "flightNo": f"RA{300 + idx}",
                            "class": "Economy",
                            "refundable": "Partially Refundable",
                            "depDate": _date_label(start, transfer_day - 1),
                            "depTime": "10:00",
                            "depCode": arr_code,
                            "arrDate": _date_label(start, transfer_day - 1),
                            "arrTime": "12:00",
                            "arrCode": _airport_code(next_label),
                            "duration": "2h 00m",
                            "stops": "Non-stop",
                            "status": "Pending",
                            "price": int(18000 * budget_mult),
                        },
                    )

                # Stopover activity en route between cities
                stopover_title, stopover_time = picker.pick(city_label, stopover=True)
                add(
                    transfer_day,
                    {
                        "type": "activity",
                        "time": f"{_date_label(start, transfer_day - 1)} - {stopover_time}",
                        "title": stopover_title,
                        "rating": 4.4,
                        "location": f"En route: {city_label} → {next_label}",
                        "price": int(3200 * budget_mult),
                        "duration": "2–3 hours",
                        "source": "template",
                        "bookable": False,
                        "isStopover": True,
                    },
                )

        day_cursor += nights

    # Return flight on final day
    day_city_map[num_days] = last_label
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
            "depCode": last_code,
            "depLocation": last_label,
            "arrDate": _date_label(start, num_days - 1),
            "arrTime": "23:40",
            "arrCode": origin_code,
            "arrLocation": origin_label,
            "duration": "11h 25m",
            "stops": "1 Stop",
            "status": "Pending",
            "price": int(43000 * budget_mult),
        },
    )

    day_rows = [
        {
            "day": i + 1,
            "title": f"Day {i + 1}: {day_city_map.get(i + 1, plan_cities[0]['city'])}",
            "activities": [
                s.get("title", s.get("name", ""))
                for s in segments
                if s.get("day") == i + 1 and s.get("type") == "activity"
            ],
        }
        for i in range(num_days)
    ]

    return {
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d"),
        "days": day_rows,
        "city_days": plan_cities,
        "segments": segments,
    }
