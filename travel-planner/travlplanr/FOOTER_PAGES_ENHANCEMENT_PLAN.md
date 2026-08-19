# Footer-Linked Pages — Enhancement & Improvement Plan

This document covers **UI/UX**, **content**, **SEO**, **i18n**, and **structural** improvements for every route reachable from `FooterSectionComponent` via `FOOTER_LINK_GROUPS` in `apps/web/src/app/shared/data/landing.data.ts`, plus the footer’s own interactive elements (newsletter, travel resources dropdown, support block).

**Scope:** Customer app (`apps/web/`) public pages linked from the global footer.

**Related:** See `DESIGN_ENHANCEMENT_PLAN.md` for platform-wide roadmap (design system, CMS admin, SSR, Stripe, etc.).

---

## Footer Link Map

| Footer link | Route | Shell pattern | Data source |
|-------------|-------|---------------|-------------|
| About Us | `/about` | Custom hero + section nav | Static i18n + `about.data.ts` |
| How It Works | `/how-it-works` | Custom gradient hero | i18n keys only |
| Blogs | `/blog`, `/blog/:slug` | Navbar + sections | CMS API (`/cms/blog`) |
| Travel Resources | External URLs | Footer dropdown | Hardcoded external links |
| FAQ | `/faq` | Navbar + sidebar nav | CMS API (`/cms/faq`) |
| Terms | `/terms` | `LegalPageShell` | Static `terms.data.ts` (EN) |
| Privacy | `/privacy` | `LegalPageShell` | Static `privacy.data.ts` (EN) |
| Contact Us | `/contact` | Custom gradient hero | Form → API (`POST /api/v1/contact`) |

**Footer chrome (not routes):**

| Element | Current behavior |
|---------|------------------|
| Newsletter | Toast on submit — no API |
| Social links | External (Facebook, Instagram, X, LinkedIn, YouTube) |
| Partner logos | Decorative partner row |
| Support | `support@travlplanr.com` mailto |

**Key reference files:**

| Topic | Path |
|-------|------|
| Footer component | `apps/web/src/app/landing/components/footer-section/footer-section.component.ts` |
| Footer link data | `apps/web/src/app/shared/data/landing.data.ts` |
| Legal shell | `apps/web/src/app/shared/components/legal-page-shell/legal-page-shell.component.ts` |
| Legal content | `apps/web/src/app/shared/components/legal-document-content/legal-document-content.component.ts` |
| CMS service | `apps/web/src/app/shared/services/cms.service.ts` |
| CMS API | `services/planner/app/routers/cms.py` |
| Contact API | `services/planner/app/routers/contact.py` |
| Routes | `apps/web/src/app/app.routes.ts` |

---

## Current State Summary

| Page | Maturity | Strengths | Main gaps |
|------|----------|-----------|-----------|
| **About** | High (recent refactor) | Section components, i18n, JSON-LD, compressed images | Custom shell; abstract team section |
| **How It Works** | Medium | Full i18n, rich content, FAQ preview from CMS | 520-line monolith; duplicates landing; token drift |
| **Blog list** | Medium | CMS, search, filters, featured hero, skeletons | Hardcoded EN SEO; no pagination |
| **Blog post** | High | Per-post SEO, OG image, `BlogPosting` JSON-LD | No TOC; CMS content EN-only |
| **FAQ** | High | Search, scroll-spy, sidebar nav, `FAQPage` JSON-LD | No bottom contact CTA; CMS EN-only |
| **Terms** | Medium | `LegalPageShell`, TOC, email linking | Body copy EN-only; placeholder aria label |
| **Privacy** | Medium | Same as Terms | Same as Terms |
| **Contact** | High | Real API, validation, topic cards, i18n | Chat claim unverified; no ticket ID shown |
| **Travel Resources** | Low | External links work | No on-site hub; no new-tab cues |
| **Footer newsletter** | Stub | UI exists | No backend; no consent |

---

## Cross-Cutting Enhancements

### 1. Shared public page shell

Three layout patterns exist today:

| Pattern | Used by |
|---------|---------|
| `LegalPageShell` | Terms, Privacy |
| Custom gradient hero | How It Works, Contact |
| Navbar + `section-container` | Blog, FAQ, About |

