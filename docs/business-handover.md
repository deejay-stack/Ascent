# Business accounts and handover

## Accounts created for this installation

| Access | Email | Initial password location |
| --- | --- | --- |
| Owner / admin | djaybernadas+owner@gmail.com | `backend/.env.local` → `ASCENT_OWNER_PASSWORD` |
| Staff | kogakuchiki19@gmail.com | `backend/.env.local` → `ASCENT_STAFF_PASSWORD` |
| Existing customer | djaybernadas@gmail.com | Existing customer password, unchanged |

The owner uses a separate email alias to keep your customer identity and history intact. These are real Supabase Auth users with matching application profiles. Each operator has a different randomly generated initial password. Password hashes live in Supabase Auth; the application profile contains the role, never a password.

Run `npm.cmd run dev` and open `http://localhost:5173/login`. Copy the corresponding password from the private environment file. After signing in, open **Profile → Change password** and set a personal password of at least 12 characters. The owner manages People, inventory and settings; staff use the staff workspace for store operations. Access is checked by the API as well as the page routes.

These initial accounts were provisioned directly and can sign in without a confirmation email. Public registration and email recovery still require working email delivery. Configure custom SMTP in Supabase before onboarding real customers; its default sender only delivers to project-team addresses. See [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp) and [this project's email setup](real-accounts.md).

## Change your own account

- **Password:** Profile → Change password. If signed out, use the sign-in page's password recovery flow after SMTP is configured.
- **Name or email for the same person:** Profile → edit → Save profile. Complete any requested email confirmations. The account ID and historical records remain associated with that person.
- **Environment variables:** Editing `ASCENT_OWNER_PASSWORD` or `ASCENT_STAFF_PASSWORD` does not change an existing user's password. They are initial setup inputs. The seed script does not reset an existing Auth password.

Do not rename a former employee's identity to give it to a different person. Create a new account for the replacement so historical receipts and activity remain attributable to the original operator.

## Replace the owner of an existing store

1. Configure SMTP and the deployed site's Auth redirect URLs. The incoming owner registers with their own email and password, selects **Admin / owner**, and confirms their email.
2. The current owner opens **People**, finds the incoming owner's request, verifies who they are, and selects **Approve admin**.
3. The incoming owner signs in again, checks that Inventory, People, reports and settings are accessible, and confirms the store's records are present.
4. While signed in as the **incoming owner**, open People, find the outgoing owner and select **Disable access**. The API blocks further application requests from the disabled account, including requests using an existing session. The profile and historical business records remain stored.
5. Remove the outgoing operator's bootstrap variables from the deployment and any setup copies. Do not rerun `db:seed` with the old owner's email: bootstrap intentionally grants and enables the configured operator roles. Account administration after setup belongs in People.

The app prevents disabling your own owner account and prevents removal of the last active owner. Another active owner can restore disabled access through People if needed. Disabling app access does not revoke Supabase dashboard, hosting, database or repository access; transfer those separately below.

## Replace staff

Have the new employee register as **Staff**, confirm their email and choose their own password. The owner approves the staff request in People. Alternatively, **People → Create staff account** lets the owner provision a confirmed account with a temporary password; deliver that password privately and have the employee change it after signing in.

Once the replacement signs in successfully, disable the outgoing staff account in People. Do not delete their sales or change historical cashier IDs. Use a separate account for each employee.

## Install for a different business

This version stores one business per database. It has no tenant isolation for unrelated businesses. Each buyer needs a separate Supabase project and deployment. Do not reuse your development database or another customer's database for a new business.

1. Create the business's Supabase project under an organization they control. Configure their frontend public URL/key in `frontend/.env.local` and their server credentials and database pooler URLs in `backend/.env.local`, using the `.env.example` files as templates. Use the new project's TLS certificate if required by its certificate chain. Keep server keys out of all `VITE_` variables.
2. For initial provisioning only, set `ASCENT_OWNER_*` and `ASCENT_STAFF_*` to that business's operator details, with unique temporary passwords of at least 12 characters. Never copy the current installation's operator credentials to another customer.
3. From the repository root, install dependencies and run:

   ```sh
   npm install --legacy-peer-deps
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   npm run db:check
   npm run build
   npm start
   ```

   `db:seed` without `--demo-catalog` provisions the configured operators, categories, image bucket and store settings without inserting sample products or stock. It preserves existing records.

4. Configure the deployed HTTPS site URL and `/auth/callback` and `/reset-password` redirects in Supabase Auth; configure and verify custom SMTP. Have both operators change their initial passwords, then remove bootstrap password variables from the production runtime environment. Keep runtime database and Supabase server credentials configured.
5. The owner enters the actual store details, products, prices and counted opening stock. Verify a full sale, receipt, stock adjustment, customer order, cancellation and daily report in a separate staging installation first. Configure backups and verify recovery before taking live transactions.

Run the mutating integration/auth/system test suites against development or staging. Although their uniquely named records are cleaned up, some suites temporarily modify settings; they are not intended to run during real trading. The startup test is read-only but requires the configured operator passwords to match their current Auth passwords.

Cash workflows are implemented. GCash, Maya and card demonstrations remain disabled by `ENABLE_PAYMENT_DEMOS=false`; collecting those payments requires a real merchant provider integration. Printer/scanner hardware, email delivery, hosting and backup recovery must be verified for each deployed business. Passing development tests does not substitute for that deployment acceptance.

## Transfer the hosted installation as well as app access

For a sale of the existing store installation, transfer the actual Supabase project to the business's organization using the project's general settings. Supabase requires ownership of the source organization and membership in the destination organization, with additional prerequisites documented in [Project Transfers](https://supabase.com/docs/guides/platform/project-transfer). Review plan differences and potential downtime before scheduling the transfer.

Transfer or grant the business ownership of the hosting account, domain, source repository, SMTP provider, billing and any merchant account. Confirm the business can deploy, administer users and recover a backup. Replace server secrets and database credentials during a coordinated deployment, verify the app still works, then revoke the outgoing developer's infrastructure access if ongoing support was not agreed. Do not ship personal `.env.local` files in the source-code handover.

For multiple customers, repeat the separate-project setup. Supporting multiple unrelated businesses inside one shared application/database would require a separate tenant-isolation implementation.
