# Deploy ASCENT to Vercel

## Architecture and readiness

Repository: `https://github.com/deejay-stack/Ascent`, branch `main`. Keep the existing repository and create two Vercel projects from it.

- `frontend/`: React 19, TypeScript 6, Vite 8, Tailwind 4 and React Router 7. Build output is `frontend/dist/`.
- `backend/`: Express 5, TypeScript with NodeNext ES modules, Prisma 7 with the PostgreSQL `pg` adapter. Development uses `backend/src/index.ts`; local production starts `backend/dist/index.js`. Both `src/app.ts` and `src/index.ts` export the Express app for Vercel without opening a listener there.
- Supabase provides PostgreSQL, Auth, Storage and browser Realtime. Access tokens travel in the `Authorization: Bearer` header. Sessions persist in the browser's dedicated IndexedDB store; the API does not use login cookies or in-memory sessions.
- Root `package.json` and `package-lock.json` manage both npm workspaces. Use Node **22.x**, matching the validated local Node 22.21.0 environment.

**Readiness: ready with manual configuration required.** The owner account was restored with operator approval and verified in the production-build browser check. Source preparation does not create Vercel projects or deploy anything. A real deployment and its URLs have not been verified. See `docs/vercel-validation-2026-11-06.md` for this run's evidence and limitations.

The [November 7 TypeScript migration report](docs/typescript-migration-2026-11-07.md) records the current compiler, build and workflow verification. Actual deployment is **not yet verified on Vercel**.

The earlier `NODE_TYPESCRIPT_ERROR` mentioning `../frontend/src/main.tsx` indicates frontend code entered a Node TypeScript compilation without the frontend JSX configuration. The frontend already has `jsx: react-jsx` and its React dependencies; those settings are preserved. The backend now has its own `tsconfig.json`, with `rootDir/include` restricted to `src`, no frontend project references, and explicit NodeNext compilation. Each Vercel build command names its workspace to prevent running the root build in the wrong context. Set the project Root Directories below; repository changes cannot correct stale dashboard overrides. Shared operator/test compilation is explicitly separate in root `tsconfig.tools.json`, including the existing demo seed's frontend data import. The original remote build log and project settings were not available for retrospective confirmation of the exact dashboard misconfiguration.

## Resolve the existing admin login

The November 6, 2026 diagnosis found that the configured owner email was absent from Supabase Auth and its original profile was marked deleted and disabled. With explicit operator approval, the missing Auth account was recreated using its retained profile ID and existing private credential, then that profile was reactivated. Credential verification, server token verification and owner inventory access in the production-build browser check passed. Historical business counts were preserved. A browser-saved password cannot authenticate a deleted account; selecting an admin role on the login page cannot grant privileges.

Run a private diagnostic from the repository root:

```sh
npm run check:auth --workspace @ascent/backend
```

`backend/.env.local` holds the initial `ASCENT_OWNER_EMAIL` and `ASCENT_OWNER_PASSWORD`; keep the password private. Changing these fields does not change an existing user's Auth password.

For a future recurrence involving a deleted original owner, a narrowly scoped recovery script previews its plan without writing (it refuses an already-active owner):

```sh
npm run owner:restore --workspace @ascent/backend
```

Only after the operator authorizes restoring that specific account, apply it:

```sh
npm run owner:restore --workspace @ascent/backend -- --apply
npm run check:auth --workspace @ascent/backend
```

It recreates the missing Auth user with the retained profile ID and the existing private bootstrap credential, then reactivates that owner profile. It preserves historical business record links and refuses ambiguous profiles or conflicting identities. It does not reset an existing password. If the Auth step succeeds but profile activation fails, rerun after resolving the database issue; it verifies the matching existing identity and credential before completing activation. Do not put this script in a deployment build command. Existing accounts with forgotten passwords should use the normal recovery flow with working SMTP.