**Plan:** Extract `PublicPageShellComponent` with variants (`legal`, `hero`, `content`) for consistent navbar offset, max-width, typography, and footer spacing.

### 2. Design token migration

How It Works and Contact use `slate-*`, inline `style="background:linear-gradient(...)"`, and `font-[Poppins,sans-serif]` instead of design tokens (`text-text-primary`, `bg-surface`, `font-poppins`, `primary`).

**Plan:** Migrate to tokens; add `hero-gradient-dark` utility in `styles.scss` to replace repeated inline gradients.

### 3. CMS content localization

`CmsService` fetches blog/FAQ with no locale parameter. UI chrome is translated (en/es/fr); **body content is always English**.

**Plan:**

1. Pass current locale to CMS APIs; fallback to `en`
2. Add locale fields on `BlogPost`, `FaqSection`, `FaqItem` (DB + admin)
3. Admin publish-per-locale workflow (see `DESIGN_ENHANCEMENT_PLAN.md` CMS section)

### 4. Legal pages i18n

`terms.data.ts` and `privacy.data.ts` are English-only. `LEGAL.TOC_ARIA_LABEL` is a placeholder (`"Toc Aria Label"`) in all locales.

**Plan:** Fix aria label immediately; long-term — CMS-managed legal docs with `effective_date`, `version`, and per-locale content.

### 5. SEO standardization

| Page | SEO today | Gap |
|------|-----------|-----|
| About | `seo.set()` + Organization JSON-LD | Done |
| How It Works | i18n title/description | No `HowTo` JSON-LD |
| Blog list | Hardcoded EN in `ngOnInit` | Use `BLOG.SEO.*` i18n keys |
| Blog post | Per-post meta + `BlogPosting` | Strong |
| FAQ | i18n SEO + `FAQPage` JSON-LD | Strong |
| Terms/Privacy | Hardcoded EN | No legal schema; TOC aria |
| Contact | i18n SEO | No `ContactPage` schema |

### 6. Test coverage

Only About has unit tests among footer-linked pages.

**Plan:** Smoke tests per page — component creates, SEO called, critical UI renders. Mock `CmsService` / `ContactService` where needed.

### 7. SSR / prerender

Footer pages are prime SEO targets but client-rendered.

**Plan:** Prerender `/about`, `/how-it-works`, `/blog`, `/faq`, `/terms`, `/privacy`, `/contact` (see platform plan Phase 4).

### 8. Footer chrome

| Element | Enhancement |
|---------|-------------|
| Newsletter | Wire to API (Resend/Mailchimp); GDPR consent checkbox |
| Travel Resources | `rel="noopener noreferrer"`; external-link icon; eventual `/resources` hub |
| Support | Link to `/contact`; optional hours/timezone |

---

## Page-by-Page Plans

### `/about` — About Us

**Status:** Recently refactored into section components with i18n, sticky nav, image compression, and `setJsonLd(Organization)`.

| Done | Remaining |
|------|-----------|
| Section component split | Align with `PublicPageShell` |
| i18n for all UI strings | Real team profiles or careers link |
| Map lazy-load + touch popups | Static map fallback on mobile |
| Product pillars (not fake stats) | Breadcrumb: Home → About |

**Priority:** P2–P3 (maintenance polish)

---

### `/how-it-works` — How It Works

**Status:** Feature-rich (~520 lines, monolithic) but overlaps landing `HowItWorksSectionComponent`.

**Gaps:**

- Monolithic component — hard to maintain
- Duplicates landing “How it works” content
- CTAs point to `/explore` instead of `/wizard`
- `slate-*` palette vs design tokens
- No sticky section nav
- No `HowTo` JSON-LD
- No unit tests

**Structural plan:**

1. Split into sections: `HiwHero`, `HiwSteps`, `HiwAi`, `HiwFeatures`, `HiwPartners`, `HiwFaqPreview`, `HiwCta`
2. Reuse `HowItWorksStepsComponent` from landing instead of duplicate mockups
3. Landing = summary; this page = deep dive
4. Sticky nav: Steps · AI · Features · Partners · FAQ
5. CTA hierarchy: `/wizard` → `/explore` → `/pricing`
6. Add `HowTo` JSON-LD for the 3 steps

