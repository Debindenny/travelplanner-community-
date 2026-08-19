# Travlplanr — Investor Document Set

Three separate decks, matching the three required attachments on the application form:

| # | Form field | File | Slides | Status |
|---|---|---|---|---|
| 21 | Attach Pitch Deck | [01-PITCH-DECK.md](01-PITCH-DECK.md) | 16 | Content complete — grounded in the shipped codebase + 2026 market data |
| 22 | Attach Founder(s) Profile | [02-FOUNDERS-PROFILE.md](02-FOUNDERS-PROFILE.md) | 12 | Structure + all product/traction proof complete; **personal details marked `[FILL]`** |
| 23 | Attach Historical & Projected Financials | [03-FINANCIALS.md](03-FINANCIALS.md) | 14 | Full 5-year bottoms-up model with assumptions; **historical actuals marked `[FILL]`** |

## How to read these files

Every slide is written as:

```
### Slide N — <Title>
**Headline:** the one sentence the slide must land
**On the slide:** exactly what to put on the slide (keep it this short)
**Visual:** what the artwork/chart should be
**Say:** what you say out loud — the speaker note
```

Do not paste the "Say" text onto slides. Slides carry the headline + 3–5 lines; your voice carries the rest.

## What I could and could not source

**Sourced from the codebase** (verified, quotable in the room):
- 5 microservices, 347 HTTP/WS endpoints, 76 database tables, 31 migrations, ~47k lines Python + ~64k lines TypeScript, 166 Angular components, 47 test files
- 9 live TravelNext product lines (flights, hotels, cars, transfers, rail, activities, events, holidays, cruise) + Amadeus, Booking.com, Google Places/Routes, Tripadvisor
- LLM fallback chain Ollama → Groq → Gemini → Anthropic with a self-hosted warm model
- Stripe checkout with server-authoritative pricing and Redis-configurable B2B/B2C markup
- Price points: Free / ₹999 / ₹4,999 per month (`apps/web/src/app/shared/data/pricing.data.ts`)
- AI learning flywheel tables: `chat_interactions`, `activity_outcomes`, `activity_acceptance_stats`, `prompt_versions`

**Not in the codebase — you must supply:**
- Founder names, bios, education, employment history, equity split
- Any real usage/revenue history (the `about` page team + timeline data are placeholder copy, not facts)
- Current cash position and burn

Everywhere I needed one of those, the deck says `[FILL: ...]` with a note on what a strong answer looks like.

## Market sources used

- [AI in Travel Market — market.us](https://market.us/report/ai-in-travel-market/)
- [Generative AI in Travel Market — Precedence Research](https://www.precedenceresearch.com/generative-ai-in-travel-market)
- [India Online Travel Market — Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/online-travel-market-in-india)
- [India Outbound Tourism Market — Future Market Insights](https://www.futuremarketinsights.com/reports/india-outbound-tourism-market)
- [India's Outbound Travel Market to Reach 50M Travellers by 2030](https://edtimes.in/indias-outbound-travel-market-set-to-reach-50-million-travellers-by-2030/)
- [Mindtrip Raises $12M — Skift](https://skift.com/2024/09/17/mindtrip-raises-12-million-in-tough-funding-environment-for-ai-trip-planners/)
- [Layla Surpasses $1B in Trips Planned](https://finance.yahoo.com/news/layla-surpasses-1-billion-trips-165400507.html)
- [30 Sundays Raises ₹61 Cr — Inc42](https://inc42.com/buzz/traveltech-startup-30-sundays-raises-%E2%82%B961-cr-to-expand-ai-powered-holiday-planning/)
- [OTA Commission Rates 2026 — Cloudbeds](https://www.cloudbeds.com/online-travel-agencies/commissions/)
- [Tour OTA Commission Rates 2026 — Samba](https://www.sambahq.com/ota-supplier-guide/ota-commission-rates)

FX used throughout: **₹95 = $1** (matches the platform's own FX fallback rate in `services/shared/fx.py`).
