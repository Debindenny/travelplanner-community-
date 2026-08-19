import asyncio
import sys
import random
from pathlib import Path
from datetime import datetime, timedelta
from itertools import combinations

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

try:
    from services.planner.app.models.inventory import InventoryItem
except ModuleNotFoundError:
    from app.models.inventory import InventoryItem

PLANNER_DB_URL = "postgresql+asyncpg://travlplanr:travlplanr@localhost:5432/planner_db"

CITIES = [
    "Paris", "Tokyo", "Bali", "New York", "Rome", "London", "Dubai", "Sydney",
    "Barcelona", "Maldives", "Brussels", "Amsterdam", "Madrid", "Singapore", "Bangkok",
]

COUNTRY_CITY = {
    "Belgium": "Brussels",
    "France": "Paris",
    "Netherlands": "Amsterdam",
    "Italy": "Rome",
    "Indonesia": "Bali",
    "UAE": "Dubai",
    "Switzerland": "Zurich",
    "Japan": "Tokyo",
    "Spain": "Madrid",
    "UK": "London",
    "Germany": "Berlin",
    "Thailand": "Bangkok",
    "Singapore": "Singapore",
    "Australia": "Sydney",
}

CITY_AIRPORT = {
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
    "New York": "JFK",
    "Chennai": "MAA",
    "Mumbai": "BOM",
    "Zurich": "ZRH",
    "Berlin": "BER",
    "Maldives": "MLE",
}

# Routes used in demo itineraries (Chennai hub + European multi-city)
CORE_FLIGHT_ROUTES = [
    ("MAA", "CDG"), ("CDG", "MAA"),
    ("MAA", "BRU"), ("BRU", "MAA"),
    ("MAA", "BCN"), ("BCN", "MAA"),
    ("MAA", "MAD"), ("MAD", "MAA"),
    ("CDG", "BCN"), ("BCN", "MAD"),
    ("CDG", "BRU"), ("BRU", "AMS"),
    ("LHR", "CDG"), ("DXB", "SIN"), ("SIN", "BKK"),
]

CORE_TRAIN_ROUTES = [
    ("Paris", "Brussels"), ("Brussels", "Amsterdam"), ("Barcelona", "Madrid"),
    ("Paris", "London"), ("Rome", "Madrid"), ("Amsterdam", "Berlin"),
    ("Paris", "Barcelona"), ("Brussels", "Paris"), ("Madrid", "Barcelona"),
]

CORE_BUS_ROUTES = [
    ("Paris", "Brussels"), ("Barcelona", "Madrid"), ("Amsterdam", "Berlin"),
    ("Brussels", "Amsterdam"), ("Paris", "Barcelona"), ("Rome", "Milan"),
]

PROVIDER_LINKS = {
    "travelnext": "https://travelnext.works",
    "tripadvisor": "https://www.tripadvisor.com",
    "google_places": "https://www.google.com/maps/search",
    "google_routes": "https://www.google.com/maps/dir",
}


def _meta(**kwargs) -> dict:
    return kwargs


