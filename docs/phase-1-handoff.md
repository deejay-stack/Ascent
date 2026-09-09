> Historical Phase 1 milestone. See [current integration notes](integration-handoff.md) and [Supabase setup](supabase-setup.md) for work completed after this document.

# ASCENT Phase 1 handoff

## Scope and architecture

The existing Node backend, account storage, sessions, and historical order endpoints remain intact. No Supabase project, credentials, Prisma configuration, or database connection has been added.

The repository root is the frontend root. Assets therefore live in `public/images`, not a new nested frontend directory.

New commerce uses one browser-local store behind `src/services/index.ts`. Product, inventory, sales and payment contracts are in their respective service folders. Writes return promises; reads expose a synchronous cache and subscription for React. A future API implementation should hydrate that cache and publish revisions after successful requests. Components do not import seed arrays. `mockStorage.ts` is the only file that accesses localStorage, including the existing auth-token and theme persistence.

`ascent-commerce-v1` holds products, sales, item/price snapshots, payment information, inventory movements, orders and store settings as one persisted document. A sale validates quantities, aggregates duplicate lines, rechecks availability and stock, checks payment confirmation, builds all records in a draft, persists it, then publishes the update. Failed validation or persistence does not publish a partial sale. Transaction IDs make repeated completion idempotent.

This remains a single-browser development system. It is not a production authorization boundary, distributed inventory lock or multi-terminal transaction engine. Storage events refresh other tabs, but concurrent writes from separate tabs can still overwrite each other. Cost prices are omitted from storefront and staff service projections; mock seed data itself is shipped in the development frontend.

## Features delivered

- Forty original grocery products across twelve categories, with unique SKUs/EAN-style barcodes, varied units, stock thresholds, two out-of-stock examples and one archived example.
- Forty original local SVG product illustrations, consistent dimensions, descriptive filenames and a shared image component with a local fallback. These are replaceable sample illustrations, not product photography. SVG keeps this simple artwork compact and crisp without a raster conversion dependency.
- Catalog search across name/SKU/barcode/brand/category; category, price, availability and featured filters; sorting, load-more pagination, quick view, quantity controls, stock-limit enforcement, skeleton and empty states, responsive filter modal.
- POS product selection, name/SKU/barcode search, Enter-terminated USB scanner input, duplicate-scan guard, focus retention and scan feedback. Camera UI stays a permission-free placeholder.
- Responsive two-panel POS with a mobile Products/Bill switch, stock-aware quantities, remove/clear actions, discounts, configurable demonstration tax, cash validation and change.
- GCash, Maya and card demonstrations with explicit pending, success, failure and cancellation. No card details are collected and opening a modal never completes a sale.
- Receipts with item/price and store-identity snapshots, totals, cashier, payment/change, print-only CSS, text download and new-transaction action.
- Inventory summaries, stock/category/search filters, owner product editing/archive/availability controls, stock-in/out/count adjustments and attributable movement history.
- Owner/staff dashboards calculated from completed sales and current stock; reactive updates, recent receipts, sales trend, product/category performance and inventory alerts.
- Reports with dates, payment/source filters, transaction detail/reprint, totals, product quantities, best sellers and low/zero-sale products. Product/category gross sales are clearly separated from final totals after discount/tax.
- Customer checkout reserves stock in the same local store. Local and previous backend orders appear in order history. Owner/staff can record exact-cash payment and fulfillment, or cancel and restore stock. Unpaid orders do not inflate sales reports; settlement does not deduct stock twice.
- Local store-name/address/demo-tax settings and account details/theme controls.

## Verification

Run `npm.cmd run verify` on Windows with Microsoft Edge installed. The runner creates a separate test backend JSON file, Vite cache and Edge profile under `artifacts/phase-1`; it starts and stops its own API/Vite helpers on ports 4186/5186. Set `ASCENT_TEST_URL` to target an already running development server instead. Service tests run through Vite's TypeScript transform in the browser.

The machine-readable result is `artifacts/phase-1/verification.json`. Screenshots and `receipt.pdf` are saved beside it. The checks cover catalog/image behavior, customer cart and checkout, service validation and persistence rollback, scanner handling, cash/QR payment, receipts/print CSS, stock/history, dashboard/report updates and mobile layout. Printing is checked through the browser print action and generated PDF; a physical printer and physical USB scanner have not been tested.

Also run `npm.cmd run lint` and `npm.cmd run build`.

## Remaining work

- People/staff account management remains the existing placeholder route. Profile details are read-only; account editing needs an account service.
- About remains the existing informational placeholder. Newsletter subscription and password-recovery delivery remain existing demonstrations without mail delivery.
- Camera scanning, real QR/card payment, receipt-lookup QR codes, product photography and production tax configuration remain deferred.
- The new product editor edits existing seed products; creation/deletion/category-management screens are not included.
- Browser-local records are not synchronized with the legacy backend product/order inventory. Legacy orders stay readable, while new orders and POS share the new local catalog. Historical backend orders do not enter the mock sales reports.

## Exact next database starting point

After Phase 2 is explicitly approved, start with the contracts in `src/types/product.ts`, `src/types/commerce.ts` and `src/services/{products,inventory,sales,payments}`. Design the PostgreSQL schema and Express request/response contracts before changing components: categories, products, inventory_movements, sales, sale_items, payments, orders/order_items, and account/role mappings.

Implement the first transactional Express endpoint around `SalesService.complete`: accept an idempotency key and requested quantities; resolve authorized cashier and server-side prices; validate payment; lock/recheck stock; create sale, immutable item/payment snapshots and movement records; decrement stock; commit all or none. Keep both current product quantity and permanent movement history. Test rollback, replay, concurrent checkout and insufficient stock before replacing the mock implementation.

Then add Prisma/PostgreSQL, Supabase Auth and owner-only staff provisioning, Storage image URLs, and authorized Realtime notifications after commits. The frontend must never contain a service-role key. Enable RLS for any frontend Supabase access. Keep operational writes through Express. Swap API implementations at `src/services/index.ts`, hydrate the observable cache and remove the localStorage commerce adapter only after migration tests pass.
