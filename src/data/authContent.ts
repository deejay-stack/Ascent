import type { DemoCredential, FeaturePoint } from '../types/auth'

export const demoCredentials: DemoCredential[] = [
  {
    role: 'owner',
    label: 'Owner',
    email: 'owner@ascent.store',
    hint: 'Full access to inventory, orders, staff, POS, and reports.',
  },
  {
    role: 'staff',
    label: 'Staff',
    email: 'staff@ascent.store',
    hint: 'Counter sales, order fulfillment, and stock operations.',
  },
  {
    role: 'customer',
    label: 'Customer',
    email: 'maya@example.com',
    hint: 'Storefront browsing, checkout, tracking, and reorders.',
  },
]

export const landingMetrics: FeaturePoint[] = [
  {
    label: 'Stock sync',
    value: 'Live',
    detail: 'One inventory pool for storefront and counter sales.',
  },
  {
    label: 'Order queue',
    value: '24',
    detail: 'Online and POS receipts in one operational view.',
  },
  {
    label: 'Low stock',
    value: '6',
    detail: 'Reorder alerts before fast-moving items run out.',
  },
]

export const authHighlights = [
  'Role-aware access for owner, staff, and customers',
  'Checkout, POS, inventory, receipts, and reports in one system',
  'Built for mini-marts that need speed more than software theater',
]
