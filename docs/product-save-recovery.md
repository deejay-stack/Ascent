# Product saves and connection recovery

The reported Vite `/api/products` error, `read ECONNRESET`, means the connection between Vite and the API was cut. The provided log contains no backend crash or database error, so the original interruption's cause is unconfirmed. Normal product creation, supplied photos and uploads passed through Vite against Supabase during the investigation.

## Changes

- Product creation includes a request token retained while the product form stays open. The server derives a product ID from the token, authenticated owner and validated input. Identical retries return the saved product; concurrent attempts cannot create another product or repeat opening stock. No database migration or reset is required.
- The frontend retries product creation once after a connection reset, timeout or unavailable-service response. Validation, duplicate SKU/barcode and permission errors are returned immediately. Other mutations are not automatically replayed by the proxy.
- Vite uses the explicit local API address, a bounded upstream timeout and JSON errors instead of an empty 502 response. Diagnostic proxy errors remain visible in the terminal.
- A temporary database failure during startup no longer terminates the API. The health endpoint reports 503 until the database is reachable, and later requests can reconnect. Request failures log their method, path, status and error code without logging credentials or payloads.
- Oversized images are rejected before upload, and the server independently enforces the 2 MB limit. Invalid JSON, upload errors, database timeouts and conflicting records now have specific error responses.

An automatic retry uses the same input and owner identity. Editing the draft creates a different request payload; closing the form discards its request token. If a prolonged outage prevents confirming a save, reload Inventory and check the SKU/barcode before starting a new draft. Unique SKU/barcode constraints remain enforced.

## Verification

Verified on September 15, 2026: 24 unit/local failure checks, 20 commerce API scenarios plus four signup lifecycle scenarios, 26 live browser system checks, lint and the production build passed. The running API and Vite health/catalog endpoints also returned HTTP 200 after cleanup.

`npm run test:unit` includes a real local Vite proxy with an upstream socket deliberately reset, plus API startup against an unreachable database. It checks useful error responses and that the server stays available.

`npm run test:integration` exercises concurrent product submissions, replay after stock has changed, duplicate identifiers, role enforcement, rejected oversized uploads and malformed requests, as well as carts, inventory, orders, payments and receipts.

`npm run test:system` commits the browser's first product save to Supabase and deliberately drops its response. It checks automatic recovery, exactly one product and one opening-stock movement, then continues the shopping, POS, reporting and account workflows.

The live suites create temporary records and remove them afterward. Run them against development or staging, not during real trading. Reports are under `artifacts/integration/` and `artifacts/system/`.

## Running and diagnosing the app

Use `npm.cmd run dev` at the repository root to start both the API and Vite. If running them in separate terminals, the frontend needs the backend listening on port 4174. After updating an already open development session, refresh the page so it uses the new save behavior.

If another interruption occurs, capture both the Vite terminal and the backend terminal at the same time. Look for `API operation failed`, `PostgreSQL is temporarily unavailable`, `Database idle connection closed`, or a process restart. These distinguish an API restart from a database outage; the Vite reset alone cannot identify which occurred.
