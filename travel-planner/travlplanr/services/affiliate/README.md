# Affiliate Service

Travel inventory search via **TravelNext**, **Travelomatix** (hotels),
**Google Places/Routes**, and **Tripadvisor**, plus the internal booking lifecycle.

## Owned domains

- **Bookings** (`app/routers/bookings.py`, prefix `/api/v1/bookings`) — CRUD for the
  bookings-of-record: `GET /` lists a customer's bookings, `POST /` creates one
  (idempotent on `tenant_id` + `customer_id` + `trip_id` + `package_id`).
- **Inventory** (`app/routers/inventory.py`, prefix `/api/v1/inventory`) — `GET /search`
  proxies to `app/adapters/inventory_manager.py`, which fans out to:
  - TravelNext (flights, cars, rail, activities, holidays, events, cruises, transfers)
  - Travelomatix (hotels — Search → Details → RoomList → BlockRoom → Book)
  - Google Places / Routes (POI fill + transit estimates)
  - Tripadvisor (activity content / recommendations)
  - Unsplash (image backfill only)

  Results are Redis-cached for 10 minutes and rate-limited to 60 req/min/IP.
  `GET /redirect` tracks and redirects affiliate deep-link clicks; targets are
  restricted to an allowlist of partner hostnames (`ALLOWED_REDIRECT_HOSTS`).

## DB tables

Single table, defined in `app/models/bookings.py`:

- **`bookings`** — `id`, `tenant_id`, `customer_id`, `trip_id` (nullable), `package_id`
  (nullable), `amount` (Numeric(10,2)), `currency`, `status` (enum: `pending`,
  `confirmed`, `cancelled`, `completed`), `stripe_session_id`, `created_at`,
  `updated_at`.

## Provider env vars

| Env var | Purpose |
| --- | --- |
| `TRAVELNEXT_*` | TravelNext product credentials + base URLs |
| `TRAVELOMATIX_*` | Travelomatix hotel API headers + base URL + city map |
| `TRIPADVISOR_API_KEY` | Terra Partner API key (`X-API-Key`) for activities/POIs |
| `UNSPLASH_ACCESS_KEY` | Unsplash Client-ID for activity photo backfill |
| `GOOGLE_PLACES_API_KEY` | Places Text Search, Autocomplete, Details, Photos, Routes, Time Zone |
| `GOOGLE_MAPS_BROWSER_KEY` | Browser Maps JS key (exposed via planner `/public-config`) |

## Activity merge order

1. **TravelNext Activities / Events** — bookable sightseeing & tickets when creds exist
2. **Google Places** — iconic landmarks with real photos (content-only)
3. **Tripadvisor** — ratings/reviews + POI photos (content-only)
4. **Unsplash** — image backfill for any result still missing a photo

Tripadvisor recommendations (`GET /api/v1/inventory/recommendations`) power AI
itinerary grounding. Extra Google helpers:

- `GET /api/v1/inventory/places/autocomplete` — destination typeahead
- `GET /api/v1/inventory/places/details` — Place Details enrichment
- `POST /api/v1/inventory/routes/compute` — travel time between stops
- `GET /api/v1/inventory/timezone` — IANA timezone for lat/lng

## Events

Defined in `shared/events.py` under the "Affiliate" section: `trip.booked`,
`trip.cancelled`, `booking.refunded` — on stream `events:affiliate`
(`STREAM_AFFILIATE`).

- **Consumes**: `trip.booked`, in `app/consumers/booking_consumer.py` (consumer group
  `affiliate_group`). On receipt, creates a `Booking` row with status `CONFIRMED` if one
  doesn't already exist for the tenant/customer/trip/package.
