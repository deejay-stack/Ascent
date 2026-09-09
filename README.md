# ASCENT grocery and minimart

React, TypeScript and Vite frontend with two data modes: a working local demonstration and an Express/Prisma integration prepared for Supabase Auth, PostgreSQL, Storage and Realtime.

The application includes 40 grocery products, catalog filters, a stock-aware cart, customer orders, POS cash checkout, payment demonstrations, printable receipts, inventory adjustments, product/category editing, staff account management, editable profiles, store settings and calculated dashboards/reports. Camera barcode scanning starts only on request.

## Run locally

```sh
npm install --legacy-peer-deps
npm run dev
```

Use `npm.cmd` in Windows PowerShell if script execution is disabled. Node 22.21 or later in the supported Node 22 line is used for this project.

Local demo accounts: owner@ascent.store, staff@ascent.store and maya@example.com, all with password `ascent-demo`. Local auth and people use server/data.json; mock commerce uses browser storage. These records are separate from Supabase.

```sh
npm run build
npm start
```

The production-style local server opens at http://localhost:4174.

## Supabase integration

Follow [the setup and live verification guide](docs/supabase-setup.md). Fill `.env.local`, apply migrations, seed, verify the connection and switch both data-mode variables to supabase. No project credentials are bundled. The app currently stays in mock mode; live Supabase data exchange is pending configuration.

GCash, Maya and card controls are payment demonstrations. Real merchant payments require a separate provider integration.

## Checks

```sh
npm run lint
npm run build
npm run db:validate
npm run verify
```

The browser suite uses Microsoft Edge, isolated API/Vite processes (ports 4186/5186), mock mode and separate test data. Results, screenshots and receipt PDF are in artifacts/phase-1. It does not modify the existing backend data file.

See [current implementation notes](docs/integration-handoff.md). The [Phase 1 audit](docs/phase-1-audit.md), [handoff](docs/phase-1-handoff.md) and [file inventory](docs/phase-1-files.md) describe the earlier milestone.

