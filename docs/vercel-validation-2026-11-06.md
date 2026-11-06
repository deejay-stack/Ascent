# Vercel preparation and owner recovery validation — November 6, 2026

## Result

**Ready with manual configuration required.** The application is prepared for separate frontend/backend Vercel projects. Real Vercel URLs, dashboard environment variables, Supabase redirect configuration and deployed acceptance checks remain manual. Nothing was committed, pushed or deployed.

The reported admin login failure was caused by a deleted Supabase Auth identity. The configured original owner had a retained `owner` profile with `is_active=false` and a non-null `auth_deleted_at`. After the user explicitly approved recovery, `restore-owner.mjs --apply` recreated that same Auth ID with the existing private local credential and reactivated the profile. The owner now signs in and reaches inventory in the production-build browser check. The password was not printed or added to source, and an existing account's password was not reset.

## Architecture

| Part | Actual implementation |
| --- | --- |
| Frontend | `frontend/`, React 19, TypeScript 6, Vite 8, React Router 7, Tailwind 4 |
| Backend | `backend/`, Express 5 ES modules; local `src/index.mjs`, native default export `src/app.mjs` |
| Database | Supabase PostgreSQL; Prisma 7, `@prisma/adapter-pg`, verified TLS, transaction pooler |
| Authentication | Supabase Auth; bearer tokens, role checks in API, IndexedDB browser persistence |
| Assets and events | Public bundled frontend files, Supabase Storage uploads, browser Supabase Realtime |
| Repository | npm workspaces with one root lockfile, existing `origin` deejay-stack/Ascent, branch `main` |

## Files changed by this task

The workspace already contained many modified/untracked commerce, checkout, routing and test files. Those existing changes were preserved. This list describes additions/edits made for the current task only.

| File | Purpose and effect |
| --- | --- |
| `.gitignore` | Ignore Vercel local project metadata; existing private env exclusions retained |
| `package.json` | Pin supported Node 22.x |
| `package-lock.json` | Keep root/workspace Node engine metadata synchronized; no dependency version upgrades |
| `backend/package.json` | Node engine, Prisma generation build command, read-only Auth check and explicit owner recovery commands |
| `frontend/package.json` | Pin supported Node 22.x |
| `backend/vercel.json` | Native Express preset, workspace-compatible installation and Prisma generation build |
| `frontend/vercel.json` | Vite preset, installation/build/output settings, SPA fallback |
| `backend/src/app.mjs` | Default export, production mode guard, proxy awareness, CORS before auth, local-only combined static serving |
| `backend/src/index.mjs` | Prevent filesystem demo mode on Vercel while retaining local launcher behavior |
| `backend/src/cors.mjs` | Explicit frontend origin allowlist, bearer-token preflight handling, local combined-server compatibility |
| `backend/src/database-config.mjs` | Statically traceable bundled CA path and shorter Vercel pool idle timeout; TLS verification preserved |
| `frontend/src/services/apiUrl.ts` | Validate and resolve independently deployed API origin without duplicating `/api` |
| `frontend/src/services/api.ts` | Apply `VITE_API_URL` to authenticated and anonymous API requests |
| `frontend/vite.config.ts` | Reject incomplete/invalid public Vercel configuration at build time; existing dev proxy preserved |
| `backend/.env.example` | Explain CORS production origins and runtime versus one-time bootstrap credentials |
| `frontend/.env.example` | Document optional local/required separate-production `VITE_API_URL` |
| `backend/scripts/check-auth.mjs` | Read-only account existence/profile/credential/token diagnostics without secret output |
| `backend/scripts/restore-owner.mjs` | Default read-only preview; explicit `--apply` restores only the retained deleted original owner and preserves its ID |
| `backend/tests/cors.test.mjs` | Production origin validation, allowed preflight/bearer forwarding, disallowed origins, local combined requests |
| `backend/tests/deployment.test.mjs` | Import native default export and exercise deployment-mode preflight/protected routes/JSON 404s without a live DB |
| `frontend/tests/unit/api-url.test.mjs` | Local proxy versus separate API origin; invalid paths, credentials and duplicate prefixes |
| `README.md` | Link repository-specific deployment and validation instructions |
| `VERCEL_DEPLOYMENT.md` | Exact dashboard settings, environment variables, database/SMTP steps, verification, Git commands and troubleshooting |
| `docs/vercel-validation-2026-11-06.md` | This change and evidence report |

No database schema/migration, business transaction, payment-provider activation or frontend design change was introduced by this task. Private local environment files were not changed.

## Executed validation

