// Regenerate demo catalog data using the supplied product photographs.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
const imageMap = JSON.parse(readFileSync('src/data/productImages.json', 'utf8'))
const groups = [
  ['staples', 'Rice and Staples'],
  ['breakfast', 'Bread and Breakfast'],
  ['canned-goods', 'Canned and Packaged Food'],
  ['instant-food', 'Instant Food and Noodles'],
  ['produce', 'Fresh Produce'],
  ['beverages', 'Beverages'],
  ['snacks', 'Snacks and Biscuits'],
  ['dairy', 'Dairy and Chilled Goods'],
  ['frozen', 'Frozen Food'],
  ['personal-care', 'Personal Care'],
  ['household', 'Household Supplies'],
  ['baby-essentials', 'Baby and Family Essentials'],
]
const rows = [
  ['Premium Rice 5 kg', 0, 325, 265, 45, 'pack', 'bag'],
  ['Regular Rice 5 kg', 0, 265, 215, 60, 'pack', 'bag'],
  ['Cooking Oil 1 L', 0, 99.5, 80, 34, 'bottle', 'bottle'],
  ['White Sugar 1 kg', 0, 85, 68, 5, 'kilogram', 'bag'],
  ['Iodized Salt 500 g', 0, 24, 17, 75, 'pack', 'bag'],
  ['Sliced Bread', 1, 78, 60, 18, 'loaf', 'bag'],
  ['Fresh Eggs 12 pieces', 1, 114, 90, 24, 'box', 'eggs'],
  ['Instant Coffee 25 g', 1, 12.5, 9, 120, 'sachet', 'bag'],
  ['Canned Sardines 155 g', 2, 24.5, 19, 96, 'can', 'can'],
  ['Canned Corned Beef 150 g', 2, 42, 33, 42, 'can', 'can'],
  ['Canned Tuna 180 g', 2, 56, 44, 36, 'can', 'can'],
  ['Instant Noodles 55 g', 3, 15.5, 12, 100, 'pack', 'bag'],
  ['Cup Noodles 60 g', 3, 39, 30, 28, 'piece', 'cup'],
  ['Spaghetti Pasta 500 g', 3, 62, 49, 22, 'pack', 'box'],
  ['Bananas 1 kg', 4, 75, 52, 30, 'kilogram', 'banana'],
  ['Potatoes 1 kg', 4, 95, 70, 20, 'kilogram', 'potato'],
  ['Tomatoes 1 kg', 4, 90, 65, 4, 'kilogram', 'tomato'],
  ['Onions 1 kg', 4, 120, 90, 0, 'kilogram', 'onion'],
  ['Bottled Water 1 L', 5, 25, 16, 80, 'liter', 'bottle'],
  ['Soft Drink 1.5 L', 5, 72, 55, 48, 'bottle', 'bottle'],
  ['Fruit Juice 1 L', 5, 89, 67, 32, 'box', 'carton'],
  ['Powdered Milk 150 g', 5, 68, 51, 25, 'pack', 'bag'],
  ['Crackers 100 g', 6, 32, 23, 64, 'pack', 'bag'],
  ['Chocolate Biscuits 120 g', 6, 38, 28, 45, 'pack', 'bag'],
  ['Potato Chips 60 g', 6, 36, 25, 3, 'pack', 'bag'],
  ['Chocolate Bar 40 g', 6, 45, 32, 0, 'piece', 'box'],
  ['Fresh Milk 1 L', 7, 99, 76, 20, 'liter', 'carton'],
  ['Cheese 165 g', 7, 69, 52, 16, 'box', 'box'],
  ['Yogurt 100 g', 7, 35, 26, 12, 'piece', 'cup'],
  ['Hotdogs 500 g', 8, 115, 88, 24, 'pack', 'bag'],
  ['Frozen Chicken 1 kg', 8, 195, 155, 15, 'kilogram', 'bag'],
  ['Frozen Mixed Vegetables 500 g', 8, 89, 65, 6, 'pack', 'bag'],
  ['Bath Soap 90 g', 9, 32, 22, 56, 'piece', 'box'],
  ['Shampoo 12 mL', 9, 8, 5.5, 150, 'sachet', 'bag'],
  ['Toothpaste 100 g', 9, 65, 47, 30, 'box', 'box'],
  ['Laundry Detergent 1 kg', 10, 115, 88, 22, 'pack', 'bag'],
  ['Dishwashing Liquid 500 mL', 10, 59, 42, 40, 'bottle', 'bottle'],
  ['Baby Diapers 12 pieces', 11, 145, 110, 18, 'pack', 'bag'],
  ['Baby Wipes 80 sheets', 11, 65, 45, 5, 'pack', 'box'],
  ['Rubbing Alcohol 500 mL', 11, 79, 58, 28, 'bottle', 'bottle'],
]
const products = rows.map(([name, cat, sellingPrice, costPrice, stockQuantity, unit], i) => {
  const slug = name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')
  const categoryId = groups[cat][0]
  const folder = ['breakfast', 'instant-food'].includes(categoryId) ? 'staples' : categoryId
  const imageUrl = imageMap[`/images/products/${folder}/${slug}.svg`]
  if (!imageUrl || !existsSync(`public${imageUrl}`)) throw new Error(`Missing image for ${name}`)
  const barcodeBase = `4801000${String(i + 1).padStart(5, '0')}`
  const checksum =
    (10 - ([...barcodeBase].reduce((sum, d, n) => sum + Number(d) * (n % 2 ? 3 : 1), 0) % 10)) % 10
  return {
    id: `grocery-${String(i + 1).padStart(3, '0')}`,
    name,
    slug,
    description: `${name} for everyday meals and home essentials. Sold per ${unit}; sample packaging shown.`,
    categoryId,
    sku: `ASC-${categoryId.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
    barcode: barcodeBase + checksum,
    imageUrl,
    costPrice,
    sellingPrice,
    stockQuantity,
    lowStockThreshold: 7,
    unit,
    brand: 'ASCENT Essentials',
    isAvailable: true,
    isFeatured: [0, 14, 18, 26].includes(i),
    isArchived: i === 39,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }
})
writeFileSync(
  'src/data/grocerySeed.ts',
  `import type { Category, Product } from '../types/product'\n\nexport const categories: Category[] = ${JSON.stringify(
    groups.map(([id, name]) => ({ id, name })),
    null,
    2,
  )}\n\nexport const seedProducts: Product[] = ${JSON.stringify(products, null, 2)}\n`,
)
console.log(
  `Wrote ${products.length} demo products using the supplied photographs. Image files were preserved.`,
)