Then open `http://localhost:5173/login`, use the owner email and its matching credential, and verify `/owner/inventory`. Browser autofill must match that account. Login storage differs between `localhost` and `127.0.0.1` and between deployed domains.

## 1. Prepare the database without replacing data

Use the existing Supabase project. The API needs the transaction pooler URL (usually port 6543) and verified TLS; `backend/certs/supabase-ca.crt` is a public CA certificate bundled with the backend. Keep the direct/session URL (usually port 5432) on an operator machine for migrations with advisory locks.

For a new target or an upgrade, review the existing SQL migrations, take a backup and run the project's migration command deliberately from a trusted machine:

```sh
npm install --legacy-peer-deps
npm run db:validate
npm run db:migrate
npm run db:generate
npm run db:check
```

Do not run migrations automatically on every Vercel build. This preparation did not execute migrations or change the schema. The existing configured database passed checks for all **18 application tables**, RLS, Storage and the `store_events` Realtime publication. Retain all seven migration folders, including `202609150001_checkout_payments` and `202609160001_order_fulfillment`, when committing the current workspace.

`db:seed` is initial provisioning, not a routine deploy step: it can grant/enable configured operator roles and create categories and a storage bucket. Do not rerun it just to repair login. No database provider change is needed.

## 2. Create the backend Vercel project

Import **deejay-stack/Ascent** and use:

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Framework Preset | Express |
| Node.js | 22.x |
| Install Command | `npm ci --include=dev --legacy-peer-deps` |
| Build Command | `npm run build --workspace @ascent/backend` (generates Prisma Client, then compiles backend TypeScript) |
| Output Directory | Leave unset; native Express supplies the function |
| Entry | `src/app.ts` / `src/index.ts`, default Express export |
| Health check | `https://YOUR-BACKEND-DOMAIN/api/health` |

Allow access to files outside the Root Directory in the build settings so Vercel can use the root workspace package and lockfile. Keep dependency installation enabled for dev dependencies: Prisma generation and TypeScript build tools need them. `backend/vercel.json` selects Express and the commands; no legacy `builds`/`routes` wrapper or `api/index.js` is used.

Configure these **backend-only** variables in Vercel for each environment being deployed:

| Variable | Value/purpose |
| --- | --- |
| `ASCENT_DATA_MODE` | `supabase` (required; filesystem demo mode is rejected on Vercel) |
| `SUPABASE_URL` | Existing project's HTTPS URL |
| `SUPABASE_SECRET_KEY` | Existing server secret; alternatively use `SUPABASE_SERVICE_ROLE_KEY` |
| `DATABASE_URL` | Existing Supabase transaction-pooler PostgreSQL connection string |
| `APP_URL` | Exact frontend HTTPS origin, e.g. `https://YOUR-FRONTEND-DOMAIN` |
| `SUPABASE_PRODUCT_BUCKET` | `product-images`, or the existing bucket name |
| `ENABLE_PAYMENT_DEMOS` | `false` for cash-only; `true` only for an explicitly labeled demo environment |

Vercel sets `NODE_ENV=production` and its platform variables. Do not set `PORT`. The runtime does not need `DIRECT_URL`, `ASCENT_OWNER_*`, `ASCENT_STAFF_*` or the publishable key used by local administrative/test scripts. Do not upload local environment files. Omit the unused future merchant credential templates: this app has no live payment adapter.

The default verified CA is included; `DATABASE_CA_CERT` is optional only if you supply a valid deployment-accessible replacement. Never set it to a Windows-only path on Vercel.

Reserve the frontend project name/domain before the first backend build so `APP_URL` can be set. If necessary, use its intended exact HTTPS domain and update it to the final value afterward. Multiple specifically approved origins, including selected preview domains, can be comma-separated. Wildcards, paths and HTTP production origins are rejected.

After deployment, open `/api/health`: expect HTTP 200 with `status: "ok"`, `mode: "supabase"`, `database: "connected"`. A failed database connection returns 503. `/api/me` without a token must return 401, not a page of HTML. The backend root and frontend page paths return JSON 404s; frontend pages are hosted by the frontend project.

