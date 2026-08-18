# Travlplanr — Page-by-Page Enhancement Audit

_Compiled July 2, 2026 from a file-by-file read of `apps/web/src` (~130 TypeScript files) and all five FastAPI services._

Every finding is anchored to a `file:line` and rated:

- **High** — broken behavior, security exposure, or user-visible damage
- **Medium** — degraded experience or robustness
- **Low** — polish and hygiene

**323 findings total — 86 High, 168 Medium, 69 Low.**

| Area | Findings | High |
|---|---:|---:|
| Landing & marketing | 74 | 15 |
| Trip-planning flow | 89 | 21 |
| Community | 67 | 20 |
| Auth, profile & app shell | 33 | 10 |
| Backend services | 56 | 20 |
| Repo-level | 4 | 0 |

---

## Summary

The app is far more real than a prototype — a working AI itinerary pipeline, genuine design tokens with lint enforcement, lazy routes everywhere, Redis Streams eventing, argon2 auth with JWT revocation, and honest loading/error states in the newest pages. The gap is consistency and follow-through:

- **A handful of features ship visibly broken** — community messages never render, the community map can never place a marker, package detail pages can't be viewed.
- **Demo shortcuts leak into production surfaces** — hardcoded Chennai→Paris data inside exported PDFs, fabricated ratings and review counts, mock fallbacks that fake success on API failure.
- **The auth perimeter has real holes** — rate limiting bypassable with a spoofed header, OTPs from a predictable PRNG, unauthenticated internal and admin endpoints.

---

## Top 20 fixes

1. **Community messages never display.** The chat pane template jumps from header to input — the `messages` signal is populated but no `@for` renders it, and failed sends fake success. DMs are effectively fictional. → Community
2. **B2B accounts can't exist in the migrated database.** The only identity migration creates the `user_kind` enum without `CORPORATE_ADMIN`/`TRAVEL_AGENT`, so the whole agents router fails on Postgres; staff DELETE also 500s (body on a 204) and customer account deletion breaks on an FK. → Backend
3. **Auth brute-force defenses are bypassable.** The rate limiter keys on client-supplied `x-forwarded-for`; OTPs are generated with `random.randint` (predictable Mersenne Twister); OTP verify has no per-email attempt cap. → Backend
4. **Unauthenticated internal & realtime endpoints.** `/internal/users/resolve` is an email-enumeration oracle with no auth; the community WebSocket authenticates by `customerId` in the URL — anyone can subscribe to anyone's stream. → Backend / Community
5. **The HTTP interceptor destroys sessions on any 401/403.** Opening a shared trip you're not a collaborator on returns 403 → full logout with no `returnUrl`. Restrict to 401 and preserve the location. → App shell
6. **Hardcoded demo itinerary data ships in real trips and PDFs.** Inclusions/exclusions are a fixed Chennai→Paris/Barcelona/Madrid set rendered in the Travel Summary and exported to PDF for every trip; home airport is hardcoded `MAA`; PDF travellers hardcoded "2 Adults". → Trip flow
7. **Booking is riddled with dead buttons.** "Book Now", "Book Stay", "Select Train/Bus/Car", "Book Activity" have no click handlers; detail-page selections (bed, time slot, travelers) are decorative; "Book Complete Itinerary" double-fires checkout. → Trip flow
8. **Package pages defeat their purpose.** Detail page auto-generates a plan and navigates away on load (viewing = server-side writes); the shared package card routes to a blank wizard ignoring which package was clicked. → Trip flow
9. **Explore bypasses wizard validation.** "Start planning" jumps to step 2, so trips generate with an empty required departure location. Wizard itself has no date validation, no traveler-count input, and an "arrival at different location" checkbox that reveals nothing. → Trip flow
10. **Saves that fail still report success.** `TripService.saveTrip` and customization sync swallow PUT failures and update local state — "Itinerary saved" toasts on server rejection. Generated-but-unsaved trips are also invisible in My Trips. → Trip flow
11. **Mock fallbacks fake real data on error.** Notifications fall back to a hardcoded unread badge of 3 and fake entries; feed errors render as "no posts yet"; identity's customer list returns md5-derived fake LTV/segments; the About page ships fictional founders. → Theme
12. **A 59 MB autoplaying hero video with `preload="auto"`** and 16 MB of unoptimized landing JPGs dominate first-load; fonts load via CSS `@import`; Leaflet + highlight.js load render-blocking from CDNs on every page (hljs without SRI). → Marketing / App shell
13. **Community map can never show a marker** — it reads `post.destinations` (plural) which doesn't exist on the model — and both Leaflet popups (community + itinerary map) interpolate unescaped user/API content: stored-XSS vectors. → Community / Trip flow
14. **Reels autoplay every video simultaneously** (N concurrent downloads, corrupted view counts) and all engagement buttons are dead. → Community
15. **Session security needs a strategy.** 7-day JWTs in `localStorage`, no refresh flow, no proactive expiry handling; `/community/messages` route unguarded; EOL `quill@1.3.7` with known XSS advisories; placeholder Sentry DSN with 100% tracing + replay. → App shell
16. **Event pipeline loses messages.** The identity consumer acks in `finally` (failures permanently lost), starts its group at `$` (skips history), streams have no `maxlen` (unbounded Redis growth), and there's no outbox — Redis downtime turns committed writes into 500s with lost events. → Backend
17. **Blocking calls in async handlers.** argon2 hashing and the synchronous SendGrid client run inside async endpoints, stalling the event loop on every login/OTP. → Backend
18. **Loading states flash empty/error UI.** FAQ shows "No questions found" and blog shows "Article not found" during every fetch; itinerary swap views show "0 flights found" while inventory is in flight; the FAQ header also sits under the fixed navbar with dark-on-dark links on scroll. → Marketing / Trip flow
19. **Navigation fragmentation.** Three navbar implementations plus page-local ones stack two fixed navbars on Pricing and most community pages (duplicate notification fetches included); the itinerary's twelve swap/detail views live in one signal with no routing — Back exits the whole page. → App shell / Trip flow
20. **Modal & interaction accessibility debt.** No dialog in the app (share panel, create-post, save-modal, story viewer, lightbox) has focus traps/`role="dialog"`/Escape; drag-to-reorder has no keyboard path; reaction pickers are hover-only so touch users can't reach them; live regions are missing on toasts, errors, and chat streams. → Theme

---

## Cross-cutting themes

Six patterns explain most of the findings; fixing the pattern once is cheaper than fixing each instance.

| Theme | Evidence |
|---|---|
| **"Looks real but isn't"** | Fake send-success in messages; hardcoded unread badge; fabricated hotel ratings ("always 4.5, 1.2 km from center"), review counts ("12568K Reviews"), CO₂ figures, room-price multipliers; md5-derived customer LTV; fictional founders; invented package tags. Decide a rule: _an error state is always shown as an error, and no number renders unless it came from data._ |
| **Fragmentation** | 3 navbars; 2 `apiUrl()` utilities with opposite contracts (one has zero importers); 2 WebSocket stacks; 2 SEO patterns; 2 upload endpoints; off-brand violet collaboration UI; ad-hoc `slate-*` palettes on How-it-works/Contact/Community despite a real token system. Consolidate each pair and delete the loser. |
| **Swallowed errors** | `saveTrip`, `deleteTrip`, customization sync, collection load, feed load, decline-invite, destination picker — all catch-and-continue (often logging only), leaving success-looking UI over failed writes. Route every mutation's failure to the existing `ToastService`. |
| **State without routes** | Itinerary's 12 view modes in one signal (no Back/refresh/deep-link); wizard state not reset after generation; profile drafts clobbered by late-arriving loads; unsaved-changes guard applied only to the wizard. |
| **Untracked async lifecycles** | Wizard generation poll never unsubscribed; live-call mic/WebSocket never released on destroy; community WS subscription stacks per visit and disconnects the shared singleton; story-modal 50 ms interval drives app-wide change detection; carousel keydown listeners per instance. |
| **Demo data in prod paths** | Chennai→Paris inclusions in PDFs; `MAA` home hub; Paris-only car pickup lists; static airline/operator filter lists that zero-out real inventory; 5-country nationality picker; +91/+1/+44-only phone codes; US carousel using Middle-East photos. |

---

## Landing & marketing pages

_Paths relative to `apps/web/src/`._

### Global shell — `index.html`, `styles.scss`, SEO

**Done well:** genuinely accessibility-conscious global styles — skip link, `:focus-visible` restoration, `prefers-reduced-motion`, `.sr-only` (`styles.scss:24-120`); a real design-token system (`tailwind.config.js:14-104`); a well-built `SeoService` with de-duplicated JSON-LD injection.

- **[High · Perf/SEO]** `index.html:14-18` loads Leaflet CSS+JS and highlight.js CSS+JS synchronously from unpkg/cdnjs on **every** page — render-blocking third-party requests for libraries no marketing page uses. Lazy-load them, or at minimum `defer`.
- **[High · Code]** Three parallel navbar implementations (`landing/components/navbar`, `about/components/about-navbar`, `shared/components/app-navbar`) with divergent auth handling, mobile menus, scroll behavior, and active-link styling. Consolidate to one navbar with variants.
- **[Medium · Perf]** Google Fonts pulled via `@import` inside the compiled stylesheet (`styles.scss:5`) — blocks first paint. Inter loads at weight 400 only while `section-header.component.ts:14` renders watermarks at `font-black` (900), so the browser synthesizes the weight.
- **[Medium · SEO]** No `<link rel="canonical">` anywhere and no default `og:image` — `SeoService.set()` (`seo.service.ts:30-39`) only emits one when a page passes it; only blog posts do.
- **[Medium · Code]** Two SEO patterns in use: `SeoService` (landing, FAQ, blog, pricing) vs raw `Title`/`Meta` injection (About `about-page.component.ts:372-373`, How-it-works `:452-455`, Contact `:419-430`) — the raw ones never get OG/Twitter tags.

### Landing page — `landing/`

**Done well:** real loading spinner, error state with retry, and graceful static-data fallback when the API is down (`landing-page.component.ts:46-53, 199-209`); the strongest SEO in the app (`:112-139`); below-the-fold images lazy-load; carousel arrows have `aria-label`s.

