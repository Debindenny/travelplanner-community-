"""Normalize itinerary segments and derive day rows for the customer UI."""

from __future__ import annotations

from datetime import datetime, timedelta

from app.services.package_plan_builder import _airport_code, _date_label


def _parse_start(start_date: str | None) -> datetime:
    if start_date:
        try:
            return datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            pass
    return datetime.now() + timedelta(days=14)


def normalize_segments(segments: list[dict], trip) -> list[dict]:
    """Ensure each segment has the fields the Angular itinerary page expects."""
    start = _parse_start(getattr(trip, "start_date", None))
    travelers = getattr(trip, "travelers", 2) or 2
    image = getattr(trip, "image", None) or "assets/images/landing/journey-thailand.jpg"
    destination = getattr(trip, "destination", "Destination") or "Destination"
    primary_city = destination.split(",")[0].strip() or "Destination"
    budget_mult = _budget_multiplier(getattr(trip, "budget", None))

    normalized: list[dict] = []
    used_activity_titles: set[str] = set()
    for raw in segments:
        seg = dict(raw)
        day = int(seg.get("day") or 1)
        seg["day"] = day
        seg_type = str(seg.get("type") or "activity").lower()

        if seg_type == "flight":
            dep_code = seg.get("depCode") or seg.get("dep_code") or "MAA"
            arr_code = seg.get("arrCode") or seg.get("arr_code") or _airport_code(primary_city)
            seg.update(
                {
                    "type": "flight",
                    "carrier": seg.get("carrier") or "Air India",
                    "flightNo": seg.get("flightNo") or seg.get("flight_no") or f"AI{100 + day}",
                    "class": seg.get("class") or "Economy",
                    "refundable": seg.get("refundable") or "Partially Refundable",
                    "depDate": _date_label(start, day - 1),
                    "depTime": seg.get("depTime") or "09:00",
                    "depCode": dep_code,
                    "arrDate": _date_label(start, day - 1),
                    "arrTime": seg.get("arrTime") or "18:00",
                    "arrCode": arr_code,
                    "duration": seg.get("duration") or "8h 00m",
                    "stops": seg.get("stops") or "1 Stop",
                    "status": seg.get("status") or "Pending",
                    "price": int(seg.get("price") or round(42000 * budget_mult)),
                }
            )
        elif seg_type == "hotel":
            name = seg.get("name") or seg.get("title") or f"Hotel {primary_city} Central"
            nights = max(int(seg.get("nights") or 1), 1)
            seg.update(
                {
                    "type": "hotel",
                    "name": name,
                    "rating": float(seg.get("rating") or 4.2),
                    "location": seg.get("location") or f"Downtown {primary_city}",
                    "dates": seg.get("dates")
                    or f"{_date_label(start, day - 1)} – {_date_label(start, day - 1 + nights)}",
                    "amenities": seg.get("amenities") or ["Free WiFi", "Breakfast"],
                    "roomType": seg.get("roomType") or "Deluxe Double",
                    "bedPreference": seg.get("bedPreference") or "Queen Bed",
                    "cancellation": seg.get("cancellation") or "Free cancellation until 48h",
                    "parking": seg.get("parking") or "Available",
                    "imageUrl": seg.get("imageUrl") or seg.get("image") or image,
                    "price": int(seg.get("price") or round(12000 * nights * budget_mult)),
                }
            )
        elif seg_type == "car":
            seg.update(
                {
                    "type": "car",
                    "model": seg.get("model") or "Toyota Camry",
                    "category": seg.get("category") or "Standard Sedan",
                    "location": seg.get("location") or f"{primary_city} Airport",
                    "dates": seg.get("dates") or _date_label(start, day - 1),
                    "passengers": int(seg.get("passengers") or travelers),
                    "gearbox": seg.get("gearbox") or "Automatic",
                    "bags": int(seg.get("bags") or 2),
                    "fuel": seg.get("fuel") or "Full to Full",
                    "imageUrl": seg.get("imageUrl") or image,
                    "price": int(seg.get("price") or round(18000 * budget_mult)),
                }
            )
        elif seg_type in {"train", "bus"}:
            dep_loc = seg.get("depLocation") or seg.get("dep_location") or primary_city
            arr_loc = seg.get("arrLocation") or seg.get("arr_location") or destination.split(",")[-1].strip()
            seg.update(
                {
                    "type": seg_type,
                    "carrier": seg.get("carrier") or ("Renfe AVE" if seg_type == "train" else "Intercity Express"),
                    "route": seg.get("route") or f"{dep_loc} → {arr_loc}",
                    "depDate": _date_label(start, day - 1),
                    "depTime": seg.get("depTime") or "08:00",
                    "depLocation": dep_loc,
                    "arrDate": _date_label(start, day - 1),
                    "arrTime": seg.get("arrTime") or "12:00",
                    "arrLocation": arr_loc,
                    "duration": seg.get("duration") or "4h 00m",
                    "stops": seg.get("stops") or "Direct",
                    "price": int(seg.get("price") or round(8500 * budget_mult)),
                    "imageUrl": seg.get("imageUrl") or image,
                }
            )
        else:
            title = seg.get("title") or seg.get("name") or f"{primary_city} Experience"
            # De-dupe repeated activity titles across days
            base_title = title
            suffix = 1
            while title.lower() in used_activity_titles:
                suffix += 1
                title = f"{base_title} (Day {suffix})"
            used_activity_titles.add(title.lower())
            # Only trust a firm cancellation/refund promise when a real inventory
            # record backs this activity — otherwise we'd be inventing a policy
            # that no provider actually offers.
            bookable = bool(seg.get("bookable"))
            source = seg.get("source") or "ai_suggested"
            default_refundable = "Refundable up to 24h" if bookable else "Availability not confirmed — verify before booking"
            # Do NOT fall back to the trip cover / journey-thailand.jpg — that
            # stamped the same demo photo onto every activity. Leave empty so
            # enrich_itinerary_images (or the frontend pool) can pick unique
            # real photos per activity.
            raw_image = seg.get("image") or seg.get("imageUrl")
            activity = {
                "type": "activity",
                "time": seg.get("time") or f"{_date_label(start, day - 1)} - Morning",
                "title": title,
                "rating": float(seg.get("rating") or 4.5),
                "location": seg.get("location") or primary_city,
                "refundable": seg.get("refundable") or default_refundable,
                "price": int(seg.get("price") or round(4500 * budget_mult)),
                "duration": seg.get("duration") or "3–4 hours",
                "source": source,
                "bookable": bookable,
            }
            if raw_image:
                activity["image"] = raw_image
            # Preserve Google Places / Routes enrichment when present.
            for key in (
                "lat",
                "lng",
                "place_id",
                "placeId",
                "travelMinutes",
                "travelDuration",
                "travelDistanceKm",
                "travelMode",
                "travelFrom",
                "weekday_text",
                "open_now",
            ):
                if seg.get(key) is not None:
                    activity[key] = seg[key]
            seg.update(activity)

        normalized.append(seg)
    return normalized


def build_days_from_segments(segments: list[dict], trip) -> list[dict]:
    """Build day-by-day summary rows from segment list."""
    if not segments:
        return []

    destination = getattr(trip, "destination", "Destination") or "Destination"
    cities = [c.strip() for c in destination.split(",") if c.strip()]
    primary_city = cities[0] if cities else destination
    max_day = max(int(s.get("day") or 1) for s in segments)

    day_rows: list[dict] = []
    for day_num in range(1, max_day + 1):
        day_segments = [s for s in segments if int(s.get("day") or 0) == day_num]
        city_for_day = cities[min(day_num - 1, len(cities) - 1)] if cities else primary_city
        activities = [
            s.get("title") or s.get("name") or ""
            for s in day_segments
            if s.get("type") == "activity"
        ]
        day_rows.append(
            {
                "day": day_num,
                "title": f"Day {day_num}: {city_for_day}",
                "activities": activities,
            }
        )
    return day_rows


def _budget_multiplier(budget: str | None) -> float:
    key = (budget or "standard").lower()
    if "budget" in key or "economy" in key:
        return 0.85
    if "premium" in key or "luxury" in key or "mid" in key:
        return 1.15 if "mid" in key else 1.25
    return 1.0
