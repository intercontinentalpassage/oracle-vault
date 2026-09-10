# Oracle Vault

A ticket storefront for a Thai-style lottery reseller business — customers
browse and request tickets by digit, staff manage inventory and draws from
an Admin panel, and resellers ("agents") get their own branded shop under
the same system. Built with Vite + React on the frontend and Supabase
(Postgres + Auth + Storage + Edge Functions) as the entire backend — no
separate server to run or maintain.

Live storefront, Admin, and every Agent shop all read from the same
Supabase project, so there's a single source of truth for tickets,
customers, and sales.

## Tech stack

- **Frontend:** Vite, React 18, React Router (hash-based routing)
- **Backend:** Supabase — Postgres database with Row Level Security,
  Supabase Auth (staff logins), Supabase Storage (images), two Edge
  Functions (Telegram bot, admin account management)
- **Hosting:** Netlify, auto-deploying from this repo's `main` branch
- **Integrations:** Telegram bot (ticket browsing + purchase requests),
  GLO lottery results PDF parser (client-side, no server needed)

## Local setup

```
npm install
cp .env.example .env    # already filled in with the Supabase project's URL/key
npm run dev              # http://localhost:5173
```

To test with real data, run `seed-sample-data.sql` in the Supabase SQL
Editor (dashboard -> SQL Editor -> New query -> paste -> Run).

## Build & deploy

```
npm run build      # outputs to dist/
npm run preview    # serves the production build locally, for a true speed check
```

Netlify is already wired to this repo: `git push` to `main` triggers an
automatic build and deploy. Netlify's build settings:
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Environment variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (same values as `.env.example`)

## Project structure

```
src/
  pages/              Customer-facing routes (Storefront, AgentShop, MyTickets, Login)
  pages/admin/         Admin dashboard (protected, role=admin)
  pages/agent/         Agent dashboard (protected, role=agent)
  components/          Shared UI: cart, digit search, draw banner, winner checker, etc.
  lib/                 Supabase client, i18n, image compression, shared stores/hooks
```

Routing is hash-based (`#/`, `#/admin/tickets`, `#/shop/:slug`, etc.) so
Netlify never needs server-side routing rules.

## Where things live

- **Database schema, RLS policies, and design decisions** -> `DATABASE.md`
- **What was built, in what order, and why** -> `PROJECT_NOTES.md`
- **Supabase dashboard** — manage tables, Auth users, Storage, Edge
  Function logs, and secrets directly at supabase.com/dashboard
- **Staff accounts** — created from Admin -> All logins (in-app), not the
  Supabase dashboard, except for the very first admin account

## Key manual/admin-driven workflows

- **Adding tickets:** Admin -> Tickets -> paste numbers, pick group + price
  + draw (draw is mandatory — it's what makes a ticket show as "upcoming"
  on the storefront and auto-expire once that draw's date passes)
- **Publishing draw results:** Admin -> Draws -> upload the official GLO
  6-digit results PDF (auto-parsed) or enter manually -> review -> Create
  draw -> Publish (publishing also tags any matching tickets as winners,
  visible in Admin only)
- **Sending tickets to an agent:** Admin -> Tickets -> select tickets ->
  pick an agent -> creates an invoice record and reassigns them (they
  disappear from the main storefront and appear on that agent's shop)
- **Creating a new agent/admin login:** Admin -> All logins -> Create a
  login (email is optional — a placeholder gets generated and shown to
  you if left blank)
