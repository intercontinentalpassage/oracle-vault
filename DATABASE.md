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
| email | text | nullable — agent-set contact email; usable alongside `slug` as an "agent code" customers can enter on the main storefront's checkout to credit a purchase to that agent |
| slug | text, unique | |
| hero_image_url | text | Supabase Storage URL |
| active | boolean | inactive agents' shops show "doesn't exist" |
| currency_symbol | text | nullable — falls back to site default |
| telegram | text | nullable — the agent's own Telegram username (no `@`), shown as a Telegram button on their shop page. CHECK: 5-32 letters/numbers/underscores. Never falls back to the site owner's Telegram |
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
manually by Admin, or by an Agent in their own My customers page — either
directly, or when they mark one of their tickets sold). Looked up by
phone, never by login — customers don't have Supabase Auth accounts.
`agent_id` (nullable) marks which agent first added/claimed that
customer; the record itself is still shared/global, not agent-exclusive.

### `purchase_requests`
A customer's checkout submission (website, agent shop, or Telegram bot).
Anyone can insert one (that's the whole point of the storefront being
public); only staff can read/update the queue.

| column | type | notes |
|---|---|---|
| customer_phone, customer_name | text | |
| ticket_ids | uuid[] | |
| total | numeric | |
| requested_numbers | text[] | the ticket numbers originally asked for. Set by the database on insert (trigger `purchase_requests_snapshot_numbers`, callers can't spoof it) so it survives the request being trimmed or expiring |
| status | text | `pending`, `confirmed`, `rejected` |
| agent_id | uuid, nullable | set when submitted through an agent's shop |
| decided_by | uuid, FK -> profiles | who approved/rejected it |

### `sales`, `invoices`, `refunds`
- `sales` — one row per completed ticket sale, created when a purchase
  request is approved, or by `sell_tickets_to_customer` for a direct staff
  sale. Feeds Agent -> Sales and Agent -> My customers. `customer_id` and
  `customer_phone` are nullable: a walk-in sale (agent catalog's instant
  "Mark sold", no customer prompt) leaves both null and never appears in My
  Tickets, Admin > Customers, or an agent's own Customers page (all keyed by
  phone) — the UI shows "Walk-in" wherever it displays the phone directly.
- `invoices` — created when Admin sends a batch of tickets to an agent.
- `refunds` — an agent requesting tickets be taken back; approving one
  returns those tickets to `available` with `agent_id` cleared.

### `site_settings`
Generic key/value store for anything site-wide and admin-editable:
`logo_url`, `currency_symbol`, `results_bg_url` + `results_bg_overlay`
(ticket card background), `draw_banner_bg_url` / `_color` / `_overlay`,
`telegram_channel` (public channel username, no `@`, for the cart's "Buy in Telegram"
button — blank hides the button).
Public read (the storefront needs these), admin-only write.

### `translations` + `translation_locks`
Every piece of customer-facing text, editable per-language from Admin ->
Storefront text. `translation_locks` marks a key as "same in all
languages" (used for things like a brand name that shouldn't translate).

### `telegram_post_log`
Rate-limit log for the `send-cart-to-telegram` Edge Function: one row per
attempt with a one-way hash of the caller's IP (`ip_hash`) and `created_at`.
Rows older than a day are deleted by the function. RLS is on with no
policies, so only the service role (the function) can read or write it.

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
- **profiles**: a user reads their own row; only admins can write. (The one
  exception is an agent changing their own `display_name`, which goes through
  `update_my_display_name` below — never a direct write, since this table
  also holds `role`.)

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
  requests and sales (including their `customer_name` from `customers`,
  if set), `security definer`, callable by `anon`. This exists
  specifically so the anon key can never be used to browse other
  customers' purchase history. Request rows carry the numbers that were
  asked for in `ticket_number` (comma-separated; empty for `confirmed`
  requests, whose tickets already appear as `sale` rows), and a
  `sold_out_numbers` column: everything for an `expired` request, or the
  numbers dropped from a still-`pending` one.
