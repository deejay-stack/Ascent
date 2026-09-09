import {
  Apple,
  Boxes,
  Coffee,
  Cookie,
  Droplets,
  Milk,
  PackageCheck,
  PhilippinePeso,
  ScanBarcode,
  ShieldCheck,
  ShoppingBasket,
  Snowflake,
  SprayCan,
  Store,
  Truck,
  UserRound,
  UsersRound,
  Wheat,
  type LucideIcon,
} from 'lucide-react'

export type LandingCategory = {
  name: string
  description: string
  icon: LucideIcon
  tone: string
}

export const landingCategories: LandingCategory[] = [
  { name: 'Fresh Produce', description: 'Fruit and vegetables', icon: Apple, tone: 'sage' },
  { name: 'Beverages', description: 'Drinks for every day', icon: Coffee, tone: 'amber' },
  { name: 'Snacks and Biscuits', description: 'Quick bites and treats', icon: Cookie, tone: 'rose' },
  { name: 'Rice and Staples', description: 'Everyday essentials', icon: Wheat, tone: 'sand' },
  { name: 'Dairy and Chilled Goods', description: 'Milk and chilled goods', icon: Milk, tone: 'blue' },
  { name: 'Frozen Food', description: 'Freezer favorites', icon: Snowflake, tone: 'ice' },
  { name: 'Personal Care', description: 'Daily self-care', icon: Droplets, tone: 'lavender' },
  { name: 'Household Supplies', description: 'Home cleaning needs', icon: SprayCan, tone: 'mint' },
]

export const shoppingSteps = [
  { number: '01', title: 'Find what you need', description: 'Browse organized categories or search the catalog.' },
  { number: '02', title: 'Choose fulfillment', description: 'Select convenient pickup or local delivery.' },
  { number: '03', title: 'Review and confirm', description: 'See every item, fee, and payment status clearly.' },
]

export const trustPoints = [
  { icon: ShieldCheck, label: 'Secure checkout' },
  { icon: PackageCheck, label: 'Real-time availability' },
  { icon: Truck, label: 'Pickup or delivery' },
]

export const managementTabs = [
  {
    id: 'commerce',
    label: 'Commerce',
    icon: ShoppingBasket,
    title: 'One order flow, wherever the sale begins.',
    description: 'Online orders and counter transactions arrive in a consistent operational queue, ready for fulfillment and receipt generation.',
    points: ['Unified order statuses', 'Pickup and delivery workflows', 'Customer order history'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    title: 'Know what is available before customers ask.',
    description: 'Track quantities, stock movement, low-stock thresholds, and product availability from a single inventory view.',
    points: ['Stock-in and stock-out records', 'Low-stock alerts', 'Auditable adjustments'],
  },
  {
    id: 'pos',
    label: 'POS & billing',
    icon: ScanBarcode,
    title: 'A cashier flow built to keep the line moving.',
    description: 'Search or scan products, build a bill, accept supported payments, and produce a clear receipt without extra screens.',
    points: ['Barcode-ready search', 'Cash change calculation', 'Inventory deduction'],
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: PhilippinePeso,
    title: 'Business signals without reporting clutter.',
    description: 'Owners get practical views of sales, stock health, product movement, and team activity.',
    points: ['Sales trends', 'Category performance', 'Staff activity history'],
  },
]

export const roleBenefits = [
  { icon: UserRound, label: 'Customers', title: 'Convenient shopping', description: 'Browse, order, choose fulfillment, and follow progress from one account.' },
  { icon: UsersRound, label: 'Staff', title: 'Focused daily tools', description: 'Process orders, operate the POS, and maintain inventory without sensitive controls.' },
  { icon: Store, label: 'Owners', title: 'Complete oversight', description: 'Manage operations, people, suppliers, settings, and performance with full authority.' },
]

export const faqs = [
  { question: 'Is ASCENT only for grocery stores?', answer: 'ASCENT is designed around grocery and minimart workflows, but its catalog, inventory, order, and POS structure can support similar small retail operations.' },
  { question: 'Can customers choose pickup instead of delivery?', answer: 'Yes. The planned checkout flow supports both pickup and delivery, with available methods controlled by the store.' },
  { question: 'Do staff members see owner-level reports?', answer: 'No. Staff routes focus on daily operations. Sensitive reports, role management, and global settings remain owner-only.' },
  { question: 'Are online card payments active?', answer: 'Not yet. Payment options without an integrated provider are clearly identified as demonstrations, and ASCENT never collects raw card details.' },
]