- **[High · Perf]** The hero video `assets/videos/website_header.mp4` is **59 MB**, autoplayed with `preload="auto"` and no poster (`hero-section.component.ts:22-33`). Compress/stream it, add a poster, use `preload="metadata"` and a mobile-gated source.
- **[High · Design]** Price copy renders doubled: `destination-grid-section.component.ts:33` prints "Starts from {{price}}*" while the data already contains a prefix (`landing.data.ts:61` "Start at ₹ 60,000/Person") → users see **"Starts from Start at ₹ 60,000/Person*"**. The API mapper (`landing-page.component.ts:178`) doubles it too.
- **[High · Function]** `assets/images/placeholder.jpg`, used as the image fallback (`landing-page.component.ts:171`), **does not exist on disk** — API destinations without images produce broken `<img>`s.
- **[High · UX]** Developer instructions leak into user-facing UI: the offline fallback banner literally says _"Start the backend with: docker compose up -d"_ (`landing-page.component.ts:161`).
- **[High · A11y]** Clickable destination cards are `<article [routerLink]>` — not links: no keyboard focus, no Enter activation (`destination-carousel-section.component.ts:50-54`, `destination-grid-section.component.ts:17-22`).
- **[Medium · Design]** US carousel reuses Middle-East photos: New York shows `dubai.jpg`, "East coast" shows `abu-dhabi.jpg`, Orlando shows `bahrain.jpg`, Los Angeles shows `qatar.jpg` (`landing.data.ts:111-115`).
- **[Medium · Design]** CTA banner is fixed `text-5xl` with three hard-broken `<p>` lines (`cta-banner-section.component.ts:15-19`) — no responsive downscale; forced breaks wrap awkwardly on mobile.
- **[Medium · UX]** Hero mute toggle uses the identical icon for both states — `hero-section.component.ts:70` resolves `isMuted() ? 'mute.svg' : 'mute.svg'`, differentiated only by opacity; an `unmute.svg` was intended.
- **[Medium · UX]** "Trips" in the main nav (`landing.data.ts:17`) points at the `authGuard`ed `/trips` — logged-out visitors get bounced to login with no explanation.
- **[Medium · Function]** When the API succeeds but a tag has no destinations, carousels render headings with zero cards (`landing-page.component.ts:191-196`); API-mapped cards never set `subtitle` or `gridArea`, so subtitles render blank and bento tiles get class `tile-undefined`, collapsing the curated grid at ≥1280px (`:170-180`).
- **[Medium · Perf]** `images/landing/figma/` totals 16 MB with JPGs up to ~588 KB rendered at 302×258 — no `srcset`/`sizes`, no width/height (CLS), no WebP/AVIF.
- **[Medium · A11y]** Mobile hamburger lacks `aria-expanded` (`navbar.component.ts:144-148`) — the about-navbar version has it. Profile dropdown (`:119-125`) has no Escape/click-outside handling.
- **[Medium · Code]** Dead components: `travel-categories-section` (empty array), `journeys-section` (empty array), and `packages-carousel-section` are imported nowhere; `READY_PACKAGES` (all priced "₹ 79,999") exists only for the dead section and contains the typo "Al-powered".
- **[Medium · Code]** All eight landing signals are `signal<any[]>` with `as any` casts through the fallback path (`landing-page.component.ts:102-109, 201-208`) despite `CarouselCard`/`DestinationTile` models existing.
- **[Low · Content]** Copy errors throughout `landing.data.ts`: "United State America" (:138), lowercase "west coast" (:114), truncated subtitles "The old wonders of" (:103) and "Fall in Love with" (:193), "Land of Rise sun" (:196); watermark/title mismatch "South East Asia(n) Vacations" (`landing-page.component.ts:80-81`).
- **[Low · Design]** Card titles at `text-5xl` on a 302px-wide carousel card (`destination-carousel-section.component.ts:64`) will clip for long names like "Saudi Arabia".
- **[Low · UX]** Carousel prev/next never disable at scroll extents and there's no scroll-snap (`destination-carousel-section.component.ts:45-68`).
- **[Low · Function]** Currency inconsistency in one mapper: `price: d.price ? 'Starts from ₹ …' : '$999'` (`landing-page.component.ts:178`).
- **[Low · A11y]** Loading spinner has no `role="status"`/sr-only text (`landing-page.component.ts:46-48`).

### Footer — `landing/components/footer-section/` (shared by all pages)

- **[Medium · Design]** Partner logo rows use `flex justify-between` with `shrink-0` images and no wrap (`footer-section.component.ts:25-70`) — fixed-height logos overflow horizontally on narrow viewports; the two rows are fully copy-pasted duplicates.
- **[Medium · Content]** Two support emails shown, one a Gmail address (`travlplanr@gmail.com` beside `support@travlplanr.com`, `landing.data.ts:246-250`); support phone `+91 98765 43210` is an obvious sequential placeholder.
- **[Low · Content]** The "coming soon" toast for unbuilt Travel Resource links is a good honest pattern — but the Terms page copy references those resources (`terms.data.ts:27`), so they should eventually ship.

### About — `about/`

**Done well:** the most polished marketing page — IntersectionObserver reveal animations with an SSR fallback (`about-page.component.ts:425-461`), stat count-ups parsed from the same data the labels render from, content fully externalized to `about.data.ts`, and a creative dependency-free SVG routes map.

- **[High · Content]** The co-founder team is fictional — "Alex Mercer" / "Elena Rostova" (`about.data.ts:154-173`). Invented founders on a public About page are a trust liability; so are unverifiable metrics styled as data ("10k+ Adventures Planned", "99.9% Stress Reduction", `:133-152`).
- **[High · A11y]** Map hotspots are hover-only (`about-map.component.ts:198`) — tooltip content is unreachable by keyboard and on touch, which is most traffic. Add focusable elements with focus/blur and tap toggling.
- **[Medium · Design]** Story-section parallax hardcodes a scroll offset (`(scrollOffset - 1200) * 0.12`, `about-page.component.ts:413`) — mis-offsets on short screens.
- **[Medium · Perf]** `about-hero.jpg` is 2.9 MB and `about-story.jpg` 6.5 MB, both eager; the hero also transforms on every scroll event via `@HostListener('window:scroll')` (`:408-415`).
- **[Medium · Code]** `about-map.component.ts:22-44` embeds a raw `<style>` block in the template — injected unscoped, so `.map-land` etc. become global.
- **[Medium · UX]** Fake language selector: a non-interactive 🇮🇳/"En" div with `cursor-pointer` (`about-navbar.component.ts:46-56`) looks clickable but does nothing.
- **[Medium · UX]** Logged-in about-navbar shows a static avatar with no menu/logout (`about-navbar.component.ts:58-72`); the mobile menu omits Log In / "Start for free" (`:107-128`) — mobile visitors on About/How-it-works/Contact/FAQ have no auth entry point.
- **[Low · A11y]** Timeline year buttons have no `aria-current`/pressed semantics (`about-timeline.component.ts:36`).

### How it works — `how-it-works/`

**Done well:** strong narrative structure with mock UI vignettes per step; native `<details>/<summary>` FAQ accordions; correct fixed-navbar offset.

- **[Medium · Design]** Hero stats bar is `grid-cols-3` with `divide-x` at all breakpoints (`how-it-works-page.component.ts:43-47`) — cramped/overflowing at 320–375px.
- **[Medium · Content]** Its six FAQ items are hardcoded (`:369-410`) while `/faq` loads from the CMS — the two will drift.
- **[Medium · Code]** ~150 lines of literally repeated check-bullet markup and six copy-pasted feature/partner cards (`:71-87, 116-133, 172-189, 235-264, 333-356`) — extract an `@for` over data arrays.
- **[Low · Design]** Invents its own palette (`slate-900/500/400`, inline hex gradient, `rounded-3xl`) diverging from the design tokens. Same divergence on Contact.
- **[Low · Code]** Uses constructor-injected `Title`/`Meta` instead of `SeoService` — no OG tags.

### FAQ — `faq/`

**Done well:** CMS-driven with real error+retry and empty-search states; FAQPage JSON-LD emission; a scroll-spy deliberately fixed to survive manual scrolling; signal-based search with an explanatory comment about the ngModel/computed pitfall.

- **[High · Design]** Content isn't offset for the fixed navbar: the page's first section is only `pt-8` (`faq-page.component.ts:19`) under a `fixed top-0` header — the "Help Centre" heading sits beneath the 73px navbar. Every other page compensates (`legal-page-shell.component.ts:21`).
- **[High · Design]** Navbar contrast breaks on scroll: the scrolled state forces `bg-slate-900/90` regardless of variant (`about-navbar.component.ts:16-18`) while `variant="solid"` keeps dark-gray links and the dark logo — dark-on-dark, an effectively invisible header.
- **[High · UX]** The `loading` signal (`faq-page.component.ts:150`) is never used in the template — while FAQs fetch, users see the **"No questions found"** empty state flash before content arrives.
- **[Medium · UX]** Sidebar section clicks use `scrollIntoView` but section anchors have no `scroll-mt` (`:279, :89`) — headings land behind the fixed navbar.
- **[Low · UX]** Section nav is `hidden … lg:block` with no mobile substitute — no jump navigation on phones.
- **[Low · A11y]** Accordion answers aren't associated with their toggles (no `aria-controls`/`id`); sidebar buttons lack `aria-current`.

### Pricing — `pricing/`

**Done well:** clean data-driven plan cards from a typed model; highlighted "Most popular" tier; sensible per-plan CTA routing; proper `SeoService` usage.

- **[High · Function]** Double navbar: `/pricing` is a child of the app shell (`app.routes.ts:97-101`) which renders its own fixed navbar + `pt-[68px]`, while the pricing template renders a second fixed navbar plus a 70px spacer and `pt-[73px]` (`pricing-page.component.ts:15-23`). Two fixed headers stack; spacing is doubled.
- **[Medium · Function]** Every CTA including "Upgrade now" and "Contact sales" routes to `/explore` or `/partners` (`:60`) — no checkout, no billing hand-off; the "Payments via Stripe" claim (`:70-71`) has no backing flow.
- **[Low · Design]** `h1` is a non-responsive `text-8xl` (`:26`) — heavy at 320px.
- **[Low · UX]** No billing-period toggle, plan comparison, or FAQ link — standard pricing furniture the data model half-supports.

### Contact — `contact/`

**Done well:** the best form UX in the app — per-field validation tied to touched state, a character counter with warning color, real submitting spinner, success panel with "send another", and topic cards that auto-fill the subject.

- **[Medium · UX]** Submit is disabled while invalid, but errors only show for _touched_ fields (`contact-page.component.ts:181`) — a user who skipped a field sees a dead button with no explanation.
- **[Medium · A11y]** Topic cards are clickable `<div>`s (`:330-333`) with a hover-only "Select this topic" affordance (`:341`) — invisible to keyboard/touch.
- **[Low · A11y]** Validation messages have no `role="alert"`/`aria-describedby` links to inputs; after `selectTopic()` scrolls to top, focus isn't moved to the form.
- **[Low · Content]** Sidebar hours say "Mon–Fri, 9 AM – 7 PM IST" (`:236`) while How-it-works promises "24/7 Support" — contradictory claims.
- **[Low · Design]** Ad-hoc `slate-*` colors and radii instead of the design tokens.

