# Oracle Vault (Vite + React + Supabase)

## Local setup
1. `npm install`
2. `cp .env.example .env` — already filled in with the Oracle Vault Supabase
   project's URL and anon key.
3. `npm run dev` — opens at http://localhost:5173

## Build for deploy
`npm run build` outputs to `dist/`. On Netlify:
- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables (Site settings -> Environment variables):
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (copy from `.env.example`)

## What's built so far (Phase 2 - storefront)
- Main storefront (`/`): digit search, ticket results with group filters,
  draw banner, cart, purchase-request checkout
- Agent shop (`/shop/:slug`): same storefront scoped to one agent's tickets
- My Tickets lookup (`/my-tickets`): phone-based purchase status lookup
- Staff login (`/login`): Supabase Auth, redirects by role
- `/admin` and `/agent` are placeholders until Phase 3/4

## Data
No sample tickets/groups/draws are seeded yet - the storefront will show
"No tickets match" until some rows exist in the `tickets`, `groups`, and
`draws` tables (via the Supabase dashboard or a script we'll add).
