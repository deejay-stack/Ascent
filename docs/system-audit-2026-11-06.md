# SME e-commerce system audit — November 6, 2026

## A. Architecture summary

ASCENT remains the existing single-store application. The repository already contained extensive uncommitted checkout, fulfillment, connection recovery, and reporting work when this audit began; that work was preserved. No database reset, schema migration, dependency replacement, or rewrite from scratch was performed.

| Area | Discovered implementation |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8; React Router 7 data router in `frontend/src/app/router.tsx` |
| UI | Existing CSS, Tailwind 4, Lucide icons, Motion animations; shared public and role-specific dashboard layouts |
| State | Auth and Cart contexts; product/service subscriptions and a remote snapshot cache; Supabase Realtime plus periodic refresh |
| Backend | Express 5 ESM API; Zod validation, Helmet, rate limits, Multer image uploads |
| Database | Supabase PostgreSQL, Prisma 7 with the pg adapter; 18 application tables, foreign keys, checks, RLS |
| Authentication | Supabase Auth verifies tokens; profiles provide active state and approved customer/staff/owner roles; privileged API middleware rechecks roles |
| Persistence | Database carts, order/item/payment/sale records, inventory movements, order events and notifications; IndexedDB for browser authentication and checkout recovery |
| Payments | Counter cash, newly added COD, and explicitly gated GCash/Maya/PayPal/QR Ph digital-bank simulations; no working real provider collection was found or replaced |
| Alternate mode | Existing local/mock service implementations and legacy JSON auth API; isolated mock regression tests remain available |
| Validation | Node unit/integration tests and existing Edge/CDP browser scripts; no new testing library installed |

Sensitive `.env.local` contents were not printed or changed. Build and validation scripts use the existing workspace configuration.

## B. Existing workflow analysis

The application already supported registration and email-confirmation handling, role approval, catalog search/filter/sort, product details, stock limits, guest and authenticated carts, explicit checkout review, inventory reservation, counter collection, digital simulation outcomes, receipts, history, fulfillment, and inventory/product/people management.

The initial architecture assessment identified missing global scroll restoration, ephemeral cash confirmation, incomplete Orders API representations, no delivery COD choice, uncertain-checkout recovery after Realtime cleared a cart, incomplete active-order counts, and transaction retries that did not consistently reject changed requests. These were addressed within the existing services and models.

The broader production features described in the October completion plan (refunds, reservation expiry, cashier reconciliation, merchant integrations, receiving documents, and scalable history endpoints) are separate release work. Existing pricing and discount permissions were preserved rather than inventing a new business policy.

## C. Bugs identified and fixed

| Bug / root cause | Affected code | Correction | Validation |
| --- | --- | --- | --- |
| Route changes retained the previous window position; no router restoration component | `app/router.tsx`, `index.css` | One root `ScrollRestoration`; automatic scrolling is immediate; existing explicitly smooth navigation actions remain supported | 13 Edge navigation checks passed |
| Adding restoration could reset catalog context on search/sort/filter changes | `ProductCatalogPage.tsx` | Query-only changes use `preventScrollReset`; Back/Forward use router history restoration | Actual sort position remained 300 px; Back restored 450 px |
| Navbar interpreted a URL fragment as a CSS selector, allowing malformed fragments to throw | `PublicNavbar.tsx` | Safely decode and look up an element ID | Malformed-fragment browser check passed without uncaught errors |
| Cash confirmation existed only in Cart component state | `CartPage.tsx`, router, new `OrderDetailsPage.tsx` | Navigate to persistent, protected order details with confirmation and internal status history | Checkout browser refresh check passed; mobile screenshot inspected |
| Orders list omitted payment and events; creation returned events from before the first event was written | `app.mjs`, `orders.mjs` | Include payment/events on list and detail; reload creation result inside its transaction after recording the first event | API assertions checked initial event and final payment/event history |
| A lost acceptance response could clear the cart without showing confirmation; a changed cart version could generate another checkout reference | `checkoutRecovery.ts`, `apiServices.ts`, `CartPage.tsx`, `orders.mjs` | Persist unresolved attempt, look up the owned order before retry, recover on Cart reload, guard duplicate confirmation calls, and validate the browser's cart version inside the order transaction | Edge deliberately lost the POST response, blocked immediate recovery, then reloaded: one recovered order; final cross-session guard results in addendum |
| Paid orders still being prepared disappeared from active-order counts | `RoleDashboardPage.tsx`, `checkout.ts` | Count all five nonterminal statuses | TypeScript/build and browser regressions passed; no dedicated dashboard-count assertion |
| POS retry verified only cashier identity and silently accepted a changed basket/tender | `validation.mjs`, `commerce.mjs` | Compare normalized items, payment method, effective discount/tax, tender/payment reference and actor against the immutable sale | Unit tests plus concurrent API retry and changed-payload checks passed |
| Stock-in/out retries could apply the same adjustment twice after a lost response | `app.mjs`, inventory service and modal | Retain a request reference for the same form contents; deduplicate and compare it inside the existing serializable transaction using movement history | Concurrent stock-in created one movement; changed payload rejected; counted-stock retry passed |
| Live tests assumed an empty store and always restored shared settings | Fixture helper and live browser/integration scripts | Scope actions/assertions to fixture records; preserve singleton store settings unless explicitly opted into testing settings writes | Live checkout and retry suites passed with existing records present |

