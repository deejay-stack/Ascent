# Customer payments and order fulfillment

The Supabase application supports a complete **demonstration** of digital checkout, plus staff-confirmed cash at the counter. Digital demonstrations do not contact a payment provider or move money.

### November 6, 2026 workflow additions

Local delivery now also offers **Cash on delivery (COD)**. It is disabled for store pickup. A COD order starts unpaid; staff selects **Start preparing**, then **Mark out for delivery**, then **Record COD collection**. Collection requires sufficient cash and atomically records one cash receipt and marks delivery Completed. Customers cannot record payment, and staff cannot mark a COD order Completed through the ordinary progress endpoint. Counter payment retains its existing pay-before-preparation behavior.

COD uses the existing records without a migration: `orders.payment_method=cod`, `payments.method=cash`, `payments.provider=cash_on_delivery`, and cash receipts in `sales`. Digital methods remain explicit simulations gated by `ENABLE_PAYMENT_DEMOS`.

Order confirmation and internal status history are available at `/account/orders/:orderId`, including after refresh. Staff and owners can open corresponding details from their Orders pages. `GET /api/orders/:id` and the Orders list include payment and status events and enforce ownership for customers.

Checkout keeps an unresolved attempt in the existing IndexedDB storage. If the acceptance response is lost, the application looks up that order before retrying; reloading Cart also recovers an accepted order. Browser checkout also supplies a cart version, checked in the transaction, so two sessions cannot submit the same cart using different order references. POS rejects a transaction reference reused with different effective sale details. Stock-adjustment requests carry retry references, and the API deduplicates them in its existing serializable transaction.

Live tests leave shared store settings unchanged by default. Only use `ASCENT_TEST_STORE_SETTINGS=true` on an isolated development store if testing writes to the singleton settings record. Temporary fixture accounts, products, orders, payments, and receipts are cleaned up after each live suite.

See [the November system audit](system-audit-2026-11-06.md) for current results and limitations. `npm run test:navigation` runs isolated mock browser checks for route scrolling and history.

## Try the process

1. An owner creates available products and opening stock in Inventory.
2. A customer adds products to their cart, supplies contact details (and an address for delivery), and selects GCash, Maya / PayMaya, PayPal, QR Ph / digital banks, or cash at the counter.
3. **Review order** displays a confirmation dialog. Stock is reserved and the order is created only after the customer confirms.
4. Digital methods open a clearly labeled demo screen. Use the successful, pending, or failed payment controls to demonstrate each outcome. Official GCash, Maya, and PayPal icons are stored locally; QR Ph / digital banks uses a generic bank icon. No wallet password, PIN, OTP, bank account, or card details are collected.
5. A successful demo payment creates one payment receipt and marks the order **Paid**. Failed and pending payments remain unpaid and can be retried from My orders. Duplicate confirmations do not create another sale or deduct stock again.
6. For cash, staff opens Orders and selects **Receive counter payment**, enters the amount received, checks the change, and confirms cash collection. The payment receipt identifies the staff member.
7. Staff moves a paid order through **Preparing → Ready for pickup / Out for delivery → Completed**. Payment and fulfillment are separate steps.

Customers and active owner/staff accounts receive persistent in-app notifications for order creation, payment changes, cancellation, and fulfillment. The bell opens recent updates; selecting an update marks it read. Supabase Realtime refreshes connected sessions. These are in-app updates, not email or OS push notifications.

Unpaid orders can be cancelled from Orders; cancellation restores reserved stock once. Paid orders cannot be cancelled through this flow. Refund handling and automatic expiration of abandoned reservations are not implemented; staff must cancel abandoned unpaid orders.

## Demo configuration and business handover

`backend/.env.local` currently enables digital demonstrations with `ENABLE_PAYMENT_DEMOS=true`. Set it to `false` and restart the API to disable digital demo checkout; cash remains available. Demo receipts are labeled and stored with `is_demo=true`. Reports exclude them by default; **Include demo payments** explicitly includes them. Demonstrations still reserve real inventory in the configured database, so use a development store for demonstrations.

`backend/.env.example` contains empty future integration templates:

```dotenv
PAYMONGO_SECRET_KEY=
PAYMONGO_WEBHOOK_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_ENV=sandbox
PAYMENT_PUBLIC_URL=
```

**Adding credentials alone does not activate real collection.** Before business deployment, implement and test provider checkout creation, verified webhooks, matching currency/amount/order references, payment reconciliation, refunds, reservation expiry, and provider sandbox-to-live configuration. The current payment event ledger deduplicates local demo callbacks; it is not a public provider webhook endpoint. Never expose secret keys in frontend configuration.

See [business handover](business-handover.md) for account transfer, and [real accounts](real-accounts.md) for registration and role approval. Existing user credentials remain managed by Supabase Auth.

## Database and checks

The checkout migrations add order contact/payment details, demo flags, provider reference placeholders, `order_events`, `notifications`, and `payment_webhooks`, plus fulfillment status constraints. The database has 18 application tables. These new tables use RLS and do not grant direct browser access; authorized API routes enforce roles and record ownership.

```sh
npm run db:migrate
npm run db:generate
npm run test:unit
npm run test:integration
npm run test:system
npm run test:checkout
```

The checkout browser suite uses isolated temporary accounts and products, API port 4196, frontend port 5196, and Edge debug port 9583. It checks all wallet choices, explicit order review, failed/pending/successful payment, staff notification and read state, fulfillment, customer receipt, cash/change, cancellation, report filtering, and mobile layout. Results and screenshots are written to `artifacts/checkout/`. Run live test suites sequentially because they share store settings; test fixtures are removed afterward.

Verified on September 16, 2026: build, lint, Prisma validation, 27 unit tests, 36 integration tests (including suite totals), 31 checkout browser checks, 26 Supabase system checks, 110 mock regression checks, and 8 production startup checks passed. The final database check verified all 18 tables with RLS, Realtime, Storage, and three active Auth accounts (owner, staff, customer), with no temporary test accounts remaining. Existing products and the earlier unpaid order were retained.

The first integration run exposed an older database constraint that rejected intermediate fulfillment statuses. Migration `202609160001_order_fulfillment` fixes that constraint; apply both checkout migrations when upgrading an existing installation. Digital confirmations, duplicate callbacks, and counter collection passed after the fix.
