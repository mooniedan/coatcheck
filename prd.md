# Product Requirements Document (PRD): Coat Check

## 1. Executive Summary
**Coat Check** is a web application that answers the daily question *"what should I wear?"* by translating the weather forecast into concrete clothing recommendations. It pairs real-time weather data with a personalized recommendation engine and a feedback loop, so advice adapts to the fact that people experience the same temperature differently — some run cold, some run warm.

Recommendations start **generic** for every new user, then become **personal** as the user gives feedback ("too cold" / "too hot" / "just right"). Aggregated feedback from a small set of **alpha** users seeds smarter defaults for **beta** users, and the combined dataset ships as improved global defaults when the product goes to **general availability (GA)**.

**Pivot:** Coat Check was originally prototyped as a native Android app (Kotlin/Jetpack Compose/Hilt/Firebase — see Appendix A). We are now building it **web-first** so we can ship and iterate faster across all devices. The architecture deliberately separates a reusable **API layer** from the web UI so that native iOS/Android clients can be added later against the same backend.

## 2. Problem Statement
Weather apps report data ("15°C, windy, 40% rain") but stop short of advice. Users are left to translate numbers into outfits, and that translation is personal: individual cold/heat tolerance, age (kids vs. adults), and habit all change the right answer. Generic "wear a jacket above 12°C" rules are wrong often enough that people stop trusting them. Coat Check closes the gap between *forecast* and *decision*, and keeps learning per person.

## 3. Goals & Objectives
* **Actionable advice:** Specific, layered clothing suggestions driven by "feels like" temperature and conditions (rain, wind).
* **Personalization:** A feedback loop that shifts each person's recommended thresholds over time toward their real comfort.
* **Family / multi-person profiles:** One account can hold profiles for several people (e.g. self + partner + children), each with its own learned thresholds.
* **Data network effect:** Alpha feedback improves beta defaults; alpha+beta feedback improves GA defaults. Each cohort makes the next one's first-run experience better.
* **Reusable API:** A clean HTTP/JSON API the web app consumes today and native mobile apps can consume later.
* **Low-friction sign-in:** Google (Gmail) login for the foreseeable launch window.

### Non-goals (for v1)
* Native iOS/Android apps (planned, not built — API is designed to support them).
* E-commerce / shopping integrations.
* Social features beyond the family group.
* Vacation/packing "planning mode" is a **stretch goal**, not v1 scope (see §9).

## 4. Target Audience
* **Daily commuters** wanting a fast, trustworthy "what to wear" before heading out.
* **Parents** dressing children, who especially benefit from per-person profiles.
* **Couples / households** where members disagree on temperature.

## 5. User Roles & Cohorts

### 5.1 Account & profiles
* An **account** is one Google identity (one Gmail login).
* An account owns one or more **person profiles**. The account owner is one profile; additional family members (partner, kids) are profiles managed by the owner.
* Each profile has its own **comfort model** (learned temperature thresholds) and its own feedback history.

### 5.2 Cohorts (the data-maturity ladder)
Cohort is an attribute on the account, set/managed by an admin, and it governs which set of **baseline thresholds** new profiles start from.

| Cohort | Who | Baseline they receive | Their data feeds… |
|--------|-----|-----------------------|-------------------|
| **Alpha** | Earliest invited users | Hand-tuned generic defaults | Beta baseline |
| **Beta** | Wider invited group | Defaults refined from **alpha** aggregate feedback | GA baseline |
| **GA / main** | Public, at launch | Defaults refined from **alpha + beta** aggregate feedback | Continuous improvement |

* A profile **always** starts from the cohort baseline and personalizes from there via feedback.
* Cohort baselines are recomputed periodically (an admin-triggered or scheduled aggregation job), never silently overwriting a user's *personal* adjustments — personalization is layered on top of whichever baseline applies.

## 6. Functional Requirements

### 6.1 Authentication
* Sign in with **Google OAuth** (Supabase Auth, PKCE flow), mirroring the sibling project's `app/auth/callback` pattern.
* First login provisions an account row and a default person profile from the Google display name.
* Session is cookie-backed (Supabase SSR), refreshed in `middleware.ts`.

