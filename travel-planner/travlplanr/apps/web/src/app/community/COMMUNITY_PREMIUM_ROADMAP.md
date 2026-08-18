# Travl Community — Premium & Traveler-First Roadmap

> Goal: evolve the community from a generic "LinkedIn/Instagram clone" into a **destination-driven, premium travel network** that feels real, trustworthy, and uniquely useful to travelers.

**Audited:** `community-page.component.ts`, `community-stories-bar.component.ts` + live render at `/community` (2026-06-23).

---

## TL;DR — The Core Problem

The page is visually competent but **generically social**. Nothing on it says "travel." A premium travel community wins on three things the current page lacks:

1. **Place is the primary object** — every post should anchor to a real destination (map pin, destination page, "add to my trip").
2. **Trust & realness** — right now stats, news, and engagement are hardcoded; mock-data fallbacks hide that features aren't truly wired.
3. **Travel utility** — the feed should *help you plan*, not just scroll: save to bucket list, attach itineraries, find travel buddies, see posts on a map.

---

## Part A — Honest Audit of What Exists Today

> **Update (2026-06-23, rev 2):** Added `CommunityProfileService` + backend widget endpoints (`/community/profile/me`, `/shortcuts`, `/news`, `/ads`). Profile stats and the Ad block are now data-driven. Two endpoints are fetched-but-not-rendered (see A2/A8). Progress tracked below.

### 🔴 Realness gaps (things that look real but aren't)
| # | Issue | Location | Status |
|---|-------|----------|--------|
| A1 | **Profile stats** — followers/views/bio | `community-page.component.ts:36-46` | ✅ **FIXED** — now bound to `myProfile()` from `/community/profile/me` |
| A2 | **"Travl News"** — 3 fake headlines + reader counts | `:232-260` | 🟠 **HALF-DONE** — `news()` signal *is fetched* (`:351`) but template still renders **hardcoded `<li>`s**; `news()` is never bound. Bind the loop. |
| A8 | **Shortcuts** (Groups/Events/Hashtags) | `:58-67` | 🟠 **HALF-DONE** — `shortcuts()` *is fetched* (`:353`) but template still hardcodes the 3 rows; `shortcuts()` never bound |
| A9 | **Ad block** | `:269-284` | ✅ **FIXED** — bound to `ads()` from `/community/ads` |
| A3 | **Mock-data fallback on every load error** | `:368-374`, stories `:86-98` | 🔴 still present — masks broken API wiring |
| A4 | **Dead `+ Follow` button** on every post — not wired | `:125-127` | 🔴 still dead |
| A5 | **Dead Share button**, dead Save/bookmark | `:175-180`, `:48-53` | 🔴 still inert |
| A6 | **Static avatars** via ui-avatars/pravatar, not user-uploaded | throughout | 🔴 still placeholder identity |

### 🟠 UX / polish gaps
| # | Issue | Detail |
|---|-------|--------|
| B1 | **Double-bordered stories** | Stories bar (`border-b bg-white`) is wrapped in *another* white card (`:85-87`) → visible double frame |
| B2 | **No loading skeletons** | Feed flips blank → mock; no shimmer/placeholder |
| B3 | **No empty states** | "No posts yet / Follow people to see their trips" missing |
| B4 | **Letterboxed images** | `object-contain` on black bg (`:139-141`) looks dated; modern feeds use full-bleed aspect-ratio crops |
| B5 | **No multi-image carousel** | Posts only render `images[0]` (`:140`) despite `images[]` array |
| B6 | **No pagination / infinite scroll** | `loadPosts()` fetches once; feed can't grow |
| B7 | **No real-time / optimistic polish** | Like is optimistic but comment count & follow aren't reflected app-wide |

### 🟡 Engineering / standards gaps
| # | Issue | Detail |
|---|-------|--------|
| C1 | **Design-token violations** | `bg-[#f3f2ef]` arbitrary hex + raw `blue-500`/`gray-*` everywhere. Project standard is **tokens only, never raw hex/arbitrary values** (see design-system memory + codemods) |
| C2 | **Accessibility** | Icon-only buttons (more-menu, share, save) lack `aria-label`; story circles not keyboard-operable |
| C3 | **Base64 image storage** | Uploads stored inline in JSONB, not object storage — won't scale |
| C4 | **No analytics/event tracking** | No way to measure engagement to tune the feed |

