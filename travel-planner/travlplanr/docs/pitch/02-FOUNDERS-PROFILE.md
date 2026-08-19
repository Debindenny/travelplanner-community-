# DECK 2 — FOUNDER(S) PROFILE
### Travlplanr · 12 slides · a standalone read-alone document

> **What this document is for.** Investors read the pitch deck to decide if the *market* is interesting. They read this one to decide if *you* are the person who wins it. It gets read without you in the room, so unlike the pitch deck, this one may carry full sentences.
>
> **What it must prove, in order:** (1) you have unfair insight into this problem, (2) you can build — and here the evidence is exceptional, (3) you can sell, (4) the team is complete enough to execute and honest about what's missing, (5) you're coachable and referenceable.

---

## Slide 1 — Cover

**Headline:** Founder Profile — Travlplanr

**On the slide:**
- `Travlplanr` · Founder(s) Profile
- `[FILL: Founder name — Title]` · `[FILL: Co-founder name — Title]`
- `[FILL: city, country]`
- `[FILL: email · phone · LinkedIn URL(s)]`
- Company founded `[FILL: month/year]` · Platform live since `[FILL]`

**Visual:** Founder headshot(s) — professional, plain background, looking at camera. If two founders, side by side, same crop, same lighting. This matters more than founders think: mismatched or casual photos read as an unserious team.

---

## Slide 2 — Founder at a glance

**Headline:** `[FILL: one line that positions you — e.g. "Full-stack engineer who has shipped and operated production travel infrastructure end-to-end."]`

**On the slide — a snapshot box:**

| | |
|---|---|
| Name | `[FILL]` |
| Role | `[FILL: Founder & CEO / CTO]` |
| Based in | `[FILL]` |
| Years of experience | `[FILL]` |
| Education | `[FILL: degree, institution, year]` |
| Previously | `[FILL: 2–3 most credible roles — company, title, dates]` |
| Domain edge | `[FILL: travel industry exposure, or the personal experience that gave you the insight]` |
| Technical edge | Architected and built a 5-service, 347-endpoint travel platform with 13 live supplier integrations |
| Commitment | `[FILL: full-time since <date> / notice period ends <date>]` |
| Equity held | `[FILL: %]` |

**Say / write:** Keep this to fact form. No adjectives. The next slides do the persuading.

> **If you are a solo founder:** say so plainly here and address it head-on on Slide 8. Solo founders raise seed rounds all the time; solo founders who *pretend* to have a team do not.

---

## Slide 3 — Why me, why this

**Headline:** `[FILL: the origin story in one sentence — the specific moment you hit this problem]`

**On the slide — three short blocks:**

**The problem I lived**
`[FILL: 2–3 sentences. Be specific and dated. "In [month year] I planned a [n]-day trip to [place] and spent [n] hours across [n] sites, and still got [specific thing] wrong." Specificity is the whole trick — a generic "travel planning is broken" origin story is forgettable; a dated, concrete one is not.]`

**What I saw that others didn't**
`[FILL: your actual insight. Candidates, pick the one that's genuinely yours:
 • "The planning and the booking are treated as two industries. The traveller experiences them as one act."
 • "The valuable data isn't the itinerary the AI produced — it's the edit the traveller made to it."
 • "In India the traveller is coming online for the first time on their phone, and the whole outbound funnel is still built for someone who already knows where they're going."]`

**Why I'm the one who ships it**
`[FILL: 2–3 sentences tying your specific background to the specific hard part. The hard part of this business is the 9-product-line booking integration, not the AI. If your background is engineering/integration, say that plainly.]`

**Visual:** A simple three-panel: the frustrating moment → the insight → the platform screenshot. Or a single photo of the actual trip that started it, if you have one — it humanises the whole document.

---

## Slide 4 — Track record

**Headline:** `[FILL: e.g. "15 years shipping production systems. Three of them in travel."]`