| Check | Result |
| --- | --- |
| Offline dependency installation | Passed: `npm install --ignore-scripts --legacy-peer-deps --offline` |
| Lockfile metadata update | Passed with package-lock-only offline installation; no version upgrades |
| Exact project-directory `npm ci --dry-run --ignore-scripts --offline --include=dev --legacy-peer-deps` | Passed from both `frontend` and `backend`, resolving the shared workspace lockfile |
| `npm run lint` | Passed |
| `npm run test:unit` | Passed: 11 frontend + 23 backend = **34 tests** |
| `npm run build --workspace @ascent/backend` | Passed: Prisma Client 7.10 generated |
| `npm run build` | Passed: TypeScript and Vite production build, repeated after final code changes |
| `npm run db:validate` | Passed |
| Native Vercel-mode live read-only API smoke | Passed: database health, 12-product public snapshot, explicit CORS response, auth preflight, anonymous account/order rejection, unlisted origin rejection and backend page-path 404 |
| Vercel frontend build-configuration checks | Passed: missing API URL rejected, `/api` suffix rejected, complete HTTPS public configuration accepted |
| `npm run verify` | Passed: **110 isolated mock regression checks**, including catalog/search/filters/details, cart, checkout/order history, POS/demo payments, receipts, inventory/admin operations, profiles and responsive behavior |
| `node backend/scripts/check-auth.mjs` after approved recovery | Passed: owner Auth identity confirmed, active owner profile, credential login and server token verification |
| `npm run test:startup` after approved recovery | Passed: **8 checks** for production API/DB, owner and staff sign-in/inventory, anonymous catalog and refresh-outage recovery |
| `npm run db:check` | Passed: all 18 tables/RLS, Storage, matching frontend/backend configuration and Realtime |
| Project `vercel.json` parsing | Passed; no legacy `builds`/`routes` wrapper |
| `git diff --check` | Passed |
| Tracked/nonignored source secret-pattern review | No real credential identified; matches were dummy PostgreSQL passwords in error/startup/deployment tests. Private env files remain untracked. This is not a full Git-history secret audit. |
| Exact private-value scan | Passed: configured server keys, connection strings and bootstrap passwords were absent from nonignored source and built frontend assets. Values were compared in memory and never printed. |

Initial attempts to reach Supabase directly and start headless Edge inside the sandbox failed because of network/process restrictions. The applicable checks were rerun with approved execution permissions and the results above are the successful reruns. An exploratory `npm ci --prefix backend` attempt failed because explicit `--prefix` bypasses workspace lockfile discovery; the configured Vercel commands use their project working directory instead, and both of those working-directory dry runs passed.

User-browser inspection ended when the computer-use tool could not determine the browser URL confidently. It did not submit the saved login or change browser settings. Successful owner login was subsequently verified by the project's automated browser check using an isolated browser profile; the user's existing browser session was not inspected or signed in by that test.

## Database preservation

Before and after approved owner recovery:

| Records | Before | After |
| --- | ---: | ---: |
| Products | 12 | 12 |
| Categories | 12 | 12 |
| Orders | 2 | 2 |
| Sales | 1 | 1 |
| Payments | 1 | 1 |
| Profiles | 7 | 7 |
| Temporary test profiles/Auth accounts | 0 | 0 |
| Auth accounts | 3 | 4 (the approved original owner restored) |

Current active identity role summary: one owner, one staff, two customers. Business records were preserved, and the restored account uses the original profile ID.

## Vercel settings

| Setting | Frontend | Backend |
| --- | --- | --- |
| Git repository | deejay-stack/Ascent | Same repository |
| Root | `frontend` | `backend` |
| Framework | Vite | Express |
| Install | `npm ci --include=dev --legacy-peer-deps` | Same |
| Build | `npm run build` | `npm run build` (Prisma generation) |
| Output | `dist` | Unset |
| Node | 22.x | 22.x |
| Variables | `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL` | `ASCENT_DATA_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or legacy service-role key), `DATABASE_URL`, `APP_URL`, `SUPABASE_PRODUCT_BUCKET`, `ENABLE_PAYMENT_DEMOS` |

Both builds need access outside the project root for the root npm workspace configuration/lockfile. See the full deployment guide for domain, environment scope and Supabase callback/SMTP requirements.

## Remaining manual work and limits

- Create/configure the two Vercel projects, select real frontend/backend domains, set dashboard variables and run actual deployment acceptance checks. No Vercel CLI build against linked project credentials was run; this does not claim a verified Vercel-hosted deployment or Linux function bundle.
- Verify real cross-domain browser Auth persistence, callback/recovery delivery and routes on deployed URLs. The local deployment-mode smoke and production browser tests cover source behavior but cannot prove dashboard setup.
- Full live integration/system/checkout suites were not rerun against shared business data during this task. Their fixtures can write/delete temporary remote data; the isolated mock suite, all unit checks and read-only live startup/API checks were run instead.
- Digital payments remain explicitly demo-only. No live money collection, provider webhook, SMTP delivery, production scale or hardware scanner/printer validation is claimed.
- The existing large Vite chunk warning remains. API rate limits remain per-instance; use platform controls for global abuse limits and monitor database connection capacity under scale.
- Existing abandoned-order expiration, refunds and external courier/payment-provider integration remain separate business work, as documented in the earlier audit. No missing business features were invented during deployment preparation.

## GitHub commands

The branch is `main` and origin remains `https://github.com/deejay-stack/Ascent.git`. Review the pre-existing application changes and new dependencies/imports before staging the complete working app:

```sh
git status --short
git diff --check
git add --all
git diff --cached --stat
git diff --cached
git commit -m "Prepare ASCENT for separate Vercel deployments and owner recovery"
git push origin main
```

No commit or push was performed. Do not include local environment files or generated artifacts.
