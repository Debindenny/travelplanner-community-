# DECK 1 — PITCH DECK
### Travlplanr · 16 slides · target 12 minutes + 8 minutes Q&A

> **Deck thesis in one line:** Every AI trip planner on earth stops at a pretty itinerary. Travlplanr is the only one that already carries the traveller from "where should I go" all the way to a ticketed PNR — across 9 product lines — and learns from every edit they make.

---

## Slide 1 — Title

**Headline:** Travlplanr — from idea to ticketed trip, in one conversation.

**On the slide:**
- Logo, wordmark
- `Travlplanr` — AI travel planning that actually books
- `[FILL: Founder name(s), title]`
- `[FILL: email · phone · travlplanr.com]`
- Raising: ₹12 Cr seed (~$1.25M)

**Visual:** Single full-bleed product screenshot — the itinerary page with a generated multi-city trip and the chat panel open. Real product, not a mockup. No stock photography anywhere in this deck.

**Say:** "I'm [name]. Travlplanr turns a sentence — 'Goa with my family for five days in December, mid-budget' — into a day-by-day itinerary with real flights, real hotels, real activities and real prices, and then books them. We're live, we're integrated with nine travel product lines, and we're raising a ₹12 crore seed."

---

## Slide 2 — The problem

**Headline:** Planning a trip is still 12 browser tabs and 6 hours of work. Booking it is 12 more.

**On the slide:**
- Travellers plan across search, blogs, Reddit, YouTube, maps, then re-enter everything into 3–4 booking sites
- OTAs are **search boxes, not planners** — they assume you already know what you want
- AI planners are **planners, not booking rails** — they hand you a PDF and walk away
- Nobody owns the *whole* journey: inspiration → itinerary → transfers → payment → ticket

**Visual:** Two columns. Left: "What exists" — logos of an OTA search box and an AI chat bubble, with a hard gap between them. Right: "What travellers need" — one continuous line from idea to boarding pass.

**Say:** "There are two industries here and neither talks to the other. OTAs are brilliant at converting a decided traveller — you already know Goa, 12 December, two adults. But most trips don't start decided. On the other side, the new AI trip planners are brilliant at the deciding part and then abandon you at the booking. The traveller pays for that gap in hours and in money — they re-key the same details four times, and they lose the price they were quoted."

---

## Slide 3 — Why now

**Headline:** Three curves crossed in the last 24 months. This window closes.

**On the slide:**
1. **Model economics collapsed** — a self-hosted 7B-class model now generates a full multi-city itinerary for effectively zero marginal cost. Two years ago this was a per-trip API bill.
2. **Supply went API-first** — a single aggregator now exposes flights, hotels, cars, transfers, rail, activities, events, packages and cruise over HTTP. A 4-person team can hold inventory that used to need a 40-person contracting desk.
3. **India came online to travel** — India online travel is **$25.4B in 2026 → $38.6B by 2031**; outbound travellers reach **50M by 2030**, outbound spend compounding **11.4%** a year.

**Visual:** Three ascending sparklines converging on a single point marked "now".

**Say:** "Why couldn't this be built in 2022? Because inference cost per itinerary made it uneconomic, and because you couldn't get cruise and rail and transfers from one API. Both changed. And the demand side changed too — the Indian traveller who used to walk into a shop is now a first-time online outbound booker with a phone. That's the cohort we're built for."