### Partners — `partners/`

- **[High · Design]** The page renders no footer and no marketing navbar — as an app-shell child it gets the logged-in navbar and then just ends after one card (`partners-page.component.ts:10-33`). A B2B lead hits a dead end with no contact info.
- **[Medium · Function]** No lead capture at all — "Contact sales" from Pricing lands here and the only CTA loops back to `/pricing` (`:25`). Link to `/contact` with the Partnership/B2B subject.
- **[Medium · SEO]** No title/meta set — the page keeps whatever title the previous route left.
- **[Low · Design]** Non-responsive `text-8xl` h1 (`:13`), same as Pricing.

### Privacy & Terms — `privacy/`, `terms/`

**Done well:** a model of reuse — thin wrappers over `LegalPageShellComponent` (correct navbar offset) and `LegalDocumentContentComponent` (with `scroll-mt-28` anchors). The privacy content is unusually substantive — it names actual AI processing partners and the DPDP Act, and terms include an honest AI-hallucination disclaimer.

- **[Medium · SEO]** Neither page sets a title or meta description — legal pages inherit the previous page's `<title>`. Two-line fix via `SeoService`.
- **[Medium · UX]** Sections have anchor ids and scroll margins built in, but no table of contents is rendered — 9+ sections of legal text with no in-page navigation.
- **[Low · Function]** `privacy@travlplanr.com` and account-deletion mentions render as plain text, not links (`legal-document-content.component.ts:61`).
- **[Low · Content]** Header copy "Privacy & Policy" (`privacy-page.component.ts:19`, and the footer label) should be "Privacy Policy".
- **[Low · Code]** `LegalPageShellComponent.showChatbot` input is dead — nothing uses it.

### Blog — `blog/`

**Done well:** the most engineering-mature marketing pages — CMS-driven with distinct error-retry vs not-found states, a race-condition guard on slug changes, per-post SEO with `BlogPosting` JSON-LD and og:image, real share intents, and deterministic generated author avatars.

- **[High · UX]** Same loading gap as FAQ: the list flashes **"No articles found"** during fetch (`blog-page.component.ts:115-121`) and the post page flashes the full **"Article not found"** screen on every navigation (`blog-post-page.component.ts:138-147`). Add skeletons.
- **[Medium · Function]** Category chips are a hardcoded static list (`shared/data/blog.data.ts:8-15`) while posts come from the CMS — posts in other categories are unreachable via filters and empty categories still render as chips.
- **[Medium · Perf]** Featured/hero images have no priority hints, no `srcset`, no width/height (CLS on the largest element of both pages) — `blog-page.component.ts:47-51`, `blog-post-page.component.ts:80-84`.
- **[Low · Function]** highlight.js loads globally but nothing calls `hljs.highlightAll()` after `[innerHTML]` renders (`blog-post-page.component.ts:88`) — CMS code blocks get theme CSS but no tokenization.
- **[Low · Code]** The 16-field `BlogPost` mapping literal is copy-pasted three times (`blog-page.component.ts:167-184`, `blog-post-page.component.ts:197-214, 264-281`) — extract `mapCmsPost()`.
- **[Low · A11y]** Each card has three separate links to the same slug (image, title, "Read article") — noisy for screen readers; consider one stretched link.

### 404 — `not-found/`

