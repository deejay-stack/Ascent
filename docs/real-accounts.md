# Real accounts and connection recovery

Live sign-in uses each person's email and password. The form no longer fills demo credentials or lets a role selector determine access. Supabase Auth stores password hashes in `auth.users`; `public.profiles` stores the linked ID, name, email, approved role, active status and optional `requested_role`. Passwords are never copied into the public profile table.

## Register and approve access

1. Open `/register`, choose Customer, Staff, or Admin / owner, and enter a name, email and matching passwords of at least 12 characters.
2. Confirm the email using the Supabase confirmation link, then sign in.
3. Customer accounts can shop immediately after confirmation. Staff/admin requests initially have customer permissions and show a pending message.
4. An existing owner signs in and opens **People**, checks the person's identity, then selects **Approve staff**, **Approve admin**, or **Decline request**. The applicant signs in again to enter the approved workspace.

The existing configured owner account remains the initial approver. Do not run the bootstrap repeatedly to manage people; use the application. Public signup metadata cannot grant roles. Only an authenticated active owner can approve a pending request, and the server selects the stored requested role rather than accepting a replacement role from the browser.

## Email delivery still needs configuration

The project owner confirmed that custom SMTP is not configured. Supabase's default mail service only sends to project-team addresses, so arbitrary real customers cannot complete email confirmation or receive password-reset emails yet. See [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

In Supabase Authentication settings, configure a verified sender address/name and your email provider's SMTP host, port, username and password. Enter these in Supabase's custom SMTP settings; they do not belong in frontend configuration. Keep email signup enabled and email confirmation required.

In Authentication → URL Configuration, set the Site URL to the application origin and allow these redirects for local development:

```text
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
http://localhost:4174/auth/callback
http://localhost:4174/reset-password
```

If you open the app using `127.0.0.1`, add those exact origins too. For deployment, add the actual HTTPS origin and both paths. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls). After configuring delivery, verify signup and recovery using an inbox you control.

## Connection changes

The running API initially returned HTTP 500 after its database connection timed out; a later request succeeded. Runtime queries now use Supabase's transaction pooler (port 6543, `DATABASE_URL`), while migrations use the session pooler (port 5432, `DIRECT_URL`) so migration advisory locks retain their connection. The pool keeps idle connections longer, uses TCP keepalive and allows 20 seconds to establish a connection. Snapshot transactions allow 20 seconds instead of the driver's default five seconds. The local pool is limited to five connections per API process. [Supabase's Prisma guide](https://supabase.com/docs/guides/database/prisma) describes the runtime/migration connections.

Browser API calls have a 45-second deadline and reject HTML fallback pages instead of treating them as database responses. Authentication, registration and recovery remain reachable if a catalog request fails. Retry shows a busy state and reloads the snapshot. Temporary Auth service failures return HTTP 503 instead of being misreported as an expired session; existing identity is retained during temporary refresh failures.

A successful empty inventory is tracked separately from an inventory that never loaded. If a later refresh fails, the empty catalog stays visible with a connection notice instead of replacing the whole app with Retry.

Run `npm.cmd run dev` from the repository root to start both frontend and backend. The frontend is at `http://localhost:5173`. For the built app, run `npm.cmd run build` then `npm.cmd start` and open `http://localhost:4174`.

## Verification

`npm run test:auth` passed 26 checks for outage recovery, registration forms, real Auth profile creation/password hashing/confirmation tokens, owner approval, denied self-approval, owner retirement/restoration, denied access with a disabled owner's existing session, and password changes followed by fresh sign-in. To avoid sending test mail, the browser's public signup response is simulated while `auth.admin.generateLink` creates a real Auth account from the submitted form data; the generated token is verified against Supabase. Public SMTP delivery is not tested. Temporary accounts are removed afterward. The report is `artifacts/auth/results.json`.

The operator-account changes passed 19 unit tests, eight production startup/empty-catalog recovery checks using the configured real owner/staff accounts, lint and the production build. Earlier commerce validation passed 18 live API scenarios, 24 live browser system checks and 110 mock regression checks. All five database migrations are applied. See [Business accounts and handover](business-handover.md) for changing passwords, replacing operators and deploying for a business.

Final checks of the user's running API (`localhost:4174`) and frontend (`localhost:5173`) returned HTTP 200 for health and catalog snapshots. The live catalog remained empty for owner inventory entry. Health responses took approximately 0.1–0.3 seconds and snapshots 0.9–1.7 seconds in that check; external service/network latency can vary.

## Deleted-account signup and storage-quota fixes

After the original Auth accounts were deleted, two profile rows still reserved their email addresses. The resulting `profiles_email_key` violation caused “Database error saving new user.” Migration `202609140002_deleted_auth_profiles` archives orphaned profiles using `auth_deleted_at`, disables their access, and enforces unique email addresses only among current profiles. Hard and soft Auth deletion triggers now archive profiles automatically. Historical orders and actor IDs remain intact; registering again creates a new customer identity and does not inherit the old role or history. Archived profiles are excluded from People.

Supabase sessions now use the `ascent-auth` IndexedDB database rather than localStorage. Existing session keys migrate only after a durable write succeeds. Logout records a tombstone so a leftover legacy token cannot be restored. Inventory, photos, guest carts and unrelated browser data are not deleted. Theme preference writes cannot block the application if localStorage is full.

Follow-up verification: 16 unit tests passed, four database lifecycle regression scenarios passed with complete rollback, and five real browser checks passed with localStorage deliberately filled. The browser checks verified real sign-in, persistence after reload, IndexedDB storage, preservation of existing local data and logout. Run `npm run test:auth-storage` for the quota regression; its report is `artifacts/auth-storage/results.json`.