### 6.2 Location & weather
* User provides a location by city/address search (and optionally browser geolocation).
* The system fetches **current conditions** and a **short-term forecast**.
* Required fields: temperature, **feels-like** temperature, humidity, wind speed, precipitation probability, condition (clear/rain/snow/etc.).
* **Weather provider:** Open-Meteo is the default (no API key, free tier, global). The provider sits behind a server-side adapter so it can be swapped without touching clients.
* Weather is fetched **server-side** (via a Route Handler), never directly from the browser, so keys/quotas/caching stay on the server and responses can be cached per location+hour.

### 6.3 Recommendation engine
* Maps **feels-like** temperature (adjusted by wind/rain) to clothing categories: **Tops, Bottoms, Outerwear, Accessories**.
* Recommendations are **layered** (e.g. base layer + light jacket vs. heavy coat).
* Conditions modify output: rain → raincoat/umbrella; high wind → windproof layer; etc.
* The engine resolves thresholds in priority order: **profile personal model → cohort baseline → hard-coded generic defaults**.
* The engine is implemented as a **pure, unit-tested module** (no framework/DB imports), following the sibling project's `lib/*.ts` + `*.test.ts` convention, so the identical logic can run server-side for web and later for mobile via the API.

### 6.4 Feedback loop
* For a given recommendation (tied to the weather snapshot at that time), the active profile can submit: **Too Cold**, **Too Hot**, or **Just Right**.
* Each feedback row records: profile id, account cohort (denormalized for aggregation), feels-like temperature, conditions, the recommended item set, the verdict, and a server timestamp.
* Feedback nudges that profile's personal thresholds (e.g. repeated "too cold at 12°C" shifts the profile's outerwear threshold upward).
* All writes go through **Route Handlers using the Supabase service_role key**; the browser anon key is read-only. **RLS is on everywhere.**

### 6.5 Family / multi-person management
* Account owner can **create, rename, and remove** person profiles within the account.
* A profile selector lets the owner switch the "who is this for?" context; recommendations and feedback apply to the selected profile.
* Each profile's comfort model and history are isolated from siblings.

### 6.6 Responsive UI/UX
* The web app is **responsive** and must look and work well on both **desktop and mobile** browsers, designed mobile-first (the most common "before I leave the house" context) and scaling up gracefully to larger screens.
* Layout, touch targets, the profile selector, and the feedback controls all adapt to viewport size; no horizontal scrolling on phones.
* Built with Tailwind's responsive breakpoints, matching the sibling project's styling approach.

### 6.7 Aggregation & cohort baselines (admin / batch)
* A scheduled or admin-triggered job aggregates feedback **by cohort** to produce refined baselines:
  * Alpha aggregate → Beta baseline.
  * Alpha + Beta aggregate → GA baseline.
* Output is a versioned set of category thresholds stored in the DB and read by the engine.
* Aggregation reads anonymized/derived signals only (temperature, conditions, verdicts) — not personal identity.

## 7. Technical Requirements

The stack intentionally mirrors the sibling **2slight** project so tooling, conventions, and ops are shared.

* **Framework:** Next.js 15 (App Router) + React 19, TypeScript.
* **Styling:** Tailwind CSS.
* **Backend / DB / Auth:** Supabase (Postgres + Supabase Auth), **EU region**.
* **Hosting:** Vercel (web) + Supabase (data/auth).
* **API layer:** Next.js **Route Handlers** under `app/api/**` expose a versioned HTTP/JSON API. This is the single backend for the web app today and the planned mobile clients tomorrow. Keep handlers thin; put logic in pure `lib/` modules.
* **Supabase access pattern (from 2slight):**
  * `lib/supabase/client.ts` — browser anon client (read-only).
  * `lib/supabase/server.ts` — cookie-backed SSR client for Server Components / Route Handlers.
  * `lib/supabase/admin.ts` — service_role client; **all mutations** go through it inside Route Handlers.
  * **RLS on** for every table; anon may only `SELECT` genuinely public config.
* **Auth flow:** Google OAuth (PKCE), `app/auth/callback/route.ts` exchanges the code for a session; `middleware.ts` refreshes it.
* **Migrations:** SQL files in `supabase/migrations/NNNN_*.sql`, plus `supabase/seed.sql` for baseline/threshold seed data.
* **Testing:** Vitest for unit (especially the recommendation engine + threshold math) and Playwright for E2E, matching the sibling repo.
* **Weather adapter:** server-side module wrapping Open-Meteo, swappable behind a stable internal interface.