---

## Part B — What a Premium Travel Community Needs (the differentiators)

These are the features that make it *travel-first* instead of a social clone. Ordered by impact-to-effort.

### 🗺️ 1. Destination-anchored posts  *(highest leverage)*
Every post optionally tags a **real destination** (from the existing destinations service), rendering:
- A clickable place chip → destination page
- A mini map pin / static map thumbnail
- "Trips here" + "Add to my trip" CTA
**Why:** turns scrolling into planning. This is the single biggest "travel, not LinkedIn" move.

### 🔖 2. Bucket List / Save-to-Collection
Replace the inert bookmark with real **collections** ("Bucket List", "Summer 2026", custom). Saved posts/destinations group into boards (Pinterest-for-travel).
**Why:** the #1 traveler behavior is "save for later."

### ✈️ 3. Travel-native reactions
Beyond Like: **😍 Wanderlust · ✈️ Been there · 🔖 Bucket list · 🧭 Take me here**. "Been there" doubles as a lightweight check-in / credibility signal.

### 🧳 4. Itinerary & trip sharing as a post type
Let users attach/share an existing itinerary (the app's core asset) as a rich post card. One-tap "Clone this trip."
**Why:** ties community directly to the product's revenue loop.

### 🧭 5. Map view of the feed
Toggle the feed to a world map with post pins clustered by region. Explore by place, not just by time.

### 🏷️ 6. Followable topics / hashtags
`#solotravel #budgettravel #vanlife` as real, followable entities feeding "Discover." The left-rail "Followed Hashtags" becomes functional.

### 🤝 7. Traveler trust signals
- **Verified Traveler / Creator badges**
- Countries-visited count, "Local in {city}" badge
- Real follower/post counts (kills audit issue A1)

### 👥 8. Find travel buddies / companions
Opt-in "Looking for companions to {destination} in {month}" post type + match surface. (Bigger bet — phase later.)

---

## Part C — Phased Implementation Plan

> Sequencing rule: **fix realness first** (cheap, high trust payoff) → **add the travel-defining features** → **scale & delight**.

### PHASE P0 — Make it Real & Trustworthy  *(1–2 days, do first)*
Removes everything fake and wires the dead buttons. No new big features.

- [ ] **A1/A7:** Replace hardcoded left-rail stats with real `getUserProfile()` data (followers/following/posts). Remove "profile viewers" or back it with a real counter.
- [ ] **A4:** Wire `+ Follow` button → `community-profile.service.toggleFollow()`; reflect state per post.
- [ ] **A3:** Remove silent mock-data fallbacks; replace with **error + empty states** (B3) so broken wiring is visible, not hidden. Keep a single dev-only seed path.
- [ ] **A5:** Wire **Share** (copy link + native share sheet) and **Save** (Phase P2 collections stub → toast "Saved").
- [ ] **B1:** Fix double-bordered stories card (remove inner or outer frame).
- [ ] **B2:** Add feed + stories **skeleton loaders**.
- [ ] **C1:** Run the design-system codemod / convert `bg-[#f3f2ef]` and raw colors to **tokens**. (Required by repo standard.)
- [ ] **C2:** Add `aria-label`s to icon buttons; make story circles `<button>`/keyboard-operable.

**Backend:** add `GET /community/users/me/stats`; ensure follow endpoint returns fresh counts. **Files:** `community-page.component.ts`, `community-stories-bar.component.ts`, `community-profile.service.ts`.

---

### PHASE P1 — Feed Quality & Media  *(2–3 days)*
Make the core feed feel modern and premium.

- [ ] **B5:** Multi-image **carousel** in posts (swipe + dots) — render full `images[]`.
- [ ] **B4:** Switch to **aspect-ratio crops** (4:5 / 1:1) with `object-cover`, tasteful rounded corners; add a real lightbox on click.
- [ ] **B6:** **Infinite scroll** (IntersectionObserver) with `limit/offset` already supported by `/feed`.
- [ ] **Real "Following" vs "Discover"** difference verified end-to-end (Discover = `/explore`, trending by likes).
- [ ] Post **detail view / permalink** route `/community/posts/:id` (needed for Share links).
- [ ] **C3:** Move image uploads to **object storage** (S3/compatible); store URLs, generate thumbnails.

**Backend:** image upload endpoint returning CDN URLs; `GET /community/posts/{id}`. **New:** `community-post-carousel.component.ts`, `community-post-detail.component.ts`.

---

### PHASE P2 — The Travel-First Layer  *(4–6 days, the differentiator)*
This is what makes it a *travel* community.

- [ ] **B/1 Destination tagging:** add `destination_id` to posts; place chip + static map thumbnail + link to destination page. Picker in create-post (autocomplete on destinations service).
- [ ] **B/2 Collections / Bucket List:** `Collection` + `CollectionItem` models; save posts & destinations into boards; boards tab on profile.
- [ ] **B/3 Travel reactions:** extend like into reaction types; show reaction summary; "Been there" counter on destinations.
- [ ] **B/6 Followable hashtags:** `Hashtag` + `PostHashtag`; parse `#tags` from captions; follow/unfollow; left-rail becomes real; Discover can filter by topic.

**Backend migrations:** `add_destination_to_posts`, `add_collections`, `add_reactions`, `add_hashtags`.
**Frontend:** `destination-picker.component.ts`, `collections-page.component.ts`, `reaction-bar.component.ts`, hashtag chips + `topic-feed`.

---

### PHASE P3 — Planning Loop & Map  *(4–6 days)*
Tie community back to the product's core value.

- [ ] **B/4 Itinerary post type:** attach an existing itinerary as a rich card; "Clone this trip" → creates a draft trip for the viewer.
- [ ] **B/5 Map feed:** map toggle plotting posts by destination (clustered). Explore-by-place.
- [ ] **B/7 Trust badges:** verified traveler, countries-visited, "Local in {city}".

**Backend:** itinerary-link payload on posts; geo coords on destinations for the map; badge fields on profile.
**Frontend:** `itinerary-post-card.component.ts`, `community-map.component.ts` (Leaflet/Mapbox), profile badges.

---

### PHASE P4 — Engagement, Delight & Scale  *(ongoing)*
- [ ] Real-time notifications + DM (WebSocket; replace polling) — finishes Phases 5/6 from prior build.
- [ ] Real "Travl News" pipeline (CMS-backed travel articles) replacing A2 placeholders.
- [ ] Travel buddies / companion matching (Part B #8).
- [ ] Feed ranking signals + analytics/event tracking (C4) to tune Discover.
- [ ] Reels/short-video posts; saved searches; weekly "trending destinations" digest.

---

## Part D — Prioritized "Do This Next" Shortlist

If you only do five things, do these — they deliver the most "real + premium + travel" per hour:

1. **P0 realness sweep** — kill hardcoded stats/news, wire Follow/Share, add skeletons + empty states, fix token violations. *(trust)*
2. **Destination tagging on posts** (P2 #1) — the defining travel feature. *(identity)*
3. **Multi-image carousel + full-bleed crops + lightbox** (P1). *(premium feel)*
4. **Bucket List / Collections** (P2 #2) — the behavior travelers actually want. *(utility)*
5. **Infinite scroll + post permalinks** (P1). *(table stakes)*

---

## Part E — Effort & Sequencing Summary

| Phase | Theme | Effort | Unlocks |
|-------|-------|--------|---------|
| **P0** | Realness & trust | 1–2 d | Nothing fake; dead buttons live; on-brand tokens |
| **P1** | Feed quality & media | 2–3 d | Modern premium feel; permalinks; real uploads |
| **P2** | Travel-first layer | 4–6 d | Destinations, collections, reactions, hashtags |
| **P3** | Planning loop & map | 4–6 d | Itinerary sharing, map feed, trust badges |
| **P4** | Engagement & scale | ongoing | Real-time, news, buddies, ranking |

**Recommended order:** P0 → P1 → P2 → P3 → P4. P0 is non-negotiable before showing this to real users — it's where the "looks fake" risk lives.

---

*Cross-refs: prior build status in `implementation-verification-report.md`; phase-by-phase API/model details in `community-platform-build-phases-3-7.md`. Honor the Tailwind token system (no raw hex) per the frontend design-system standard.*
