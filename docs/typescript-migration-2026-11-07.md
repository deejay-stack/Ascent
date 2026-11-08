# TypeScript migration and verification — November 7, 2026

## A. Migration summary and audit

Baseline: clean Git commit `617dc5406fffb8f6c43dd0a08e0a2176af08e70c`. History was preserved; no commit, push, schema migration, seed, account recovery, or deployment was performed. An ignored archive of that commit was also used to execute the unchanged mock browser baseline.

The [file inventory](typescript-migration-inventory.json) records all **198 original tracked JavaScript/TypeScript files**, their responsibilities, original and final import dependencies, target paths, and migration status. Generated assets, dependencies, build output, and historical artifacts were excluded. The audit also inspected package scripts, frontend TypeScript/Vite configuration, both Vercel configurations, Prisma configuration/schema and all seven SQL migrations, environment examples, routing, state providers, database/Auth/Storage/Realtime integration, and verification utilities.

**60 files converted:**

| Area | Files | Conversion |
| --- | ---: | --- |
| Backend application | 21 | `.mjs` → `.ts` |
| Backend operator scripts | 7 | `.mjs` → `.mts` |
| Backend tests/helpers | 14 | `.mjs` → `.mts` |
| Frontend utility scripts | 3 | `.mjs` → `.mts` |
| Frontend tests/helpers | 14 | `.mjs` → `.mts` |
| Shared development launcher | 1 | `.mjs` → `.mts` |

The React application was already TypeScript/TSX. Its components, hooks, providers, routes, service behavior, styles, and JSX compiler settings were retained. **47 original files have modified import declarations**, including type-only imports; exact lists are in the inventory. Three type-only modules were added: `backend/src/types.ts` for Prisma-derived payloads and Express request augmentation, `backend/tests/helpers/api-types.ts` for existing JSON contracts, and `frontend/tests/protocol.ts` for the browser driver's DevTools protocol subset. No duplicate application services were introduced.

The only deliberately retained project JavaScript file is **`eslint.config.js`**. ESLint loads this configuration natively; converting it would add a TypeScript configuration loader dependency without improving application typing. Emitted `.js` files under ignored `dist/` are generated output.

### Architecture and dependencies

- Frontend entry: `frontend/src/main.tsx`; application/router under `src/app/`, with public/customer/owner/staff layouts, existing protected routes, Auth/Cart/Theme providers and client services.
- Backend entry: `backend/src/index.ts`; live Express app and middleware/routes in `src/app.ts`; local mock server in `src/legacy.ts`. Existing live endpoint paths, middleware ordering, response projections and error mapping were preserved.
- Live authentication uses Supabase bearer tokens, server-side user verification and database profile roles/activation. Browser sessions remain in IndexedDB; local mock sessions remain in their existing demo store. No cookie/session policy was changed.
- Prisma Client 7.10.0 and `@prisma/adapter-pg` retain the existing PostgreSQL adapter, verified CA/TLS configuration, connection limits and transaction retries. Supabase remains the database, Auth, Storage and Realtime provider.
- Product creation, stock adjustments, cart versions/mutation hashes, checkout hashes, inventory reservations, cents/tax calculations, payment demos, cash/COD settlement, receipts, notifications and account handover rules are unchanged.
- Existing cross-directory imports are operator/test-only: the demo seed reads frontend grocery data; browser/integration verification shares backend fixtures and existing frontend data types. None enters the production backend compiler's file graph.

### Configuration and commands

- Added strict `backend/tsconfig.json`: NodeNext ESM, `rootDir: src`, `outDir: dist`, explicit source include, no emit on errors, erasable TypeScript syntax and relative import-extension rewriting. Source imports use `.ts`; emitted Node imports use `.js`.
- Added separate root `tsconfig.tools.json` for strict, non-emitting checks of utilities/tests and their deliberate shared imports. Frontend application compilation remains in its existing Vite/JSX configuration.
- Backend build now generates Prisma Client and compiles TypeScript. `npm start` runs compiled `backend/dist/index.js`; root build builds both workspaces. `npm run server` and the development launcher retain direct source startup. Node utilities/tests run as `.mts` using native stripping on the validated Node 22.21.0 runtime.
- Added explicit typecheck commands and `.mts` lint coverage. Backend unit tests build first so the same deployment/outage assertions can check source and emitted entry points. Dependency versions and `package-lock.json` were preserved.
- Both Vercel build commands explicitly select their workspace. Frontend output remains `dist` with the existing SPA rewrite; backend framework remains native Express with no static output directory.