## D. Newly integrated features

**Cash on delivery:** Local delivery offers COD while store pickup keeps counter cash and the existing digital choices. The order is unpaid during preparation and delivery. Staff must record sufficient cash at the Out for delivery stage; this atomically records payment, creates one receipt, and completes the order. Customers cannot collect payment, ordinary progress cannot skip collection, and repeated collection does not create another sale or deduct stock again.

No migration was necessary. COD is identified by `orders.payment_method=cod` and `payments.provider=cash_on_delivery`. The payment and receipt use the existing cash method. Existing counter cash retains its pay-before-preparation behavior. Existing historical records remain compatible.

**Durable order confirmation and internal tracking:** Customers can open `/account/orders/:orderId`; owners and staff have matching detail routes. Details include order reference, creation date, line quantities/unit prices/totals, fulfillment, contact/address, method, payment state, total, history link and recorded events. Tracking changes only through authorized actions. No courier locations, tracking numbers or shipment events are fabricated.

**Authorized order lookup and checkout recovery:** `GET /api/orders/:id` supports safe confirmation/recovery. It returns 404 for another customer's order and requires authentication. Checkout uses the existing IndexedDB storage and server idempotency rather than a second cart or order system.

## E. Complete system workflow

1. Open the landing page, register or sign in, and use the existing email confirmation process where configured. Privileged requests still require owner approval.
2. Browse/search/filter/sort products, open details or quick view, add items, and adjust or remove quantities within stock limits. Authenticated carts persist across sessions.
3. In Cart, choose pickup or local delivery, supply contact details/address, choose an available payment method, review, and explicitly confirm. The backend calculates product prices and atomically reserves stock, creates the order/payment/event and clears the accepted cart.
4. Counter cash opens persistent confirmation while awaiting staff collection. Digital methods open clearly labeled simulations supporting failed, pending and successful outcomes. Successful demo payment creates one simulated receipt. COD opens persistent confirmation and remains unpaid.
5. Customers view history, confirmation and internal tracking. Staff prepares paid counter/digital orders, then marks them ready for pickup or out for delivery, then Completed. COD can be prepared unpaid; staff records cash collection at delivery to complete it.
6. Initial unpaid orders can be cancelled, restoring reserved inventory once. Paid cancellation remains blocked pending a separate refund workflow. Receipts and order state persist after refresh and subsequent sign-in.

## F. Testing results

These are observed executions from this audit, not the historical September reports. Browser results/screenshots are under `artifacts/`; temporary live fixtures were cleaned up by their suites. Store settings mutation was excluded by default.

