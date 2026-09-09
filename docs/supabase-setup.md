# Supabase setup and verification

Status: the Express/Prisma integration, Auth adapter, Storage upload path and Realtime refresh are implemented. No Supabase project has been configured or modified. Live database migrations and data exchange have not been tested.

## 1. Configure the project locally

Use a dedicated ASCENT Supabase project. If the project already contains tables or users, inspect its schema and migration history before applying these migrations; they create new public tables with common names.

Edit `.env.local` using `.env.example` as the template. Never put secrets into frontend variables or commit this file.

| Variable | Value |
| --- | --- |
| SUPABASE_URL | Project URL from the Supabase dashboard |
| VITE_SUPABASE_URL | Same project URL |
| VITE_SUPABASE_PUBLISHABLE_KEY | Public publishable key (or legacy anon key) |
| SUPABASE_SERVICE_ROLE_KEY | Server secret key or legacy service-role key; Express only |
| DATABASE_URL | PostgreSQL Session pooler connection string, port 5432 |
| DIRECT_URL | Optional migration connection; otherwise DATABASE_URL is used |
| ASCENT_OWNER_EMAIL / NAME / PASSWORD | Explicit owner bootstrap account; password at least 12 characters |
| ASCENT_STAFF_EMAIL / NAME / PASSWORD | Optional initial staff account |
| APP_URL | Frontend origin, initially http://localhost:5173 |
| SUPABASE_PRODUCT_BUCKET | product-images |
| ENABLE_PAYMENT_DEMOS | true for development demonstrations; false to disable them |

Copy the connection string from the project's Connect panel and URL-encode special characters in its password. Use the Session pooler for a persistent Express server where direct IPv6 access is unavailable. Keep TLS settings from the project's connection guidance. See [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres) and [Prisma with Supabase](https://supabase.com/docs/guides/database/prisma).

In Supabase Auth URL Configuration, set the frontend Site URL and allow `http://localhost:5173/auth/callback` and `http://localhost:5173/reset-password` (plus the actual deployed equivalents). Configure email delivery for confirmation and password recovery. See [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords).

## 2. Apply the prepared schema and seed

From the project directory (use npm.cmd in restricted PowerShell):

```sh
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:check
```

The first migration creates the application tables. The second adds database checks, RLS, a customer-only signup trigger and Realtime publication for small store_events records. The Express database connection must have permission to access the application tables despite frontend RLS restrictions. Frontend clients cannot write business tables directly.

The seed creates explicitly configured owner/staff accounts, 12 categories, 40 products, opening stock movements and a public product image bucket. Existing seeded product IDs are skipped so rerunning does not reset stock. Existing matching bootstrap accounts receive the configured role; their password is not reset. The seed does not import browser-local transactions or legacy JSON accounts. Remove bootstrap passwords from the local environment after setup if no longer needed.

## 3. Enable cloud data exchange

Only after configuration checks pass, set BOTH values:

```dotenv
ASCENT_DATA_MODE=supabase
VITE_DATA_MODE=supabase
```

Restart `npm run dev`. For a production build, rebuild with these environment values and run `npm start`. Frontend mode is fixed at build time. The Express API defaults to port 4174. Vite proxies API requests; the production Express server serves dist and /api on the same origin.

Check `/api/health`: it must report mode supabase and database connected. Sign in with the configured owner, not the local demo credentials. Confirm the catalog shows seeded products and the connection indicator recovers after reconnecting.

## 4. Verify against the actual project

Use a clearly named test product and minimal quantities:

1. Owner creates a category and product, uploads an image, then refreshes.
2. In a second browser session, sign in as staff; confirm owner controls and cost prices are inaccessible.
3. Complete one cash sale; verify exactly one sale, payment, stock deduction and inventory movement in the database.
4. Watch the second session update through Realtime; focus/30-second polling provides a fallback.
5. Create a customer pickup order, verify stock reservation, then settle it once without a second deduction. Test cancellation on another order.
6. Confirm a customer cannot read another customer's orders and cannot call owner endpoints.
7. Confirm email verification/recovery redirects and profile changes with the configured email provider.
8. Disable a staff account and confirm subsequent API access is rejected.

Camera scanning needs a camera and HTTPS or localhost; the browser checks cover its explicit start control, not physical camera decoding. USB scanning is supported through keyboard input plus Enter. GCash, Maya and card are demonstrations; no merchant provider or real payment collection is configured.

## Architecture and limits

React -> authenticated Express endpoints -> Prisma transactions -> Supabase PostgreSQL. Supabase Auth verifies identities; database profiles determine roles. Storage holds public product images. Realtime publishes small invalidation events; authorized snapshot endpoints return the refreshed records and hide owner cost prices from staff/customers.

Sales use database transactions with serializable retry and guarded stock updates. POS transaction IDs provide retry protection. Browser mock mode is intended for one-browser demonstration; its commerce records do not synchronize across devices.

Cloud runtime verification remains pending until project credentials are supplied locally. The complete local workflow suite is `npm run verify`; it explicitly forces mock mode and uses isolated data.