**On the slide — reverse-chronological, outcomes not duties:**

| Period | Company / Role | What I owned | Outcome |
|---|---|---|---|
| `[FILL]` | Travlplanr — Founder | Whole product & platform | 5 services, 347 endpoints, 13 integrations, payments live |
| `[FILL]` | `[company, role]` | `[FILL]` | `[FILL: a number. Revenue moved, users served, system scaled, team grown, money saved.]` |
| `[FILL]` | `[company, role]` | `[FILL]` | `[FILL: a number.]` |
| `[FILL]` | `[education]` | `[FILL]` | `[FILL]` |

**Rules for filling this in:**
- Every row ends in a **quantified** outcome. "Led the payments team" is nothing. "Rebuilt payments, cut failed transactions from 4.1% to 0.9% across ₹40 Cr/yr of volume" is everything.
- If you've founded before — **lead with it, including the failure.** A failed prior startup with a clear articulated lesson is a strong positive signal at seed. Hiding it is a negative one.
- Cut anything older than 12 years unless it's a marquee name.

---

## Slide 5 — Proof of execution (your strongest slide — use it)

**Headline:** Judge me on what I've already shipped, not on what I'm promising.

**On the slide:**

**Built and running today:**

| Layer | Delivered |
|---|---|
| Backend | 5 FastAPI microservices — identity, planner, ai-worker, affiliate, reporting — plus a shared library. **~47,000 lines of Python across 284 modules** |
| API surface | **347 HTTP + WebSocket endpoints**, OpenAPI-documented, versioned, with a shared error envelope, rate limiting and circuit breakers |
| Data | **76 PostgreSQL tables**, 31 versioned migrations |
| Frontend | Angular 17 signals-first SPA — **166 components, ~64,000 lines of TypeScript** — plus a separate admin CMS app |
| Supplier integrations | **13 live**: 9 TravelNext product lines (flights, hotels, cars, transfers, rail, activities, events, holidays, cruise) + Amadeus, Booking.com, Google Places/Routes, Tripadvisor |
| AI | Self-hosted open-weight model (Qwen 3.6, 128k context, custom prompt + tuned sampling) behind a 4-provider fallback chain (local → Groq → Gemini → Anthropic), ~0.5s first token, plus a measured learning flywheel with versioned prompts |
| Payments | Stripe live, server-authoritative pricing, live-tunable B2B/B2C markup |
| Reliability | Redis Streams event bus, at-least-once delivery, idempotent consumers, dead-letter queue, stale-message reclaim |
| Ops | Docker Compose local stack, Azure Container Apps + Bicep IaC + KEDA autoscaling, GitHub Actions CI, 47 test modules |
| Reach | 3 languages (EN/ES/FR), 3 currencies (₹/$/€) with live ECB rates, voice input with self-hosted Whisper fallback, PDF itinerary export |

**Visual:** The architecture diagram, same one as the pitch deck. Consistency across documents reads as rigour.

**Say / write:** "Most founders at this stage ask investors to believe a plan. I'm asking them to inspect a platform. The hardest part of this business — nine separate booking integrations, a payments flow, and a real PNR-level data model — is done. That's the risk this round doesn't have to carry."

> This slide is your single biggest asset in this document. Put it early, make it dense, and offer a live technical deep-dive. Very few seed-stage travel founders can produce it.

---

## Slide 6 — What I've learned building it

**Headline:** `[FILL: e.g. "Three things I got wrong, and what they taught me."]`

**On the slide — 3 items, each: the belief → what happened → what we changed:**

1. `[FILL. Strong candidates drawn from the actual build:
   • "I assumed the AI was the hard part. The AI took weeks; the nine supplier integrations took months. The moat turned out to be in the plumbing."
   • "I assumed cloud LLM APIs were the only option. Moving generation to a self-hosted warm model cut our per-itinerary cost to ~zero and changed our entire acquisition strategy — we can now afford a real free tier."
   • "I assumed travellers wanted a finished itinerary. They wanted a first draft they could argue with — which is why every edit is now logged as training signal."]`
