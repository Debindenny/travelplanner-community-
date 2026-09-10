"""Seed event_itinerary_days/activities for the 6 hosted-journey demo events

Revision ID: 0035_seed_event_itineraries
Revises: 0034_event_itinerary_bookings
Create Date: 2026-09-08 00:00:00.000000

Ports the exact day/activity structure that
apps/web/src/app/community/services/community-events-mock.store.ts computes
client-side (buildJourneyDays/asActivities) for evt-1..evt-6, so the newly
DB-backed itinerary looks the same as the old mock — just now with real rows
that selection/booking/transport can reference. Priced activities get a
default capacity of 20 (so "book" has something finite to demonstrate
availability against); free activities stay uncapped.
"""
import re
import uuid
from datetime import date, timedelta
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0035_seed_event_itineraries'
down_revision: Union[str, Sequence[str], None] = '0034_event_itinerary_bookings'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ACTIVITY_IMAGES = [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1499425543974-31970c11ecd8?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=100&q=80',
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=100&q=80',
]
DEFAULT_TIMES = ['09:00', '14:00', '19:00', '20:00']
FREE_RE = re.compile(r'free|departure', re.I)


def as_activities(titles: list[str]) -> list[dict]:
    out = []
    for title in titles:
        if FREE_RE.search(title):
            out.append({'title': title, 'included': False, 'price': None, 'category': 'Optional · Free time'})
        else:
            out.append({'title': title})
    return out


def finalize_day(day_num: int, city: str, start: date, day_price: int, activities_in: list[dict]) -> tuple[dict, list[dict]]:
    date_label = (start + timedelta(days=day_num - 1)).strftime('%d %b')
    even_split = round(day_price / len(activities_in))
    activities_out = []
    for i, a in enumerate(activities_in):
        activities_out.append({
            'title': a['title'],
            'time': a.get('time', DEFAULT_TIMES[i % len(DEFAULT_TIMES)]),
            'category': a.get('category', 'Included Experience'),
            'duration': a.get('duration', ''),
            'rating': a.get('rating', 4.6),
            'image': a.get('image', ACTIVITY_IMAGES[(day_num + i) % len(ACTIVITY_IMAGES)]),
            'price': a['price'] if 'price' in a else even_split,
            'included': a.get('included', True),
        })
    return {'day': day_num, 'city': city, 'dateLabel': date_label, 'price': day_price}, activities_out


def build_journey_days(start: date, segments: list[dict]) -> list[tuple[dict, list[dict]]]:
    day_num = 1
    result = []
    for segment in segments:
        for day in segment['days']:
            result.append(finalize_day(day_num, segment['city'], start, day['price'], day['activities']))
            day_num += 1
    return result