**Priority:** P1

---

### `/blog` — Blog list

**Gaps:**

- SEO title/description hardcoded English in `ngOnInit`
- Featured hero image `alt=""`
- No pagination (all posts load at once)
- No list-level JSON-LD
- No end-of-page CTA to wizard/explore
- CMS content English-only

**Plan:**

- i18n SEO keys for list page
- Pagination or “Load more”
- `CollectionPage` / `Blog` JSON-LD
- Featured image alt from post title
- Shared `PublicPageCta` at bottom

**Priority:** P1 (SEO/i18n); P2 (pagination, TOC on posts)

---

### `/blog/:slug` — Blog post

**Strengths:** Per-post SEO, OG image, `BlogPosting` JSON-LD, related posts, breadcrumbs, code highlighting.

**Gaps:**

- No table of contents for long articles
- No reading progress indicator
- No author bio / author page
- Content English-only from CMS

**Plan:**

- Auto-generated TOC from `h2`/`h3` in sanitized HTML
- Reading time computed vs CMS string
- Author schema with `sameAs`
- Locale-aware CMS content (Phase 2)

**Priority:** P2

---

### `/faq` — FAQ

**Strengths:** Sidebar + mobile jump, search, scroll-spy, skeleton/error states, `FAQPage` JSON-LD.

**Gaps:**

- CMS content English-only
- No “Was this helpful?” feedback
- No contact escalation CTA at bottom
- No deep-link to section/question (`/faq#section-id`)

**Plan:**

- Bottom CTA: “Still have questions?” → `/contact?subject=General Inquiry`
- Hash routing for sections
- Expand first match when search narrows to one item
- Optional chatbot handoff for no-results queries

**Priority:** P1 (contact CTA + deep links); P2 (feedback)

---

### `/terms` + `/privacy` — Legal

**Strengths:** `LegalPageShell`, TOC with anchors, email auto-linking, last-updated date.

**Gaps:**

- Body copy English-only in `terms.data.ts` / `privacy.data.ts`
- `LEGAL.TOC_ARIA_LABEL` placeholder
- Hardcoded SEO strings
- No print/PDF export
- No version history
- No cross-link between Terms ↔ Privacy in hero

**Plan:**

- Fix TOC aria label (P0)
- Print / download PDF button
- Legal footer strip cross-links
- es/fr legal translations (compliance)
- CMS-managed legal docs long-term

**Priority:** P0 (aria); P1 (es/fr legal)

---

### `/contact` — Contact Us

**Strengths:** Full form validation, a11y, topic cards, `?subject=` prefill, real `SupportTicket` API, response-time sidebar, i18n.

**Gaps:**

- “Live chat available” may not be wired
- No ticket reference ID shown on success (API returns `id`)
- No honeypot beyond rate limit (5 req / 5 min)
- Postcode `560001` hardcoded
- No confirmation email to user

**Plan:**

- Show ticket ID on success
- Wire chat or remove chat claim
- Honeypot + optional reCAPTCHA
- Backend confirmation email event
- Breadcrumb: Home → Contact

**Priority:** P1

---

### Travel Resources (footer dropdown)

**Current:** Four external links — visa, insurance, currency, packing (`TRAVEL_RESOURCE_LINKS` in `landing.data.ts`).

**Plan:**

- Short term: `rel="noopener noreferrer"`, external-link icon, opens in new tab
- Long term: `/resources` hub with curated tools, affiliate disclosures, and “Plan your trip” CTA

**Priority:** P3

---

## Unified Information Architecture

Cross-linking between footer pages (currently siloed):

```
About ──→ How It Works ──→ /wizard
  │              │
  └── FAQ ←──────┘
         │
    Contact ←── Terms / Privacy
         │
       Blog (inspiration → planning)
```

**Shared `PublicPageCtaComponent`** on About, How It Works, FAQ, Blog list:

- Primary: Start planning → `/wizard`
- Secondary: View pricing → `/pricing`
- Tertiary: Contact us → `/contact`

---

## Phased Roadmap

### Phase 1 — Quick wins (1–2 weeks)