| Test case | Expected result | Actual result | Status |
| --- | --- | --- | --- |
| Navigation scroll | Destination starts at top; history and anchors work | 13 isolated Edge checks passed, including mobile, query preservation, deep refresh and no uncaught exceptions | PASS |
| Registration lifecycle | Correct role isolation, hashed passwords and retained history | Four rollback-based database scenarios and 26 live auth/connection browser checks passed; email delivery intercepted | PASS |
| Login | Authorized customer/staff/owner access | Temporary test owners, staff and customers authenticated in live API/browser suites | PASS (fixtures) |
| Configured production owner | Existing configured account reaches `/owner` | Production API/database started; owner login timed out before reaching `/owner`; live role check found no active owner | BLOCKED |
| Product browsing | Catalog, details, images, filters and empty states work | Existing 110-check mock suite and live checkout product navigation passed | PASS |
| Add to cart | Quantity/state persist, stock enforced | API and browser tests passed; no overselling in concurrent checkout | PASS |
| Checkout | One accepted order with stock/cart consistency | API confirmation/price validation passed; two concurrent references for one cart version returned one 201 and one 409, leaving one order and one stock deduction | PASS |
| Payment | Cash and demo states remain consistent | All four digital methods, pending/failure/retry, counter cash and COD passed | PASS |
| Order confirmation | Details survive refresh | Persistent details and mobile viewport verified | PASS |
| Order history | Owned order/payment/events persist | List/detail ownership and final event/payment assertions passed | PASS |
| Order tracking | Only authorized valid transitions | Staff pickup and delivery flows passed; skipped steps and customer progress rejected | PASS |
| Admin management | Product/order/payment management works | Temporary owner/staff workflows passed; real owner access remains blocked as above | PASS (fixtures) |
| Transaction retries | One operation and changed-input rejection | Concurrent POS and stock requests, counted adjustment retry, changed payloads passed | PASS |
| Lint | No lint errors | `npm run lint` completed successfully after application changes | PASS |
| Type check / build | Existing production bundle builds | `npm run build` passed; existing large-chunk warning remains (~829 kB main JS before gzip) | PASS |
| Prisma | Current schema validates | `npm run db:validate` passed; no migration applied | PASS |
| Unit tests | Business/input/storage/network regressions pass | 10 frontend + 19 backend tests passed | PASS |
| Integration tests | API/database and signup consistency | Expanded main suite: 37 tests passed; later targeted retry suite: 1 passed (38 observed across both runs) | PASS |
| Checkout browser suite | Customer, wallet, cash, COD and staff integration | 39 checks passed | PASS |
| Live system browser suite | Inventory, cross-session carts, orders, POS, reports, people and access restrictions | 26 checks passed; shared settings loaded without mutation | PASS |
| Authentication browser suite | Signup, confirmation tokens, role approval, owner handover, password changes and outage recovery | 26 checks passed using temporary accounts; no email delivery claimed | PASS |
| Browser storage quota | Login/session/logout work without clearing saved local data | All 5 full-localStorage/IndexedDB browser checks passed | PASS |
| Mock browser suite | Existing features preserved | 110 checks passed | PASS |
| Supabase configuration | Tables, RLS, Storage, Auth and Realtime available | Read-only connectivity check passed outside network-restricted sandbox | PASS |
| Real SMTP delivery | Confirmation/reset messages arrive in an actual mailbox | Delivery was deliberately intercepted; real tokens were verified without sending messages | NOT TESTED |
| Natural token expiry | An actually expired access token refreshes or signs out correctly | No wait for real token expiration was performed; logout, disabled accounts and session reload were exercised separately | NOT TESTED |

The completion addendum records the additional live checks and final cleanup verification. Across the suites, 219 browser/service checks, 29 unit tests and 38 integration tests passed; the configured-owner production startup check remains blocked as described above.

## G. Files modified or created in this audit

Paths below are relative to the repository. This list describes this audit's edits; other modified/untracked files were already present.

| File | Reason |
| --- | --- |
| `frontend/src/app/router.tsx` | Global restoration and protected customer/staff/owner detail routes |
| `frontend/src/index.css` | Instant default route scrolling |
| `frontend/src/components/navigation/PublicNavbar.tsx` | Safe fragment lookup |
| `frontend/src/components/checkout/PaymentMark.tsx` | Cash icon for COD |
| `frontend/src/components/inventory/StockAdjustmentModal.tsx` | Stable retry reference for unchanged form contents |
| `frontend/src/pages/dashboard/OrderDetailsPage.tsx` (new) | Persistent confirmation and internal tracking |
| `frontend/src/pages/dashboard/OrdersPage.tsx` | Detail links, COD handling and cash collection |
| `frontend/src/pages/dashboard/RoleDashboardPage.tsx` | Correct active-order count |
| `frontend/src/pages/public/CartPage.tsx` | Durable navigation, uncertain-order recovery and COD selection |
| `frontend/src/pages/public/CheckoutPaymentPage.tsx` | Confirmation link, COD-aware cash instructions, cash/demo labels |
| `frontend/src/pages/public/ProductCatalogPage.tsx` | Preserve query-only scroll context |
| `frontend/src/services/checkout.ts` | COD labels and status helpers |
| `frontend/src/services/checkoutRecovery.ts` (new) | Durable unresolved-order lookup and recovery |
| `frontend/src/services/inventory/inventoryService.ts` | Optional adjustment retry identity |
| `frontend/src/services/remote/apiServices.ts` | Checkout recovery and safe adjustment retry |
| `frontend/src/types/product.ts` | COD order method type |
| `backend/src/app.mjs` | Complete order reads, ownership-checked lookup and adjustment deduplication |
| `backend/src/checkout-rules.mjs` | COD validation/options/transitions |
| `backend/src/orders.mjs` | COD collection and complete creation response |
| `backend/src/commerce.mjs` | Validate existing POS sale on retry |
| `backend/src/validation.mjs` | Effective sale comparison for retry requests |
| `backend/tests/checkout-rules.test.mjs` | COD validation and transition coverage |
| `backend/tests/server-validation.test.mjs` | Changed POS retry rejection |
| `backend/tests/helpers/live-fixture.mjs` | Preserve shared settings by default |
| `backend/tests/integration/checkout.test.mjs` | COD, concurrency, ownership and order representation checks |
| `backend/tests/integration/commerce.test.mjs` | Opt-in singleton settings mutation |
| `backend/tests/integration/retries.test.mjs` (new) | Concurrent POS/stock retry integration coverage |
| `frontend/tests/verify-navigation.mjs` (new) | Scroll, history, anchor, mobile and refresh regressions |
| `frontend/tests/verify-checkout.mjs` | COD, durable confirmation, lost-response recovery, fixture-scoped actions/reports |
| `frontend/tests/verify-browser.mjs` | Match durable confirmation route |
| `frontend/tests/verify-supabase.mjs` | Match confirmation, preserve settings and scope fixture actions/assertions |
| `package.json` | Expose `test:navigation` |
| `README.md`, `docs/demo-checkout.md` | Current behavior and test safety notes |
| `docs/system-audit-2026-11-06.md` (new) | Architecture, fixes, test evidence, file list and limitations |