EVENTS = [
    {
        'id': 'evt-1', 'start': date(2026, 6, 3),
        'segments': [
            {'city': 'Paris', 'days': [
                {'price': 8500, 'activities': [
                    {'title': 'Hotel Check-in: Le Marais Boutique Hotel', 'time': '14:00', 'category': '4-Star Hotel · Guided Check-in', 'duration': '', 'rating': 4.7, 'image': ACTIVITY_IMAGES[0], 'price': 4200},
                    {'title': 'Welcome Dinner: Chez Julien Restaurant', 'time': '19:00', 'category': 'Group Dining · Set Menu', 'duration': '2h', 'rating': 4.5, 'image': ACTIVITY_IMAGES[1], 'price': 1800},
                    {'title': 'Evening Seine River Walk', 'time': '20:00', 'category': 'Optional · Self-guided until sunset', 'duration': '', 'rating': 4.6, 'image': ACTIVITY_IMAGES[2], 'price': None, 'included': False},
                ]},
                {'price': 7800, 'activities': [
                    {'title': 'Eiffel Tower & Trocadéro', 'time': '09:00', 'category': 'Skip-the-line · Guided', 'duration': '2h', 'rating': 4.9, 'image': ACTIVITY_IMAGES[4], 'price': 2500},
                    {'title': 'Louvre Museum', 'time': '10:30', 'category': 'Guided Tour', 'duration': '2h 30m', 'rating': 4.8, 'image': ACTIVITY_IMAGES[3], 'price': 2200},
                    {'title': 'Seine River Sunset Cruise', 'time': '18:00', 'category': 'Optional · Sightseeing', 'duration': '1h 30m', 'rating': 4.9, 'image': ACTIVITY_IMAGES[7], 'price': 1900},
                ]},
                {'price': 6200, 'activities': [
                    {'title': 'Free Day / Palace of Versailles Visit', 'time': '09:00', 'category': 'Optional · Full-day excursion', 'duration': 'Full day', 'rating': 4.5, 'image': ACTIVITY_IMAGES[4], 'price': 4200},
                    {'title': 'Montmartre Walking Tour', 'time': '14:00', 'category': 'Group Activity', 'duration': '2h', 'rating': 4.3, 'image': ACTIVITY_IMAGES[2], 'price': 2000},
                ]},
            ]},
            {'city': 'Barcelona', 'days': [
                {'price': 9100, 'activities': [
                    {'title': 'High-Speed Train to Barcelona — TGV', 'time': '08:00', 'category': 'Train · Direct', 'duration': '3h (approx)', 'rating': 4.7, 'image': ACTIVITY_IMAGES[5], 'price': 3100},
                    {'title': 'Sagrada Família & Tapas Tasting', 'time': '16:00', 'category': 'Group Activity', 'duration': '3h (approx)', 'rating': 4.7, 'image': ACTIVITY_IMAGES[1], 'price': 6000},
                ]},
                {'price': 7600, 'activities': [
                    {'title': 'Park Güell Tour', 'time': '09:00', 'category': 'Guided Tour', 'duration': '2h', 'rating': 4.7, 'image': ACTIVITY_IMAGES[3], 'price': 2100},
                    {'title': 'Gothic Quarter Walking Tour', 'time': '15:00', 'category': 'Guided · Group Activity', 'duration': '2h', 'rating': 4.6, 'image': ACTIVITY_IMAGES[2], 'price': 1700},
                    {'title': 'Sunset Rooftop Drinks', 'time': '20:00', 'category': 'Optional · Sightseeing', 'duration': '1h 30m', 'rating': 4.9, 'image': ACTIVITY_IMAGES[7], 'price': 3800},
                ]},
                {'price': 6900, 'activities': [
                    {'title': 'Beach Day & Water Sports', 'time': '10:00', 'category': 'Optional · Free time', 'duration': 'Half day', 'rating': 4.4, 'image': ACTIVITY_IMAGES[8], 'price': 1200, 'included': False},
                    {'title': 'Flamenco Show & Dinner', 'time': '20:00', 'category': 'Optional · Evening Show', 'duration': '2h', 'rating': 4.8, 'image': ACTIVITY_IMAGES[9], 'price': 2400, 'included': False},
                ]},
            ]},
            {'city': 'Madrid', 'days': [
                {'price': 8200, 'activities': [
                    {'title': 'Flight to Madrid — Iberia', 'time': '08:00', 'category': 'Direct · Economy', 'duration': '1h 15m', 'rating': 4.6, 'image': ACTIVITY_IMAGES[6], 'price': 3800},
                    {'title': 'Royal Palace & Prado Museum', 'time': '11:00', 'category': 'Guided Tour', 'duration': '3h', 'rating': 4.6, 'image': ACTIVITY_IMAGES[3], 'price': 2300},
                    {'title': 'Farewell Dinner: Sobrinos de Botín', 'time': '20:00', 'category': "Group Activity · World's oldest restaurant", 'duration': '2h', 'rating': 4.9, 'image': ACTIVITY_IMAGES[1], 'price': 2100},
                ]},
                {'price': 7400, 'activities': [
                    {'title': 'Retiro Park & Crystal Palace', 'time': '09:00', 'category': 'Free time · Self-guided', 'duration': '2h', 'rating': 4.5, 'image': ACTIVITY_IMAGES[4], 'price': 800},
                    {'title': 'Flamenco Masterclass', 'time': '15:00', 'category': 'Optional · Group Activity', 'duration': '1h 30m', 'rating': 4.4, 'image': ACTIVITY_IMAGES[9], 'price': 1400, 'included': False},
                    {'title': 'Free Evening', 'time': '19:00', 'category': 'Optional · Free time', 'duration': '', 'rating': 4.2, 'image': ACTIVITY_IMAGES[2], 'price': None, 'included': False},
                ]},
                {'price': 5200, 'activities': [
                    {'title': 'Free Morning / Souvenir Shopping', 'time': '09:00', 'category': 'Optional · Self-guided', 'duration': 'Half day', 'rating': 4.2, 'image': ACTIVITY_IMAGES[2], 'price': None, 'included': False},
                    {'title': 'Departure Transfer to Airport', 'time': '13:00', 'category': 'Private Transfer', 'duration': '1h', 'rating': 4.7, 'image': ACTIVITY_IMAGES[6], 'price': 900},
                ]},
            ]},
        ],
    },
    {
        'id': 'evt-2', 'start': date(2026, 6, 18),
        'segments': [
            {'city': 'Rome', 'days': [
                {'price': 9200, 'activities': as_activities(['Arrival', 'Colosseum at sunset'])},
                {'price': 8100, 'activities': as_activities(['Vatican Museums', 'Trastevere dinner'])},
                {'price': 7300, 'activities': as_activities(['Day trip to Tivoli'])},
            ]},
            {'city': 'Amalfi', 'days': [
                {'price': 9600, 'activities': as_activities(['Drive to Amalfi', 'Positano viewpoint'])},
                {'price': 8800, 'activities': as_activities(['Ravello gardens', 'Boat day'])},
                {'price': 6700, 'activities': as_activities(['Free beach morning', 'Limoncello tasting'])},
            ]},
            {'city': 'Palermo', 'days': [
                {'price': 7900, 'activities': as_activities(['Ferry to Palermo', 'Street food market'])},
                {'price': 7100, 'activities': as_activities(['Wine tasting', 'Coastline drive'])},
                {'price': 5400, 'activities': as_activities(['Free morning', 'Departure'])},
            ]},
        ],
    },
    {
        'id': 'evt-3', 'start': date(2026, 10, 12),
        'segments': [
            {'city': 'Kyoto', 'days': [
                {'price': 8900, 'activities': as_activities(['Arrival', 'Gion evening walk'])},
                {'price': 7200, 'activities': as_activities(['Fushimi Inari torii gates'])},
                {'price': 8300, 'activities': as_activities(['Arashiyama bamboo grove', 'Tea ceremony'])},
                {'price': 7600, 'activities': as_activities(['Kinkaku-ji', 'Ryoan-ji rock garden'])},
                {'price': 6800, 'activities': as_activities(['Philosopher’s Path', 'Nishiki Market'])},
                {'price': 7900, 'activities': as_activities(['Nara day trip', 'Deer Park'])},
                {'price': 6100, 'activities': as_activities(['Free day', 'Optional kaiseki dinner'])},
                {'price': 5300, 'activities': as_activities(['Closing dinner', 'Departure'])},
            ]},
        ],
    },
    {
        'id': 'evt-4', 'start': date(2026, 12, 12),
        'segments': [
            {'city': 'Paris', 'days': [
                {'price': 8700, 'activities': as_activities(['Arrival', 'Christmas market at Tuileries'])},
                {'price': 7900, 'activities': as_activities(['Louvre', 'Seine river cruise'])},
                {'price': 6300, 'activities': as_activities(['Montmartre walk', 'Free evening'])},
            ]},
            {'city': 'Barcelona', 'days': [
                {'price': 9200, 'activities': as_activities(['Flight to Barcelona', 'Gothic Quarter lights'])},
                {'price': 7700, 'activities': as_activities(['Sagrada Família', 'Park Güell'])},
                {'price': 6900, 'activities': as_activities(['Tapas crawl', 'Free evening'])},
            ]},
            {'city': 'Madrid', 'days': [
                {'price': 8300, 'activities': as_activities(['Train to Madrid', 'Retiro Park'])},
                {'price': 7500, 'activities': as_activities(['Prado Museum', 'Flamenco night'])},
                {'price': 5300, 'activities': as_activities(['Free morning', 'Departure'])},
            ]},
        ],
    },
    {
        'id': 'evt-5', 'start': date(2026, 12, 12),
        'segments': [
            {'city': 'Rome', 'days': [
                {'price': 8900, 'activities': as_activities(['Arrival', 'Colosseum'])},
                {'price': 7900, 'activities': as_activities(['Vatican Museums', 'Trastevere dinner'])},
                {'price': 7000, 'activities': as_activities(['Day trip to Tivoli'])},
            ]},
            {'city': 'Amalfi', 'days': [
                {'price': 9100, 'activities': as_activities(['Drive to Amalfi', 'Positano viewpoint'])},
                {'price': 8300, 'activities': as_activities(['Ravello gardens'])},
                {'price': 6400, 'activities': as_activities(['Coastal walk', 'Limoncello tasting'])},
            ]},
            {'city': 'Palermo', 'days': [
                {'price': 7500, 'activities': as_activities(['Ferry to Palermo', 'Street food market'])},
                {'price': 6800, 'activities': as_activities(['Wine tasting', 'Coastline drive'])},
                {'price': 5100, 'activities': as_activities(['Free morning', 'Departure'])},
            ]},
        ],
    },
    {
        'id': 'evt-6', 'start': date(2026, 12, 12),
        'segments': [
            {'city': 'Kyoto', 'days': [
                {'price': 8600, 'activities': as_activities(['Arrival', 'Gion evening walk'])},
                {'price': 7100, 'activities': as_activities(['Fushimi Inari torii gates in snow'])},
                {'price': 8000, 'activities': as_activities(['Arashiyama bamboo grove', 'Tea ceremony'])},
                {'price': 7400, 'activities': as_activities(['Kinkaku-ji under snow'])},
                {'price': 6600, 'activities': as_activities(['Philosopher’s Path', 'Nishiki Market'])},
                {'price': 7700, 'activities': as_activities(['Nara day trip', 'Deer Park'])},
                {'price': 6000, 'activities': as_activities(['Free day', 'Optional kaiseki dinner'])},
                {'price': 5200, 'activities': as_activities(['Closing dinner', 'Departure'])},
            ]},
        ],
    },
]


