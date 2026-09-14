# Live database and workspace handoff

## Application boundaries

`frontend/src/` contains React UI, client-side state, service adapters and Auth integration. `frontend/public/` contains the supplied product images. `frontend/tests/` contains browser scenarios and unit tests. Frontend build output is `frontend/dist/`.

`backend/src/` contains Express, authenticated routes, transaction logic and PostgreSQL services. `backend/prisma/` owns the schema and migrations. `backend/scripts/` owns database inspection, migrations, bootstrap and verification. `backend/tests/` contains unit/API integration tests. The Express production server serves `frontend/dist/`; Vite proxies `/api` to Express during development.

Root scripts orchestrate the two npm workspaces. A single root lockfile and hoisted dependency directory are intentional. Server environment files never need to be imported by frontend code. `frontend/src/lib/supabase.ts` reexports the shared Auth client so there are no competing sessions.

## Persisted data

| Tables | Purpose |
| --- | --- |
| `profiles` | Customer, staff and owner profiles, roles, active state; Auth credentials remain in Supabase Auth |
| `categories`, `products` | Catalog details, SKU/barcode, photo URL, prices, current stock, visibility and archive state |
| `inventory_movements` | Opening stock, stock-in/out, count adjustments, order reservations, sales and restored cancellations |
| `carts`, `cart_items`, `cart_mutations` | Per-customer carts, quantities and retry references that prevent duplicate additions |
| `orders`, `order_items` | Customer fulfillment choice, order status and item/price snapshots |
| `payments` | Cash receipts and explicitly enabled demo payment attempts/statuses |
| `sales`, `sale_items` | Completed counter/online sales and immutable receipt details |
| `store_settings` | Store identity/address and tax setting |
| `newsletter_subscriptions` | Saved subscriptions; no email campaign is sent by this application |
| `store_events` | Realtime invalidation notices with public or authorized audiences |

Current inventory quantities live in `products`; its audit trail lives in `inventory_movements`. Receipts and reports are derived from persisted sales and their snapshots, so they do not need redundant receipt/report tables. Images are uploaded to Supabase Storage and referenced by product URLs. Theme preferences and anonymous guest carts remain local; signing in merges the guest cart into the customer's database cart.

## Transaction and access behavior

- Express verifies Supabase sessions and looks up the role/active state in `profiles` for each authenticated request. Frontend role selection cannot grant owner access.
- All 15 business tables have RLS. Browser clients cannot directly write business tables or fetch private cost/payment data. Public catalog and authorized snapshots are projected by Express.
- Cart mutations are serialized, stock-aware and retry-safe. A retry reference belongs to one customer and one request payload. Cart changes publish private customer invalidations.
- Checkout creates the order and lines, reserves stock, clears the customer cart and emits notifications in one transaction. Repeating the order reference does not duplicate the reservation.
- POS validates current prices/stock, records payment, sale/receipt and stock movement atomically. Guarded updates and serializable transactions prevent selling the last unit twice. Failed transactions leave stock unchanged.
- Settling an unpaid online order records cash payment and a completed sale; stock was already reserved. Cancellation restores that reservation once.
- Product archives hide items from the customer catalog but preserve orders, receipts and history. Owners manage product metadata; staff can perform reasoned stock adjustments.
- Realtime invalidation refreshes current snapshots. A 30-second/focus refresh remains a reconnect fallback. Late responses from a previous account are discarded.

## Configuration and startup

Frontend `frontend/.env.local`:

```dotenv
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=<project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Backend `backend/.env.local` uses `ASCENT_DATA_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`), `DATABASE_URL`, `SUPABASE_PRODUCT_BUCKET`, `APP_URL`, configured owner/staff accounts and `ENABLE_PAYMENT_DEMOS=false`. The bootstrap accepts explicitly configured passwords of at least eight characters; account forms require longer new passwords. No defaults are used for live owner credentials.

The verified PostgreSQL connection uses the transaction pooler for runtime (`DATABASE_URL`, port 6543) and the session pooler for migrations (`DIRECT_URL`, port 5432), with a bundled public Supabase CA certificate. Certificate/hostname verification remains enabled. `DATABASE_CA_CERT` can select another CA file. Reference: [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [SSL configuration](https://supabase.com/docs/guides/platform/ssl-enforcement) and [API key types](https://supabase.com/docs/guides/api/api-keys). See [account and connection updates](real-accounts.md) for the subsequent signup/approval migration and SMTP requirements.

From the repository root:

```sh
npm install --legacy-peer-deps
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:check
npm run dev
```

Use `npm.cmd` where Windows PowerShell blocks npm's script shim. `npm run build` builds only the frontend; `npm start` runs Express and serves that build. The owner enters available inventory through `/owner/inventory`.

The migration runner applies the reviewed Prisma SQL using the API's verified PostgreSQL driver. It obtains an advisory lock, deploys each migration transactionally, and records Prisma-compatible migration names/checksums in `_prisma_migrations`. Applied SQL changes are rejected; platform line-ending differences are accepted. This avoids the native Prisma engine's connection failure observed in this Windows environment. `npm run db:migrate:prisma --workspace @ascent/backend` is retained for environments where the native engine works.

The setup creates accounts, 12 editable starter categories, settings and image storage. It does not insert demo products, overwrite stock, or erase transactions. `npm run db:seed -- --demo-catalog` explicitly enables demo products for a separate demonstration setup.

## Verification commands

| Command | Scope | Output |
| --- | --- | --- |
| `npm run test:unit` | Frontend money/scanning/photos; backend validation/cart rules/migration integrity | Node test results |
| `npm run test:integration` | Live Auth/API/database/Storage, role access, rollback, idempotency and stock concurrency | `artifacts/integration/api-results.json` |
| `npm run test:system` | Live owner/customer/staff UI, two-session cart synchronization, receipts, inventory, uploads and responsive catalog | `artifacts/system/results.json`, screenshots, receipt PDF |
| `npm run test:startup` | Built app, local live-mode settings and configured owner/staff sign-in; run after building | `artifacts/startup/results.json` |
| `npm run verify` | Mock-mode regression suite, isolated browser storage and legacy API fixture | `artifacts/phase-1/verification.json` |
| `npm run lint` / `npm run build` / `npm run db:validate` | Source checks, production build and schema validity | Command output |

Live test fixtures have a unique `test-` run prefix. Cleanup targets those fixture accounts/categories/products and their dependent records; it preserves configured owner/staff accounts and real products. These tests temporarily change store settings and restore them, so reruns belong in a development project rather than an active trading session.

## Verified result — 14 September 2026

| Check | Result |
| --- | --- |
| Unit tests | 13 passed |
| Live API integration scenarios | 18 passed |
| Live browser system checks | 24 passed |
| Mock regression checks | 110 passed |
| Account registration/approval and connection checks | 21 passed; email delivery simulated |
| Production startup/account checks | 8 passed |
| ESLint, TypeScript/production build, Prisma validation | Passed |
| Migration history | All 4 migrations applied; checksum/idempotent rerun passed |
| Database readiness | 15 tables with RLS, Realtime publication, Auth and image Storage verified |

The final live database contains 12 starter categories and the two configured owner/staff profiles. Products, orders, sales and payments are empty; no test accounts remain. The owner can now enter real products and opening stock. Both local environment files select Supabase; electronic payment demonstrations are disabled.

The production build succeeds with a bundle-size advisory (largest JavaScript chunk approximately 805 kB before gzip). Test reports, screenshots and receipt PDF are in the artifact paths above. Browser tests verified a 390-pixel catalog viewport and cross-session cart updates before the polling fallback.

## Remaining external operations

Cash payments are implemented. GCash/Maya/card tests exercise demonstrations only; no merchant funds are collected. Physical camera, scanner, receipt printer and deployment-host checks require the actual devices/host. Supabase email confirmation/recovery uses the project's Auth email settings and redirect allowlist; configure production URLs and email delivery before customer rollout.
