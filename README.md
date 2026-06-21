# Coat Check

Turns the weather into **what to wear**, tuned to how *you* feel the cold. Web-first
(Next.js + Supabase + Vercel); the Route Handler API is built to be reused by future native
mobile clients. See [`prd.md`](./prd.md) for the full product spec.

## Stack
- **Next.js 15** (App Router) + React 19 + TypeScript
- **Tailwind CSS**
- **Supabase** (Postgres + Auth, EU region) — Google sign-in
- **Open-Meteo** for weather — free, no API key for non-commercial/dev use
- **Vitest** (unit) + **Playwright** (E2E)

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase keys
npm run dev                        # http://localhost:3000
```

The home screen (city search, weather, recommendations) works **without any setup** —
weather comes from Open-Meteo, which needs no key, and recommendations fall back to the
generic catalog. Sign-in, family profiles, and feedback need Supabase configured.

### Supabase setup
1. Create an EU-region Supabase project.
2. Run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`, in the SQL Editor.
3. Enable the **Google** auth provider (Authentication → Providers) and add
   `http://localhost:3000/auth/callback` (and your Vercel URL) as redirect URLs.
4. Copy the project URL + anon key + service-role key into `.env.local`.

## Scripts
| Command | What it does |
|---------|--------------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (the recommendation engine + thresholds) |
| `npm run lint` | Next/ESLint |

## Layout
```
app/
  api/{weather,recommendations,me,feedback,profiles}/route.ts   # the reusable API
  auth/callback/route.ts        # Google OAuth (PKCE) callback
  page.tsx                      # main "what to wear" screen (responsive)
  family/page.tsx               # manage family profiles
lib/
  supabase/{client,server,admin}.ts
  recommend.ts (+ .test.ts)     # pure engine: feels-like + comfort → items
  thresholds.ts (+ .test.ts)    # baseline resolution + feedback learning
  catalog.ts                    # generic clothing catalog (mirrors seed.sql)
  weather.ts                    # Open-Meteo adapter (server-only)
  types.ts
middleware.ts                   # Supabase session refresh
supabase/migrations/0001_init.sql + seed.sql
```