## H. Remaining limitations

- **Real owner access:** The configured production owner did not reach its workspace; the read-only live Auth-role summary had one staff and two customers, with no active owner. Existing profiles/privileges were not changed. An authorized operator must designate and approve the intended owner account before an ordinary live admin demonstration. No credentials are included here.
- **Real payments and courier integration:** Digital collection remains simulation-only. No merchant onboarding, verified real-provider callbacks, refunds or live courier tracking is claimed. Actual payment tests were not performed.
- **Email delivery:** Supabase signup/confirmation can be tested with real generated confirmation tokens while delivery is intercepted. This does not prove public SMTP delivery works.
- **Reservations/refunds:** Abandoned unpaid reservations still require manual cancellation. Cancellation after preparation and paid refunds need separate business rules and implementation; existing restrictions are retained.
- **Pricing policy:** Existing online checkout has zero extra shipping/tax charges in this demonstration. POS tax/discount override policy was not changed; staff requests remain bounded by existing validation. Owner policy should be agreed and enforced before business deployment.
- **Scale and operations:** Snapshot-based full-history synchronization, the latest-50 notification window, lack of cash shifts/receiving/refund modules, deployment/backups, hardware camera/receipt-printer behavior and load testing remain outside the verified academic demo flow.
- **Warnings:** Vite reports a large production chunk; pg emits a deprecation warning for concurrent queries inside Prisma transactions. Checks passed, but these remain maintenance items.
- **Test environment:** Live suites used isolated accounts/products in the configured project, rather than a separately provisioned database. Existing commerce records were preserved; singleton settings write tests were intentionally excluded unless explicitly opted in.
- **Backward-compatible adjustment API:** Retry protection applies when an adjustment supplies `requestId`; the current UI supplies it. Legacy callers omitting this optional field retain the earlier behavior and should adopt retry identities before automatically replaying writes.

## Completion addendum

- Live system browser suite: 26/26 checks passed.
- Authentication/connection browser suite: 26/26 checks passed, including real Supabase signup/confirmation tokens, hashing, approved staff/owner access, handover, password change and recovery from a simulated service outage. Delivery was intercepted; no real email delivery is claimed.
- Full-localStorage/IndexedDB suite: 5/5 checks passed for login, reload persistence and logout without clearing unrelated local records.
- Final retry integration rerun passed after adding cart-version validation: two different order references submitted concurrently for one cart version returned 201 and 409, with one order, cleared cart, and one stock deduction. POS and stock retry checks passed in that same run.
- Final lint, TypeScript/production build, all 29 unit tests, and Prisma validation passed. No schema change was required. `git diff --check` was clean.
- The production startup suite passed API/database startup, then exited unsuccessfully when the configured owner did not reach `/owner`. Subsequent configured staff/public checks in that particular script were not reached. This environment blocker was not hidden by the passing temporary-owner suites.

- Final checkout rerun: all 39 checks passed with cart-version protection enabled, including all four digital methods, COD, receipts, cancellation, reporting, mobile details and recovery after a dropped order response.
- Final read-only database/configuration check passed: all 18 tables/RLS, Auth, Storage and Realtime verified. Counts matched the pre-test baseline exactly: 12 products, 12 categories, 2 orders, 1 sale, 1 payment, 7 profiles and 3 Auth accounts. Both application and Auth temporary-test-account counts were zero.
- The final role summary still contained one staff and two customer accounts, with no active owner. No owner privileges were assigned to an existing account during this audit.
- Frontend and backend `.env.local` files were not modified. Existing uncommitted work remains in place; no Git reset or commit was performed.
