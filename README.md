# ASCENT SME Store

ASCENT is a responsive grocery catalog and store workspace built with React, TypeScript, Vite, and a dependency-free Node API.

Phase 1 adds a browser-local POS, 40 grocery products with local illustrations, inventory movements, receipts, payment demonstrations, customer order reservations, calculated dashboards and reports. The existing Node backend still provides authentication and historical orders. New commerce records use a replaceable mock service layer; Supabase integration has not started.

## Run locally

```bash
npm install
npm run dev
```

The app runs through Vite and proxies `/api` requests to the Node server on port `4174`. For a production-style run:

```bash
npm run build
npm start
```

Then open `http://localhost:4174`.

## Demo accounts

All seeded accounts use the password `ascent-demo`.

- Owner: `owner@ascent.store`
- Staff: `staff@ascent.store`
- Customer: `maya@example.com`

Customer registration is also enabled. Passwords are stored as salted scrypt hashes. The local API keeps its existing accounts, sessions, products and historical orders in `server/data.json`. New shopping and POS operations share browser-local development inventory through `src/services/index.ts`. All localStorage access is isolated in `src/services/storage/mockStorage.ts`.

## Available workflows

- Searchable, filterable, sortable product catalog
- Product details and stock-aware quantities
- Persistent cart with pickup or delivery selection
- Customer registration, sign-in, session restore, sign-out, and recovery request
- Role-based protected routes for customer, staff, and owner workspaces
- Authenticated order creation, stock deduction, and customer order history
- Persisted light/dark mode across public, authentication, catalog, cart, and dashboard views

## Checks

```bash
npm run lint
npm run build
```

On Windows PowerShell with script execution disabled, use `npm.cmd` instead of `npm`.

Run the complete browser/service workflow checks with Microsoft Edge installed:

```bash
npm run verify
```

The runner uses separate API/Vite test processes and browser data. Results, screenshots and a print-check PDF are written under `artifacts/phase-1`. Ports 4186 and 5186 must be available. It does not use the existing backend data file.

See [the implementation handoff](docs/phase-1-handoff.md), [file inventory](docs/phase-1-files.md), and [initial inspection](docs/phase-1-audit.md) for scope, limitations, and the exact Phase 2 starting point. Real payments, camera scanning, staff account management and Supabase remain deferred.