2. `[FILL]`
3. `[FILL]`

**Visual:** Three cards. Keep them plain — this slide's power is its honesty, not its design.

**Say / write:** Investors are buying your learning rate more than your current answers. A founder who can name three specific things they were wrong about, with the resulting change, reads as far more fundable than one who has always been right.

---

## Slide 7 — Domain credibility & network

**Headline:** `[FILL: e.g. "Relationships that shorten our path to supply and distribution."]`

**On the slide:**

**Travel industry access**
- `[FILL: supplier/aggregator relationships — TravelNext account status, any direct hotel/DMC contacts, IATA registration or path to it]`
- `[FILL: any travel-agent network relationships relevant to the Phase-3 white-label GTM]`

**Technical / AI network**
- `[FILL: communities, open-source contributions, published work, conference talks]`

**Advisors** *(list only people who have actually agreed — investors do check)*

| Name | Background | Helping with |
|---|---|---|
| `[FILL]` | `[FILL]` | `[FILL]` |
| `[FILL]` | `[FILL]` | `[FILL]` |

**If this slide is thin:** don't pad it — instead say what you're doing about it. "We have no travel-industry advisor yet; closing one is a stated milestone of this round" is a credible answer. Fabricated advisors are a fatal one.

---

## Slide 8 — The team today

**Headline:** `[FILL: e.g. "N people, built for shipping. Here's who does what — and what we're missing."]`

**On the slide:**

