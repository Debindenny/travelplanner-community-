"""Add trip template support and seed 4 real "clone-able" template itineraries

Revision ID: 0034_trip_templates
Revises: 0033_story_media_optional
Create Date: 2026-09-08 00:00:00.000000

Backs the community "Trips" browse page ("Real itineraries you can clone")
with real `trips` rows instead of the frontend's hardcoded COMMUNITY_TRIPS
mock array (apps/web .../circles-trips/features/community-trips/data). That
mock page's View itinerary / Clone / Save buttons never called the backend at
all — this migration adds the columns that mark a trip as a public,
clonable template, then seeds the same 4 itineraries the mock data showed
(same authors/customer_ids as apps/web's community-mock-users.ts registry,
same Unsplash images) so the page can be switched to the real API.
"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = '0034_trip_templates'
down_revision: Union[str, Sequence[str], None] = '0033_story_media_optional'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'


def _activity(day, time, title, rating=4.6, duration="2 hours"):
    return {
        "type": "activity", "day": day, "time": time, "title": title,
        "rating": rating, "location": title, "refundable": "Free cancellation",
        "duration": duration,
    }


def _hotel(day, name, location, dates):
    return {
        "type": "hotel", "day": day, "name": name, "rating": 4.5, "location": location,
        "dates": dates, "amenities": ["Free WiFi", "Breakfast included", "24-hour front desk"],
    }


def _flight(day, dep_code, arr_code, date_):
    return {
        "type": "flight", "day": day, "carrier": "Skyline Air", "flightNo": "SA204",
        "class": "Economy", "refundable": "Non-refundable", "depDate": date_, "depTime": "09:15",
        "depCode": dep_code, "arrDate": date_, "arrTime": "17:40", "arrCode": arr_code,
        "duration": "8h 25m", "stops": "Nonstop", "status": "Confirmed",
    }


def _train(day, carrier, route, dep_location, arr_location, date_):
    return {
        "type": "train", "day": day, "carrier": carrier, "route": route,
        "depDate": date_, "depTime": "08:30", "depLocation": dep_location,
        "arrDate": date_, "arrTime": "12:15", "arrLocation": arr_location,
        "duration": "3h 45m", "stops": "Direct",
    }


def _days(entries: list[tuple[int, str, list[str]]]) -> list[dict]:
    return [{"day": d, "title": f"Day {d}: {city}", "activities": acts} for d, city, acts in entries]


def _image(photo_id: str) -> str:
    return f"https://images.unsplash.com/photo-{photo_id}?auto=format&fit=crop&w=900&q=80"


JAPAN_IMAGE = _image("1493976040374-85c8e12f0c0e")
LISBON_IMAGE = _image("1503756234508-e32d1769ee16")
EUROPE_IMAGE = _image("1467269204594-9661b134dd2b")
PARIS_IMAGE = _image("1502602898657-3e91760cbb34")

JAPAN_SEGMENTS = [
    _flight(1, "JFK", "NRT", "2026-03-28"),
    _activity(1, "18:00", "Shibuya Crossing & Shibuya Sky"),
    _hotel(1, "Shibuya Excel Hotel", "Tokyo", "Mar 28 - Mar 31"),
    _activity(2, "09:00", "Senso-ji Temple & Asakusa"),
    _activity(2, "14:00", "Tokyo Skytree"),
    _activity(3, "09:00", "Meiji Shrine & Harajuku"),
    _activity(3, "14:00", "teamLab Planets"),
    _train(4, "JR Central", "Tokyo -> Kyoto", "Tokyo", "Kyoto", "2026-03-31"),
    _activity(4, "15:00", "Arashiyama Bamboo Grove"),
    _hotel(4, "Kyoto Granbell Hotel", "Kyoto", "Mar 31 - Apr 2"),
    _activity(5, "09:00", "Fushimi Inari Shrine"),
    _activity(5, "14:00", "Kiyomizu-dera Temple"),
    _train(6, "JR West", "Kyoto -> Osaka", "Kyoto", "Osaka", "2026-04-02"),
    _activity(6, "14:00", "Osaka Castle"),
    _hotel(6, "Osaka Marriott Miyako", "Osaka", "Apr 2 - Apr 3"),
    _activity(7, "09:00", "Dotonbori Food Walk"),
    _activity(7, "13:00", "Umeda Sky Building"),
]
JAPAN_DAYS = _days([
    (1, "Tokyo", ["Shibuya Crossing & Shibuya Sky"]),
    (2, "Tokyo", ["Senso-ji Temple & Asakusa", "Tokyo Skytree"]),
    (3, "Tokyo", ["Meiji Shrine & Harajuku", "teamLab Planets"]),
    (4, "Kyoto", ["Arashiyama Bamboo Grove"]),
    (5, "Kyoto", ["Fushimi Inari Shrine", "Kiyomizu-dera Temple"]),
    (6, "Osaka", ["Osaka Castle"]),
    (7, "Osaka", ["Dotonbori Food Walk", "Umeda Sky Building"]),
])
JAPAN_CITY_DAYS = [
    {"city": "Tokyo", "nights": 3}, {"city": "Kyoto", "nights": 2}, {"city": "Osaka", "nights": 1},
]

LISBON_SEGMENTS = [
    _flight(1, "JFK", "LIS", "2026-05-04"),
    _activity(1, "16:00", "Alfama District Walking Tour"),
    _hotel(1, "Lisboa Plaza Hotel", "Lisbon", "May 4 - May 7"),
    _activity(2, "09:00", "Belem Tower & Jeronimos Monastery"),
    _activity(2, "15:00", "Tram 28 Ride"),
    _activity(3, "10:00", "LX Factory"),
    _activity(3, "13:00", "Time Out Market Lisboa"),
    _activity(3, "19:00", "Fado Dinner Show"),
    _train(4, "CP Urbanos", "Lisbon -> Sintra", "Lisbon", "Sintra", "2026-05-07"),
    _activity(4, "10:00", "Pena Palace"),
    _activity(4, "14:00", "Quinta da Regaleira"),
    _hotel(4, "Sintra Boutique Hotel", "Sintra", "May 7 - May 8"),
    _activity(5, "10:00", "Sintra Old Town"),
]
LISBON_DAYS = _days([
    (1, "Lisbon", ["Alfama District Walking Tour"]),
    (2, "Lisbon", ["Belem Tower & Jeronimos Monastery", "Tram 28 Ride"]),
    (3, "Lisbon", ["LX Factory", "Time Out Market Lisboa", "Fado Dinner Show"]),
    (4, "Sintra", ["Pena Palace", "Quinta da Regaleira"]),
    (5, "Sintra", ["Sintra Old Town"]),
])
LISBON_CITY_DAYS = [{"city": "Lisbon", "nights": 3}, {"city": "Sintra", "nights": 1}]

EUROPE_SEGMENTS = [
    _flight(1, "JFK", "AMS", "2026-06-01"),
    _activity(1, "15:00", "Anne Frank House"),
    _hotel(1, "Amsterdam Canal Hotel", "Amsterdam", "Jun 1 - Jun 3"),
    _activity(2, "09:00", "Van Gogh Museum"),
    _activity(2, "14:00", "Canal Cruise"),
    _train(3, "DB", "Amsterdam -> Berlin", "Amsterdam", "Berlin", "2026-06-03"),
    _activity(3, "15:00", "Brandenburg Gate & Reichstag"),
    _hotel(3, "Berlin Mitte Hotel", "Berlin", "Jun 3 - Jun 6"),
    _activity(4, "09:00", "East Side Gallery"),
    _activity(4, "14:00", "Museum Island"),
    _activity(5, "10:00", "Berlin Wall Memorial"),
    _train(6, "CD", "Berlin -> Prague", "Berlin", "Prague", "2026-06-06"),
    _activity(6, "15:00", "Prague Castle"),
    _hotel(6, "Prague Old Town Hotel", "Prague", "Jun 6 - Jun 8"),
    _activity(7, "09:00", "Charles Bridge Walk"),
    _activity(7, "13:00", "Old Town Astronomical Clock"),
    _activity(7, "16:00", "Vltava River Cruise"),
    _train(8, "OBB", "Prague -> Vienna", "Prague", "Vienna", "2026-06-08"),
    _activity(8, "15:00", "Schoenbrunn Palace"),
    _hotel(8, "Vienna Ring Hotel", "Vienna", "Jun 8 - Jun 10"),
    _activity(9, "09:00", "Vienna State Opera"),
    _activity(9, "14:00", "Naschmarkt"),
    _train(10, "MAV", "Vienna -> Budapest", "Vienna", "Budapest", "2026-06-10"),
    _activity(10, "15:00", "Buda Castle & Fisherman's Bastion"),
    _hotel(10, "Budapest Danube Hotel", "Budapest", "Jun 10 - Jun 13"),
    _activity(11, "09:00", "Szechenyi Thermal Bath"),
    _activity(11, "20:00", "Danube Night Cruise"),
    _activity(12, "10:00", "Great Market Hall"),
    _train(13, "HZ", "Budapest -> Zagreb", "Budapest", "Zagreb", "2026-06-13"),
    _activity(13, "15:00", "Upper Town Walking Tour"),
    _hotel(13, "Zagreb Central Hotel", "Zagreb", "Jun 13 - Jun 14"),
    _activity(14, "09:00", "Zagreb Cathedral"),
    _activity(14, "11:00", "Dolac Market"),
]
EUROPE_DAYS = _days([
    (1, "Amsterdam", ["Anne Frank House"]),
    (2, "Amsterdam", ["Van Gogh Museum", "Canal Cruise"]),
    (3, "Berlin", ["Brandenburg Gate & Reichstag"]),
    (4, "Berlin", ["East Side Gallery", "Museum Island"]),
    (5, "Berlin", ["Berlin Wall Memorial"]),
    (6, "Prague", ["Prague Castle"]),
    (7, "Prague", ["Charles Bridge Walk", "Old Town Astronomical Clock", "Vltava River Cruise"]),
    (8, "Vienna", ["Schoenbrunn Palace"]),
    (9, "Vienna", ["Vienna State Opera", "Naschmarkt"]),
    (10, "Budapest", ["Buda Castle & Fisherman's Bastion"]),
    (11, "Budapest", ["Szechenyi Thermal Bath", "Danube Night Cruise"]),
    (12, "Budapest", ["Great Market Hall"]),
    (13, "Zagreb", ["Upper Town Walking Tour"]),
    (14, "Zagreb", ["Zagreb Cathedral", "Dolac Market"]),
])
EUROPE_CITY_DAYS = [
    {"city": "Amsterdam", "nights": 2}, {"city": "Berlin", "nights": 3}, {"city": "Prague", "nights": 2},
    {"city": "Vienna", "nights": 2}, {"city": "Budapest", "nights": 3}, {"city": "Zagreb", "nights": 1},
]

PARIS_SEGMENTS = [
    _flight(1, "JFK", "CDG", "2026-04-17"),
    _activity(1, "17:00", "Eiffel Tower & Trocadero"),
    _hotel(1, "Le Marais Boutique Hotel", "Paris", "Apr 17 - Apr 20"),
    _activity(2, "09:00", "Louvre Museum"),
    _activity(2, "14:00", "Tuileries Garden"),
    _activity(2, "19:00", "Seine River Cruise"),
    _activity(3, "09:00", "Montmartre & Sacre-Coeur"),
    _activity(3, "14:00", "Musee d'Orsay"),
    _activity(3, "17:00", "Le Marais Walking Tour"),
    _activity(4, "10:00", "Notre-Dame & Ile de la Cite"),
]
PARIS_DAYS = _days([
    (1, "Paris", ["Eiffel Tower & Trocadero"]),
    (2, "Paris", ["Louvre Museum", "Tuileries Garden", "Seine River Cruise"]),
    (3, "Paris", ["Montmartre & Sacre-Coeur", "Musee d'Orsay", "Le Marais Walking Tour"]),
    (4, "Paris", ["Notre-Dame & Ile de la Cite"]),
])
PARIS_CITY_DAYS = [{"city": "Paris", "nights": 3}]

TEMPLATES = [
    {
        "id": "20000000-0000-0000-0000-000000000001",
        "customer_id": "286da2eb-d51b-4bff-b139-5724fd719cf4",  # Rhea Sharma
        "customer_name": "Rhea Sharma",
        "display_code": "ITIN-TPL1",
        "title": "7 Days in Japan",
        "destination": "Tokyo, Kyoto, Osaka",
        "start_date": "2026-03-28", "end_date": "2026-04-03", "travelers": 2,
        "travel_style": "Cultural", "travel_method": "flight", "budget": "Mid-range",
        "interests": ["Culture", "Food", "History"], "food_preferences": ["Local cuisine"],
        "image": JAPAN_IMAGE, "segments": JAPAN_SEGMENTS, "days": JAPAN_DAYS, "city_days": JAPAN_CITY_DAYS,
        "template_meta": {
            "subtitle": "Cherry-blossom season · Mid-range · Couple", "tier": "Mid-range",
            "saves_label": "2.4K saves", "per_person": "₹1.4L", "updated_label": "Updated 2d ago",
        },
        "updated_at": datetime(2026, 9, 6, tzinfo=timezone.utc),
    },
    {
        "id": "20000000-0000-0000-0000-000000000002",
        "customer_id": "5ee4f1d5-9a7b-438f-86e4-e50946e2f09d",  # Iker Solano
        "customer_name": "Iker Solano",
        "display_code": "ITIN-TPL2",
        "title": "5 Days in Lisbon & Sintra",
        "destination": "Lisbon, Sintra",
        "start_date": "2026-05-04", "end_date": "2026-05-08", "travelers": 1,
        "travel_style": "Relaxed", "travel_method": "flight", "budget": "Budget",
        "interests": ["Culture", "History"], "food_preferences": ["Local cuisine"],
        "image": LISBON_IMAGE, "segments": LISBON_SEGMENTS, "days": LISBON_DAYS, "city_days": LISBON_CITY_DAYS,
        "template_meta": {
            "subtitle": "Shoulder season · Budget · Solo", "tier": "Budget",
            "saves_label": "1.8K saves", "per_person": "€620", "updated_label": "Updated 5d ago",
        },
        "updated_at": datetime(2026, 9, 3, tzinfo=timezone.utc),
    },
    {
        "id": "20000000-0000-0000-0000-000000000003",
        "customer_id": "a2dd0a45-be25-4804-9b2c-daa81d1d358b",  # Marco Villa
        "customer_name": "Marco Villa",
        "display_code": "ITIN-TPL3",
        "title": "Europe by Train - 14 Days",
        "destination": "Amsterdam, Berlin, Prague, Vienna, Budapest, Zagreb",
        "start_date": "2026-06-01", "end_date": "2026-06-14", "travelers": 2,
        "travel_style": "Backpacking", "travel_method": "train", "budget": "Budget",
        "interests": ["Culture", "History", "Nightlife"], "food_preferences": ["Local cuisine"],
        "image": EUROPE_IMAGE, "segments": EUROPE_SEGMENTS, "days": EUROPE_DAYS, "city_days": EUROPE_CITY_DAYS,
        "template_meta": {
            "subtitle": "Summer · Budget · Couple", "tier": "Budget",
            "saves_label": "1.2K saves", "per_person": "€1.9K", "updated_label": "Updated 1w ago",
        },
        "updated_at": datetime(2026, 9, 1, tzinfo=timezone.utc),
    },
    {
        "id": "20000000-0000-0000-0000-000000000004",
        "customer_id": "7efdbee8-bc0a-481d-a214-08683f6869c8",  # Emma Ross
        "customer_name": "Emma Ross",
        "display_code": "ITIN-TPL4",
        "title": "Paris Long Weekend",
        "destination": "Paris",
        "start_date": "2026-04-17", "end_date": "2026-04-20", "travelers": 1,
        "travel_style": "Cultural", "travel_method": "flight", "budget": "Mid-range",
        "interests": ["Culture", "Art", "Food"], "food_preferences": ["Local cuisine"],
        "image": PARIS_IMAGE, "segments": PARIS_SEGMENTS, "days": PARIS_DAYS, "city_days": PARIS_CITY_DAYS,
        "template_meta": {
            "subtitle": "Spring · Mid-range · Solo", "tier": "Mid-range",
            "saves_label": "940 saves", "per_person": "£540", "updated_label": "Updated 3d ago",
        },
        "updated_at": datetime(2026, 9, 5, tzinfo=timezone.utc),
    },
]


def upgrade() -> None:
    op.add_column('trips', sa.Column('is_template', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('trips', sa.Column('template_meta', JSONB(), nullable=True))
    op.create_index(
        'ix_trips_is_template', 'trips', ['is_template'],
        postgresql_where=sa.text('is_template = true'),
    )

    conn = op.get_bind()
    insert_stmt = sa.text("""
        INSERT INTO trips (
            id, tenant_id, customer_id, customer_name, display_code,
            title, destination, start_date, end_date, travelers,
            travel_style, travel_method, budget, interests, food_preferences,
            status, image, days, city_days, segments, customizations,
            is_template, template_meta, created_at, updated_at
        ) VALUES (
            :id, :tenant_id, :customer_id, :customer_name, :display_code,
            :title, :destination, :start_date, :end_date, :travelers,
            :travel_style, :travel_method, :budget, :interests, :food_preferences,
            'READY', :image, :days, :city_days, :segments, :customizations,
            true, :template_meta, :updated_at, :updated_at
        )
    """).bindparams(
        sa.bindparam("days", type_=JSONB),
        sa.bindparam("city_days", type_=JSONB),
        sa.bindparam("segments", type_=JSONB),
        sa.bindparam("customizations", type_=JSONB),
        sa.bindparam("template_meta", type_=JSONB),
        sa.bindparam("interests", type_=sa.ARRAY(sa.String)),
        sa.bindparam("food_preferences", type_=sa.ARRAY(sa.String)),
    )

    for tpl in TEMPLATES:
        trip_id = uuid.UUID(tpl["id"])
        exists = conn.execute(sa.text("SELECT 1 FROM trips WHERE id = :id"), {"id": trip_id}).first()
        if exists:
            continue
        conn.execute(insert_stmt, {
            **tpl,
            "id": trip_id,
            "customer_id": uuid.UUID(tpl["customer_id"]),
            "tenant_id": uuid.UUID(DEFAULT_TENANT_ID),
            "customizations": {},
        })


def downgrade() -> None:
    ids_list = "', '".join(t["id"] for t in TEMPLATES)
    op.execute(f"DELETE FROM trips WHERE id IN ('{ids_list}')")
    op.drop_index('ix_trips_is_template', table_name='trips')
    op.drop_column('trips', 'template_meta')
    op.drop_column('trips', 'is_template')