## B. TypeScript and build verification

Executed successfully:

- Clean root `npm ci`.
- `npm run build --workspace @ascent/frontend` and `npm run build --workspace @ascent/backend`, plus the final root build of both workspaces.
- Explicit frontend, strict backend and strict shared-tool typechecks via `npm run typecheck`; no unresolved diagnostics.
- `npm run lint`; no errors or warnings.
- Prisma Client generation at **7.10.0** and `npm run db:validate`.
- Backend compiler file-list inspection: **no frontend sources included**.
- Frontend Vercel-mode build with an explicit HTTPS test API origin into a separate ignored artifact directory; this is a build simulation, not a deployed API.
- Private-value scan of that browser bundle: none of the configured server Supabase keys, database URLs or bootstrap passwords was present. Application-source search found no hardcoded localhost API URL in production paths.

Normal frontend build assets retained the baseline CSS/JavaScript hashes, providing additional evidence that application/UI behavior was untouched. The Vercel simulation necessarily has a different application hash because it embeds a different API origin.

## C. Functional verification

| Executed check | Verified result |
| --- | --- |
| Frontend unit tests | **11 passed** |
| Backend unit/deployment/outage tests | **27 passed** |
| Live backend integration suite | **38 passed**, none skipped |
| Archived unchanged mock browser baseline | **110 passed** |
| Migrated mock browser suite | **110 passed** |
| Navigation/deep-link/mobile browser checks | **13 passed** |
| Compiled production startup/browser checks | **8 passed** |
| Auth/registration/approval/connection browser checks | **26 passed** |
| Full-storage Auth persistence/logout browser checks | **5 passed** |
| Live checkout browser checks | **39 passed** |
| Live system browser suite | **26 passed** on the final isolated run |

Live tests used uniquely named fixtures and their existing cleanup routines. Shared store settings were not enabled for mutation. No schema migration, database reset, production record deletion, catalog seed, or operator-account restoration was run.

After all suites and cleanup completed, the read-only Supabase check passed again. Business counts matched the pre-test check exactly: **12 products, 12 categories, 2 orders, 1 sale, 1 payment, 7 retained profiles, and 4 Auth accounts; zero test accounts remained**. All 18 application tables/RLS, the Storage bucket and Realtime publication were verified again. In total, the final runs passed **38 unit tests, 38 integration tests and 227 browser checks**; the separate 110-check archived baseline is not included in those totals.

Coverage includes request validation and error mapping; role/activation enforcement; Supabase registration confirmation and owner approval; Auth persistence/logout; product browsing/search/details; product/photo saves and retry idempotency; cart persistence and concurrent sessions; explicit checkout confirmation; demo wallet outcomes; counter cash and COD; stock reservation/deduction/restoration; order progress and notifications; receipts/reports; and responsive/deep-link navigation.

### Failures investigated during verification

- Initial baseline unit run had two failures before Prisma Client was generated; both passed after generation. The final backend pretest hook now generates/builds before source and compiled tests.
- An initial sandboxed Edge renderer crashed. Browser checks were rerun outside that sandbox.
- One mock run hit a wall-clock scanner debounce assertion. The unchanged archived baseline and the migrated rerun both passed all 110 checks, with the assertion and scanner code unchanged.
- The first live system/checkout browser runs rejected their isolated Vite origins. The harness now explicitly sets the child API's `APP_URL` to its test origin. This fixes test environment setup; production CORS and assertions were not loosened. Checkout then passed all 39 checks.
- A subsequent system run completed 12 checks, including real checkout/payment, before an API error during fulfillment while other live suites were active. A final isolated run passed all 26 checks; no business logic or assertions were changed. API stderr capture was added to those two harnesses without exposing credentials. The intermediate error's exact database cause was not captured, so it is recorded as transient rather than assigned a speculative cause.

