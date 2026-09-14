# Product photos and owner inventory preparation

The current application remains in its configured data mode. This change does not connect, reset or seed a remote database, and does not reset existing browser inventory or transactions.

## Supplied images

`src/data/productImages.json` maps the 40 retired SVG paths to 37 supplied photographs and three explicit placeholders. The files retain their original locations and names, including `produce/fresh_milk.jpg`, `household/bath_soap.jpg`, `dairy/yugart.jpg` and `produce/tomatoe.jpg`. Duplicate files in other folders are preserved. Coffee, bottled water and rubbing alcohol have no matching supplied photograph.

The common product image component serves the catalog, quick view, product details, cart, featured products, POS, inventory and editor preview. It handles missing files and resolves legacy paths. Existing browser records migrate only their retired image URLs; quantities, prices, owner uploads, sales, orders and stock movements remain intact. The demo catalog generator uses the same mapping and no longer recreates product SVGs.

## Completed workflows

- Restored the missing shared image renderer and stock adjustment dialog that prevented compilation.
- Owners can select a supplied photo or upload JPG/PNG/WebP files in the product editor. Uploads block saving until complete and expose failures.
- Stock adjustments show before/after quantities, require a reason, reject negative or unchanged counts, and record the responsible user.
- Homepage category links follow actual catalog categories, including categories created or renamed by the owner. Empty catalogs hide stale featured/category sections and explain that inventory is being prepared.
- Empty inventory guides the owner through the first category and product. Catalog load errors provide a retry action.
- POS bill controls lock during a pending sale. Changed availability or insufficient stock blocks completion until the bill is corrected. The connected POS hides simulated payment methods when the server disables them.
- Store settings and order payment copy reflect the active workflow instead of always describing browser demo records.

## Verification

On 10 September 2026, all 110 browser/service checks passed, including decoding every product image, selecting a supplied photo, creating a category and product from an empty inventory, following its homepage category link, and reloading a legacy catalog without losing prices, stock or history. The isolated test profile restores its fixtures and does not alter the user's records. Results are in `artifacts/phase-1/verification.json`; screenshots and the receipt PDF are in the same directory.

ESLint, the TypeScript/Vite production build, four server validation tests and Prisma schema validation passed. The catalog generator also ran successfully without recreating deleted product illustrations. The first sandboxed Edge run crashed before checks started; the permitted retry completed. Vite still reports its existing large-bundle advisory. No live database or merchant payment verification is claimed.

## Database handoff

`npm run db:seed` now bootstraps accounts, starter categories, settings and image storage without inserting demo products. A fresh store can be populated entirely through owner inventory controls. Demo catalog insertion requires the explicit `--demo-catalog` flag and uploads photos with the correct MIME type. Both seed modes preserve existing database records.

Follow `docs/supabase-setup.md` for connection and live verification. Resetting an already populated database still requires reviewing its existing sales/orders and choosing a reset procedure. No database reset was performed during this task. Live cross-device synchronization, configured Auth/Storage and real hardware checks remain part of the database rollout. Electronic merchant payments still require a provider integration.