- **`sell_tickets_to_customer(p_ticket_ids uuid[], p_phone text, p_name text)`**
  — sells one or more tickets to one customer atomically (admins, and agents
  for their own tickets only). Locks the tickets first (id order), then
  re-checks every one is still `available` (and, for an agent, still theirs);
  if anything in the batch no longer qualifies, NONE of the batch is sold and
  no sale rows are created — `{ok:false, code:'unavailable', numbers}` names
  which tickets. `p_phone` is optional: blank/null makes it a walk-in sale —
  no customer is looked up or created, and the sale row's `customer_id` and
  `customer_phone` are both left `null`. Only on success does it upsert the
  customer (when a phone was given), insert the sale rows, and mark the
  tickets `sold`, together. Used by the agent catalog: the per-row "Mark
  sold" (instant, walk-in, no prompt) and "Sell N selected" (asks for a
  customer). Replaces an earlier two-step client version (insert sale, then
  update ticket) that could leave a stray sale row for a ticket that ended up
  NOT marked sold if another ticket in the same batch had just been sold.
- **`recall_sale(p_sale_id uuid)`** — undoes one sale: deletes that sale row
  and, only if it was the ticket's *last* remaining sale row, puts the ticket
  back to `available`. Admins can recall any sale; agents only their own.
  Replaces the app's old direct `sales.delete()` calls for this, which never
  actually worked — `sales` has no DELETE policy, so those silently removed 0
  rows under RLS. Admin > Tickets' "Recall" button had therefore been putting
  the ticket back to `available` **without** removing its old sale record;
  Agent > Sales' new "Recall" button uses this from the start. (Fixed on
  2026-09-20: 3 tickets in production had exactly this — a stale sale row
  still attached to an already-`available` ticket; those stale rows were
  deleted as a one-off cleanup.)
- **`set_sale_customer(p_sale_id uuid, p_phone text, p_name text)`** — adds or
  corrects the customer on an *existing* sale (chiefly: filling in a walk-in
  sale's phone/name afterward, from Agent > Sales). Upserts the customer by
  phone (same upsert as `sell_tickets_to_customer`) and sets the sale's
  `customer_id` and `customer_phone`. Refuses a blank phone. Admins can edit
  any sale; agents only their own.
- **`approve_purchase_request(p_request_id uuid, p_ticket_ids uuid[])`** —
  approves a purchase request atomically (admins from the admin panel, and the
  service role). It locks the tickets first (always in id order), then
  re-checks that the request is still `pending` and every selected ticket is
  still `available`, and only then sells them, records the sales, and expires
  (or trims) every other pending request that wanted the same tickets. If a
  ticket was already taken, the request expires instead (its ticket list is
  kept so we still know what was asked for). Returns
  `{ok, code, status, message}` rather than raising, so the outcome is
  persisted. This is what stops several requests for one ticket all being
  approved. `p_ticket_ids` lets the admin approve only some of a request's
  tickets.
- **Guard trigger `tickets_block_double_sale`** — refuses an update that sets
  a ticket's `status` to `sold` when it is already `sold`. A safety net for any
  path that doesn't use `approve_purchase_request` (the Telegram Approve
  button still does its own multi-step approval). Price/group edits on sold
  tickets are unaffected.
- **`update_my_display_name(p_name text)`** — lets a signed-in staff user change
  *only their own* `profiles.display_name` (used by the agent's "Your name"
  field in Shop settings). `security definer`, executable by `authenticated`
  only (not `anon`). Trims the name, caps it at 60 characters, and stores an
  empty name as NULL. It cannot touch `role` or `agent_id`.

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
- **`send-cart-to-telegram`** (`verify_jwt: false`, source in
  `supabase/functions/send-cart-to-telegram/`) — called by the cart's "Buy in
  Telegram" button. Posts a photo of the customer's chosen numbers plus
  "I want to buy this" to the Telegram channel named in
  `site_settings.telegram_channel`. Numbers only — no customer details. It
  re-checks the tickets in the database (must exist and be `available`),
  builds the caption itself, checks the image really is a PNG/JPEG under
  ~2 MB, and rate-limits per IP (10 per 10 min) and overall (120 per hour)
  via `telegram_post_log`. The bot token comes only from the
  `TELEGRAM_BOT_TOKEN` secret (no default in the source), and the bot must
  be an admin of the channel. Without both the secret and the setting it
  returns "not set up" and posts nothing.
- **`admin-accounts`** (`verify_jwt: true`) — the only place staff
  account creation and password resets happen. Independently re-verifies
  the caller is a signed-in admin (checking `profiles.role`, not just
  that a JWT is present) before doing anything, since this endpoint can
  create logins and reset any password.

Both were built with CORS headers explicitly handled (`OPTIONS`
preflight answered directly) — a missing CORS header here is a very
easy way to get a silent "NetworkError" in the browser with no useful
error message, and cost real debugging time before it was caught.