Raw command logs, compiler file lists and the isolated Vercel build are under ignored `artifacts/migration/`. Existing suite reports/screenshots are under `artifacts/{integration,phase-1,navigation,startup,auth,auth-storage,checkout,system}/`. Older screenshots in those directories are historical unless the current report references them.

## D. Vercel compatibility and original error

**Not yet verified on Vercel.** No Vercel project, dashboard settings or deployment logs were available, and no deployment was attempted. Local builds, source/emitted default-export smoke tests and the compiled-server browser check passed; these do not establish a successful cloud deployment.

The reported `../frontend/src/main.tsx` / missing JSX errors identify frontend code being compiled in a Node context without its frontend configuration. That JSX failure signature was reproduced locally with an intentionally wrong compiler context. The corrected frontend check uses `jsx: react-jsx`; the backend's isolated compiler graph contains no frontend files. Explicit workspace build commands prevent the root build from accidentally selecting both applications in an individual Vercel project. The original remote `react-dom/client` dependency failure cannot be retrospectively attributed to a specific dashboard/install setting without its full log; clean workspace installation and frontend resolution pass locally.

Use Vercel Root Directory **`frontend`** / Vite / output **`dist`**, and Root Directory **`backend`** / Express / output unset. Enable access outside each Root Directory for the shared npm workspace lockfile. Keep Node **22.x** and install build-time dev dependencies. See [deployment instructions](../VERCEL_DEPLOYMENT.md).

Required frontend variables remain `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and HTTPS `VITE_API_URL`. Required backend variables remain `ASCENT_DATA_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and exact HTTPS `APP_URL`; retain the configured product bucket and explicit demo-payment flag. The deployment does not need bootstrap operator passwords or migration credentials. Never add privileged keys under `VITE_`.

Production still rejects filesystem mock mode. Local combined static serving remains available; Vercel frontend assets are served by the separate Vite project. Existing Express memory-backed rate limits remain per process and therefore are not a globally coordinated quota across scaled serverless instances. PostgreSQL pool capacity must account for Vercel instance scaling. These platform limits were documented without redesigning the application.

References checked: [Vercel Express exports and static serving](https://vercel.com/docs/frameworks/backend/express), [Vercel Node TypeScript configuration](https://vercel.com/docs/functions/runtimes/node-js), [Vercel monorepos](https://vercel.com/docs/monorepos), and [TypeScript relative import rewriting](https://www.typescriptlang.org/tsconfig/rewriteRelativeImportExtensions.html).

## E. Architecture preservation and observable changes

The monorepo/workspaces, application directories, UI, routes, API contracts, database schema/migration history, business calculations and workflows were preserved. Runtime comparison against the baseline confirmed that migrations primarily erase to the existing JavaScript operations. Type-only modules do not introduce runtime dependencies or cycles.

Intentional operational changes:

1. The migrated launcher exports the live Express app and skips local `listen()`/startup probes on Vercel. Local startup still selects the same live/mock modes and starts the same server. This makes either recognized TypeScript entry safe for native Vercel import.
2. Production startup uses compiled JavaScript, so root build now compiles both workspaces. Direct source startup remains available through `npm run server` and development commands.
3. Utilities/tests now require the documented Node 22 runtime with TypeScript stripping; the existing seed keeps its `tsx` runner.
4. Test-only changes configure isolated frontend origins, capture sanitized API diagnostics, and extend existing deployment/outage assertions to emitted output. No assertion was removed or weakened.

## F. Outstanding items

- Deploy and check the actual Vercel frontend/backend URLs, dashboard overrides, CORS, Auth redirects/SMTP, database connectivity and direct-route refreshes using the deployment guide. Actual cloud resolution of the original deployment error remains unverified.
- The existing frontend large-chunk warning remains; bundle splitting would exceed a language migration's scope.
- Live integration emitted a `pg` deprecation warning about overlapping queries. Existing queries/dependencies were preserved.
- Real merchant payment collection remains unimplemented; current digital methods are explicitly demos, as before. Email deliverability, a physical camera and real payment providers were not certified by these tests.
- The intermediate live fulfillment error did not recur in the isolated final run; retain the diagnostic capture when investigating a recurrence.