def upgrade() -> None:
    conn = op.get_bind()

    days_table = sa.table(
        'event_itinerary_days', sa.column('id'), sa.column('event_id'), sa.column('day_number'),
        sa.column('city'), sa.column('date_label'), sa.column('price'),
    )
    activities_table = sa.table(
        'event_itinerary_activities', sa.column('id'), sa.column('day_id'), sa.column('title'),
        sa.column('time'), sa.column('category'), sa.column('duration'), sa.column('rating'),
        sa.column('image'), sa.column('price'), sa.column('capacity'), sa.column('booked_count'),
        sa.column('default_included'),
    )

    for event in EVENTS:
        already_seeded = conn.execute(
            sa.text("SELECT 1 FROM event_itinerary_days WHERE event_id = :eid LIMIT 1"),
            {'eid': event['id']},
        ).first()
        if already_seeded:
            continue

        day_rows = []
        activity_rows = []
        for day_dict, activities in build_journey_days(event['start'], event['segments']):
            day_id = uuid.uuid4()
            day_rows.append({
                'id': day_id, 'event_id': event['id'], 'day_number': day_dict['day'],
                'city': day_dict['city'], 'date_label': day_dict['dateLabel'], 'price': day_dict['price'],
            })
            for a in activities:
                activity_rows.append({
                    'id': uuid.uuid4(), 'day_id': day_id, 'title': a['title'], 'time': a['time'],
                    'category': a['category'], 'duration': a['duration'], 'rating': a['rating'],
                    'image': a['image'], 'price': a['price'],
                    'capacity': 20 if a['price'] is not None else None,
                    'booked_count': 0, 'default_included': a['included'],
                })

        op.bulk_insert(days_table, day_rows)
        op.bulk_insert(activities_table, activity_rows)


def downgrade() -> None:
    conn = op.get_bind()
    for event in EVENTS:
        conn.execute(sa.text("DELETE FROM event_itinerary_days WHERE event_id = :eid"), {'eid': event['id']})