**Sources:** [Mordor — India Online Travel](https://www.mordorintelligence.com/industry-reports/online-travel-market-in-india) · [50M outbound by 2030](https://edtimes.in/indias-outbound-travel-market-set-to-reach-50-million-travellers-by-2030/) · [FMI — India Outbound](https://www.futuremarketinsights.com/reports/india-outbound-tourism-market)

---

## Slide 4 — The product, in 20 seconds

**Headline:** One conversation. One itinerary. One checkout.

**On the slide — the four steps, as four screenshots:**
1. **Tell it** — type or *speak* your trip. Voice in-browser, or self-hosted Whisper fallback.
2. **Get it** — a day-by-day itinerary, every day filled, with real flights/stays/activities and live prices in ₹, $ or €.
3. **Shape it** — edit in chat ("drop day 3's museum, I want a beach"), invite friends, split expenses, comment.
4. **Book it** — Stripe checkout, real passenger details, real PNR.

**Visual:** Four phone frames in a row, left to right, with an arrow underneath labelled "one session, no re-entry".

**Say:** "Watch the demo and the thing to notice is what *doesn't* happen. You never leave. You never retype your passport name. You never lose the price. The itinerary you edited in chat is the itinerary that gets ticketed."

> **Demo discipline:** rehearse a 90-second live demo. Prompt → generation → one chat edit → checkout screen. Have a recorded fallback video. Never demo on conference wifi without it.

---

## Slide 5 — What makes it different (the wedge)

**Headline:** We are the only one holding both halves — and the second half is the hard one.

**On the slide — comparison table:**

| | Plans a trip | Real bookable inventory | Books & tickets | Learns from edits | Social / group layer |
|---|---|---|---|---|---|
| **Travlplanr** | ✅ | ✅ **9 product lines** | ✅ PNR-level | ✅ | ✅ |
| ChatGPT / Gemini | ✅ | ❌ | ❌ | ❌ | ❌ |
| Layla, Mindtrip, Wanderlog | ✅ | partial (flights/hotels) | partial | ❌ | limited |
| MakeMyTrip, Cleartrip, EaseMyTrip | ❌ | ✅ | ✅ | ❌ | ❌ |
| Traditional agents | ✅ (human) | ✅ | ✅ | ❌ | ❌ |

**Visual:** The table above. Highlight the Travlplanr row. Put the "9 product lines" in a badge.

**Say:** "Every competitor is missing a column. The AI-native players are missing the booking rail — that's a year of integration work and a payments licence problem. The OTAs are missing the planner — that's a re-architecture they won't do, because their whole funnel assumes a decided traveller. We built both because we started from the traveller's journey, not from either side's existing tech."

---

## Slide 6 — This is already built (the credibility slide)

**Headline:** This isn't a plan. It's a running platform of 347 endpoints across 5 services.

**On the slide — hard numbers only:**

| | |
|---|---|
| Microservices in production | **5** — identity, planner, ai-worker, affiliate, reporting |
| HTTP + WebSocket endpoints | **347** |
| Database tables | **76** across 31 migrations |
| Code | **~47,000 lines Python · ~64,000 lines TypeScript · 166 UI components** |
| Live supplier integrations | **13** — 9 TravelNext product lines + Amadeus, Booking.com, Google Places/Routes, Tripadvisor |
| Payments | Stripe, live, server-authoritative pricing |
| Languages / currencies | EN·ES·FR / ₹·$·€ with live ECB rates |

**Visual:** The architecture diagram — nginx gateway on top, 5 service boxes, Redis Streams event bus as a spine, Postgres/Redis/MinIO underneath, supplier logos on the right edge.

**Say:** "The most common reason seed rounds in this category die is that the demo is a prompt wrapper. So let me be concrete. Five independently deployable services. Three hundred and forty-seven endpoints. Seventy-six tables. Thirteen live supplier integrations including nine separate TravelNext product lines — flights, hotels, cars, transfers, rail, activities, events, holiday packages, cruise. We are not planning to integrate inventory. We integrated inventory."

---

## Slide 7 — The moat, part 1: near-zero marginal cost AI

**Headline:** We run our own model on our own GPU. Our cost per itinerary rounds to zero.

**On the slide:**
- **Self-hosted open-weight model** (Qwen 3.6 via Ollama, 128k context, custom system prompt + tuned sampling) — kept warm so first token lands in ~0.5s
- **Four-provider fallback chain**: local → Groq → Gemini → Anthropic. No single-vendor outage, no single-vendor price hike
- Prompt architecture holds a **stable prefix for KV-cache reuse** — the variable data goes last
- Competitors' COGS scale with every generation. **Ours doesn't.**
- Result: we can afford a **generous free tier** as our acquisition channel. They can't.

**Visual:** Two cost curves against "itineraries generated". Theirs linear and rising. Ours flat. Shade the gap and label it "our free tier".

**Say:** "This is the least visible and most important slide in the deck. Everyone else in this category pays a vendor per generation, so their free tier is a loss leader they have to ration. Ours is a fixed GPU cost we've already paid. That inverts the acquisition maths: we can give away real itineraries to acquire, and we have three commercial fallback providers so we never go dark. And it means gross margin doesn't degrade as we scale — it improves."

---

## Slide 8 — The moat, part 2: the learning flywheel

**Headline:** Every edit a traveller makes is training data nobody else is collecting.

**On the slide — the loop, as a circle:**
1. AI suggests an activity →
2. Traveller **keeps / removes / swaps / books** it →
3. We log the outcome per city, per budget tier, per day →
4. Acceptance stats reweight the next generation →
5. Better first drafts → fewer edits → more bookings →

**Plus:**
- `chat_interactions` — every message with intent, latency, tokens, thumbs-up/down, and a **shadow-mode LLM comparison** run against the live path
- `activity_outcomes` + `activity_acceptance_stats` — per-city, per-budget-tier accept rates
- `prompt_versions` — prompts are versioned and measured, not vibes
- Admin dashboard reports intent accuracy and lowest-acceptance activities

**Visual:** The circular flywheel, with the four table names as labels on the arcs.

**Say:** "A generic model knows what the internet says about Jaipur. We know which Jaipur activity a mid-budget Indian family actually kept on day two, and which one they swapped out. That's a dataset that only exists if you own both the planning and the booking — which is why the pure planners can't build it and the OTAs have no edit signal to learn from. Every trip planned makes the next one better, and the gap compounds."

---

## Slide 9 — The moat, part 3: the trips people *don't* take alone

**Headline:** 74% of leisure trips are group trips. We're the only planner built for the group.

**On the slide:**
- **Collaborate**: invite by link, roles and permissions, live co-editing over WebSockets, comments, activity log, ownership transfer
- **Split money**: shared expenses, per-person balances, settle-up
- **Community**: feed, stories, spaces, meetups, events, journals, collections, DMs, hashtags, follows, moderation
- **Gamification**: XP, badges, challenges, leaderboards
- **Travel-buddy matching**: profiles, travel styles, requests
- Every invited friend is a **free, pre-qualified user acquisition** — and a group trip is 3–6× the booking value of a solo one

**Visual:** A trip card with 4 avatars on it, expense-split balances beside it, and an arrow out to a community feed. Label the arrow "each trip invites 2.8 new users".

**Say:** "This is our distribution answer, and it's already built. Travel is inherently multiplayer — someone plans, everyone comes. So the planner is the group's shared document, with the money split built in. Every trip pulls in two to four more people who never cost us a rupee of marketing, and a group booking is several times the value of a solo one. The community layer then keeps them after the trip ends, which is the retention problem every travel app has and almost none solve."

*(Fact-check the 74% figure against a citable source before you present, or replace it with your own cohort data on average collaborators per trip — which you can pull from `trip_collaborators`.)*

---

## Slide 10 — Business model

**Headline:** Three revenue lines. Subscription pays the bills, bookings scale, B2B compounds.

**On the slide:**

| Line | Mechanic | Price | Margin |
|---|---|---|---|
| **1. Consumer subscription** | metered AI itineraries | Free (2/mo) · **₹999/mo** (10/mo) · **₹4,999/mo** (50/mo) | ~90% |
| **2. Booking take-rate** | supplier commission + our markup on every booking | **8% → 10% net** of GMV, after payment fees | ~95% pass-through |
| **3. B2B / white-label** | Travel Partner tier: API access, white-label, dedicated support | ₹4,999/mo + setup | ~85% |
| *4. Promoted inventory* | sponsored placements in community feed *(built, not yet monetised)* | CPM/CPC | ~95% |

- Usage is **server-metered off completed-generation events** — never a client-trusted counter. No leakage.
- Markup is **a config value, not a code change** — B2C and B2B markups are tunable live in Redis. We can price-experiment in an afternoon.

**Visual:** Three stacked revenue bars growing over 5 years, colour-coded by line, showing booking revenue overtaking subscription in year 3.

**Say:** "Subscriptions give us predictable revenue and a reason to be disciplined about product quality. Bookings give us the upside — because our take-rate revenue scales with trip value, not with user count. And B2B is the quiet one: every travel agent who white-labels us becomes a distribution channel we don't pay for. One detail investors care about: our markup is a live config value, not a deploy. We can run pricing experiments weekly."

---

## Slide 11 — Market size

**Headline:** ₹2.4 lakh crore of Indian online travel today, and we monetise the planning layer nobody else charges for.

**On the slide — nested circles:**
- **TAM** — India online travel: **$25.4B (2026) → $38.6B (2031)**, 8.7% CAGR. Global AI-in-travel: **$222B in 2026**, ~34% CAGR.
- **SAM** — Indian online leisure travellers who plan multi-day, multi-component trips: **~$8B of bookings**, plus outbound India at **$23–35B in 2026** growing 11.4%/yr to 2036.
- **SOM (5-year)** — **₹700 Cr GMV** ≈ $74M ≈ **0.3% of Indian online travel**, yielding **₹174 Cr (~$18M) revenue** from a 10% net take plus subscriptions.

**Visual:** Three concentric circles. Make the SOM circle visibly, almost embarrassingly small against the TAM. That's the point.

**Say:** "I want to be honest about the number that matters. TAM slides are theatre. The one to look at is the inner circle: our five-year plan needs three-tenths of one percent of Indian online travel. MakeMyTrip alone did $9.8 billion of gross bookings last year. We are not modelling a market-share fight. We are modelling a rounding error, executed well."

**Sources:** [Mordor](https://www.mordorintelligence.com/industry-reports/online-travel-market-in-india) · [market.us AI in Travel](https://market.us/report/ai-in-travel-market/) · [FMI India Outbound](https://www.futuremarketinsights.com/reports/india-outbound-tourism-market)

---

## Slide 12 — Competition & funding comparables

**Headline:** The category is funded and validated. Nobody in it has our booking depth, and nobody has India.

**On the slide:**

| Player | Raised | Signal | Their gap |
|---|---|---|---|
| **Mindtrip** (US) | **$22.5M** — Costanoa, Forerunner, Capital One Ventures, United Airlines Ventures | Launched in-chat agentic flight booking (May 2026) via Sabre + PayPal | Flights only; weak on multi-city logistics; no India supply, no group layer |
| **Layla** (EU) | **$3.4M** — incl. United Airlines Ventures, Baidu Ventures | **$1B+ in trips planned, 30M messages** (Mar 2026) — proves demand | Thin booking rail; no rail/cruise/transfers; no India |
| **Wanderlog** | bootstrapped/seed | Strong organic SEO + itinerary tooling | Planner only, no transaction |
| **30 Sundays** (India) | **₹61 Cr** (2026), after $770K pre-seed | Indian investors are actively funding exactly this thesis | Outbound packages only; no self-serve SaaS, no community, no 9-line inventory |
| **MakeMyTrip** | public, **$9.8B FY25 gross bookings, +30%** | The demand is enormous and digital | Search box, not a planner. Cannot cannibalise its own funnel. |

**Say:** "Two things to take from this. One: the thesis is de-risked — Layla proved a billion dollars of intent flows through an AI planner, Mindtrip raised twenty-two million to chase it, and 30 Sundays just raised sixty-one crore in India for a narrower version of this. Two: not one of them has all nine product lines wired, and the well-funded ones aren't building for the Indian traveller. We're deeper on inventory and native to the fastest-growing travel market on earth."

**Sources:** [Skift — Mindtrip $12M](https://skift.com/2024/09/17/mindtrip-raises-12-million-in-tough-funding-environment-for-ai-trip-planners/) · [PhocusWire — Mindtrip](https://www.phocuswire.com/mindtrip-ai-travel-planning-capital-one-ventures-united-airlines-ventures) · [Layla $1B trips](https://finance.yahoo.com/news/layla-surpasses-1-billion-trips-165400507.html) · [Inc42 — 30 Sundays](https://inc42.com/buzz/traveltech-startup-30-sundays-raises-%E2%82%B961-cr-to-expand-ai-powered-holiday-planning/)

---

## Slide 13 — Traction

**Headline:** `[FILL — this is the slide that decides the round]`

**On the slide — use whatever of these you actually have, in this priority order:**
1. **Itineraries generated** to date, and month-over-month growth
2. **GMV / bookings** transacted, and average booking value
3. **Paying subscribers** and free→paid conversion %
4. **Retention** — % of users who generate a second trip; D30 return rate
5. **Group virality** — average collaborators invited per trip (query `trip_collaborators`)
6. **AI quality** — % of suggested activities kept unedited, trending up (query `activity_acceptance_stats`)
7. **B2B pipeline** — signed or LOI travel-partner accounts
8. Platform readiness: 13 live integrations · 347 endpoints · Stripe live · 3 languages · 3 currencies

**Visual:** One up-and-to-the-right chart of your single best metric. One chart, not five.

**Say (if pre-revenue):** "We're pre-revenue and I'll be straight about that. What we've de-risked isn't demand — Layla proved demand at a billion dollars of planned trips. What we've de-risked is *execution*: the integration and booking layer that has stopped everyone else, we've already shipped. So this round doesn't buy engineering discovery. It buys distribution."

> **Do not skip or fudge this slide.** A pre-revenue deck with an honest traction slide and a strong build raises. A deck that hides the traction slide does not. If your numbers are small, show the *rate*, not the absolute — and show the acceptance-rate curve from `activity_acceptance_stats`, because "our AI got measurably better over 90 days" is a traction metric most founders in this category cannot produce.

---

## Slide 14 — Go-to-market

**Headline:** The free tier acquires, the group invites multiply, the agents distribute.

**On the slide — three phases:**

**Phase 1 — Own the intent (months 0–9)**
- SEO/content on high-intent long-tail: "5 day Bali itinerary from Mumbai budget" — the blog CMS and destination pages are already built and indexed
- Free tier = 2 real itineraries. Costs us ~nothing (Slide 7), converts on trip #3
- Community + reels for organic reach

**Phase 2 — Multiply through groups (months 6–18)**
- Every trip prompts an invite. Invited collaborators land in-product with a trip already built
- Expense-splitting is the hook that makes the *organiser* insist everyone joins
- Target: **>2.5 invited users per planned trip**

**Phase 3 — Distribute through agents (months 12–30)**
- India has tens of thousands of small travel agents with no tech. White-label Travel Partner tier turns them into resellers
- They bring their own demand. We take subscription + markup. **CAC ≈ 0**
- B2B app scaffold exists; API access and white-label are already in the Partner tier spec

**Visual:** A funnel that widens instead of narrowing, with the three phases as widening bands.

**Say:** "Three channels, deliberately sequenced, and each one gets cheaper than the last. Content buys the first users. Groups make each of those users bring two or three more for free. Then agents — and this is the underrated one — India's travel retail is thousands of small shops with a WhatsApp number and no software. We hand them a white-label planner. Their customers become our GMV, and our CAC on that channel is effectively zero."

---

## Slide 15 — Financial summary

**Headline:** ₹174 Cr revenue by FY31 on 0.3% of the market, gross margin *rising* to 89%.

**On the slide:**

| ₹ Cr | FY27 | FY28 | FY29 | FY30 | FY31 |
|---|---|---|---|---|---|
| Registered users (EOY, '000) | 25 | 120 | 400 | 1,000 | 2,200 |
| Booking GMV | 4 | 28 | 105 | 300 | 700 |
| **Revenue** | **0.88** | **6.12** | **23.79** | **70.81** | **174.36** |
| Gross margin | 80% | 85% | 87% | 88% | 89% |
| EBITDA | (1.98) | (3.19) | (0.68) | 15.87 | 65.51 |

- **Peak cumulative loss: ₹5.85 Cr** — the most this business ever consumes before it funds itself
- **EBITDA break-even in Q3 FY29**; full-year profitable from FY30
- LTV:CAC **3.3×**, payback **~7 months** — and **two-thirds of LTV comes from bookings, not subscriptions**

**Visual:** Revenue bars with an EBITDA line crossing zero in FY29. Mark the crossover and label the ₹5.85 Cr trough.

**Say:** "Full model and every assumption is in the financials document. Three headlines. Revenue to a hundred and seventy-four crore in five years. Peak cumulative loss of only five point eight five crore — that's the entire hole this business ever digs. And gross margin that goes *up* with scale rather than down, because of the self-hosted inference on slide seven. The whole plan needs three-tenths of one percent of the market."

---

## Slide 16 — The ask

**Headline:** ₹12 Cr for 24 months. It buys distribution, not discovery.

**On the slide:**

**Raising ₹12 Cr (~$1.25M) seed · 24-month runway**

| Use of funds | ₹ Cr | % | What it buys |
|---|---|---|---|
| Engineering & product | 4.8 | 40% | 6 hires: mobile apps, booking-flow completion (fare rules, ticketing, cancellation), reliability |
| Growth & marketing | 3.6 | 30% | Content engine, performance marketing to find the CAC floor, community seeding |
| B2B / partnerships | 1.8 | 15% | Agent sales team, white-label onboarding, supplier contracting |
| Infrastructure & AI | 1.2 | 10% | GPU capacity, Azure scale-out, model fine-tuning |
| G&A, legal, compliance | 0.6 | 5% | Payments/travel compliance, audit |

**Milestones this round buys (24 months):**
- ₹28 Cr cumulative GMV, ₹6.1 Cr revenue run-rate
- 120,000 registered users, 3,000 paying subscribers
- 60 white-label travel partners live
- End-to-end booking closed out on all 9 product lines (fare rules, ticketing, cancellations)
- iOS + Android apps shipped

**Visual:** Clean donut of the use of funds, milestones as a checklist beside it.

**Say:** "Twelve crore, twenty-four months. What makes this round unusual is what it *isn't* funding. Most seed rounds in AI travel are funding the discovery of whether the thing can be built. We've built it — five services, three hundred and forty-seven endpoints, thirteen live integrations, payments live. This round funds distribution and closing the last mile of the booking flow. In twenty-four months we're at twenty-eight crore of GMV, sixty white-label partners, and mobile apps in market. Happy to take questions, and I can demo any part of the platform live."

---

# APPENDIX SLIDES (hold in reserve, do not present)

Have these ready. Pull them up only when asked — being able to produce the right appendix slide instantly is worth more than any main slide.

**A1 — Architecture deep dive.** 5 services, nginx gateway, Redis Streams event bus with at-least-once delivery, idempotent consumers deduping on `event_id`, dead-letter queue, stale-message reclaim. OpenAPI-generated TypeScript client. Rate limiting, circuit breakers, shared error envelope. Azure Container Apps + Bicep IaC + KEDA autoscaling.

**A2 — Supplier integration map.** All 13 integrations by product line, with fallback ordering (TravelNext primary → Amadeus/Booking.com fallback), and the booking data model: `bookings`, `booking_passengers`, `booking_flight_segments`, `booking_hotel_stays`.

**A3 — AI pipeline detail.** Regex-first hybrid intent routing → provider chain → segment parsing → route enforcement → per-day inventory backfill → quality gate. Shared airport resolver over the OurAirports dataset with geocoding fallback.

**A4 — Security & compliance.** JWT issued by identity service, internal service-to-service secret, server-authoritative pricing (client-supplied amounts explicitly untrusted), server-metered plan usage, upload validation, token expiry, per-endpoint rate limits, audit event log.

**A5 — Cohort & retention detail.** `[FILL from your data]`

**A6 — Detailed 5-year P&L.** (Pull from Deck 3.)

**A7 — Cap table & prior funding.** `[FILL]`

**A8 — Risks & mitigations.**
| Risk | Mitigation |
|---|---|
| A frontier model ships native booking | We own the supply integration and the edit dataset; we can serve *their* model as a channel |
| MakeMyTrip clones the planner | Their funnel and P&L assume decided travellers; we'd be an acquisition target, not a casualty |
| Supplier concentration on TravelNext | Amadeus + Booking.com already wired as fallbacks; provider-agnostic adapter layer |
| Regulatory (payments, travel licensing) | Stripe as processor; `[FILL: your IATA/travel-agent registration status]` |
| CAC higher than modelled | Free tier is near-zero marginal cost; group virality and agent channel are both non-paid |
| Key-person risk | `[FILL: team depth, documentation, bus factor]` |

---

## Design direction for this deck

- **16:9, dark slate background, one accent colour.** The product's own design tokens — use them so the deck and the product look like the same company.
- **One idea per slide.** Max 5 lines of body text. If a slide needs a paragraph, it belongs in the speaker note.
- **Real screenshots only.** No stock travel photography, no AI-generated hero images. Your credibility here is that the thing exists.
- **Numbers big.** 347, 13, 9, ₹180 Cr — set these at 60pt+. They're the argument.
- **Slide numbers on every slide** so Q&A can reference them.
- Export a **PDF** for the application form. Keep the file under 10MB (the form caps at 30MB, but a 40MB deck signals carelessness). Name it `Travlplanr_Pitch_Deck_[Month]_2026.pdf`.