- **[Medium · Content]** Headline is broken English: **"Oops! page Not Found...!"** (`not-found-page.component.ts:14`).
- **[Medium · UX]** No navbar/footer and only one action — stranded users can't reach Explore, Blog, or Contact.
- **[Low · SEO]** No title set (tab keeps the previous page's) — should set "Page not found" and ideally `noindex`.
- **[Low · Design]** `leading-[166px]` magic number on the 128px "404" (`:12`); hardcoded `font-[Poppins,sans-serif]` instead of the token (also on Contact and How-it-works).

---

## Trip-planning flow

_Paths relative to `apps/web/src/app/`._

### Wizard — `wizard/` + NgRx store

**Done well:** clean NgRx separation with typed action groups and testable selectors; the draft persists to localStorage with the `generating` flag sanitized on restore; a `canDeactivate` guard exists; generation has a poll timeout, rebuild fallback, and error toasts.

- **[High · UX]** The "Arrival at different Location" checkbox (`wizard-page.component.ts:135-138`) reveals no input — the `arrivalLocation` control exists (`:597`) but is never rendered; the review step then shows the literal text "Different Location (Arrival)" (`:402-404`).
- **[High · UX]** Step-6's "View all Packages" button calls `prev()` and just returns to step 5 (`:517-521`) — it never navigates to `/packages`.
- **[High · UX]** No traveler-count input anywhere: `step2Form.travelers` (`:604`) is never rendered; count is silently hardcoded by group type (friends = 2, family = 4, `:762-770`). A group of six cannot be expressed.
- **[High · Function]** No date validation: past dates and end-before-start pass `canProceed()` (`:600-606, 705-710`), and `getTotalDays()` clamps to 1, masking it (`:608-614`).
- **[Medium · UX]** Generation progress is computed and dispatched (`:821-834`) but the overlay shows only a static "Fetching for you" — `selectGenerationProgress` is never consumed. Up to two minutes with zero feedback.
- **[Medium · UX]** `canDeactivate` skips step 6 (`:564`) — leaving from the review step loses everything silently; it also uses raw `window.confirm`.
- **[Medium · UX]** Wizard state is never reset after successful generation — `WizardActions.reset` exists but is never dispatched, so revisiting `/wizard` restores the finished trip's step-6 state.
- **[Medium · UX]** No destination autocomplete/validation despite a backend `/destinations` endpoint and a `GeocodingService` — free text sends typos straight into generation.
- **[Medium · Function]** With "AI dates" checked, the review step shows "Duration: 0 days" — `getTotalDays()` only reads start/end (`:431, 608-614`) instead of summing `cityDays`.
- **[Medium · Function]** `generate()`'s `complete` handler runs an uncaught async chain (`:843-867`); if `rebuildTrip` throws, the rejection is unhandled and the user is stuck on the overlay.
- **[Medium · Perf]** The generation polling subscription is never stored or torn down — `pollSub` is declared (`:560`) but never assigned; `ngOnDestroy` only unsubscribes the step-sync sub. Navigating away mid-generation leaks the interval.
- **[Medium · Content]** Copy errors: "Food & Dinning" (`:33`), "Nutarians food" as the gluten-free subtitle (`:45`), "Aesthetic gateway" for getaway (`:49`), placeholder "e.g Paris, United Kingdom" (`:114`).
- **[Medium · Design]** Budget tier labels ("0 – 150K", `:54-56`) contradict the itinerary page's Budget Selection card ("0 – 95K INR", `itinerary-page.component.html:3340-3354`).
- **[Medium · A11y]** Selection tiles convey selection only by border/background classes — no `aria-pressed`; step transitions never move focus or announce the new step.
- **[Medium · Code]** Generation-success handling is duplicated three times (`:825-831, 843-852, 854-863`) — extract a `handleTripReady()` helper.
- **[Low · UX]** Default of 6 nights per city (`:654`) means 3 cities = an 18-night default trip.
- **[Low · Perf]** `interval(1000)` polling is aggressive; the localStorage sync reducer serializes state on every 1s progress dispatch (`wizard.reducer.ts:84-94`).
- **[Low · Code]** Reducer impurity — `localStorage.removeItem` inside the reducer (`wizard.reducer.ts:79`); unused `summary` signal; step-4 uses the `driving` icon for interests (`:694`).

### Itinerary — `itinerary/itinerary-page.component.ts` (~4,540 lines) + `.html` (~3,660 lines)

**Done well:** the `displayedDays` computed cleanly layers segments → added items → swap overrides → removals → custom order (`.ts:2959-3059`); inventory-error vs genuinely-empty is distinguished with a retry hook; maps are deferred with `@defer (on viewport)`; the chat-driven edit pipeline is an ambitious, working integration.

- **[High · Function]** Hardcoded Chennai→Paris/Barcelona/Madrid mock inclusions/exclusions (`.ts:3125-3186`) render in the Travel Summary **and are exported into the PDF** (`.ts:3682-3685`) — a Tokyo trip's PDF lists "Renfe AVE Barcelona → Madrid". Home hub is hardcoded `'MAA'` (`.ts:3323-3325`).
- **[High · Function]** Dead buttons throughout: "Book Now" (`.html:2852`), "Select Car" (`:2911`), "Book Stay" (`:2979`), "Book Activity" (`:3023`), "Select Train" (`:3089`), "Select Bus" (`:3157`), "View Bus Information" (`:1564`), hotel "View map" (`:1978-1981`), the gallery "Show more" overlay (`:1954-1958`), and the Calendar/Travelers edit pencils (`:2683-2694`).
- **[High · UX]** The entire swap/detail flow is a `viewMode` signal with `window.scrollTo` — no routing (`.ts:436, 757-758`). Browser Back exits the itinerary entirely; refresh loses swap context; nothing is deep-linkable.
- **[High · UX]** No loading state for inventory: `start*Swap` opens the view immediately and fetches async (`.ts:761-795, 1092-1117, 1640-1664`) — users see "0 flights found" while the request is in flight.
- **[High · UX]** The Travel Cities widget (`.ts:2866-2922`) mutates only a local signal — day cards, segments, dates, and costs never change. It looks like it edits the trip but does nothing; `removeCity` also injects a hardcoded "Arrival at CDG" transit.
- **[High · Design]** Swap flight/train/car/bus/hotel views are desktop-only — fixed `px-[80px]` gutters and `w-[302px]` sidebars with zero breakpoints (`.html:9, 470, 872, 1336, 1600` et al.), while swap-activity and detail views use responsive classes. Broken on mobile.
- **[High · Function]** Hotel inventory price bug: `price: r.price || 150` (`.ts:1657`) doesn't unwrap the `{amount}` object shape handled everywhere else — an object price renders "₹ [object Object]" and breaks filtering/sorting.
- **[High · Function]** Swap-override keys are positional (`` `${day}-${idx}` ``, `.ts:3013-3030`) while added items are appended before overrides apply — adding an item after swapping can apply an override to the wrong card. Same fragility in `migrateSwapOverride` (`.ts:4436-4456`).
- **[High · A11y]** Drag-and-drop reordering (`cdkDrag`, `.html:2784-2785`) has no keyboard alternative and no ARIA announcements — reordering is mouse-only.
- **[High · Code]** Six near-identical swap subsystems copy-pasted per transport type (`.ts:609-645, 650-921, 926-1229, 1234-1407, 1455-1860, 1885-2430`). Extract a generic swap-list component/service — this alone would remove thousands of lines.
- **[Medium · Function]** Detail-page choices are decorative: traveler counts, activity time slot, hotel bed, car pickup/dropoff are selected but ignored by `selectAlternative*` (`.ts:2676-2707, 2323-2338, 1694-1705, 1142-1169`).
- **[Medium · UX]** No undo/confirmation for swaps or reorders, and `syncCustomizationsToBackend` failure is swallowed (`.ts:3576-3593` → `trip.service.ts:405-408`).
- **[Medium · UX]** "Book Complete Itinerary" has no busy/disabled state (`.html:3580-3588`) — double-click fires checkout twice. It also posts to literal `'/api/v1/checkout'` instead of the `apiUrl()` helper (`.ts:3505`).
- **[Medium · Function]** Inventory race: consecutive `start*Swap` calls don't cancel prior fetches — a slow earlier response can overwrite the list with stale-route results.
- **[Medium · Function]** `getItemKey` falls back to type+title (`.ts:3814-3824`) — two same-titled activities in one day collide in `track`, pair removals, and corrupt ordering.
- **[Medium · Function]** `tripNeedsPlanRebuild` auto-regenerates when ≥2 activity titles repeat (`.ts:3438-3445`) — a legitimately customized plan can be silently rebuilt on load.
- **[Medium · Function]** Fabricated detail content presented as fact: hotels always 4.5★/"1.2 km from center"/taxes 20 (`.ts:1648-1660`), activities always 4.8★ (`.ts:2270-2286`), synthetic room-price multipliers ×1.48–×2.43 (`.ts:1732-1813`), fixed CO₂ figures (`.ts:2076, 2109, 2641`).
- **[Medium · Function]** Static filter lists (airlines `.ts:634-639`, operators, suppliers, Paris-only pickup points `.ts:966-981`, Paris/Madrid "Popular Areas" `.html:1783`) don't match dynamic inventory. Budget Selection radios reprice nothing (`.html:3336-3356`).
- **[Medium · Function]** Hotel-detail "Remove" just calls `backToHotelList()` — identical to "Change Hotel" (`.html:2081-2086`); nothing is removed.
- **[Medium · A11y]** Duplicate element IDs generated in loops (`id="flight-card"`, `"stays"`, `"activities"`… `.html:2789-3099`) — invalid HTML that breaks anchor targets and AT navigation. `viewMode` changes never move focus; result cards are clickable divs without `role`/`tabindex`.
- **[Medium · Perf]** ~4,540-line component + 3,660-line template compile into one chunk with all 12 view modes always in the template.
- **[Low · Design]** `tripDurationLabel` renders "8 Days : 7 Night / 7Days" (`.ts:2764-2769`); hardcoded hex hovers instead of tokens; bus cards don't stack responsively (`.html:1488`).
- **[Low · UX]** Day-tab nav has no scroll-spy — `activeDayTab` desyncs while scrolling; PDF generation reuses the "Fetching for you" overlay copy.
- **[Low · Perf]** Five cost computeds each traverse all displayed items (`.ts:2808-2860`); `waitForTripReady` polls at 4 req/s for up to 15s (`.ts:4199-4217`).
- **[Low · Code]** Dead code (`parseActivityFromString`, `budgetPriceMultiplier`, `swapSubheading`, five more, `.ts:3280-3368`); pervasive `(item as any)` casts; price-slider inputs and city +/− buttons unlabeled.

### Itinerary map — `itinerary/components/itinerary-map/`

**Done well:** proper `ngOnDestroy` teardown, marker/polyline bookkeeping with `clearMap()`, loading overlay, numbered city markers with fit-to-bounds.

- **[Medium · Security]** Popup HTML string-interpolates API-provided titles (`:118, 156`) — an XSS vector; the map also has no text alternative.
- **[Medium · Function]** Module-scope `L.icon(...)` runs at import time (`:12-22`) — if the Leaflet CDN script hasn't loaded, importing the component throws before Angular can render.
- **[Medium · Function]** `updateMapFeatures` isn't re-entrant: overlapping `ngOnChanges` runs interleave `clearMap()` and awaited geocodes (`:92-170`) → duplicated/orphaned markers, including after destroy.
- **[Medium · Perf]** Serial `await` geocoding per city and segment — N sequential Nominatim round-trips per render with no throttle (`geocoding.service.ts:54-67`).
- **[Low · Function]** Generic locations ("City Center") geocode to arbitrary world coordinates and get plotted (`:135-158`); total geocode failure leaves a silent world view.

### Itinerary PDF — `itinerary-pdf-template/-service/-models`

**Done well:** lazy `import('html2pdf.js')` keeps the heavy lib out of the main bundle; `pdf-avoid-break` classes; a well-typed data model; pre/post-booking template variants.

- **[High · Function]** Inherits the mock-content problem: hardcoded Paris/Barcelona/Madrid `summarySections` and "2 Adults" travellers (`itinerary-page.component.ts:3668, 3682-3685`) — exported PDFs contain wrong facts for most trips.
- **[Low · Function]** 120 ms `setTimeout` before capture (`:3563`) is race-prone on slow devices — prefer `afterNextRender`; the pre-booking PDF's "Book Now" pill has no URL/QR; duplicate re-entrancy guards.

### My Trips — `trip/`

**Done well:** clear loading/error/empty tri-state with retry; visibility and tab-filter rules extracted into pure, tested utils; `TripService` cleanly separates list-load, single-trip, and inventory error channels.

- **[High · UX]** Generated-but-unsaved trips are invisible: `isListedInMyTrips` requires saved/booked/pending (`trip-listing.util.ts:15-18`) and `isEmptyWishlist` then hides even the tabs — a user who generated an itinerary but never clicked Save has no way to find it again.
- **[High · Function]** `TripService.saveTrip` swallows PUT failures and still updates the local signal (`trip.service.ts:394-408`) — the itinerary then toasts "Itinerary saved to My Trips" even when the server rejected it. `deleteTrip` swallows errors too (`:279-281`).
- **[Medium · Function]** In-progress trips vanish: `upcoming` requires `startDate ≥ today` and `recent` requires `endDate < today` (`my-trips-filter.util.ts:14-18`) — a trip happening right now matches neither tab.
- **[Medium · Function]** `searchInventory`'s third fallback drops route/location entirely (`trip.service.ts:341-345`) — arbitrary inventory presented as route-specific results.
- **[Medium · UX]** No card actions (delete/duplicate/share) although `deleteTrip` exists unused.
- **[Medium · A11y]** Tab buttons convey active state only via color — no `aria-pressed`/`role="tablist"` (`trips-page.component.ts:68-81`).
- **[Low · UX]** Loading skeleton is two grey bars, not card-shaped; only the "View Itinerary" text link is clickable, not the card image/title.
- **[Low · Code]** `TripItineraryCardComponent` exists but the page re-implements the card inline; `tripDayCount` counts nights as days (off-by-one); unused `STORAGE_KEY`.

### Chatbot page — `chatbot/`

**Done well:** persists a capped 50-message history tolerating corrupt storage; sends trimmed history with page context; typing indicator has an `aria-label`.

- **[Medium · UX]** No auto-scroll — new replies land below the fold in long chats (`:28`), unlike the floating widget's `shouldScroll` mechanism.
- **[Medium · Function]** Shares the `'travlplanr_chat_history'` localStorage key with the floating widget but with a narrower message shape — images/audio/suggested-actions are silently dropped/rewritten (`:80` vs `floating-chatbot.component.ts:438`).
- **[Medium · UX]** A 401/403 hard-logs the user out mid-conversation (`:150-152`) with no explanation.
- **[Medium · A11y]** No `aria-live` region on the message list — replies aren't announced.
- **[Low · UX]** `clearHistory()` exists but no UI invokes it; no suggested prompts; no voice/image parity with the floating widget.

### Floating chatbot — `shared/components/floating-chatbot/` + chat services

**Done well:** per-trip scoped history that swaps on navigation; focus moves to the input on open; `ChatApiService` retries transient failures with backoff and maps status codes to human messages.

- **[High · Function]** Live-call WebSocket URL is hardcoded `ws://` (`:737`) — blocked as mixed content on any HTTPS deployment. Derive `wss:` from the page protocol.
- **[High · Function]** No `ngOnDestroy`: an active call's socket and microphone stream are never released on destroy (`:720-785`), and a mid-recording `MediaRecorder` leaks the mic (`:634-667`).
- **[Medium · Function]** Persisted messages include `audio_url` with an `<audio autoplay>` binding (`:133-135`) — reloads replay stale audio and blob URLs will be dead; live-call playback spawns a new `Audio` per chunk with no queue → overlapping playback (`:750-757`).
- **[Medium · Function]** `bookPackageFromChat` falls back to `pkgs[0]` when the title doesn't match and redirects to checkout (`chat-context.service.ts:506-511`) — chat can start payment for the wrong package; `book_trip` triggers checkout with no confirmation (`:529-540`).
- **[Medium · A11y]** `role="dialog"` but no Escape-to-close, no focus trap, no `aria-live` on the stream (`:81-165`).
- **[Medium · Code]** Client-side NLU duplicates backend intent logic with a hardcoded 33-destination regex table and a hardcoded USD→INR rate of 83 (`chat-intent.util.ts:100-133, 175`).
- **[Low · Function]** The unread badge renders but is never incremented (`:71-73`); suggested-action chips are removed via object-identity compare, which breaks after persist/reload (`:613-615`).

### For You — `for-you/`

**Done well:** complete skeleton/error/empty/data states with retry; small, focused component; preference tags forwarded to the API.

- **[Medium · Function]** Fallback literals render fake data: `pkg.price || '₹ 50,000'` and `pkg.days || '5 Days'` (`:45`) present invented prices as real.
- **[Medium · Function]** With no saved preferences it fetches the generic packages list and labels it "Personalized recommendations" (`:72-81`).
- **[Medium · UX]** "Customize trip" routes to `/explore` (`:46-48`) rather than a prefilled wizard or the package — the personalization dead-ends.
- **[Low · Design]** Non-responsive `text-8xl` h1; no SEO service usage; `packages` typed `any[]`.

### Explore — `explore/`

**Done well:** SEO metadata on init; loading/error/retry states; filter chips expose `aria-pressed`; duplicate API rows merged via a tested dedupe util.

- **[High · Function]** `startPlanning()` dispatches `setStep(2)` (`:170-172`), skipping wizard step 1 — the required `departureLocation` is never collected, so Explore-initiated trips generate with an empty departure and bypass step-1 validation.
- **[Medium · Function]** Fetches literal `'/api/v1/destinations'` (`:132`) instead of the `apiUrl()` helper — breaks under a non-default API base (same issue on the landing page and itinerary checkout).
- **[Medium · Perf]** `filteredDestinations()` is a method called from the template (`:83-84, 145-155`) — re-filters the full list every change-detection pass; make it a `computed`.
- **[Low · Design]** Results are bare text buttons with no imagery/pricing; the navbar language button is decorative; mixed `*ngIf`/`@for` syntax.

### Packages — `packages/` + `shared/components/package-card/`

**Done well:** `switchMap` on query params correctly cancels stale region fetches; SEO + `ItemList` JSON-LD; guest checkout redirects to login with `returnUrl`; detail page has proper booking/planning busy states.

- **[High · Function]** Package detail defeats itself: when logged in, `ngOnInit` immediately calls `viewItineraryPlan()` (`package-detail-page.component.ts:181-183`), which POSTs `/packages/:id/plan` and navigates away — the user can never see the detail page, and merely viewing a package creates server-side trip state.
- **[Medium · Function]** The shared package card routes the whole card to a blank `/wizard` ignoring which package was clicked (`package-card.component.ts:12`); it's also a fixed non-responsive `w-[411px]`.
- **[Medium · UX]** The list page renders a blank screen before data — everything is wrapped in `@if (pageData)` which is only set in the subscription (`packages-page.component.ts:51, 331`).
- **[Medium · Content]** Fabricated trust signals: "(12568K Reviews)", "Trusted by +10M Travelers" (`:640-641`), a hardcoded 4.5-star row ignoring the actual rating (`:94-100`), invented tags `['4 ★ Hotel', '24/7 Travel Assistance']` on every API package (`:368`), and the same hardcoded "What's included" for every detail page (`package-detail-page.component.ts:157-164`).
- **[Medium · Function]** Dead fallback: every region's static package array is empty (`:649-768`), so the "curated sample packages" branch can never trigger — failed fetches always land on the generic error.
- **[Medium · Perf]** `filteredPackages` is a getter re-filtering + re-sorting every CD cycle, patched with a `chatFilterTick` signal hack (`:280-322`).
- **[Medium · UX]** Recommended cards navigate to bare `['/packages']` with no region (`:238`) — a "Switzerland Tour Package" card lands on default Europe.
- **[Low · UX]** All detail failures collapse to "Package not found" including network errors (`:184-189`); breadcrumb "Packages" has hover affordance but no link; typo key `'farnce'`; `track pkg.title` risks collisions.

### Supporting utils — `shared/utils/`

**Done well:** `package-duration.util.ts` and `destination.util.ts` are small, pure, and testable — the pattern the giant components should follow.

- **[Medium · Function]** `geocoding.service.ts:42-44` — static-cache match uses substring `includes`, so "London Street, Bangkok" resolves to London; no throttle/queue for Nominatim.
- **[Low · Function]** `safeAirlineLogoUrl` rejects _all_ http(s) URLs (`airline-display.util.ts:30-37`) — legitimate provider logos are always discarded; only 4 airlines have bundled assets.
- **[Low · Function]** Only 6 cities have curated activity suggestions; all others get fabricated "{City} Experience N" entries (`activity-suggestions.util.ts:17-56`).

---

## Community

_Paths relative to `apps/web/src/app/community/`. Measured against its own `COMMUNITY_PREMIUM_ROADMAP.md`._

### Cross-cutting

**Done well:** the whole feature is standalone-component + lazy-loaded per route; services are cleanly separated per domain; signals are used in the newer components; most P0–P3 roadmap items are genuinely implemented.

- **[High · Design/Perf]** Duplicate navbars: every community route is a child of `AppShellComponent` which already renders the navbar + `pt-[68px]`, yet the feed, messages, post-detail, profile, and reels pages each render a _second_ navbar. Two fixed navbars stack, and since the navbar embeds the notifications dropdown, **two dropdown instances fetch unread counts per page view**.
- **[High · Code]** Two parallel WebSocket stacks: the auth-reactive `core/services/websocket.service.ts` is never used by community, which instead hand-rolls a raw socket in `community-notifications.service.ts:37-69`.
- **[High · Security]** The community WS URL carries only `customerId` in the path (`community-notifications.service.ts:44`) — no token, so anyone can subscribe to another user's stream. There's also a reconnect race that can perpetually churn connect/close every 5s (`:57-64`).
- **[Medium · Code]** Duplicated logic: `getReactionEmoji`/`getTopReactions`/`getCaptionTokens`/`formatDate` and the post-header badge block are copy-pasted verbatim between the feed and post-detail (`community-page.component.ts:717-760` vs `community-post-detail.component.ts:387-464`).
- **[Medium · Design]** Design-token violations are pervasive (raw `blue-600`/`gray-*`/`slate-*`) while the shell uses `bg-surface-muted` tokens — roadmap C1 still open.
- **[Medium · Perf]** No `OnPush` anywhere in the feature; several components run template functions per change-detection cycle.
- **[Low · Code]** Service pattern inconsistency (constructor vs `inject()` DI; hand-concatenated query strings); roadmap P4 items (analytics, feed-ranking, CMS news) still open; stray `COMMUNITY_PREMIUM_ROADMAP.md.plan` file.

### Feed — `community-page.component.ts` (839 lines)

**Done well:** real skeleton loaders, an empty state, IntersectionObserver infinite scroll with limit/offset, optimistic follow with rollback, and click-to-filter hashtag tokenization.

- **[High · Function]** `@for (token of getCaptionTokens(...); track token.value)` (`:241`) keys on the token value — a caption with a repeated word produces **duplicate track keys → Angular runtime error**. Fix to `$index`.
- **[High · Function]** Hashtag deep-link is broken: post-detail links hashtags to `/community` with a `mode` query param (`community-post-detail.component.ts:106`) but the feed never reads query params — the navigation silently shows the default feed.
- **[High · UX]** The reaction picker is `mouseenter`-only (`:319`) — on touch devices the travel reactions are unreachable; a tap goes straight to plain like.
- **[Medium · UX]** Feed errors are masked: the error handler only logs (`:639-642`), leaving `posts=[]`, which renders the "follow some travelers" empty state after a network failure. Like/react are also non-optimistic.
- **[Medium · Function]** WS subscription leak: `ngOnInit` subscribes to the shared singleton with no teardown, stacking a subscription per visit; `ngOnDestroy` then calls `disconnectWebSocket()` on that shared singleton (`:538-559`).
- **[Medium · Function]** Skeleton cards render _above_ existing posts during pagination (`:142`); the infinite-scroll sentinel is detached on view switches and only re-observed via a 500ms magic-delay `setTimeout` (`:569-573`); "More options", News "Show more", and the Ad CTA are decorative.
- **[Medium · A11y]** The reaction picker can't be opened by keyboard; left-rail and "Profile viewers" rows are clickable `<div>`s; toasts have no `role="status"`/`aria-live`.
- **[Medium · Perf]** `getCaptionTokens()` and `getTopReactions()` run per change-detection pass for every post (`:241, 288`); destination chips fire a Yandex static-map request per post render.
- **[Low · Code]** 839-line component mixing page shell, post card, comments, reactions, toasts, and WS handling; mixed signal/mutable-field idioms; unfired toast `setTimeout` not cleared.

### Post carousel & lightbox — `community-post-carousel.component.ts`

**Done well:** signal-based index state, boundary-aware arrows, labeled dots, a proper lightbox with Escape/arrow keys and body-scroll locking.

- **[High · Perf]** No lazy loading: the main image has no `loading="lazy"`/`decoding="async"` (`:11-16`), so an infinite feed eagerly downloads every post's current image.
- **[Medium · UX]** No touch swipe (roadmap B5 asked for it); arrows are `opacity-0` until `group-hover`, so on touch they're effectively invisible.
- **[Medium · Function]** Video-only posts render `src="undefined"` when `images` is empty — guard with `@if (images.length)`.
- **[Medium · Perf]** `@HostListener('document:keydown')` per instance (`:142`) — N posts register N document listeners.
- **[Low · Function/A11y]** No `ngOnDestroy`, so `body.overflow:hidden` can stick if destroyed while open; generic `alt="Post image"`; no lightbox focus trap.

### Post detail / permalink — `community-post-detail.component.ts` (466 lines)

**Done well:** a real permalink route with loading, not-found, and comment states all handled; optimistic like with rollback; an Instagram-style split layout that stacks on mobile.

- **[High · Function]** The reaction-picker UI is missing entirely: `reactPost()` and `activeReactionPostId` exist and `mouseenter` sets the signal (`:166, 410-428`), but the template has no popup — travel reactions can't be used from the permalink at all.
- **[Medium · Function]** `formatDate(post()!.timeAgo)` feeds a human string like "3h ago" into `new Date()` (`:112, 451`) → "Invalid Date".
- **[Medium · Function]** The comment icon button is dead (should focus the input); permalink visits never count a view.
- **[Medium · UX]** Share copies the URL only — no Web Share API for mobile, and no OG/meta tags, so shared links unfurl blank.
- **[Medium · Design]** The comments column hard-codes `h-[600px]` (`:45`) — a fixed box on mobile and short laptops.
- **[Low · UX/A11y]** Comments have no "load more" despite `has_more`; the follow button loses its focus ring; icon buttons lack `aria-label`.

### Create post — `community-create-post.component.ts` (384 lines)

**Done well:** multi-image upload with previews and `URL.revokeObjectURL` hygiene, video attach with a 50MB guard, destination autocomplete, itinerary attach, and a correct `forkJoin` object-form.

- **[Medium · Function]** The destination picker loads _all_ destinations once and filters client-side (`:232-241`); failure only logs, leaving it silently empty.
- **[Medium · UX]** No unsaved-changes guard — the × button discards typed caption/uploads instantly (`:26-31`); no upload progress for multi-MB videos.
- **[Medium · A11y]** No `role="dialog"`, focus trap, or Escape; the dropzone is a click-only `<div>` (no keyboard, no drag-drop); the close button is a bare `×` with no label.
- **[Low · Function/Code]** No client-side image validation; editing a chosen destination silently clears the tag; uses `HttpClient` directly instead of a service.

### Collections — save modal, page, service

**Done well:** the save flow is complete end-to-end (list → inline-create with privacy toggle → auto-save); the collections page has genuine skeleton and empty states with a CTA.

- **[High · Function]** Collection cards are dead ends — `cursor-pointer` and hover states but no click handler or route, and **there is no collection-detail view anywhere** (`community-collections-page.component.ts:48`). Saved items can never be viewed. "+ New Collection" also does nothing (`:17-19`).
- **[Medium · UX]** The save modal emits errors through the same `saved` output as success (`community-save-modal.component.ts:151-155`), so a failed save and a successful one both close the modal.
- **[Medium · A11y]** Save modal has no `role="dialog"`, Escape, backdrop-close, or focus trap.
- **[Low · Function]** The service is create-only — no `getCollectionItems`, `deleteCollection`, or remove-item endpoints (`community-collection.service.ts:21-35`).

### Stories — bar, viewer, create, service

**Done well:** the bar has skeletons and keyboard-operable buttons with labels and focus rings; the viewer implements the full Instagram model — per-story progress bars, tap zones, group-to-group advance, auto-close at end.

- **[High · Perf]** The viewer's `setInterval` every 50 ms (`community-story-modal.component.ts:149-154`) drives progress via a plain field → app-wide change detection **20×/second** while a story is open.
- **[High · Function]** Story creation takes a raw image-URL string (`community-create-story.component.ts:26-32`) and posts hardcoded identity `author_name: 'You'` (`:94-99`) — stories are attributed to "You" for everyone.
- **[Medium · A11y]** The viewer has no keyboard support at all — click-only nav zones, no Escape, no arrow keys, no focus trap, no `role="dialog"`; the image has an empty alt.
- **[Medium · UX]** No hold-to-pause; the timer keeps running when the tab is hidden; image load isn't awaited, so slow images burn their 5s before appearing.
- **[Medium · Function]** No view tracking (the "seen" ring never changes) and no delete for own stories, though `deleteStory()`/`getUserStories()` exist unused.
- **[Low · UX]** Create uses `alert()` on failure; `imageError` is never reset when the URL changes; "Your Story" always shows the default avatar.

### Reels — `community-reels.component.ts`

**Done well:** correct full-screen snap-scroll structure and `muted playsinline autoplay loop` for mobile autoplay compliance.

- **[High · Perf]** **Every video in the list autoplays simultaneously** — each has `autoplay` with no IntersectionObserver to play only the visible reel (`:27`). N reels = N concurrent downloads, and a "view" is logged for every reel immediately, corrupting counts.
- **[High · Function]** All engagement is dead: follow, like, comment, and share buttons have no handlers (`:45-67`); counts are display-only.
- **[Medium · Function]** If no real reels exist, the first 5 image posts are presented as reels (`:96-100`); no pagination and the error path leaves a black screen with no message.
- **[Medium · Design/A11y]** Sits inside the app shell's `pt-[68px]` while being `h-screen` with its own navbar → geometry off by 68px; no keyboard navigation, no captions, no mute control.

### Messages — `community-messages-page.component.ts` (206 lines)

**Done well:** a solid two-pane layout with a mobile back-navigation pattern, unread badges, instant local mark-as-read, and a clean disabled send button.

- **[High · Function]** **The message thread is never rendered.** The chat pane jumps from header (`:76-91`) straight to the input (`:93-111`); the `messages` signal is populated but there is no `@for` anywhere. The single biggest bug in the feature.
- **[High · Function]** Mock fallbacks on every error path: fake conversations, fake history, and **fake send success** (`:146-202`) — a failed send silently appends the message as delivered.
- **[High · Function]** No realtime: this page neither subscribes to the WS stream nor polls, so incoming DMs never appear; mark-as-read is local-only, so unread counts resurrect on reload.
- **[Medium · UX]** `(keyup.enter)` on a `<textarea>` sends and inserts a newline (`:101`); no Shift+Enter compose, no auto-grow, no scroll-to-bottom; the compose (pencil) button is dead.
- **[Medium · Design]** Inside the shell this page double-offsets (shell `pt-[68px]` + own navbar + own `pt-[68px]`), leaving 68px of dead space and a miscalculated chat height.
- **[Low · UX/A11y]** `isMobile()` reads `window.innerWidth` per CD (not resize-reactive); conversation rows are click-only divs; send button unlabeled.

### Notifications — dropdown + service

**Done well:** type-differentiated icons, unread highlighting, a 99+ badge clamp, optimistic mark-read/mark-all, and overlay-click close.

- **[High · Function]** Mock fallbacks: the unread count falls back to a hardcoded `3` and the list to four fake notifications on API error (`community-notifications-dropdown.component.ts:133-151`) — a fake red badge is the worst "looks real" case.
- **[Medium · Function]** Navigation is a TODO — `link_url` exists on the model but clicks just close the dropdown (`:165`); "View all notifications" is dead and no full page exists.
- **[Medium · Function]** Not realtime: the badge loads once in `ngOnInit` and never updates from the WebSocket.
- **[Medium · A11y]** The bell lacks `aria-label`/`aria-expanded`/`aria-haspopup`; rows are click-only divs; no Escape or focus management.
- **[Low · UX]** Opening refetches with no loading state, so a slow request shows "No notifications yet" first.

### Map — `community-map.component.ts`

**Done well:** correct Leaflet lifecycle (init in `AfterViewInit`, marker-layer reuse, `map.remove()` on destroy, `fitBounds` with padding) and charming avatar markers.

- **[High · Function]** **Markers can never render:** the loop reads `post.destinations` (plural array, `:62-63`) but the model only has singular `post.destination` — the property never exists, so the map is always the empty world view.
- **[High · Security]** Popup HTML interpolates `post.caption` and `post.author.name` unescaped (`:86-97`) → stored XSS via captions rendered through Leaflet's `bindPopup`.
- **[Medium · Function]** `declare const L` (`:4`) assumes a globally loaded script with no guard; no marker clustering.
- **[Low · Design/A11y]** Fixed `h-[600px]`; no loading/empty overlay; markers carry no accessible labels.

### User profile — `community-profile.component.ts` (233 lines)

**Done well:** avatar upload with hover affordance and per-step spinners, follow with follower-count math, and loading/not-found/empty-posts states.

- **[High · Function]** Post-grid tiles aren't clickable (`:93-108`) — no `routerLink` to the permalink, so a profile is a dead end; `post.images[0]` also breaks for video-only posts.
- **[Medium · Function]** Follower/following counters look like links but have no handlers, though `getFollowers`/`getFollowing` exist unused; name/bio editing is dead code; no posts pagination.
- **[Medium · Design]** The profile model lacks the travel-trust signals shown on feed cards (`is_verified`/`countries_visited`/`local_in`) — roadmap P3 badges are absent exactly where they matter most.
- **[Low · UX/A11y]** `alert()` for "please log in"; no message/DM button (breaking the loop the messages empty-state promises); grid tiles unfocusable; hover-only overlay invisible to keyboard/touch.

### Travel-buddy matching — `matching.component.ts`

**Done well:** for a later-phase feature it has the essentials — loading spinner, a genuine empty state with guidance, and a real request with server error surfacing.

- **[Medium · Function]** Matches are anonymous — a card shows `customerId.substring(0,2)` initials and literal "Traveler" (`:36-41`), with no name/avatar/profile link, so you can't vet a buddy before connecting.
- **[Medium · UX]** `alert()` for both success and failure; no per-card pending state, so double-clicking Connect double-sends; `travelStyles`/`languages` fields exist but are never rendered.
- **[Low · Code/Function]** Uses `*ngIf`/`*ngFor` while every sibling uses the new control flow; no view of incoming requests you've received.

---

## Auth, profile & app shell

_Paths relative to `apps/web/`._

### Design system & app shell

**Done well:** a real design-token system in `tailwind.config.js` (semantic colors with a WCAG-AA note, a named type scale, `rounded-btn/card/tile` radii) _with enforcement tooling_ (`check-hardcoded-hex.mjs`, a `lint:hex` script); shared `Primary/Secondary/OutlineButton` with OnPush, loading state, and focus-visible rings.

- **[High · Design]** The collaboration UI is entirely off-brand — a violet/indigo palette (`share-panel.component.ts:22`, `invite-page.component.ts:49`) and raw `gray-*` text instead of the `primary` blue and `text-*` tokens used everywhere else.
- **[High · Code]** Two competing navbars — `shared/components/app-navbar` (used by the app shell) vs `landing/components/navbar` (used by profile, trips, and legal-page-shell). This split is the structural cause of the double-navbar bugs on Pricing and community pages.
- **[Medium · Design]** Ad-hoc buttons bypass the button components: the profile page hand-rolls Save/Cancel with a hardcoded `border-[#525252]` and `rounded-[4px]` (`profile-page.component.ts:156`) that violate both the hex-lint policy and the radius token.
- **[Medium · Design]** Tokens are duplicated: `styles.scss:7-18` re-declares the palette as CSS custom properties while the Tailwind config uses literal hex.
- **[Low · Design]** `section-header.component.ts:20` hardcodes `text-[#333]`; `tailwind.config.js` `content` omits the b2b project, so its templates would be purged.

### Login / auth — `auth/`

**Done well:** a clean two-step OTP flow with per-field validation, loading states, a dev-mode OTP helper panel, and `returnUrl` restoration after login.

- **[High · Security]** JWT stored in `localStorage` (`auth.service.ts:15, 76`), readable by any XSS, with no refresh-token/rotation — when `exp` passes, the user is silently logged out mid-session.
- **[Medium · UX]** No OTP resend (only "Use a different email", `login-page.component.ts:77-83`), no code-expiry hint, and no dedicated signup path.
- **[Medium · A11y]** OTP input lacks `autocomplete="one-time-code"`, `inputmode="numeric"`, and `pattern` hints (`:52-58`); error messages lack `aria-live`/`role="alert"`.
- **[Low · Security]** The dev OTP is surfaced in the UI from the response (`:64-70`) — add an explicit `!environment.production` guard client-side too.

### HTTP interceptor & guards — `shared/`

**Done well:** JWT expiry is checked client-side before use and stale sessions are purged; auth uses Bearer headers not cookies, minimizing CSRF exposure; the auth guard preserves `returnUrl`.

- **[High · Security]** The interceptor logs out on _any_ 401/403 (`auth.interceptor.ts:25-28`) — a 403 on a resource you don't own destroys the whole session. Opening a shared itinerary as a non-collaborator can nuke your session. Restrict logout to 401.
- **[High · Security]** On logout the interceptor navigates to `/login` with no `returnUrl` (`auth.interceptor.ts:27`), unlike the guard — session expiry mid-task dumps the user at login. No retry/refresh-then-retry logic.
- **[High · Security]** Unguarded personal route: `/community/messages` reads `auth.user()` but has no `authGuard` (`app.routes.ts:102-105`), while sibling community routes do.
- **[Medium · UX]** The pending-changes guard exists but is applied only to the wizard (`app.routes.ts:82`), not to profile despite its unsaved-drafts model.
- **[Low · Code]** Duplicate root path `''` in `app.routes.ts:6` and `:70`; login lives inside the shell while `/trips` and `/profile` render their own navbar outside it — the root of the dual-navbar problem.

### Profile — `profile/`

**Done well:** profile load failures show a retry banner; the service exposes signals via `asReadonly()`.

- **[High · UX]** Profile save gives zero feedback: `saveProfile()` awaits a service call that rethrows on failure (`profile-page.component.ts:499-501` → `profile.service.ts:98`), producing an unhandled rejection — no success toast, no error, no spinner. Same for preferences and notifications.
- **[Medium · Function]** Profile drafts can be clobbered mid-edit: a constructor `effect()` (`:451-458`) overwrites drafts whenever service signals emit — e.g. when the async load resolves after the user has begun typing.
- **[Medium · UX]** Toy-scoped inputs — country code offers only +91/+1/+44 (`:101-103`), nationality only 5 countries (`:143-148`); email is editable although it's the auth identity.
- **[Medium · A11y]** Tab nav conveys state only visually (`:54-69`); add-chip inputs have placeholders but no labels.
- **[Low · Code]** Constructor re-checks `isLoggedIn()` although the route already has `authGuard`, and its manual redirect drops `returnUrl` (`:441-445`).

### Collaboration — `collaboration/`

- **[High · A11y]** The share-panel modal has no dialog semantics — no `role="dialog"`, `aria-modal`, focus trap, initial focus, or Escape (`share-panel.component.ts:15-19`); tabs aren't a real tablist and convey the active one by color alone.
- **[Medium · Perf]** Polling never pauses: a 10s `setInterval` fires two HTTP calls even while the tab is hidden (`collaboration.service.ts:86-92`).
- **[Medium · UX]** Invite decline is silent — navigates home with no confirmation/toast and discards errors (`invite-page.component.ts:187-198`).
- **[Medium · Code]** Signals passed as `@Input` (`share-panel.component.ts:314-315`) force the parent to hand over writable signals that the child mutates.

### Third-party assets, secrets & dependencies

- **[High · Security/Perf]** Third-party CDN scripts load globally on every page: Leaflet from unpkg (with SRI) and highlight.js from cdnjs (**no SRI**, `index.html:14-18`) — a supply-chain and availability risk, plus render-blocking.
- **[Medium · Security]** User email leaked to a third party: both navbars build avatar URLs from the email local-part via `ui-avatars.com` (`app-navbar.component.ts:53`). The committed `replace_avatars.py` was written to replace exactly this — it was never run (or the pattern regressed).
- **[Medium · Security]** Sentry misconfiguration: `main.ts:7` ships a placeholder DSN with `tracesSampleRate: 1.0` and session replay on — error reporting is dead in prod, and a real DSN dropped in would be a cost/privacy footgun.
- **[Medium · Security]** Dependency risk: `quill@1.3.7` is EOL with known XSS advisories, alongside a mismatched `ngx-quill@24` and `@sentry/tracing@7` beside `@sentry/angular@10`.
- **[Medium · Code]** One-off Python codemods committed at the web root (`replace_avatars.py`, `rewrite_costs.py`, `rewrite_displayed_days.py`, `modify_itinerary.py`) — regex rewrites of the itinerary component, two with absolute paths from another machine.
- **[High · Code]** Two conflicting `apiUrl()` utilities: `shared/utils/api-url.ts` (prepends `/api/v1`, 20 importers) vs `shared/api.util.ts` (opposite contract, **zero importers — dead code**). Same name, opposite behavior; a wrong import compiles and 404s at runtime.

### Routing, bundles & rendering

**Done well:** every route is lazy `loadComponent`; the floating chatbot is deferred with `@defer (on idle)`; view transitions and zone event coalescing are enabled; the skip link and global `:focus-visible` are solid.

- **[Medium · Perf]** No SSR/prerender is configured even though a `SeoService` emits JSON-LD for marketing/blog pages — crawlers get an empty shell. Budgets are also loose (initial 2mb warn / 4mb error vs 500kb on the other projects).
- **[Medium · Perf]** No preloading strategy (`app.config.ts:22-26`) — after landing, every navigation pays a chunk fetch.
- **[Medium · A11y]** No focus management on route change — `<router-outlet>` never resets focus to `#main-content`/h1 after navigation, and with view transitions on, screen-reader users get no page-change announcement.
- **[Low · Perf/Code]** Scroll restoration is `'top'` only; dead code in `app.component.ts` (empty `router.events` subscribe, unused `isLoginOrSignup`, empty `ngOnInit`); `AuthService`/`ProfileService` use `any` at every API boundary.

---

## Backend services

_Paths under `travlplanr/services/`. The gateway proxies `/api/v1/admin/*` straight to planner and only blocks `/api/v1/internal/`._

### identity

**Done well:** argon2 password hashing; real logout revocation via a Redis jti blocklist with matched TTL; the seed endpoint is environment-gated with a constant-time secret check; admin signup requires an existing manager and can't self-escalate role; deliberate N+1 avoidance and real capped pagination.

- **[High · Function]** **B2B accounts can't be inserted.** The only migration creates `user_kind` as `Enum('CUSTOMER','STAFF')` (`alembic/versions/61950fd85731_baseline_schema.py:34`) but the model adds `CORPORATE_ADMIN`/`TRAVEL_AGENT` — `agents.py:25`'s query fails with "invalid input value for enum" on Postgres.
- **[High · Function]** `me.py:284` — `delete_account` deletes `CustomerProfile` but not `customer_assignments` rows referencing it → IntegrityError → 500; customers can never delete their account (GDPR flow broken).
- **[High · Function]** `staff.py:305,335` — staff DELETE declares `204 No Content` then returns a body; Starlette raises "Response content longer than Content-Length", so staff deletion 500s.
- **[High · Function]** Display-code generation races: `auth.py:177-179`, `staff.py:247-249`, `auth.py:281-283` load every row and compute `count+1` — two concurrent signups collide on the unique index. Same check-then-insert race on email uniqueness.
- **[High · Function]** The metering consumer swallows and mis-acks: `scalar_one_or_none()` with no unique constraint on `subscriptions.user_id` raises on a second period, the exception is swallowed, and the message is acked anyway (`consumers/ai_worker_consumer.py:50-64`).
- **[High · Security]** OTP codes come from the non-cryptographic PRNG `random.randint` (`auth.py:221`) though `secrets` is already imported.
- **[High · Security]** `otp_verify` never checks `User.status`/`deleted_at` (`auth.py:263-309`), so a suspended or soft-deleted customer can still get a fresh JWT via OTP.
- **[High · Security]** `dev_otp` is returned in the API response whenever `ENVIRONMENT != "production"` and no SendGrid key is set (`auth.py:233-239`) — a default-allow that leaks live OTPs on any misconfigured deploy.
- **[High · Security]** `/internal/users/resolve` and `/internal/users/{id}/plan` are completely unauthenticated (`internal.py:20-35`) — one gateway misconfiguration turns resolve into a public email-enumeration oracle.
- **[Medium · Security]** OTP brute-force: verify is capped at 10 attempts/300s _per IP_ (`auth.py:243-257`); no per-email counter, no invalidation after N failures, and a non-constant-time compare. OTP request is also per-IP only, enabling email floods.
- **[Medium · Security]** No password policy (`auth.py:37-41` accepts empty strings); no refresh-token flow (the access token itself lives 7 days); no password-reset or email-verification flow; a shared HS256 secret across all services means any service can mint staff tokens.
- **[Medium · Function]** Raw-body update endpoints with no Pydantic model (`customers.py:403-441`, `staff.py:279-302`) let `name` be set to `None`; unguarded `uuid.UUID(path param)` 500s on malformed IDs; admin-created staff have no password and can never log in; inconsistent event ordering around commit.
- **[Medium · Function]** The customer list returns _fabricated_ LTV/segment values derived from `md5(cp.id)` (`customers.py:156-171`).
- **[Medium · Perf]** `argon2.verify`/`hash` and the synchronous SendGrid client run inside async endpoints (`auth.py:112,166,230`), blocking the event loop.
- **[Medium · Testing]** The security-critical auth service has **zero tests**.
- **[Low · Security/Code]** OTP codes and invite tokens written to logs; JWT payload embeds PII; agent approve/reject needs only `require_staff`; per-request `httpx.AsyncClient` construction; a stray committed `identity.db` SQLite file; duplicated code between routers.

### planner (largest service)

**Done well:** server-authoritative checkout pricing (recomputed from the record, client `amount` ignored, ownership checked, Stripe webhook signature-verified and idempotent); prompt-injection hardening; money-safe integer-cents expense splitting; consistent role-gating on collaboration mutations; an explicit allowed-transitions state machine.

- **[High · Security]** Three admin routers have **no auth** and are reachable through the gateway: destinations CRUD (`admin_destinations.py:38-79`), promotion-code CRUD (`admin_promotions.py:32-75`), and review moderation (`admin_reviews.py:27-57`).
- **[High · Security]** The community websocket `/ws/{customer_id}` accepts any connection with no JWT verification (`community.py:1314-1321`).
- **[High · Security]** `clone_trip` fetches the source trip by id with no ownership/collaborator/tenant filter (`community.py:1239-1312`) — an IDOR letting any customer clone any other user's private trip.
- **[High · Function]** The voice text endpoint is broken: `_chat_with_assistant(chat_req, auth)` is called with 2 args but the signature needs 3 (`voice.py:117` vs `chat.py:188`) — every voice message raises TypeError.
- **[High · Function]** Optimistic concurrency is dead: `Trip` has no `version` column though migration 0008 adds one, so the document-level guard never fires (`models/trips.py:43-93`, `trips.py:540,573`).
- **[High · Function]** The "invalidate old invite tokens on re-invite" block issues a SELECT and discards the result (`collaboration.py:330-338`) — old pending tokens stay valid. Display codes also race via global `count+1` across four routers.
- **[High · Reliability]** The `GENERATION_FAILED` consumer branch isn't in a per-message try/except (`consumers/ai_worker_consumer.py:143-172`) — a throw skips `xack` for that message and the rest of the batch; with no `XAUTOCLAIM`, such messages are stranded forever (the trip hangs in GENERATING).
- **[High · Code]** `community.py` is 1,321 lines holding posts, reactions, comments, follows, stories, notifications, DMs, collections, profiles, hashtags, clone, and a WS manager. Split it.
- **[Medium · Security]** More auth gaps: the voice websocket and `POST /{post_id}/view` are unauthenticated and un-rate-limited; staff blog upload accepts any extension → stored XSS; upload size relies on client-supplied `file.size`; refund "God-Mode" and global markup require only `require_staff` (`checkout.py:150-176`); `GET /blog/{slug}` and `/stories/user/{id}` leak unpublished/ungated content.
- **[Medium · Reliability]** Domain events are emitted _before_ `session.commit()` across several routers; the checkout webhook marks the Stripe event processed _before_ emitting `TRIP_BOOKED`, so a failed emit permanently loses the booking signal.
- **[Medium · Reliability]** Sync SDK calls on the event loop: `stripe.checkout/Refund.create` (`checkout.py:109-133`), boto3 `put_object` up to 50MB (`s3.py:32-37`), and sync SendGrid from async collaboration.
- **[Medium · Perf]** N+1 and unbounded queries: followers/following two-queries-per-row, per-conversation profile/unread queries, per-expense share fetches, feed/explore `limit`/`offset` with no upper bound, and a full-table scan per `get_matches`. Missing indexes on `TripCollaborator.email`, `Story.expires_at`, and the `customizations->packageId` JSON lookup.
- **[Medium · Function]** Lost-update counters (likes/comments/views are Python read-modify-write, not `col = col + 1`); check-then-insert races on reactions and conversations; plan-limit fails _open_ on any non-200 from identity; raw-body `update_trip` writes arbitrary JSON into `days`/`segments`; `GET /profile/{user_id}` ignores the path param and returns the caller's own profile.
- **[Medium · Perf]** The pubsub fan-out routes only to the `websocket.py` manager while `community.py` uses a separate process-local `ws_manager` (`pubsub.py:24-40`), so reaction notifications never reach users on other workers.
- **[Medium · Ops]** `create_revisions_table.py` and the `/seed` route call `Base.metadata.create_all` / `importlib.reload` at runtime, bypassing Alembic — this is why community tables exist despite a no-op migration, and the schema drifts.
- **[Medium · API]** Inconsistent response contracts: customer trip endpoints return ad-hoc dicts while admin/CMS routers use `response_model`; declared `PostResponse`/`CommentResponse` models don't match the raw dicts returned.
- **[Medium · Code]** Two different `require_trip_role` implementations (a local string-arg one in `collaboration.py:61-120` vs the shared list-arg one); `_budget_multiplier` and travelers-from-group maps each defined twice with divergent behavior.
- **[Low · Function/Ops]** Accept-invite email guard skipped when the JWT lacks an email claim; refund errors leak raw Stripe exception text; `"default_tenant"` string isn't a UUID so refund metrics never reach the dashboard; `convert_data.js`/`seed_db.py` artifacts at service root; migration 0008 docstring names the wrong down-revision (chain is intact).

### ai-worker

**Done well:** excellent reliability engineering — bounded LLM retries with backoff, per-call and overall timeouts, a dead-letter stream, stale-message reclaim via `xautoclaim`, and always-ack in `finally`; adversarial-output defense that clamps numbers and rejects non-http(s) image URLs; prompt-injection isolation of RAG examples.

- **[Medium · Function]** Gemini default model is `"gemini-3.5-flash"` (does not exist; correct is `gemini-1.5-flash`) — masked in dev only because compose overrides it (`llm_providers.py:137`); the Anthropic default is likewise unverified.
- **[Medium · Function]** `_hydrate_segments` overwrites segment price with inventory price but keeps the AI-generated title/carrier (`main.py:331-390`); combined with mock inventory this yields plausible-but-fake prices/links marked `bookable=True`.
- **[Medium · Perf]** `resolve_provider_chain()` runs on every generation and again inside `complete()`, and `OllamaProvider.is_available()` does a live network probe each time (`main.py:288,210`); inventory hydration calls affiliate once per segment sequentially.
- **[Low · Function/Ops]** Provider response parsing indexes into `choices/candidates` with no shape guard; no Dockerfile `HEALTHCHECK` or pinned deps (runs as non-root, good).

### affiliate

**Done well:** booking list/idempotency queries are scoped by `customer_id` + `tenant_id` (no IDOR); the consumer is idempotent and always-acks in `finally`; a correctly-solved SQLAlchemy enum footgun; currency/amount validated.

- **[Medium · Function]** Inventory is largely fake — Amadeus hotels/cars/transit and the flight/activity fallbacks return random mock data (`adapters/providers/amadeus.py:113-132`, `booking_viator.py`, `google_places.py:61-86`).
- **[Medium · Security]** `POST /bookings` trusts the client-supplied `amount` (`bookings.py:19-24`); `/inventory/search` rate-limits on `request.client.host`, which behind the gateway is always the gateway IP → one global bucket for all users.
- **[Medium · Reliability]** The booking consumer's group is created with the default `"$"` id (`booking_consumer.py:15`), so on first creation it ignores the pre-existing backlog.
- **[Low · Function/Perf]** Missing `customer_id`/`tenant_id` fall back to random UUIDs (orphan bookings); external provider clients have no explicit timeout; no reclaim on crash; unpaginated list; no `HEALTHCHECK`.

### reporting

**Done well:** clean read-model/CQRS separation (dashboards serve rollup tables, never live OLTP scans); `require_staff` on every route with internal stats gated by a constant-time secret; properly paginated, tenant-scoped notifications.

- **[Medium · Function]** `/summary` returns hardcoded `change_pct` (5.0/2.0) and fabricated sparkline arrays on every KPI card (`dashboard.py:159-176`) — the trend/delta figures shown to admins are fake.
- **[Medium · Reliability]** On a processing exception, messages are neither acked nor reclaimed (no `xautoclaim` in reporting), so they're effectively lost (`planner_consumer.py:192-193`, `identity_consumer.py:209-210`); no consumer dedupes on `event_id`, so at-least-once redelivery double-counts non-atomic counter bumps.
- **[Low · Function/API/Perf]** `BOOKING_REFUNDED` reverses GBV but not net revenue (rollups drift upward); `notifications.py` returns a raw dict amid Pydantic models; `/financials` buckets all rows in Python.

### shared library

**Done well:** a strong default-deny production secret guard; consistent security headers + HSTS + explicit CORS allowlist; Redis Streams with consumer groups and a documented idempotent envelope; a deliberately-chosen `socket_timeout` with the rationale captured in a comment; structured JSON logging.

- **[High · Security]** The rate limiter keys on `x-forwarded-for` taken verbatim (`rate_limit.py:26-29`) — any client that can set the header (and the nginx config _appends_ rather than replaces it) rotates the value to bypass all app-layer rate limits.
- **[Medium · Security]** Insecure config defaults not fully covered by the prod guard: `database_url` with `travlplanr:travlplanr` creds and the 7-day access-token lifetime both escape the validator (`config.py:18-42`). Revocation checking and rate limiting both fail _open_ on Redis errors.
- **[Medium · Code]** `auth_dependencies.py:141-199` — `require_trip_role` imports planner-only models from the _shared_ library; it only works inside planner and crashes if used elsewhere.
- **[Medium · Reliability]** `emit_event` uses `xadd` with no `maxlen` (`redis_client.py:30-34`), so every stream grows unbounded; events are emitted post-commit with no outbox/retry.
- **[Medium · Testing]** No tests for `rate_limit.py`, `auth_dependencies.py` (revocation, `require_staff/manager`), `middleware.py`, or `redis_client.py` — the actual auth _enforcement_ paths are untested.
- **[Low · Reliability/Code]** Default DB pool with no sizing/recycle tuning; `get_db`/`get_session` near-duplicates that identity's routers use neither; fixed-window rate-limit counters allow a 2× boundary burst; `jwt.decode` doesn't require `sub`/`exp`/`jti` claims.

### Infra, compose & test coverage

**Done well:** the gateway blocks `/api/v1/internal/` at the edge, has edge rate-limit zones for OTP/admin-login/chat, CDN-style caching with stale-on-error, and a documented TLS/HSTS block; compose uses `pgvector/pg16` and healthchecks its stateful services.

- **[High · Security]** The gateway proxies `/api/v1/admin/promotions|destinations|reviews` to planner with no edge auth (`infra/gateway/nginx.conf:130-145`), and those planner routers have no app auth — net effect: unauthenticated admin mutation over the public gateway.
- **[Medium · Ops]** No app service in `docker-compose.yml` defines a `healthcheck` or `restart` policy, and the gateway's `depends_on` has no `service_healthy` condition; both migrating Dockerfiles run `alembic upgrade head` on every container start, racing under horizontal scaling.
- **[Medium · Security]** Compose ships weak defaults (Postgres `travlplanr/travlplanr`, MinIO `minioadmin/minioadmin`, uploads bucket world-readable, `JWT_SECRET: dev-secret-change-in-prod`) — safe only because `ENVIRONMENT` is unset.
- **[High · Testing]** No tests exist for identity, affiliate, or reporting; the money paths (checkout→webhook→booking, OTP auth, refunds, dashboard rollups) are untested end-to-end, and there are no router-level auth tests anywhere — exactly why the no-auth routers and unauthenticated websocket went unnoticed.
- **[Low · Security/Ops]** Committed `.env`/`.env.server` (placeholders only, but a bad habit); Ollama and MinIO ports published to host; no Dockerfile `HEALTHCHECK` or pinned base-image digests.

---

## Repo-level items

- **[Medium · Docs]** Root `BUGS.md` is stale and misleading — it describes files that don't exist in this codebase (`app.module.ts`, `chat.component.ts`, `payment/`, `admin/`, `core/guards/role.guard.ts`). Regenerate it from this audit or delete it.
- **[Medium · Repo]** The workspace root mixes the app with five vendored tool repos (`claude-marketplace/`, `ui-ux-pro-max-skill/`, `bencium-claude-code-design-skill/`, `skills/`, `agent-skills/`) around the real app in `travlplanr/`, and the project is not a git repository — no history, no revert safety. Initialize git in `travlplanr/` and move tooling out.
- **[Low · Docs]** `travlplanr/README.md` drift: says "Local full stack (coming soon)" although `docker-compose.yml` exists, and omits the reporting service and the community/collaboration features.
- **[Low · Repo]** One-off artifacts committed at service roots: `services/planner/create_revisions_table.py`, `convert_data.js`, `identity/identity.db` (SQLite in a Postgres project), plus the four Python codemods at the web root.
