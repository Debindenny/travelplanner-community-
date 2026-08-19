# Travlplanr

Full-stack travel planning platform — Angular 17+ frontend with Python FastAPI microservices on Azure.

## Monorepo structure

```
travlplanr/
├── apps/web/          Angular 17+ SPA (landing page, auth, wizard, itinerary)
├── services/          FastAPI microservices (identity, planner, ai-worker, affiliate)
├── infra/             Bicep IaC + KEDA scaling definitions
└── .github/workflows/ CI/CD pipelines
```

## Quick start — Frontend

```bash
cd apps/web
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200) to view the landing page.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Angular 17+ (signals-first, standalone components), TailwindCSS 3, i18n (en/es/fr) |
| Backend | Python 3.12, FastAPI, Pydantic v2, async SQLAlchemy |
| Messaging | Redis Streams (event bus between services) |
| Data | PostgreSQL, Redis, MinIO (object storage) |
| AI | Direct HTTP calls to an LLM fallback chain — Ollama → Groq → Gemini → Anthropic |
| Cloud (target) | Azure Container Apps, Static Web Apps, Bicep IaC |

## Landing page

The home page matches the [Travel PlanR Hi-Fi Figma design](https://www.figma.com/proto/Q7x4SWIonUAi1ljCJghpGE/Travel-PlanR-Hi--Fi) with:

- Hero with CTA buttons
- How it works (3-step AI flow)
- Travel categories, trending destinations, package carousels
- Iconic vacations bento grid
- CTA banner, journeys carousel, partner footer

## Services & Features

- **Identity** (`services/identity`) — auth (OTP + admin password), customer/staff/agent management, plan usage limits.
- **Planner** (`services/planner`) — the largest service: trips/itinerary generation, chat wizard, destinations & packages, checkout, real-time collaboration (WebSockets), community (feed, posts, stories, DMs, matching), and admin CMS routes.
- **AI Worker** (`services/ai-worker`) — Redis Streams consumer that generates itineraries via an LLM fallback chain (Ollama → Groq → Gemini → Anthropic) and hydrates affiliate inventory.
- **Affiliate** (`services/affiliate`) — travel inventory search (TravelNext, Google Places/Routes, Tripadvisor) and booking lifecycle.
- **Reporting** (`services/reporting`) — consumes domain events off Redis Streams to build admin dashboard projections, notifications, and audit stats.
- **shared** (`services/shared`) — the domain event envelope/catalog (`events.py`), auth dependencies, rate limiting, circuit breaker, and middleware used by every service.

Services communicate via a Redis Streams event bus (see `services/shared/events.py` for the event catalog) and are only reachable externally through the nginx gateway (`infra/gateway/nginx.conf`).

## Local full stack

To run the entire suite of backend microservices locally:

```bash
docker compose up -d
```

The gateway listens on `http://localhost:8080`; MinIO console on `9000`; Ollama on `11434`. See [ARCHITECTURE.md](ARCHITECTURE.md) for service boundaries, event catalog, and routing details.
