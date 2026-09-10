# Project notes

A record of what got built, in what order, and why — the context that
doesn't show up just by reading the code.

## History

Oracle Vault started as a single-file HTML app with a Google Apps
Script + Google Sheets backend. That got migrated entirely to Supabase
(this repo) because the Sheets backend had real, structural limits:
every write rewrote the *entire* sheet (no partial updates), every
request queued behind a global lock, and there was no real
authentication — just a shared password check against a sheet row.

Build order, deliberately: **Storefront first** (customers could
already browse/buy before anything else existed), then **Admin**
(so inventory could actually be managed), then **Agent** (resellers),
then integrations (Telegram, PDF parsing) once the core was solid.
Each phase was fully working and tested before the next one started —
no half-built layers left sitting.

## Key decisions and why

- **Supabase over a custom backend.** Postgres + Auth + Storage + Edge
  Functions in one place, with Row Level Security doing the access
  control instead of hand-rolled middleware. For a project this size,
  writing and maintaining a separate API server would have been pure
  overhead.

- **Customers never get login accounts.** Purchase requests are a
  public insert (anyone can submit one), but reading customer data goes
  through a single `security definer` function
  (`lookup_my_tickets(phone)`) that only ever returns that phone
  number's own data. This was a deliberate security boundary — the
  anon key is powerful enough to be dangerous if a table were opened up
  broadly, so nothing customer-facing gets a blanket "anyone can read"
  policy.

- **Ticket expiry is computed, not stored.** A ticket disappears from
  the storefront once its linked draw's date passes — this is checked
  at query time (comparing `draw_date` to "today" client-side), not a
  background job flipping a status flag. Simpler, and it can't drift
  out of sync with reality the way a cron-based approach could.

- **Per-agent currency is a nullable override, not a separate table.**
  `agents.currency_symbol` is null by default and falls back to the
  site-wide `site_settings.currency_symbol`. Kept it this simple
  because most agents won't need to override it — only the ones
  operating in a different market will ever touch that field.

- **The GLO PDF parser reconstructs layout from text position, not
  raw extraction order.** Thai government PDFs often have scrambled
  internal text order (not visual reading order) — a naive text dump
  would have made the numbers unparseable. The parser instead sorts
  each text run by its actual (x, y) position on the page before
  reading it, which reliably matches what a person sees looking at the
  document. This is brittle to genuine GLO template changes (it's
  tailored to their current layout), but it was tested against a real
  results PDF and matched every number exactly.

- **Image uploads are compressed client-side before they ever reach
  Supabase.** Originally uploads went straight through — a raw phone
  photo (often 8-15MB) became the literal file every visitor
  downloaded, and it measurably slowed page loads. Every upload now
  gets resized and re-encoded (WebP, JPEG fallback) in-browser first,
  sized appropriately for where it's actually displayed (a ticket card
  background doesn't need the same resolution as a full-width banner).

- **Google Drive links were considered and rejected** as an image
  hosting option (came up when chasing the slow-load issue) — Drive
  isn't built for serving images to a website and can silently swap a
  direct link for an HTML preview page or rate-limit it. Supabase
  Storage, which is already CDN-backed, was already the better answer.

## Known limitations / deliberate scope cuts

- **Ticket-photo parsing (physical ticket photos, not the GLO PDF) is
  intentionally *not* automated.** Real photo OCR on printed tickets
  is meaningfully less reliable than the PDF text-position approach,
  and at the actual usage frequency (roughly every two weeks), doing
  it manually — upload a photo to Claude directly, get back a
  ready-to-paste list — was judged the better tradeoff over building
  and maintaining a fragile OCR pipeline.
- **Win/loss status is admin-only.** Tickets get tagged with `win` when
  a draw publishes, but this is deliberately not surfaced to customers
  on "My Tickets" — was asked for explicitly, not an oversight.
- **The Telegram bot is a simple linear flow** (browse -> pick -> buy or
  chat), not a full conversational agent. It shares the same
  `purchase_requests` table as the website, so nothing about approvals
  is bot-specific.
- **No automated tests.** Every change went through: production build
  check -> manual local test -> deploy. This worked well at this
  project's size and pace, but is worth revisiting if the codebase
  keeps growing.

## Bugs found and fixed along the way (worth knowing about)

- The "X matches" counter next to the digit search boxes used to
  silently ignore the digits actually typed in, always showing the
  total available ticket count instead — looked correct (the variable
  name and dependency array suggested it worked), but the calculation
  itself never used the search input. Fixed by extracting the matching
  logic into one shared file (`src/lib/ticketMatch.js`) so the count
  and the actual grid filtering can't drift apart again.
- The storefront and every agent shop used to make two *sequential*
  network round-trips before showing anything (fetch tickets, then
  separately fetch related draws). Fixed by folding both into a single
  parallel batch.