## 3. Create the frontend Vercel project

Import **the same repository** again:

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Node.js | 22.x |
| Install Command | `npm ci --include=dev --legacy-peer-deps` |
| Build Command | `npm run build --workspace @ascent/frontend` |
| Output Directory | `dist` |

Enable access outside the Root Directory for the shared npm workspace lockfile. Configure:

| Variable | Value/purpose |
| --- | --- |
| `VITE_DATA_MODE` | `supabase` |
| `VITE_SUPABASE_URL` | Same Supabase HTTPS URL as backend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | That project's public publishable key |
| `VITE_API_URL` | Backend HTTPS **origin only**, e.g. `https://YOUR-BACKEND-DOMAIN` |

Do not append `/api` to `VITE_API_URL`: routes already include it. Never use the Supabase server secret or PostgreSQL password in any `VITE_*` variable: these values are compiled into public browser JavaScript. The Vercel frontend build rejects missing public configuration instead of silently deploying local mock mode.

`frontend/vercel.json` rewrites browser routes to `/index.html`. Vercel serves existing built assets normally; React Router handles deep links and refreshes. API calls go directly to `VITE_API_URL` and do not depend on this SPA fallback. Static product photos, fonts and payment demo artwork remain in `frontend/public/` and are included in `dist/`.

## 4. Connect the two deployments and Supabase Auth

1. Reserve the frontend project/domain, deploy the backend with that exact `APP_URL`, then deploy the frontend with the real backend `VITE_API_URL`.
2. If the final frontend domain differs, update backend `APP_URL` and redeploy the backend. Avoid allowing every `*.vercel.app` domain.
3. In the existing Supabase project's Auth URL Configuration, set Site URL to the real frontend origin. Add the frontend `/auth/callback` and `/reset-password` URLs to the allowed redirect URLs. Add only the development/preview origins you intend to use.
4. Configure Supabase SMTP before relying on public signup confirmations and password recovery. This preparation has not changed dashboard settings or verified email delivery.
5. Redeploy the relevant Vercel project after changing environment variables. Frontend `VITE_*` values take effect at build time, so a browser reload alone is insufficient.
6. Ensure the public commerce frontend can call the API without a Vercel deployment-protection sign-in page. Test production separately from protected previews and configure the intended public production access yourself.

Authentication uses bearer tokens and browser storage, so cross-site `SameSite` cookies are not needed. CORS preflight permits the allowed frontend's Authorization/Content-Type headers and GET/POST/PATCH/DELETE methods; it runs before authentication. API role and ownership checks remain enforced.

## 5. Serverless compatibility and operating limits

- Durable business data is stored in PostgreSQL. Uploads use bounded in-memory Multer buffers (2 MB) and Supabase Storage, not a writable local directory.
- The Prisma instance and small connection pool are reused for the lifetime of a loaded module. Runtime URLs should use Supabase's transaction pooler; Vercel uses a shorter idle timeout. Monitor database pool limits as function instances scale.
- Realtime is a browser connection directly to Supabase; Express does not host WebSockets or require an always-running background worker.
- Local `npm start` continues to serve the built frontend and API together. Vercel serves the frontend separately and does not depend on Express static serving.
- Express rate limiting uses an instance-local memory store. It is not a global limit across Vercel instances; configure platform firewall/rate rules for production abuse protection. Authentication/authorization do not depend on that memory store.
- Existing full-history snapshots can grow as business records accumulate. Large-store load/latency testing remains an operational follow-up. No capacity or production SLA is claimed here.
- Digital payments remain simulations. `ENABLE_PAYMENT_DEMOS=true` exposes explicitly labeled demos which can reserve inventory in the configured store. Do not enter live payment credentials or perform actual financial transactions to validate this deployment.

## 6. Validation and deployment acceptance

From the repository root:

```sh
npm run lint
npm run test:unit
npm run build --workspace @ascent/backend
npm run build
npm run db:validate
npm run db:check
npm run check:auth --workspace @ascent/backend
npm run verify
```

`npm run verify` is the isolated local mock browser regression. Existing live integration/system/checkout/Auth suites create temporary records in the configured Supabase project; run those sequentially against a designated development project, not a business database without authorization. `npm run test:startup` is a read-only configured-owner/staff browser check of the built app; it requires valid accounts and headless Edge.

After genuine deployment, verify the real URLs:

1. Health check, public homepage, catalog, images, search, filters and product details.
2. Open and refresh `/products`, `/login`, `/account/orders` and `/owner/inventory`; protected routes must still require the correct identity.
3. Register a test customer, complete confirmation, sign in, reload, sign out and exercise password recovery with real email delivery.
4. Sign in with the restored owner; verify inventory, People and reports. Verify customers cannot access those APIs and staff remain restricted to their permitted functions.
5. Add/update cart quantities, explicitly confirm a test order, check COD/counter payment choices, confirmation, order history and pickup/delivery tracking. Use test data; do not change live business stock without authorization.
6. Verify each enabled digital demo is labeled, cash collection and receipts work in the chosen test environment, cancellation restores test stock once, and profile edits persist.
7. Check browser network logs for the backend HTTPS origin, successful OPTIONS requests and bearer tokens on signed-in calls. Check Vercel runtime logs without copying secrets.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `invalid_credentials` | Exact autofilled email; account existence; current Auth password. The original deleted owner was restored during this preparation; do not rerun restoration for an active account. |
| Sign-in succeeds but dashboard denies access | Matching `profiles` row, `role=owner`, `is_active=true`, `auth_deleted_at IS NULL`; do not grant owner access from browser code. |
| HTML returned from API | Wrong `VITE_API_URL`, appended `/api`, frontend fallback used as API, or deployment protection. |
| CORS/OPTIONS error | Exact scheme/host in `APP_URL`, selected preview origin, backend redeployed, and public API accessibility. |
| `FUNCTION_INVOCATION_FAILED` | Backend runtime environment, generated Prisma Client, bundled CA and Express entry default export; inspect runtime logs. |
| Prisma client missing or schema not found | Backend build command must run `prisma generate` from `backend`; use root lockfile/workspace access and install dev dependencies. |
| API health 503 | Correct pooler URL/password, Supabase project availability, pool capacity and verified TLS CA. Never disable TLS validation. |
| Asset/deep-link 404 | Frontend root `frontend`, output `dist`, committed public assets and the frontend SPA rewrite. |
| Email callback/reset fails | Supabase Site URL, exact allowed redirects and SMTP delivery configuration. |
| Demo wallet options absent | Expected when `ENABLE_PAYMENT_DEMOS=false`; cash remains available. |
| Windows works, Linux imports fail | Filename case and all locally untracked imported modules must be committed. |

## 7. Review, commit and push yourself

Review the migration changes, including renamed source/tests and the added compiler/type files. Ignored `.env.local`, artifacts, `node_modules` and `dist` must stay untracked. The recoverable pre-migration baseline is commit `617dc5406fffb8f6c43dd0a08e0a2176af08e70c`.

```sh
git status --short
git diff --check
git add --all
git diff --cached --stat
git diff --cached
git commit -m "Migrate ASCENT backend and tools to TypeScript with isolated Vercel builds"
git push origin main
```

Run the commit only after staged review. No repository initialization, remote replacement, history rewrite, commit, push or deployment was performed by this preparation.

## Platform references checked

- [Vercel native Express entry/export and static asset behavior](https://vercel.com/docs/frameworks/backend/express)
- [Vite SPA deployment and fallback rewrites](https://vercel.com/docs/frameworks/frontend/vite)
- [Separate Vercel projects for a monorepo](https://vercel.com/docs/monorepos)
