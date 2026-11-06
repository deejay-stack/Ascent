# ASCENT project review and completion plan

Reviewed: October 12, 2026 (Asia/Manila).

## Assessment and release target

ASCENT has an implemented commerce foundation: separate frontend/backend workspaces, Supabase authentication and roles, owner product management, stock movements, persistent carts, checkout confirmation, cash collection, digital payment demonstrations, order fulfillment, receipts, notifications, and sales reports.

The next milestone should be a **single-store operational release**. Complete transaction recovery, returns, cashier reconciliation, inventory receiving, and deployment verification before positioning it as ready for ordinary business use. Keep digital payments explicitly simulated until a merchant integration is separately implemented and accepted. A cash-only business pilot can proceed without live wallets once the other release gates pass.

This review inspected source, schema, migrations, scripts, tests, and saved test artifacts. It did not change application behavior, inspect private secret values, migrate the database, or run tests that write to Supabase.

## Verification performed now

| Check | October 12 result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run build` | Passed; largest JavaScript chunk approximately 821 kB before gzip, 237 kB gzip; bundle-size warning remains |
| `npm run test:unit` | Passed: 10 frontend + 17 backend tests |
| Live integration, browser, SMTP, deployment | Not rerun in this review |

Saved checkout, system, startup, and mock browser reports date to September 16 in Philippine time. They are useful regression coverage, but do not prove the live environment is healthy today. Public email delivery was previously unconfigured; current Supabase dashboard settings were not inspected.

## Findings that drive the next work

| Finding | Evidence | Consequence / action |
| --- | --- | --- |
| Customer active-order count only includes `Awaiting payment` | `frontend/src/pages/dashboard/RoleDashboardPage.tsx:50` | Include Paid, Preparing, Ready for pickup, and Out for delivery; exclude terminal states. |
| POS tax and discount come from request values | `backend/src/commerce.mjs`, `completeSale`; `backend/src/validation.mjs`, `saleInput` | Define owner policy and enforce it server-side. Current validation bounds values but does not restrict staff overrides according to store policy. |
| POS retry reference checks the cashier, without comparing the original request contents | `backend/src/commerce.mjs`, existing-sale branches | Reject reuse of the same transaction ID with a changed basket or payment details; retain safe retries for identical requests. |
| Stock adjustments have no persisted retry reference | `backend/src/app.mjs`, `/api/inventory/adjustments` | A retry after a lost response can apply another adjustment. Add an idempotency key and payload comparison. |
| Unpaid orders reserve stock until manually cancelled | `backend/src/orders.mjs`; Order model | Add configurable reservation expiry and an idempotent worker; test payment-versus-expiry races. |
| Paid cancellation is rejected and directs users to a refund review that has no module | `backend/src/orders.mjs:242`; schema has no refund/return models | Implement returns and refunds without deleting original sales. |
| Cashier sessions and cash movements are not modeled | `backend/prisma/schema.prisma` | Add opening float, cash-in/out, closing count, and discrepancy review. |
| Receiving is currently a manual stock adjustment | Product and InventoryMovement models | Add supplier deliveries and receiving documents; trace purchase cost and shortages. |
| Sale items preserve selling prices but not cost at sale | `backend/prisma/schema.prisma`, SaleItem | Historical gross profit cannot be reliably reconstructed using today's product cost. Introduce cost snapshots before profit reports. |
| Most commerce records are loaded into one snapshot | `backend/src/commerce.mjs:53`; `frontend/src/components/CommerceSync.tsx` | Full history is fetched on refresh/Realtime and every 30 seconds. Add bounded endpoints and server-side summaries for growing stores. |
| Notification count uses only the latest 50 loaded notifications | `snapshot`, `OrderNotifications.tsx` | Fetch a separate total unread count and provide paginated history/mark-all-read. |
| Digital collection is intentionally demo-only | `checkout-rules.mjs`, `orders.mjs`, `docs/demo-checkout.md` | Merchant credentials alone do not enable payment collection. Keep this boundary visible. |
| Online checkout currently calculates zero tax and has no delivery charge | `backend/src/orders.mjs`, totals call; CartPage | Specify consistent pricing, tax, delivery area, fee, and pickup rules before business use. |
| No repository CI workflow or deployment manifest was found | Root file scan; no `.github/` directory | Add repeatable checks, deployment configuration, release and rollback instructions. External hosting configuration remains unverified. |
| Store configuration is a singleton; records have no tenant/store ownership field | `backend/prisma/schema.prisma`, StoreSettings | Current design is single-store. Do not put unrelated businesses in one database without tenant isolation. |

`ProductImage.tsx` already resolves retired image paths, uses a failure fallback, supplies alt text and dimensions, and lazy-loads images. Preserve it. Image compression, responsive sources, missing product photos, and above-the-fold loading can be handled during performance work.

## Execution stages

### Stage 1 — Transaction correctness and release baseline (start here)

1. Review and preserve the existing modified/untracked checkout files; establish a reviewed Git baseline before larger refactoring.
2. Correct active-order counts and centralize payment/fulfillment status definitions and labels.
3. Make POS tax settings authoritative on the server; define discount permissions, approval limits, and rounding behavior. Align online checkout pricing with the approved policy.
4. Add request hashes/idempotency records for POS and stock adjustments. Validate checkout recovery when the response is lost while Realtime clears the cart; do not assume a UI retry reference alone covers that scenario.
5. Extract focused route modules from `backend/src/app.mjs` without changing behavior. Retain the existing frontend/backend split; it is already correct. Review apparently old components by imports before removing anything.
6. Add a staging-only test configuration and CI checks for lint, build, schema validation, and unit tests. Configure live regression runs separately with protected secrets and isolated fixtures.

Acceptance: changing tax/discount requests cannot bypass approved rules; repeated identical writes create one operation; reused references with changed payloads are rejected; paid in-progress orders remain active in the dashboard; existing regressions pass.

### Stage 2 — Order recovery, reservation expiry, returns and refunds

Build reservation expiry first, followed by returns. Proposed additions: Order reservation expiry metadata, Return/ReturnItem, Refund, and a durable audit record. Names and exact schema should be finalized when implementation begins.

- Let the owner configure unpaid reservation duration, with clear customer/staff deadlines.
- Run a scheduled worker that expires only eligible unpaid orders and restores stock once. Record system actions and publish order updates.
- Add an overdue/failed-payment queue so staff can resolve interrupted checkouts.
- Add full/partial returns with reason, original sale-line references, remaining refundable quantity, and disposition: restock, damaged, or discard.
- Require appropriate approval for refunds; record payment outcome independently of return approval. Preserve original receipts and price history.
- Support recorded cash refunds first and simulated digital refunds for demos. Provider refunds belong to the live-payment stage.
- Define delivery areas/fees and collection policy, including whether delivery must be prepaid. The current counter option is not cash-on-delivery.

Acceptance: concurrent payment/expiry produces one valid outcome; retries never restore stock twice; refunds never exceed the paid amount or remaining returnable quantity; damaged returns do not re-enter sellable stock; sales reports show refunds separately and calculate net totals correctly.

### Stage 3 — Cashier shifts and daily closing

Proposed additions: CashSession and CashMovement; link cash sales, counter collections, and cash refunds to the responsible open session.

- Open a shift with cashier/register and opening float.
- Record cash-in/out with reason and authorization.
- Close with expected cash, counted cash, difference, and explanation.
- Give the owner a reviewable daily closing report; preserve closed sessions.
- Define staff access to historical sales and manager approval for discounts, refunds, and significant stock corrections. Add audit entries for role, price, and settings changes.

Acceptance: expected closing cash equals opening float plus recorded cash receipts and cash-in, less cash refunds and cash-out; digital/demo payments do not inflate expected cash; closing is idempotent and prevents unapproved later changes.

### Stage 4 — Purchasing, receiving and useful business reports

Proposed additions: Supplier, PurchaseOrder/Item, GoodsReceipt/Item, and sale-line cost snapshots. Add inventory lots/expiry dates if the first business handles perishable stock; support physical quantities separately from reserved/available quantities if its counting process requires it.

- Receive deliveries against purchase orders, including partial/short deliveries and cost differences.
- Support counted-stock sessions, damage/spoilage reasons, and reorder suggestions using existing low-stock thresholds.
- Add a validated bulk product import with preview/error report; use a separate import workflow rather than resetting live inventory.
- Snapshot cost when a new sale is posted; clearly mark unavailable historical cost instead of inventing it from current prices.
- Report gross sales, discounts, tax, refunds, net sales, cost of goods sold, gross profit, and inventory value with defined calculations.
- Provide owner-authorized CSV exports with date/payment/source filters. Protect exported cells from spreadsheet formula injection.

Acceptance: repeat receiving cannot duplicate stock; receiving updates quantities/cost consistently; later product-cost changes do not rewrite historical profit; report totals reconcile to sales, returns, and closing records.

### Stage 5 — Production readiness, performance and usability

- Configure a verified SMTP sender and HTTPS Auth redirects; test real signup, confirmation, and reset links through an actual inbox. Prior admin-generated test links do not validate email delivery. Supabase's default SMTP is not intended for general production email. [Official SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).
- Define separate development/staging/production configuration. Fail startup clearly for invalid production mode; make demo collection impossible to enable accidentally in the business environment.
- Review secret handling and rotate any server credentials previously shared in chat before handover. Keep passwords in Supabase Auth, not public profile tables.
- Configure security headers/CSP, deployment proxy trust, request limits, structured redacted logs, uptime/error monitoring, and database pool limits for the chosen host.
- Replace unbounded history snapshots with paginated catalog/orders/sales/movements endpoints and server-side report aggregates. Coalesce Realtime invalidations and monitor refresh failures.
- Lazy-load major routes and the scanner where useful; optimize supplied images. Test large catalogs and long histories, not just empty fixtures.
- Improve order search/status filters, notification history, keyboard navigation, focus/error handling, loading states, and mobile POS/orders. Keep checkout usable when requests fail.
- Document backup retention and rehearse restoration into a separate environment, including product image files. Database backups do not include the actual Storage objects. [Official backup guidance](https://supabase.com/docs/guides/platform/backups).
- Test the intended barcode scanner, receipt printer, receipt width, and store network. Define online-only operation clearly; offline sales need a separate reconciliation design.

Acceptance: an independent user can register/recover access; staging deploys reproducibly; restoration recovers usable records and images; an agreed realistic data/load profile stays responsive; no cross-role data exposure; mobile and hardware acceptance passes.

### Stage 6 — Business pilot and handover

Run a controlled full trading-day exercise with the future owner and staff: opening float, delivery receiving, POS cash sale, online order, fulfillment, cancellation, return/refund, stock count, closing cash, and report export. Inject a connection interruption and confirm recovery without duplicate records.

Deliver operating instructions, a role/approval matrix, support contacts, environment inventory, backup/restore procedure, release notes, and account/infrastructure transfer instructions. Owner acceptance must include data accuracy and recovery behavior, not only screenshots. Do not reset historical transactions to make the demo look clean.

For selling the first installations, use a separate deployment and Supabase project per business as the initial design recommendation. A shared multi-business service is a later project requiring tenant-scoped membership, queries, constraints, RLS, file paths, billing, migrations, and cross-tenant security tests. Multiple branches also need explicit modeling.

## Optional live-payment stage

Proceed only when the business wants actual electronic collection and has merchant access. Start with one provider and complete its lifecycle before adding another: hosted checkout, signed webhook verification, amount/currency/order matching, callback deduplication, reconciliation, late-payment handling, refunds, and operational alerts. Test provider failure and delayed/out-of-order callbacks before live activation. Provider fees, supported methods and onboarding must be checked against current provider documentation at implementation time.

Keep demo and real records unmistakably separate. Do not treat adding `.env` values or a return-to-site redirect as confirmation of payment.

## First development batch

| Order | Work item | Completion evidence |
| --- | --- | --- |
| 1 | Git baseline, staging test configuration, CI | Reviewed changes preserved; checks run without modifying a trading database |
| 2 | Active-order counts and shared status helpers | Tests cover every active and terminal status |
| 3 | Server pricing/discount policy | Manipulated requests and rounding tests pass |
| 4 | POS/stock adjustment idempotency and lost-checkout-response recovery | Duplicate, changed-payload, concurrent and dropped-response cases pass |
| 5 | Reservation deadline and expiry worker | Paid/expired race test, exactly-once restoration, customer/staff UI |
| 6 | Cash returns/refunds, then shift closing | Original sale preserved; refund and closing totals reconcile |

Estimate effort after the store policies and acceptance data are agreed. Finish each batch with targeted tests, then the relevant staging integration/browser suite; sequence suites that temporarily change store settings. Avoid promising a deployment date based solely on the number of existing screens.

Defer loyalty points, coupons, advanced analytics, a mobile app, shared multi-tenant hosting, and full offline POS until the single-store release passes these gates. They are useful later enhancements, not prerequisites for completing the current commerce foundation.