### 7.1 Proposed structure (mirrors sibling conventions)
```
app/
  api/
    weather/route.ts          # GET current+forecast for a location (server-side fetch + cache)
    recommendations/route.ts  # GET recommendations for profile + location
    feedback/route.ts         # POST a verdict
    profiles/route.ts         # CRUD person profiles within the account
    me/route.ts               # account + cohort + profiles
    admin/aggregate/route.ts  # trigger cohort baseline recompute (admin only)
  auth/callback/route.ts      # OAuth PKCE callback
  page.tsx                    # main "what to wear" screen
  family/page.tsx             # manage profiles
lib/
  supabase/{client,server,admin}.ts
  weather.ts                  # Open-Meteo adapter (pure-ish, server)
  recommend.ts + recommend.test.ts   # pure engine: feels-like + thresholds -> items
  thresholds.ts               # baseline resolution: personal -> cohort -> generic
  cohorts.ts                  # cohort + baseline versioning helpers
  types.ts
middleware.ts                 # session refresh
supabase/
  migrations/0001_init.sql    # accounts, profiles, clothing_items, feedback, baselines
  seed.sql                    # generic defaults + clothing catalog
```

## 8. Data Model (initial sketch)
Final column lists land in `supabase/migrations/0001_init.sql`. Conceptually:

* **accounts** — `id`, `google_sub`/`email`, `cohort` (`alpha`|`beta`|`ga`), `created_at`.
* **profiles** — `id`, `account_id` (FK), `display_name`, `relationship` (self/partner/child/other), `comfort_model` (jsonb: per-category threshold offsets), `created_at`.
* **clothing_items** — `id`, `name`, `category` (Tops/Bottoms/Outerwear/Accessories), `min_temp_c`, `max_temp_c`, `icon`, `requires_rain`/`requires_wind` flags.
* **feedback** — `id`, `profile_id` (FK), `cohort` (denormalized), `feels_like_c`, `conditions` (jsonb), `recommended_item_ids` (array), `verdict` (`too_cold`|`too_hot`|`just_right`), `server_ts`.
* **baselines** — `id`, `cohort`, `version`, `thresholds` (jsonb), `computed_at` — versioned cohort baselines produced by the aggregation job.

RLS: anon may read `clothing_items` and the active `baselines` only. Everything tied to a person (profiles, feedback) is private and reached through service_role Route Handlers scoped to the signed-in account.

## 9. Roadmap

### Phase 0 — Foundation
* Next.js + Supabase + Vercel scaffold mirroring 2slight; Google OAuth working end-to-end; `0001_init.sql`; seed generic defaults + clothing catalog.

### Phase 1 — Core "what to wear"
* Location search + server-side weather fetch (Open-Meteo).
* Pure recommendation engine (feels-like → layered items) with unit tests.
* Main screen renders weather + recommendations from generic defaults.

### Phase 2 — Accounts & feedback
* Per-account person profiles; profile selector.
* Feedback (Too Cold / Too Hot / Just Right) persisted; personal comfort model updated from feedback.

### Phase 3 — Cohorts & aggregation
* Cohort attribute on accounts; threshold resolution `personal → cohort → generic`.
* Admin/scheduled aggregation job: alpha → beta baseline, alpha+beta → GA baseline; versioned baselines.

### Phase 4 — GA hardening
* Polished UI states, error/empty/loading; caching; basic admin view of cohort baselines and feedback volume.

### Stretch / future
* **Vacation / packing mode:** destination + date range → consolidated packing list from multi-day forecast (carried over from the original Android PRD).
* **Native mobile clients** (iOS/Android) against the same Route Handler API.
* Morning "daily dress code" push/email.
* Offline / last-known-forecast caching.

## Appendix A — Origin (Android prototype)
A functional Android prototype exists at `AndroidStudioProjects/CoatCheck` (Kotlin, Jetpack Compose/Material 3, MVVM, Hilt, Retrofit, Firebase Firestore). It implemented weather fetch, a static clothing catalog, a feels-like recommendation filter, anonymous Firestore feedback, and a vacation-mode screen. This PRD supersedes that effort with a web-first build; the prototype's clothing thresholds and recommendation logic are useful reference inputs for `lib/recommend.ts` and the seed catalog.
