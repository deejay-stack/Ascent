# ASCENT grocery and minimart

React/TypeScript frontend and Express/Prisma backend connected to Supabase PostgreSQL, Auth, Storage and Realtime. The application supports owner inventory management, customer carts/orders, staff POS, cash payments, receipts, stock history, account management, settings and calculated reports.

## Project layout

| Folder | Contents |
| --- | --- |
| `frontend/` | React pages, components, hooks, client services, photos, Vite/TypeScript configuration and browser tests |
| `backend/` | Express API, database services, Prisma schema/migrations, setup scripts, certificate and backend tests |
| `scripts/` | Shared development launcher |
| `docs/` | Architecture, setup and test documentation |
| `artifacts/` | Generated test reports, screenshots and PDFs; ignored by Git |

The root `package.json` coordinates npm workspaces. Each application has its own package and environment file; npm shares installed dependencies under root `node_modules/`.

Product visuals use 37 supplied JPG/JPEG photos. Coffee, bottled water and rubbing alcohol use a neutral placeholder until a photo is selected or uploaded. Old browser catalogs receive the new image paths without resetting business records. `npm run seed:catalog` regenerates only demo catalog data and preserves supplied image files.

## Run locally

```sh
npm install --legacy-peer-deps
npm run dev
```

Use `npm.cmd` in Windows PowerShell if script execution is disabled. Node 22.21 or later in the supported Node 22 line is used for this project.

`npm run dev` starts the frontend at http://localhost:5173 and the API at http://localhost:4174. Sign in using the owner/staff accounts configured in `backend/.env.local`. The owner can add categories and actual products from Inventory; the live bootstrap inserts no sample stock.

```sh
npm run build
npm start
```

The production-style local server opens at http://localhost:4174.

## Supabase integration

Public browser configuration belongs in `frontend/.env.local`; server keys, database access and bootstrap accounts belong in `backend/.env.local`. See the corresponding `.env.example` files and [current database handoff](docs/live-database-handoff.md).

The database has 15 application tables. Signed-in customer carts persist across devices. Orders reserve stock and clear the cart transactionally; cash settlement produces a payment, sale and receipt without a second stock deduction. Reports derive from stored sales and inventory records.

Real users register at `/register`. Staff/admin access requires owner approval in People. [Account registration and email setup](docs/real-accounts.md) describes credentials, approvals, connection recovery and the required Supabase SMTP configuration.

[Business accounts and handover](docs/business-handover.md) covers the provisioned owner/staff logins, password changes, replacing operators, and installing or transferring the system to a business.

GCash, Maya and card are test demonstrations, disabled for normal store operation with `ENABLE_PAYMENT_DEMOS=false`. Merchant payment collection still requires a payment provider. Camera scanning starts only on request.

## Checks

```sh
npm run lint
npm run build
npm run db:validate
npm run test:unit
npm run test:integration
npm run test:system
npm run test:startup
npm run verify
```

Unit tests run without network access. Integration tests exercise the configured Supabase project through the API. System tests use Microsoft Edge and isolated API/Vite processes (4190/5190) against Supabase. Live tests create uniquely named fixtures and remove those fixtures afterward; use a development project when rerunning them. Reports are saved under `artifacts/integration/` and `artifacts/system/`.

After building, `npm run test:startup` verifies the production build and the configured owner/staff logins on port 4192, without creating business records.

`npm run verify` retains the isolated mock regression suite (4186/5186), with results in `artifacts/phase-1/`. To run the application in demo mode, set `VITE_DATA_MODE=mock` in the frontend and `ASCENT_DATA_MODE=mock` in the backend. Demo accounts are owner@ascent.store, staff@ascent.store and maya@example.com with password `ascent-demo`. Mock records are separate from Supabase.

Earlier phase documents are historical. [Current architecture and setup](docs/live-database-handoff.md) describes the workspace and database integration.
