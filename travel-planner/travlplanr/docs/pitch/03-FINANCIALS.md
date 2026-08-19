# DECK 3 — HISTORICAL & PROJECTED FINANCIALS
### Travlplanr · 14 slides · FY25–FY31

> **Currency & convention.** All figures in **₹ Crore** unless stated. FX **₹95 = $1** (matches the platform's own FX fallback in `services/shared/fx.py`). Indian fiscal years: **FY27 = Apr 2026 – Mar 2027**. FY25 and FY26 are historical; FY27 is in progress; FY28–FY31 are projected.
>
> **What investors are actually testing on this deck.** Not whether your FY31 number is right — it isn't, nobody's is. They're testing three things: (1) do you know which 3 assumptions the whole model hangs on, (2) is your unit economics honest, (3) does the ask reconcile to the burn. This deck is built to answer those three and nothing else.

---

## Slide 1 — Cover

**On the slide:**
- `Travlplanr` · Historical & Projected Financials
- FY25–FY31 · Prepared `[FILL: Month]` 2026
- Currency: ₹ Crore · FX ₹95 = $1
- Basis: management accounts, unaudited `[FILL: or "reviewed by <CA firm>"]`
- `[FILL: Founder name · email]`

**Visual:** Same template as the other two decks. One line of the revenue chart as a background element, faded.

---

## Slide 2 — How to read this model

**Headline:** Bottoms-up from three drivers. No top-down market-share assumptions anywhere.

**On the slide:**

Revenue is built from three driver chains, not from a % of TAM:

1. **Registered users** → conversion % → **paying subscribers** × ₹999/mo
2. **Registered users** → booking attach % → **bookings** × avg booking value → **GMV** × net take %
3. **Travel partners signed** × ₹4,999/mo + one-time white-label setup

Everything else — COGS, headcount, S&M — is derived from those three.

**Three assumptions the entire model hangs on:**

| Assumption | Base case | Where it's sensitive |
|---|---|---|
| Free → paid conversion | 3.0% steady state | ±1pt swings FY31 revenue by ~₹30 Cr |
| Net take rate on bookings | 8.0% → 10.0% | ±1pt swings FY31 revenue by ~₹7 Cr |
| Blended CAC per registered user | ₹350 | 2× CAC pushes break-even out by ~5 quarters |

**Say:** "I want to point at the three numbers that matter before you find them yourself. Conversion, take rate, CAC. Everything else in this model is downstream arithmetic. Slide 11 stress-tests all three."

---

## Slide 3 — Historical: FY25–FY27 YTD

**Headline:** `[FILL — the honest version. If bootstrapped and pre-revenue, say exactly that.]`

**On the slide:**

| ₹ Cr | FY25 (Apr'24–Mar'25) | FY26 (Apr'25–Mar'26) | FY27 YTD (Apr–Jun'26) |
|---|---|---|---|
| Revenue — subscriptions | `[FILL]` | `[FILL]` | `[FILL]` |
| Revenue — bookings (net take) | `[FILL]` | `[FILL]` | `[FILL]` |
| Revenue — B2B | `[FILL]` | `[FILL]` | `[FILL]` |
| **Total revenue** | `[FILL]` | `[FILL]` | `[FILL]` |
| Booking GMV | `[FILL]` | `[FILL]` | `[FILL]` |
| COGS | `[FILL]` | `[FILL]` | `[FILL]` |
| **Gross profit** | `[FILL]` | `[FILL]` | `[FILL]` |
| Operating expenses | `[FILL]` | `[FILL]` | `[FILL]` |
| **EBITDA** | `[FILL]` | `[FILL]` | `[FILL]` |
| Capital deployed (cumulative) | `[FILL]` | `[FILL]` | `[FILL]` |
| Headcount (EOY) | `[FILL]` | `[FILL]` | `[FILL]` |
| Registered users (EOY) | `[FILL]` | `[FILL]` | `[FILL]` |

**Visual:** Bar chart of the three historical years, even if the bars are near zero. Do not omit the chart because the numbers are small.

**Say:** "Here's the honest picture. `[FILL: e.g. 'FY25 and FY26 were build years — no revenue, ₹X of founder capital deployed, and what that capital bought is on the next slide.']`"

> **Filling this in — three rules.**
> 1. **Never leave this slide out.** A pitch deck with no historical financials reads as concealment. A historical financials slide that says "₹0 revenue, ₹X invested, here's what we built" reads as candour, and candour is what gets you the second meeting.
> 2. **Reconcile to your bank statements.** Whatever you put here, due diligence will match against your accounts. Round numbers are fine; wrong numbers are not.
> 3. If you have *any* revenue at all — one paying subscriber, one booking — show it. First-rupee proof is disproportionately valuable because it proves the payment rail works end to end.

---

## Slide 4 — What the historical spend bought

**Headline:** `[FILL: e.g. "₹X of capital converted into a live 13-integration booking platform."]`

**On the slide:**

**Capital in → asset out**

| Invested | `[FILL: ₹X Cr]` |
|---|---|
| Delivered | 5 microservices · 347 API endpoints · 76 database tables · 31 migrations |
| | ~47,000 lines Python · ~64,000 lines TypeScript · 166 UI components |
| | **13 live supplier integrations** across 9 travel product lines |
| | Stripe payments live, server-authoritative pricing, live-tunable markup |
| | Self-hosted AI generation (Qwen 3.6, 128k ctx) + 3-provider commercial fallback |
| | Admin CMS, reporting dashboards, community platform, collaboration + expense splitting |
| | 3 languages, 3 currencies with live ECB rates, PDF export, voice input |

**Benchmark:** comparable AI-travel platforms have raised **$3.4M–$22.5M** to reach a *narrower* product footprint — Layla ($3.4M, thin booking rail), Mindtrip ($22.5M, flights only).

**Visual:** A simple two-box "in → out" diagram with the capital figure on the left and the asset list on the right.

**Say:** "This is the slide that makes the rest of the model believable. Mindtrip has raised twenty-two and a half million dollars and shipped agentic booking for flights. We've shipped it for nine product lines on `[FILL: a fraction of that]`. Capital efficiency isn't a virtue I'm claiming — it's an observable track record, and it's the single best predictor of what we do with yours."

**Sources:** [Skift — Mindtrip](https://skift.com/2024/09/17/mindtrip-raises-12-million-in-tough-funding-environment-for-ai-trip-planners/) · [Layla — Crunchbase](https://www.crunchbase.com/organization/layla-7376)

---

## Slide 5 — Revenue drivers (the operating model)

**Headline:** Every rupee of revenue traces back to a driver on this slide.

**On the slide:**

| Driver | FY27 | FY28 | FY29 | FY30 | FY31 |
|---|---|---|---|---|---|
| Registered users, EOY ('000) | 25 | 120 | 400 | 1,000 | 2,200 |
| New registered users ('000) | 25 | 95 | 280 | 600 | 1,200 |
| Free → paid conversion | 2.0% | 2.5% | 3.0% | 3.2% | 3.5% |
| **Avg paying subscribers** | **400** | **2,600** | **10,000** | **30,000** | **75,000** |
| Consumer ARPU (₹/month) | 999 | 999 | 999 | 999 | 999 |
| Travel partners, avg active | 8 | 55 | 200 | 550 | 1,200 |
| New partners onboarded | 10 | 70 | 220 | 500 | 900 |
| Bookings ('000) | 1.8 | 12.7 | 47.7 | 136.4 | 318.2 |
| Avg booking value (₹) | 22,000 | 22,000 | 22,000 | 22,000 | 22,000 |
| **Booking GMV (₹ Cr)** | **4** | **28** | **105** | **300** | **700** |
| Net take rate | 8.0% | 8.5% | 9.0% | 9.5% | 10.0% |

**Visual:** Two charts side by side — registered users (area) and GMV (bars) — sharing an x-axis.

**Say:** "Three things to notice. Conversion climbs slowly and stops at three and a half percent — I'm not modelling a step-change in the product. Average booking value is held flat at twenty-two thousand rupees for all five years, which is conservative given the outbound mix grows. And take rate rises only two points across five years, from supplier-tier improvements and mix shift toward activities and transfers, where commissions run fifteen to thirty-five percent."

**Take-rate benchmark:** hotels **15–30%** supplier commission, tours & activities **15–35%** (20–25% typical), flights near-zero. Our 8–10% *net* take is a blend across the mix, after payment processing and after passing value back to the traveller.

**Sources:** [Cloudbeds — OTA Commissions 2026](https://www.cloudbeds.com/online-travel-agencies/commissions/) · [Samba — Tour OTA Rates 2026](https://www.sambahq.com/ota-supplier-guide/ota-commission-rates)

---

## Slide 6 — Revenue by line

**Headline:** ₹0.88 Cr → ₹174 Cr in five years. Bookings overtake subscriptions in FY29.

**On the slide:**

| ₹ Cr | FY27 | FY28 | FY29 | FY30 | FY31 |
|---|---|---|---|---|---|
| Consumer subscriptions | 0.48 | 3.12 | 11.99 | 35.96 | 89.91 |
| Booking take-rate | 0.32 | 2.38 | 9.45 | 28.50 | 70.00 |
| B2B subscriptions | 0.05 | 0.33 | 1.20 | 3.30 | 7.20 |
| White-label setup fees | 0.03 | 0.17 | 0.55 | 1.25 | 2.25 |
| Promoted inventory / ads | — | 0.12 | 0.60 | 1.80 | 5.00 |
| **Total revenue** | **0.88** | **6.12** | **23.79** | **70.81** | **174.36** |
| Growth % | — | 595% | 289% | 198% | 146% |
| Revenue ($M) | 0.09 | 0.64 | 2.50 | 7.45 | 18.35 |

**Visual:** Stacked bars, one per year, colour-coded by line. Annotate FY29 with "bookings ≈ 40% of revenue".

**Say:** "The mix shift is the strategic story in one chart. We start subscription-led because that's what a free-tier funnel converts into, and we end up booking-led because take-rate revenue scales with *trip value* rather than with user count. The promoted-inventory line is deliberately small — the tables and feed placements are already built, but I'm not asking you to underwrite an ad business."

---

## Slide 7 — Cost of revenue & gross margin

**Headline:** Gross margin goes from 80% to 89% — because we host our own inference.

**On the slide:**

| ₹ Cr | FY27 | FY28 | FY29 | FY30 | FY31 |
|---|---|---|---|---|---|
| Cloud infrastructure | 0.09 | 0.42 | 1.35 | 3.60 | 7.80 |
| AI / GPU (self-hosted + fallback burst) | 0.04 | 0.18 | 0.60 | 1.50 | 3.20 |
| Payment processing (on subscriptions) | 0.01 | 0.09 | 0.34 | 1.01 | 2.49 |
| Third-party data APIs (Places, Routes, Tripadvisor) | 0.02 | 0.10 | 0.35 | 0.95 | 2.10 |
| Booking support (₹90/booking) | 0.02 | 0.11 | 0.43 | 1.23 | 2.86 |
| **Total COGS** | **0.18** | **0.90** | **3.07** | **8.29** | **18.45** |
| **Gross profit** | **0.70** | **5.22** | **20.72** | **62.52** | **155.91** |
| **Gross margin** | **80%** | **85%** | **87%** | **88%** | **89%** |

**Why margin *improves* with scale — the one structural advantage in this model:**
- Itinerary generation runs on a **self-hosted open-weight model on our own GPU**. The cost is a fixed asset, not a per-call fee. Doubling generations does not double the AI bill.
- Three commercial providers (Groq, Gemini, Anthropic) sit behind it as burst/fallback capacity only — a small, controllable slice, not the base load.
- Booking take-rate revenue is **already net of payment fees**, so there's no margin decay as GMV grows.

**Visual:** Line chart of gross margin % climbing left to right, with a second, dotted line labelled "typical AI-native competitor (cloud inference)" trending *downward* for contrast.

**Say:** "Almost every AI company's gross margin degrades with usage, because inference is a variable cost paid to a vendor. Ours improves, because we own the GPU. That's why our free tier is a weapon and not a wound, and it's why I can hold an eighty-nine percent gross margin at scale with a straight face."

---

## Slide 8 — Operating expenses

**Headline:** S&M falls from 97% of revenue to 25%. Headcount scales behind revenue, not ahead of it.

**On the slide:**

| ₹ Cr | FY27 | FY28 | FY29 | FY30 | FY31 |
|---|---|---|---|---|---|
| People (avg FTE) | 7 | 19 | 42 | 85 | 155 |
| People cost | 1.26 | 3.61 | 8.40 | 17.85 | 34.10 |
| Sales & marketing | 0.85 | 3.40 | 9.80 | 22.00 | 44.00 |
| G&A (legal, audit, compliance, tools, office) | 0.42 | 1.05 | 2.40 | 5.20 | 9.50 |
| Product & tech non-people | 0.15 | 0.35 | 0.80 | 1.60 | 2.80 |
| **Total operating expenses** | **2.68** | **8.41** | **21.40** | **46.65** | **90.40** |
| S&M as % of revenue | 97% | 56% | 41% | 31% | 25% |
| Avg fully-loaded cost per FTE (₹ L) | 18 | 19 | 20 | 21 | 22 |
| Implied blended CAC per registered user (₹) | 340 | 358 | 350 | 367 | 367 |

**Visual:** Stacked opex bars with the "S&M as % of revenue" line overlaid on a secondary axis, falling steeply.

**Say:** "Two disciplines are baked in here. First, S&M as a share of revenue falls by a factor of four, and that fall isn't wishful — it comes from the two non-paid channels in the go-to-market: group invites and white-label agents. Second, implied CAC per registered user stays flat around three hundred and fifty rupees rather than magically improving, because I'd rather be wrong conservatively."

---

## Slide 9 — Unit economics (read this slide carefully)

**Headline:** ₹350 to acquire. ₹1,140 of lifetime contribution. 3.3× — and bookings are two-thirds of it.

**On the slide:**

**Per registered user (steady state, FY29 basis)**

| | |
|---|---|
| Blended CAC | **₹350** |
| Subscription contribution over life | ₹294 *(3% convert × ₹889/mo gross contribution × 11-month avg life)* |
| Booking contribution over life | ₹846 *(0.45 bookings/user lifetime × ₹22,000 × 9% net take × 95% margin)* |
| **Total lifetime contribution** | **₹1,140** |
| **LTV : CAC** | **3.3×** |
| Year-1 contribution per user | ₹570 |
| **CAC payback** | **~7 months** |

**Per paying subscriber (subscription only)**

| | |
|---|---|
| ARPU | ₹999/month |
| Gross contribution | ₹889/month (89% margin) |
| Avg subscription life | 11 months *(travel is seasonal — assumes ~9%/month churn)* |
| Subscription-only LTV | ₹9,779 |
| Fully-loaded CAC per *paying* subscriber | ₹11,667 *(₹350 ÷ 3% conversion)* |

**The conclusion I want you to draw from those two tables:**

> **Subscription revenue alone does not pay for paid acquisition** — ₹9,779 of LTV against ₹11,667 of loaded CAC is a losing trade. The booking rail is what makes the unit economics work, because it monetises the **97% of users who never subscribe.** This is precisely why we built the booking layer instead of stopping at a planner — it isn't a nice-to-have adjacent revenue line, it is the reason the business closes.

**Visual:** Two stacked bars side by side. Left: CAC ₹350. Right: contribution ₹1,140, split into a small subscription block and a large booking block. Let the size difference make the argument.

**Say:** "I'm showing you the version of this slide that most founders hide. If we were a subscription-only AI planner — which is what every competitor in the category is — our loaded CAC would exceed our LTV and we'd be building a business that gets worse as it grows. The booking rail monetises the ninety-seven percent who never pay us a subscription, and it's two-thirds of lifetime value. That's the whole reason the nine integrations exist."

---

## Slide 10 — P&L summary and path to profitability

**Headline:** EBITDA break-even inside FY29. Full-year profitable from FY30.

**On the slide:**

| ₹ Cr | FY27 | FY28 | FY29 | FY30 | FY31 |
|---|---|---|---|---|---|
| Revenue | 0.88 | 6.12 | 23.79 | 70.81 | 174.36 |
| COGS | (0.18) | (0.90) | (3.07) | (8.29) | (18.45) |
| **Gross profit** | **0.70** | **5.22** | **20.72** | **62.52** | **155.91** |
| Gross margin | 80% | 85% | 87% | 88% | 89% |
| Operating expenses | (2.68) | (8.41) | (21.40) | (46.65) | (90.40) |
| **EBITDA** | **(1.98)** | **(3.19)** | **(0.68)** | **15.87** | **65.51** |
| EBITDA margin | (225%) | (52%) | (3%) | 22% | 38% |
| Cumulative EBITDA | (1.98) | (5.17) | (5.85) | 10.02 | 75.53 |

- **Peak cumulative loss: ₹5.85 Cr** — the total operating cash the business ever consumes before it funds itself
- Monthly EBITDA crosses zero in **Q3 FY29**
- FY30–31 profitability is deliberately conservative on S&M. **At a Series A we'd reinvest that margin into growth rather than bank it** — see the upside case on the next slide.

**Visual:** Waterfall or combo chart: revenue bars with the EBITDA line crossing zero. Annotate the crossover point and the ₹5.85 Cr trough.

**Say:** "The number I'd anchor on is five point eight five crore. That's the peak cumulative operating loss — the most this business ever consumes before it pays for itself. We're asking for twelve crore against a five-point-nine crore hole, and the next slide explains exactly why the gap is there rather than pretending it isn't."

---

## Slide 11 — Sensitivity & scenarios

**Headline:** In the downside case we still reach break-even without another round.

**On the slide:**

**Sensitivity — FY31 revenue (₹ Cr) at varying conversion and CAC**

| | CAC ₹250 | CAC ₹350 (base) | CAC ₹525 | CAC ₹700 |
|---|---|---|---|---|
| **Conversion 1.5%** | 118 | 106 | 88 | 72 |
| **Conversion 2.5%** | 155 | 141 | 118 | 97 |
| **Conversion 3.5% (base)** | 196 | **174** | 146 | 120 |
| **Conversion 4.5%** | 238 | 212 | 178 | 147 |

*(Higher CAC reduces users acquired for the same S&M budget, so it lowers revenue as well as raising cost.)*

**Three scenarios**

| | Downside | **Base** | Upside |
|---|---|---|---|
| Conversion | 1.5% | **3.5%** | 4.5% |
| CAC | ₹525 | **₹350** | ₹300 |
| GMV FY31 | ₹350 Cr | **₹700 Cr** | ₹1,150 Cr |
| Revenue FY31 | ₹88 Cr | **₹174 Cr** | ₹268 Cr |
| EBITDA break-even | FY31 | **FY29** | FY30 *(deliberately re-invested)* |
| Peak cumulative loss | ₹9.6 Cr | **₹5.85 Cr** | ₹11.2 Cr |
| Does ₹12 Cr suffice? | **Yes** | **Yes, with 30+ months runway** | Yes, then raise into strength |

**Visual:** The sensitivity table as a heat map (red → green). Scenarios as three revenue lines on one chart.

**Say:** "This is why the ask is twelve crore against a five-point-nine crore base-case hole. Twelve crore is sized so the *downside* case survives without a bridge round — a nine-point-six crore peak loss if conversion halves and CAC rises fifty percent. And in the upside case, the surplus goes into S&M to buy the faster curve rather than sitting in the bank. I'd rather over-raise slightly and never need a bridge than raise precisely and lose the company to a bad quarter."

---

## Slide 12 — Cash flow & runway

**Headline:** ₹12 Cr in. Cash never drops below ₹2 Cr. Never needs a second round to survive.

**On the slide:**

| ₹ Cr | FY27 | FY28 | FY29 | FY30 | FY31 |
|---|---|---|---|---|---|
| Opening cash | 12.00 | 8.72 | 4.53 | 2.15 | 14.62 |
| EBITDA | (1.98) | (3.19) | (0.68) | 15.87 | 65.51 |
| Capex (GPU, equipment) | (1.20) | (0.45) | (0.60) | (1.20) | (2.00) |
| Working capital (supplier deposits, receivables) | (0.10) | (0.55) | (1.10) | (2.20) | (4.50) |
| Tax | — | — | — | — | (14.50) |
| **Net cash flow** | **(3.28)** | **(4.19)** | **(2.38)** | **12.47** | **44.51** |
| **Closing cash** | **8.72** | **4.53** | **2.15** | **14.62** | **59.13** |
| Runway at year-end (months) | 32 | 13 | ∞ *(cash-flow positive)* | ∞ | ∞ |

- **Reconciliation of the ask:** ₹5.85 Cr cumulative operating loss + ₹2.25 Cr capex + ₹1.75 Cr working capital + ₹2.15 Cr closing buffer = **₹12.00 Cr**
- FY30 tax is nil — ₹5.85 Cr of carried-forward losses offset the first profitable year
- Booking flow is collected via Stripe and remitted to suppliers; modelled conservatively as a working-capital **outflow** (deposits/prepayments) rather than claiming float as a benefit

**Visual:** Cash balance as an area chart dipping to its ₹2.15 Cr trough in FY29 then rising. Mark the trough.

**Say:** "The ask reconciles line by line — five point eight five of operating loss, two and a quarter of capex mostly GPU, one seventy-five of working capital, and a two crore closing buffer. Twelve crore exactly. The trough is two point one five crore in FY29, and by then we're at monthly break-even. A Series A after that would be a growth decision, not a survival one — and raising from that position is worth several turns of valuation."

---

## Slide 13 — Key metrics dashboard

**Headline:** The eight numbers we'll report to you every month.

**On the slide:**

| Metric | FY27 | FY28 | FY29 | FY30 | FY31 | Source of truth |
|---|---|---|---|---|---|---|
| Registered users (EOY, '000) | 25 | 120 | 400 | 1,000 | 2,200 | `users` |
| Paying subscribers (avg) | 400 | 2,600 | 10,000 | 30,000 | 75,000 | `subscriptions` |
| Free → paid conversion | 2.0% | 2.5% | 3.0% | 3.2% | 3.5% | `subscriptions` / `users` |
| Booking GMV (₹ Cr) | 4 | 28 | 105 | 300 | 700 | `bookings` |
| Net take rate | 8.0% | 8.5% | 9.0% | 9.5% | 10.0% | `bookings` + markup config |
| Revenue (₹ Cr) | 0.88 | 6.12 | 23.79 | 70.81 | 174.36 | reporting service |
| Gross margin | 80% | 85% | 87% | 88% | 89% | reporting service |
| Blended CAC (₹) | 340 | 358 | 350 | 367 | 367 | S&M ÷ new users |
| **AI acceptance rate** *(activities kept unedited)* | `[FILL: baseline]` | +5pt | +10pt | +14pt | +17pt | `activity_acceptance_stats` |
| **Collaborators invited per trip** | `[FILL]` | 2.0 | 2.5 | 2.8 | 3.0 | `trip_collaborators` |

**Visual:** A clean metrics grid. Highlight the last two rows in the accent colour.

**Say:** "Every one of these already has a query behind it — the reporting service builds these projections off the event bus, so this isn't a spreadsheet I'd have to reconstruct each month. And I'd draw your attention to the bottom two rows, because they're the leading indicators nobody else in this category can even measure: whether our AI is getting measurably better, and whether each trip is bringing its own users."

---

## Slide 14 — The ask, reconciled

**Headline:** ₹12 Cr (~$1.25M) seed. Here's the line-by-line, and what it buys.

**On the slide:**

**Use of funds**

| | ₹ Cr | % |
|---|---|---|
| Engineering & product (6 hires) | 4.80 | 40% |
| Growth & marketing | 3.60 | 30% |
| B2B / partnerships | 1.80 | 15% |
| Infrastructure & AI (incl. GPU capex) | 1.20 | 10% |
| G&A, legal, travel & payments compliance | 0.60 | 5% |
| **Total** | **12.00** | **100%** |

**24-month milestones**

| | Target |
|---|---|
| Revenue run-rate | ₹6.1 Cr (~$645k) |
| Booking GMV | ₹28 Cr cumulative |
| Registered users | 120,000 |
| Paying subscribers | 3,000 |
| White-label travel partners live | 60 |
| Booking flow | End-to-end on all 9 product lines — fare rules, price confirmation, ticketing, cancellation |
| Mobile | iOS + Android shipped |

**Comparables for this round**

| Company | Raised | Stage reached |
|---|---|---|
| Mindtrip (US) | $22.5M total | Flight booking in chat |
| Layla (EU) | $3.4M | $1B trips planned, thin booking |
| 30 Sundays (India) | ₹61 Cr (after $770K pre-seed) | Outbound packages |
| **Travlplanr** | **₹12 Cr sought** | **9 product lines already integrated** |

**Visual:** Donut of use of funds, milestone checklist beside it, comparables table beneath.

**Say:** "Twelve crore, twenty-four months, and the milestone I'd hold myself to hardest is the booking one — closing out fare rules, ticketing and cancellations across all nine lines. That's the difference between a platform that can book and a platform that can operate at scale. On the comparables: Indian investors just put sixty-one crore into a narrower version of this thesis, and the two best-funded global players have raised twenty-six million dollars between them for less product surface than we already run. Twelve crore, against that, is not an aggressive number."

**Sources:** [Skift — Mindtrip](https://skift.com/2024/09/17/mindtrip-raises-12-million-in-tough-funding-environment-for-ai-trip-planners/) · [Layla](https://www.crunchbase.com/organization/layla-7376) · [Inc42 — 30 Sundays ₹61 Cr](https://inc42.com/buzz/traveltech-startup-30-sundays-raises-%E2%82%B961-cr-to-expand-ai-powered-holiday-planning/)

---

# APPENDIX (hold in reserve)

**F1 — Monthly P&L, FY27–FY28.** Build this in the spreadsheet. Investors doing real diligence will ask for month-by-month for the 24 months the round covers. Do not present it; have it ready.

**F2 — Cohort revenue retention.** `[FILL]` — monthly cohorts by signup month, showing revenue retention curves. If you have even 6 months of cohorts, this is the highest-value appendix slide you can build.

**F3 — Churn assumption build.** 9%/month subscriber churn → 11-month average life. Justify against travel seasonality: users churn after their trip and return before the next one, so annual reactivation partly offsets gross churn. Note whether your model counts reactivations as new or returning.

**F4 — Full COGS build per unit.** Cost per itinerary generated (self-hosted vs each fallback provider), cost per booking, cost per support ticket.

**F5 — Detailed headcount plan.** All 155 FY31 roles by function and year, with salary bands.

**F6 — Tax & structure.** `[FILL: entity type, jurisdiction, GST registration, DPIIT/Startup India recognition status, transfer pricing if any offshore entity.]`

**F7 — Cap table pre/post round.** `[FILL: including the ESOP pool and post-money ownership at the proposed valuation.]`

**F8 — Assumption register.** Every assumption in the model, one row each, with source and confidence. Boring, and the single most reassuring document you can hand a diligence analyst.

---

## Build & delivery notes

**Build the spreadsheet first, the slides second.** The slides are a rendering of a model, and investors will ask for the model. Structure it as: `Drivers` tab → `Revenue` → `COGS` → `Opex` → `P&L` → `Cash flow` → `Scenarios`. Every number on every slide should be a cell reference, never a typed constant. If a number appears on a slide and not in the model, it will be the one they ask about.

**Three consistency checks before you export:**
1. FY31 revenue on the pitch deck matches FY31 revenue here — **₹174.36 Cr**. Decks that disagree with themselves lose the room.
2. The ₹12 Cr ask and its 5-way split are identical in both decks.
3. Anything marked `[FILL]` is filled, or the row is deleted. An unfilled placeholder in a financials document is worse than an omission.

**A note on the projections.** These are a coherent, defensible base case built bottoms-up from the product that exists and from 2026 market benchmarks — not a forecast, and not audited. Label the deck **"management projections, unaudited"** on the cover. Every serious investor knows the FY31 number is wrong; what they're grading is whether your driver logic is sound and your assumptions are honest. Both are, here. Own the assumptions in the room, name the ones you're least sure about before they do, and you'll be in the small minority of seed founders who present financials credibly.

**Export as** `Travlplanr_Financials_[Month]_2026.pdf`, and have `Travlplanr_Financial_Model.xlsx` ready to send on request.