async def main():
    print("Seeding inventory sample data...")
    import os

    db_url = os.getenv("DATABASE_URL", PLANNER_DB_URL)
    if "postgres:5432" in db_url or os.getenv("DOCKER", "").lower() == "true":
        db_url = db_url.replace("localhost", "postgres")

    engine = create_async_engine(db_url)
    session_factory = async_sessionmaker(engine)

    travel_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

    async with session_factory() as session:
        await session.execute(InventoryItem.__table__.delete())
        await session.commit()

        items: list[InventoryItem] = []
        airlines = ["Air France", "Emirates", "Delta", "Lufthansa", "Singapore Airlines", "Qatar Airways", "Air India"]
        AIRLINE_IATA = {
            "Air France": "AF",
            "Emirates": "EK",
            "Delta": "DL",
            "Lufthansa": "LH",
            "Singapore Airlines": "SQ",
            "Qatar Airways": "QR",
            "Air India": "AI",
        }
        airports = list(set(CITY_AIRPORT.values()))

        # --- Flights: guaranteed options on core routes (mix of economy + standard prices) ---
        for origin, dest in CORE_FLIGHT_ROUTES:
            for i in range(10):
                airline = random.choice(airlines)
                dep_time = f"{random.randint(6, 22):02d}:{random.choice(['00', '15', '30', '45'])}"
                duration_h = random.randint(2, 14)
                arr_h = (int(dep_time[:2]) + duration_h) % 24
                arr_time = f"{arr_h:02d}:{dep_time[3:]}"
                price = random.randint(89, 220) if i < 5 else random.randint(180, 1800)
                cabin = "economy" if price <= 220 else random.choice(["premium_economy", "business"])
                flight_no = f"{airline[:2].upper()}{random.randint(100, 9999)}"
                items.append(
                    InventoryItem(
                        item_type="flight",
                        provider="travelnext",
                        title=f"{origin} → {dest}, {airline} {flight_no}",
                        subtitle=f"Direct • {duration_h}h {random.randint(0, 59)}m",
                        price_amount=price,
                        price_currency="USD",
                        metadata_json=_meta(
                            airline=airline,
                            carrier=airline,
                            airline_code=AIRLINE_IATA.get(airline, airline[:2].upper()),
                            origin=origin,
                            destination=dest,
                            depCode=origin,
                            arrCode=dest,
                            flight_number=flight_no,
                            cabin_class=cabin,
                            start_time=dep_time,
                            end_time=arr_time,
                            duration=f"{duration_h}h {random.randint(0, 59)}m",
                            travel_date=travel_date,
                            stops="Direct",
                            deep_link=f"{PROVIDER_LINKS['travelnext']}/flights?o={origin}&d={dest}&date={travel_date}",
                        ),
                    )
                )

        # Extra random flights
        for _ in range(80):
            airline = random.choice(airlines)
            origin = random.choice(airports)
            dest = random.choice([a for a in airports if a != origin])
            dep_time = f"{random.randint(6, 22):02d}:00"
            duration_h = random.randint(2, 12)
            arr_h = (int(dep_time[:2]) + duration_h) % 24
            arr_time = f"{arr_h:02d}:00"
            flight_no = f"{airline[:2].upper()}{random.randint(100, 9999)}"
            items.append(
                InventoryItem(
                    item_type="flight",
                    provider="travelnext",
                    title=f"{origin} → {dest}, {airline} {flight_no}",
                    subtitle=f"Direct • {duration_h}h",
                    price_amount=random.randint(150, 1600),
                    price_currency="USD",
                    metadata_json=_meta(
                        airline=airline,
                        carrier=airline,
                        airline_code=AIRLINE_IATA.get(airline, airline[:2].upper()),
                        origin=origin,
                        destination=dest,
                        flight_number=flight_no,
                        start_time=dep_time,
                        end_time=arr_time,
                        duration=f"{duration_h}h",
                        travel_date=travel_date,
                        stops="Direct",
                        deep_link=f"{PROVIDER_LINKS['travelnext']}/flights?o={origin}&d={dest}&date={travel_date}",
                    ),
                )
            )

        hotel_brands = ["Grand Plaza", "Seaside Resort", "City Center Inn", "Luxury Suites", "Boutique Stay"]
        car_types = ["Economy Sedan", "Luxury SUV", "Compact", "Convertible", "Minivan", "Standard Sedan"]
        car_locations = ["{city}", "{city} Airport", "Downtown {city}", "{city} Central Station"]

        all_places = list(dict.fromkeys(CITIES + list(COUNTRY_CITY.values())))

        for city in all_places:
            for brand in random.sample(hotel_brands, k=min(3, len(hotel_brands))):
                rating = round(random.uniform(3.8, 5.0), 1)
                items.append(
                    InventoryItem(
                        item_type="hotel",
                        provider="travelnext",
                        title=f"{brand} {city}",
                        subtitle=f"{rating}★ • Downtown {city}",
                        price_amount=random.randint(60, 900),
                        price_currency="USD",
                        metadata_json=_meta(
                            city=city,
                            location=f"Downtown {city}",
                            rating=rating,
                            amenities=random.sample(["WiFi", "Pool", "Gym", "Breakfast", "Spa", "Parking"], k=3),
                            start_time="15:00",
                            end_time="11:00",
                            duration="Per night",
                            deep_link=f"{PROVIDER_LINKS['travelnext']}?ss={city.replace(' ', '+')}",
                        ),
                    )
                )

            for loc_template in car_locations:
                loc = loc_template.format(city=city)
                for ctype in random.sample(car_types, k=3):
                    items.append(
                        InventoryItem(
                            item_type="car",
                            provider="travelnext",
                            title=f"{ctype} in {loc}",
                            subtitle="Unlimited mileage",
                            price_amount=random.randint(35, 180),
                            price_currency="USD",
                            metadata_json=_meta(
                                city=city,
                                location=loc,
                                type=ctype,
                                transmission=random.choice(["Automatic", "Manual"]),
                                duration="Per day",
                                deep_link=f"{PROVIDER_LINKS['travelnext']}?city={city.replace(' ', '+')}",
                            ),
                        )
                    )

        # Country-labelled cars/hotels (matches package_plan_builder country names)
        for country, city in COUNTRY_CITY.items():
            for ctype in car_types[:4]:
                loc = f"{country} Airport"
                items.append(
                    InventoryItem(
                        item_type="car",
                        provider="travelnext",
                        title=f"{ctype} in {loc}",
                        subtitle="Unlimited mileage",
                        price_amount=random.randint(40, 200),
                        price_currency="USD",
                        metadata_json=_meta(
                            city=city,
                            location=loc,
                            country=country,
                            type=ctype,
                            transmission="Automatic",
                            duration="Per day",
                            deep_link=f"{PROVIDER_LINKS['travelnext']}?city={city.replace(' ', '+')}",
                        ),
                    )
                )

        train_ops = ["Eurostar", "SNCF", "Renfe AVE", "Amtrak", "Shinkansen", "Trenitalia", "Thalys"]
        for origin, dest in CORE_TRAIN_ROUTES:
            for _ in range(6):
                op = random.choice(train_ops)
                dep_time = f"{random.randint(6, 20):02d}:00"
                origin_code = CITY_AIRPORT.get(origin, origin[:3].upper())
                dest_code = CITY_AIRPORT.get(dest, dest[:3].upper())
                items.append(
                    InventoryItem(
                        item_type="train",
                        provider="google_routes",
                        title=f"{op}: {origin} → {dest}",
                        subtitle="High-speed rail",
                        price_amount=random.randint(25, 220),
                        price_currency="USD",
                        metadata_json=_meta(
                            operator=op,
                            origin=origin_code,
                            destination=dest_code,
                            departure=origin,
                            arrival=dest,
                            depLocation=origin,
                            arrLocation=dest,
                            cabin_class=random.choice(["Standard", "First Class"]),
                            start_time=dep_time,
                            end_time=f"{(int(dep_time[:2]) + random.randint(2, 5)) % 24:02d}:30",
                            duration=f"{random.randint(2, 5)}h",
                            deep_link=f"{PROVIDER_LINKS['google_routes']}/{origin}/{dest}",
                        ),
                    )
                )

        for origin, dest in combinations(CITIES, 2):
            if (origin, dest) in CORE_TRAIN_ROUTES or (dest, origin) in CORE_TRAIN_ROUTES:
                continue
            op = random.choice(train_ops)
            items.append(
                InventoryItem(
                    item_type="train",
                    provider="google_routes",
                    title=f"{op}: {origin} → {dest}",
                    subtitle="Regional rail",
                    price_amount=random.randint(20, 180),
                    price_currency="USD",
                    metadata_json=_meta(
                        operator=op,
                        origin=CITY_AIRPORT.get(origin, origin[:3].upper()),
                        destination=CITY_AIRPORT.get(dest, dest[:3].upper()),
                        departure=origin,
                        arrival=dest,
                        depLocation=origin,
                        arrLocation=dest,
                        start_time=f"{random.randint(7, 18):02d}:00",
                        duration=f"{random.randint(2, 6)}h",
                        deep_link=f"{PROVIDER_LINKS['google_routes']}/{origin}/{dest}",
                    ),
                )
            )

        bus_ops = ["FlixBus", "Greyhound", "Megabus", "National Express", "Eurolines"]
        for origin, dest in CORE_BUS_ROUTES:
            for _ in range(5):
                op = random.choice(bus_ops)
                items.append(
                    InventoryItem(
                        item_type="bus",
                        provider="google_routes",
                        title=f"{op}: {origin} → {dest}",
                        subtitle="Comfort coach",
                        price_amount=random.randint(12, 85),
                        price_currency="USD",
                        metadata_json=_meta(
                            operator=op,
                            origin=CITY_AIRPORT.get(origin, origin[:3].upper()),
                            destination=CITY_AIRPORT.get(dest, dest[:3].upper()),
                            departure=origin,
                            arrival=dest,
                            depLocation=origin,
                            arrLocation=dest,
                            start_time=f"{random.randint(7, 18):02d}:30",
                            duration=f"{random.randint(3, 8)}h",
                            deep_link=f"{PROVIDER_LINKS['google_routes']}/{origin}/{dest}/bus",
                        ),
                    )
                )

        activities = [
            "Eiffel Tower Skip-the-Line", "Louvre Museum Guided Tour", "Montserrat Day Trip",
            "Gothic Quarter Walk", "Sunset Cruise", "Cooking Class", "Wine Tasting",
            "Scuba Diving", "Helicopter Ride", "City Bike Tour", "Flamenco Show",
            "Versailles Palace Tour", "Grand Place Walking Tour", "Atomium Visit",
            "Canal Cruise", "Safari World", "Temple Tour", "Desert Safari",
        ]
        for city in all_places:
            for act in random.sample(activities, k=min(6, len(activities))):
                items.append(
                    InventoryItem(
                        item_type="activity",
                        provider="tripadvisor",
                        title=f"{act} — {city}",
                        subtitle="Guided experience",
                        price_amount=random.randint(25, 350),
                        price_currency="USD",
                        metadata_json=_meta(
                            city=city,
                            location=city,
                            activity_type=act.split()[0],
                            duration_hours=random.randint(1, 8),
                            rating=round(random.uniform(4.0, 5.0), 1),
                            start_time=f"{random.randint(8, 16):02d}:00",
                            duration=f"{random.randint(2, 6)} hours",
                            deep_link=f"{PROVIDER_LINKS['tripadvisor']}?text={act.replace(' ', '+')}+{city}",
                        ),
                    )
                )

        places = [
            "Eiffel Tower", "Colosseum", "Burj Khalifa", "Sydney Opera House",
            "Louvre Museum", "Sagrada Familia", "Grand Place Brussels", "Atomium",
            "Big Ben", "Marina Bay Sands", "Wat Arun", "Central Park",
        ]
        for city in all_places:
            for place in random.sample(places, k=3):
                items.append(
                    InventoryItem(
                        item_type="place",
                        provider="google_places",
                        title=f"{place}, {city}",
                        subtitle="Landmark",
                        price_amount=0,
                        price_currency="USD",
                        metadata_json=_meta(
                            city=city,
                            location=city,
                            category="Landmark",
                            rating=round(random.uniform(4.3, 5.0), 1),
                            deep_link=f"{PROVIDER_LINKS['google_places']}/{place.replace(' ', '+')}+{city}",
                        ),
                    )
                )

        session.add_all(items)
        await session.commit()
        print(f"Inserted {len(items)} inventory items (flights, hotels, cars, trains, buses, activities, places).")


if __name__ == "__main__":
    asyncio.run(main())