| # | Item | Pages |
|---|------|-------|
| 1 | Fix `LEGAL.TOC_ARIA_LABEL` | Terms, Privacy |
| 2 | Blog list SEO → i18n keys | Blog |
| 3 | FAQ bottom contact CTA | FAQ |
| 4 | Contact: show ticket ID on success | Contact |
| 5 | External link `rel` + icon on travel resources | Footer |
| 6 | How It Works CTAs → `/wizard` primary | How It Works |
| 7 | Smoke tests (SEO + render) | All footer pages |

### Phase 2 — Consistency & CMS (3–5 weeks)

| # | Item | Pages |
|---|------|-------|
| 1 | `PublicPageShell` extraction | All |
| 2 | Token migration (`slate-*` → design tokens) | How It Works, Contact |
| 3 | Split How It Works into section components | How It Works |
| 4 | Reuse landing `HowItWorksStepsComponent` | How It Works, Landing |
| 5 | Blog pagination + featured image alt | Blog |
| 6 | Blog post TOC generator | Blog post |
| 7 | FAQ deep links + hash routing | FAQ |
| 8 | Locale param on CMS APIs (fallback `en`) | Blog, FAQ |
| 9 | `HowTo` JSON-LD | How It Works |

### Phase 3 — Content & growth (6–10 weeks)

| # | Item | Pages |
|---|------|-------|
| 1 | Legal content i18n (es/fr) | Terms, Privacy |
| 2 | CMS locale fields + admin workflow | Blog, FAQ |
| 3 | `/resources` hub | Footer |
| 4 | Newsletter API + consent checkbox | Footer |
| 5 | SSR/prerender for footer routes | All public |
| 6 | Contact confirmation email | Contact |
| 7 | “Was this helpful?” on FAQ | FAQ |

### Phase 4 — Polish (ongoing)

| # | Item | Pages |
|---|------|-------|
| 1 | Print/PDF export for legal | Terms, Privacy |
| 2 | Author pages for blog | Blog |
| 3 | RSS feed | Blog |
| 4 | Reading progress on blog posts | Blog post |
| 5 | Real team on About | About |

---

## Priority Matrix

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| **P0** | Legal TOC aria label | a11y | Low |
| **P0** | CMS locale API contract | i18n | Medium |
| **P1** | Public page shell unification | Consistency | Medium |
| **P1** | How It Works refactor + landing dedupe | Maintainability | Medium |
| **P1** | Blog SEO i18n + pagination | SEO/perf | Medium |
| **P1** | FAQ contact CTA + deep links | Conversion | Low |
| **P1** | Contact ticket ID + chat accuracy | Trust | Low |
| **P2** | Design token migration | Design system | Medium |
| **P2** | Blog TOC + HowTo JSON-LD | SEO/UX | Medium |
| **P2** | Legal es/fr translations | Compliance | High |
| **P2** | Footer newsletter backend | Growth | Medium |
| **P3** | `/resources` hub | UX | Medium |
| **P3** | SSR/prerender | SEO | High |

---

## Target File Structure (Phase 2)

```
apps/web/src/app/
  shared/components/
    public-page-shell/
    public-page-cta/
    legal-page-shell/          (existing)
    legal-document-content/    (existing)
  about/                       (refactored)
  how-it-works/
    how-it-works-page.component.ts
    components/
      hiw-hero-section/
      hiw-steps-section/       (reuse landing how-it-works-steps)
      hiw-ai-section/
      hiw-features-section/
      hiw-partners-section/
      hiw-faq-preview-section/
      hiw-cta-section/
  blog/
    components/
      blog-toc/
      blog-pagination/
  faq/
    components/
      faq-contact-cta/
  contact/                     (already strong)
  terms/  privacy/             (thin LegalPageShell wrappers)
```

---

## Summary

Footer-linked pages span a wide maturity range:

- **Strong:** FAQ, Contact, Blog post detail
- **Recently improved:** About
- **Feature-rich but brittle:** How It Works (monolith + landing duplication)
- **Functional but English-locked:** Blog list, Terms, Privacy
- **Stub-level:** Footer newsletter, Travel Resources (external only)

Highest-leverage work: **unify the public page shell**, **define CMS i18n**, and **refactor How It Works** to match the About pattern. Legal and CMS localization are the main compliance gaps for es/fr users.

---

*Generated: July 2026*
