# Phase 1 inspection

The repository root is the frontend (no nested `frontend/`). Assets belong in `public/images/`.

- Routes: home, products, product details, about, cart, login, register, password recovery; account/orders/profile; staff/orders/inventory/POS/profile; owner/orders/inventory/POS/people/reports/settings; error pages.
- Layouts: PublicLayout, CustomerLayout, StaffLayout, OwnerLayout and DashboardShell.
- Components: landing hero, editorial introduction, categories, featured products, feature tabs, sticky story, FAQ, navigation, loader and motion primitives; ProductCard and ProductVisual.
- State/types: AuthContext, CartContext, ThemeContext and associated hooks; auth, product/order and role types. Services: `services/api.ts` only.
- Backend: Node HTTP server, JSON persistence, authentication/session/recovery, product reads and customer order routes. No Express, Prisma or Supabase configured.

## Findings before editing

- WorkspacePage is a placeholder for POS, inventory, owner orders, reports, people, profiles and settings.
- RoleDashboardPage has hard-coded statistics for every role.
- Catalog has basic search/category/sort but lacks price/availability filters, quick view, pagination and a filter drawer.
- Product visuals are icons/initials; landing featured items duplicate backend data.
- Cart additions have no stock check; details can attempt out-of-stock purchases. Persistence is scattered through cart handlers.
- Existing visible buttons have handlers. Placeholder modules have no workflows. Auth and newsletter forms validate/submit; recovery is a backend demonstration without email delivery.
- Preserve authentication, customer order history, public animations and theme support.

## Sequence

1. Shared types, grocery seed, local illustrations, persistence adapter and service contracts.
2. Stock-aware shopping and POS, payment simulations, receipts and atomic mock stock updates.
3. Inventory, reports and calculated dashboards.
4. Service and browser workflow tests, responsive checks, lint and build.

Keep the backend intact. New commerce uses browser-local development services; authentication and historical backend orders remain available. Database integration is a separate phase.
