// Original, replaceable SVG product illustrations. No remote assets or trademarks.
import { mkdirSync, writeFileSync } from 'node:fs'
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
const palette = [
  '#55744b',
  '#b89452',
  '#ba644f',
  '#b57c35',
  '#71864c',
  '#568aa0',
  '#ac6c58',
  '#7597a4',
  '#617d80',
  '#a4889f',
  '#59887e',
  '#aa9580',
]
const xml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
function illustration(name, category, shape, i) {
  const color = palette[category]
  const words = name.split(' ')
  const label = words.slice(0, 2).join(' ').toUpperCase()
  let form = `<path d="M110 72 Q160 60 210 72 L228 262 Q160 279 92 262Z" fill="${color}"/><path d="M112 73H208M98 255H222" stroke="#fff" opacity=".5" stroke-width="5"/>`
  if (shape === 'bottle')
    form = `<rect x="141" y="34" width="38" height="23" rx="5" fill="${color}"/><path d="M141 58H179V84Q208 103 208 122V263Q160 278 112 263V122Q112 103 141 84Z" fill="${color}"/><path d="M125 121V240" stroke="white" opacity=".25" stroke-width="9"/>`
  if (shape === 'box' || shape === 'carton')
    form = `<path d="M103 78L126 53H205L219 78V263H103Z" fill="${color}"/><path d="M103 78H219M205 55V260" fill="none" stroke="white" opacity=".3" stroke-width="4"/>`
  if (shape === 'can')
    form = `<rect x="102" y="96" width="116" height="160" rx="12" fill="${color}"/><ellipse cx="160" cy="97" rx="58" ry="13" fill="#bdc2bb"/><ellipse cx="160" cy="96" rx="46" ry="8" fill="#dce0d8"/><ellipse cx="160" cy="255" rx="58" ry="12" fill="#a8afa7"/>`
  if (shape === 'cup')
    form = `<path d="M98 105H222L202 259H118Z" fill="${color}"/><ellipse cx="160" cy="104" rx="69" ry="13" fill="#e1d8c4"/>`
  if (['banana', 'potato', 'tomato', 'onion', 'eggs'].includes(shape)) {
    form =
      shape === 'banana'
        ? `<path d="M88 103Q115 237 234 135Q211 270 110 235Q60 200 88 103" fill="#e8bd4e" stroke="#bd9640" stroke-width="4"/><path d="M114 86Q150 218 241 124Q229 228 143 207Q99 177 114 86" fill="#f1d269" stroke="#c7a44a" stroke-width="4"/>`
        : [0, 1, 2, 3, 4]
            .map(
              (n) =>
                `<ellipse cx="${108 + (n % 3) * 50}" cy="${140 + Math.floor(n / 3) * 65}" rx="${shape === 'eggs' ? 24 : 37}" ry="${shape === 'eggs' ? 34 : 31}" fill="${shape === 'tomato' ? '#c4573d' : shape === 'onion' ? '#b88071' : shape === 'eggs' ? '#e9d2af' : '#be9e6c'}" stroke="#ffffff" stroke-opacity=".3" stroke-width="3"/>${shape === 'tomato' ? `<path d="M${93 + (n % 3) * 50} ${118 + Math.floor(n / 3) * 65}l15 7 10-17-3 20 13-5" fill="#537c45"/>` : ''}`,
            )
            .join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" fill="#eeeade"/><ellipse cx="160" cy="268" rx="104" ry="13" fill="#d8d2c2"/>${form}<text x="160" y="300" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#53594d">${xml(name)}</text></svg>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" fill="#eeeade"/><ellipse cx="160" cy="278" rx="81" ry="10" fill="#d8d2c2"/>${form}<rect x="108" y="133" width="104" height="91" rx="3" fill="#faf6e9"/><text x="160" y="152" text-anchor="middle" font-family="sans-serif" font-size="10" letter-spacing="3" fill="${color}">ASCENT</text><path d="M146 171L157 160L171 178M154 178L165 166L178 183" fill="none" stroke="${color}" stroke-width="2"/><text x="160" y="198" text-anchor="middle" font-family="sans-serif" font-size="${label.length > 17 ? 8 : 10}" font-weight="bold" fill="#343d32">${xml(label)}</text><text x="160" y="215" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#656a5d">${xml(words.slice(2).join(' ') || 'EVERYDAY ESSENTIALS')}</text><text x="160" y="246" text-anchor="middle" font-family="sans-serif" font-size="8" fill="white">PANTRY COLLECTION · ${String(i + 1).padStart(2, '0')}</text></svg>`
}
const products = rows.map(([name, cat, sellingPrice, costPrice, stockQuantity, unit, shape], i) => {
  const slug = name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')
  const categoryId = groups[cat][0]
  const folder = ['breakfast', 'instant-food'].includes(categoryId) ? 'staples' : categoryId
  const imageUrl = `/images/products/${folder}/${slug}.svg`
  mkdirSync(`public/images/products/${folder}`, { recursive: true })
  writeFileSync(`public${imageUrl}`, illustration(name, cat, shape, i))
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
for (const folder of ['brand', 'landing', 'authentication', 'placeholders'])
  mkdirSync(`public/images/${folder}`, { recursive: true })
writeFileSync(
  'public/images/placeholders/product.svg',
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#eeeade"/><path d="M100 115l60-30 60 30v90l-60 30-60-30zM100 115l60 30 60-30M160 145v90" fill="none" stroke="#65805b" stroke-width="4"/><text x="160" y="275" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#53594d">ASCENT · Image unavailable</text></svg>',
)
writeFileSync(
  'src/data/grocerySeed.ts',
  `import type { Category, Product } from '../types/product'\n\nexport const categories: Category[] = ${JSON.stringify(
    groups.map(([id, name]) => ({ id, name })),
    null,
    2,
  )}\n\nexport const seedProducts: Product[] = ${JSON.stringify(products, null, 2)}\n`,
)
console.log(`Wrote ${products.length} products and original local SVG illustrations.`)