| Person | Role | Owns | Background | FT/PT | Equity |
|---|---|---|---|---|---|
| `[FILL]` | Founder | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` |
| `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` |
| `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` |

**Gaps we're honest about:**
- `[FILL: e.g. "No dedicated growth/performance-marketing lead — this is hire #1 out of this round."]`
- `[FILL: e.g. "No travel-supply/contracting lead — hire #2."]`
- `[FILL: e.g. "No mobile engineer — apps are a milestone of this round."]`

**Visual:** Simple photo grid with name + role captions. Don't invent an org chart for a team of four.

> **Do not put placeholder teams on this slide.** The public `about` page currently lists a generic "Product Team" and "Travel Research Team" — that's marketing copy. An investor document needs real names and real roles, or an honest statement that you're solo/two-person. Being small is fine. Looking evasive is not.

---

## Slide 9 — Hiring plan for this round

**Headline:** Six hires in 24 months, each tied to a milestone.

**On the slide:**

| # | Role | When | Why now / what it unblocks |
|---|---|---|---|
| 1 | Growth lead (performance + content) | Month 1 | Find the CAC floor; own the SEO/content engine that Phase-1 GTM depends on |
| 2 | Backend engineer — booking flow | Month 1 | Close the last mile: fare rules, price confirmation, ticketing, cancellations across all 9 lines |
| 3 | Mobile engineer (React Native / Flutter) | Month 3 | iOS + Android — travel is a phone-first behaviour and we're web-only today |
| 4 | B2B / partnerships lead | Month 6 | Sign and onboard white-label travel agents; the zero-CAC channel |
| 5 | ML / data engineer | Month 9 | Turn the learning flywheel from logged data into a measurable generation-quality lift |
| 6 | Customer success / trust & safety | Month 12 | Booking support obligations + community moderation at scale |

**Visual:** A 24-month timeline with the six hires plotted, and the milestone each one unblocks beneath.

**Say / write:** Tie each hire to a milestone from the pitch deck's ask slide. Headcount without an attached outcome reads as burn.

---

## Slide 10 — How I operate

**Headline:** `[FILL: your actual operating principles — 3, not 10]`

**On the slide — pick 3 and make each one falsifiable:**
- `[FILL: e.g. "Ship weekly. The platform has been deployed continuously since <date>."]`
- `[FILL: e.g. "Instrument before optimising. Every AI decision is logged with its outcome — that's why we can measure generation quality instead of guessing at it."]`
- `[FILL: e.g. "Buy nothing we can host. Self-hosted inference, self-hosted transcription, self-hosted object storage — it's why our gross margin improves with scale."]`

**Visual:** Three icons, three lines. Resist the urge to make this a values poster.

**Say / write:** Each principle should be provable from the codebase or your history. Aspirational values slides get skimmed; falsifiable ones get remembered.

---

## Slide 11 — Prior funding, cap table & commitment

**Headline:** `[FILL: e.g. "Bootstrapped to a live platform. ₹X of founder capital in, 100% founder-owned."]`

**On the slide:**

**Capital in to date**

| Source | Amount | Date | Instrument |
|---|---|---|---|
| `[FILL: Founder savings / friends & family / angel / grant]` | `[FILL]` | `[FILL]` | `[FILL]` |

**Cap table today**

| Holder | % |
|---|---|
| `[FILL: Founder]` | `[FILL]` |
| `[FILL: Co-founder]` | `[FILL]` |
| ESOP pool | `[FILL]` |
| Existing investors | `[FILL]` |

**Personal commitment**
- `[FILL: Full-time since <date>. Personal capital invested: ₹X. Other commitments: none / <disclose>.]`
- `[FILL: Vesting — founders on a 4-year schedule with a 1-year cliff, or state your intent to adopt one.]`

**Say / write:** If you bootstrapped this platform to its current state, **lead with it.** Building 347 endpoints and 13 integrations on founder capital is one of the strongest signals in this entire document set — it demonstrates capital efficiency in a way no projection can.

---

## Slide 12 — References & contact

**Headline:** Please talk to people who've worked with me.

**On the slide:**

**References** *(ask permission first — always)*

| Name | Relationship | Company / Role | Contact |
|---|---|---|---|
| `[FILL]` | `[FILL: former manager / co-founder / client]` | `[FILL]` | `[FILL]` |
| `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` |
| `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` |

**Aim for a mix:** someone who managed you, someone who worked *for* you, and someone who paid you.

**Links**
- Product: `[FILL: travlplanr.com]`
- LinkedIn: `[FILL]`
- GitHub / portfolio: `[FILL]`
- Live demo: **available on request — I'll walk any part of the platform, including the codebase**

**Contact:** `[FILL: email · phone]`

**Say / write:** Offering references unprompted, and offering a live codebase walkthrough, both signal that there's nothing to hide. Few founders do either.

---

# FILL CHECKLIST

Work down this list before you export. Anything still marked `[FILL]` at export time is a hole an investor will find.

**Must have — the document is not sendable without these**
- [ ] Founder name(s), title(s), photo(s)
- [ ] Education and employment history with dates
- [ ] The origin story, dated and specific
- [ ] Real team names and roles (or an explicit "I'm solo")
- [ ] Cap table and capital-in to date
- [ ] Contact details and LinkedIn

**Should have — each one materially raises the document**
- [ ] Quantified outcomes on every past-role row
- [ ] 3 named references with permission secured
- [ ] The "what I got wrong" slide filled honestly
- [ ] Full-time commitment status stated plainly
- [ ] Founder vesting terms

**Nice to have**
- [ ] Named advisors who have actually agreed
- [ ] Travel-industry relationships and registration status
- [ ] Public technical work — talks, writing, open source

---

## Design direction

- **Same template, colours and fonts as the pitch deck.** Three documents that look like one company is itself a signal.
- **More text than the pitch deck is correct here** — this document is read without you narrating it. Full sentences are fine; walls of text are not.
- **Headshots must be consistent** — same crop, same background, same lighting for every person.
- Export as `Travlplanr_Founders_Profile_[Month]_2026.pdf`.
- Keep it to 12 slides. If it runs past 15, you're writing a CV, not a profile.
