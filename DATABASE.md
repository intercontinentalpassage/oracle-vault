# Database reference

Supabase project: `oracle-vault` (Singapore region). Everything below
lives in the `public` schema unless noted.

## Tables

### `profiles`
Links a Supabase Auth user to a role. One row per staff login (admin or
agent) — customers never get a row here.

| column | type | notes |
|---|---|---|
| id | uuid, PK | matches `auth.users.id` |
| role | text | `admin` or `agent` |
| agent_id | uuid, FK -> agents | set only when role=agent |
| display_name | text | |
| created_at | timestamptz | |

### `agents`
One row per reseller. `slug` builds their shop URL (`/shop/:slug`).
`currency_symbol` overrides the site-wide currency just for that agent's
shop/dashboard when set.

| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| name | text | |
| phone | text | |
| slug | text, unique | |
| hero_image_url | text | Supabase Storage URL |
| active | boolean | inactive agents' shops show "doesn't exist" |
| currency_symbol | text | nullable — falls back to site default |
| created_at | timestamptz | |

### `groups`
Ticket categories (Single/Pair/Set of 5 by default, but fully
admin-editable — see Admin -> Ticket categories). Drives both the
storefront filter chips and the group headings tickets are shown under.

| column | type | notes |
|---|---|---|
| key | text, PK | slugified from the label on creation |
| label | text | freely editable |
| sort_order | int | controls display order |

### `draws`
One row per lottery draw — used both for "next draw" (tickets reference
it via `draw_id` before results exist) and for published results (once
`tiers` is filled in and `published` is true).

| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| label | text | e.g. "16 September 2026" |
| draw_date | date | used for expiry checks and sorting |
| tiers | jsonb | `[{label, prize, numbers: [...]}, ...]` |
| published | boolean | publishing triggers winner-tagging on matching tickets |
| created_at | timestamptz | |

### `tickets`
The core inventory table.

| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| number | text | the actual ticket number |
| group_key | text, FK -> groups | |
| status | text | `available`, `held`, or `sold` |
| agent_id | uuid, FK -> agents | null = main storefront inventory |
| draw_id | uuid, FK -> draws | mandatory when adding new tickets in Admin |
| price | numeric | |
| win | text | set automatically when a draw publishes and this number matches |
| created_at | timestamptz | |

A ticket is hidden from the storefront/agent shop once its linked draw's
`draw_date` has passed — this is computed client-side at query time, not
a stored flag, so it self-corrects with no cron job needed. Admin ->
Tickets -> "Archived" filter surfaces these.

### `customers`
Created automatically the first time a purchase request is approved (or
manually by Admin). Looked up by phone, never by login — customers don't
have Supabase Auth accounts.

### `purchase_requests`
A customer's checkout submission (website, agent shop, or Telegram bot).
Anyone can insert one (that's the whole point of the storefront being
public); only staff can read/update the queue.

| column | type | notes |
|---|---|---|
| customer_phone, customer_name | text | |
| ticket_ids | uuid[] | |
| total | numeric | |
| status | text | `pending`, `confirmed`, `rejected` |
| agent_id | uuid, nullable | set when submitted through an agent's shop |
| decided_by | uuid, FK -> profiles | who approved/rejected it |

### `sales`, `invoices`, `refunds`
- `sales` — one row per completed ticket sale, created when a purchase
  request is approved. Feeds Agent -> Sales and Agent -> My customers.
- `invoices` — created when Admin sends a batch of tickets to an agent.
- `refunds` — an agent requesting tickets be taken back; approving one
  returns those tickets to `available` with `agent_id` cleared.

### `site_settings`
Generic key/value store for anything site-wide and admin-editable:
`logo_url`, `currency_symbol`, `results_bg_url` + `results_bg_overlay`
(ticket card background), `draw_banner_bg_url` / `_color` / `_overlay`.
Public read (the storefront needs these), admin-only write.

### `translations` + `translation_locks`
Every piece of customer-facing text, editable per-language from Admin ->
Storefront text. `translation_locks` marks a key as "same in all
languages" (used for things like a brand name that shouldn't translate).

### `telegram_state`
One row per Telegram chat mid-purchase (tracks "waiting for phone
number after tapping Buy"). Only touched by the `telegram-webhook` Edge
Function using the service role key — no public policies needed.

## Row Level Security

Every table has RLS enabled. The general pattern:
- **Public data** (tickets, groups, draws, agents, translations, site
  settings): anyone can `select`, only admins can write.
- **Customer actions** (purchase_requests insert): anyone can insert,
  only staff can read the queue.
- **Staff data** (customers, sales, invoices, refunds): admin sees
  everything; agents are scoped to rows matching their own `agent_id`.
- **profiles**: a user reads their own row; only admins can write.

Two helper functions used throughout the policies:
```sql
auth_role()      -- returns the current user's role from profiles, or null
auth_agent_id()  -- returns the current user's agent_id, or null
```

Customers never get a Supabase Auth account, so there's no "customer"
role in RLS — their access is entirely through the public-insert policy
on `purchase_requests` plus a safe lookup function (see below).

## Database functions

- **`lookup_my_tickets(p_phone text)`** — the only way "My Tickets"
  reads customer data. Returns *only* that phone number's own purchase
  requests and sales, `security definer`, callable by `anon`. This
  exists specifically so the anon key can never be used to browse other
  customers' purchase history.

## Storage buckets

- **`site-assets`** (public) — logo, ticket-card background, draw-banner
  background. Admin-only write.
- **`agent-hero`** (public) — one hero photo per agent, stored under
  `{agent_id}/hero.{ext}`. Write policy checks `auth_agent_id()` so an
  agent can only upload to their own folder.

All uploads go through client-side compression (`src/lib/imageCompress.js`)
before reaching Storage — resized and re-encoded as WebP (JPEG fallback)
so a raw phone photo never ends up as the literal file served to visitors.

## Edge Functions

- **`telegram-webhook`** (`verify_jwt: false`) — receives Telegram bot
  updates. Verifies requests actually came from Telegram via a shared
  secret token (`x-telegram-bot-api-secret-token` header), since it
  can't use Supabase JWT auth. Uses the service role key to read
  tickets/groups and write purchase_requests directly.
- **`admin-accounts`** (`verify_jwt: true`) — the only place staff
  account creation and password resets happen. Independently re-verifies
  the caller is a signed-in admin (checking `profiles.role`, not just
  that a JWT is present) before doing anything, since this endpoint can
  create logins and reset any password.

Both were built with CORS headers explicitly handled (`OPTIONS`
preflight answered directly) — a missing CORS header here is a very
easy way to get a silent "NetworkError" in the browser with no useful
error message, and cost real debugging time before it was caught.
