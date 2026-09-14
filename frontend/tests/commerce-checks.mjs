// Runs inside an isolated browser via Vite's TypeScript transforms.
export async function runCommerceChecks() {
  const { productService, inventoryService, salesService, paymentService } =
    await import('/src/services/index.ts')
  const { getState, mutate } = await import('/src/services/mockStore.ts')
  const { mockStorage } = await import('/src/services/storage/mockStorage.ts')
  const { calculateTotals } = await import('/src/services/money.ts')
  const { createScanGuard } = await import('/src/services/posScanner.ts')
  const { reportService } = await import('/src/services/reports/reportService.ts')
  const { orderService } = await import('/src/services/orders/mockOrderService.ts')
  const owner = {
    id: 'test-owner',
    name: 'Test Owner',
    email: 'test@local',
    role: 'owner',
  }
  const staff = { ...owner, id: 'test-staff', role: 'staff' }
  const customer = { ...owner, id: 'test-customer', role: 'customer' }
  const passed = []
  const check = (name, condition) => {
    if (!condition) throw new Error(name)
    passed.push(name)
  }
  const rejects = async (name, fn) => {
    let rejected = false
    try {
      await fn()
    } catch {
      rejected = true
    }
    check(name, rejected)
  }
  const initial = structuredClone(getState())
  try {
    const all = inventoryService.list(owner),
      catalog = productService.snapshot()
    check(
      '40 products across 12 categories',
      all.length === 40 && productService.categories().length === 12,
    )
    check(
      'Unique SKU and barcode',
      new Set(all.map((p) => p.sku)).size === 40 && new Set(all.map((p) => p.barcode)).size === 40,
    )
    check('Archived product excluded', catalog.length === 39 && !catalog.some((p) => p.isArchived))
    check(
      'Public and staff cost-price projections',
      !('costPrice' in catalog[0]) &&
        !('costPrice' in inventoryService.list(staff)[0]) &&
        'costPrice' in all[0],
    )
    const p = catalog.find((p) => p.name === 'Premium Rice 5 kg')
    for (const [label, search] of [
      ['name', p.name],
      ['SKU', p.sku],
      ['barcode', p.barcode],
      ['brand', p.brand],
      ['category', p.category],
    ])
      check(
        'Search by ' + label,
        productService.snapshot({ search }).some((x) => x.id === p.id),
      )
    check(
      'Category filter',
      productService.snapshot({ category: 'beverages' }).every((p) => p.categoryId === 'beverages'),
    )
    check(
      'Price and availability filters',
      productService
        .snapshot({ minPrice: 30, maxPrice: 60, availability: 'in-stock' })
        .every((p) => p.price >= 30 && p.price <= 60 && p.stock > 0),
    )
    check(
      'Out-of-stock filter',
      productService.snapshot({ availability: 'out-of-stock' }).length === 2,
    )
    const sorted = productService.snapshot({ sort: 'price-low' })
    check(
      'Price sorting',
      sorted.every((p, i) => i === 0 || p.price >= sorted[i - 1].price),
    )
    check(
      'Money-safe calculation',
      calculateTotals(
        [
          { price: 0.1, quantity: 3 },
          { price: 0.2, quantity: 1 },
        ],
        0.1,
        12,
      ).total === 0.45,
    )
    const scan = createScanGuard()
    check(
      'Duplicate scan debounce and deliberate rescan',
      scan(p.barcode, 1000) && !scan(p.barcode, 1100) && scan(p.barcode, 1400),
    )
    const request = () => ({
      transactionId: salesService.nextTransaction(),
      actor: owner,
      items: [{ productId: p.id, quantity: 2 }],
      discount: 25,
      taxRate: 0,
      paymentMethod: 'cash',
      amountReceived: 1000,
    })
    await rejects('Insufficient cash rejected', () =>
      salesService.complete({ ...request(), amountReceived: 1 }),
    )
    await rejects('Negative quantity rejected', () =>
      salesService.complete({
        ...request(),
        items: [{ productId: p.id, quantity: -1 }],
      }),
    )
    await rejects('Zero quantity rejected', () =>
      salesService.complete({
        ...request(),
        items: [{ productId: p.id, quantity: 0 }],
      }),
    )
    await rejects('Over-stock rejected', () =>
      salesService.complete({
        ...request(),
        items: [{ productId: p.id, quantity: p.stock + 1 }],
      }),
    )
    await rejects('Duplicate lines aggregated before stock check', () =>
      salesService.complete({
        ...request(),
        items: [
          { productId: p.id, quantity: p.stock },
          { productId: p.id, quantity: 1 },
        ],
      }),
    )
    await rejects('Archived sale rejected', () =>
      salesService.complete({
        ...request(),
        items: [{ productId: all.find((p) => p.isArchived).id, quantity: 1 }],
      }),
    )
    await rejects('Out-of-stock sale rejected', () =>
      salesService.complete({
        ...request(),
        items: [{ productId: catalog.find((p) => p.stock === 0).id, quantity: 1 }],
      }),
    )
    await rejects('Customer cannot run POS', () =>
      salesService.complete({ ...request(), actor: customer }),
    )
    await rejects('NaN amount rejected', () =>
      salesService.complete({ ...request(), amountReceived: NaN }),
    )
    await rejects('Excessive discount rejected', () =>
      salesService.complete({ ...request(), discount: 999999 }),
    )
    const before = JSON.stringify(getState())
    const write = mockStorage.write
    mockStorage.write = () => {
      throw new Error('Simulated storage full')
    }
    await rejects('Persistence failure rejects sale', () => salesService.complete(request()))
    mockStorage.write = write
    check('Failed sale leaves all records unchanged', JSON.stringify(getState()) === before)
    const req = request(),
      sale = await salesService.complete(req)
    check(
      'Cash receipt and change',
      sale.total === 625 &&
        sale.change === 375 &&
        sale.items[0].unitPrice === 325 &&
        !!sale.receiptNumber,
    )
    check(
      'Stock deduction and movement',
      productService.snapshot().find((x) => x.id === p.id).stock === p.stock - 2 &&
        getState().movements.at(-1).after === p.stock - 2,
    )
    check(
      'Dashboard and report update',
      reportService.get(owner).revenue === 625 && reportService.get(owner).transactions === 1,
    )
    await salesService.complete(req)
    check('Repeated completion idempotent', getState().sales.length === 1)
    for (const method of ['gcash', 'maya', 'card']) {
      const req = { ...request(), paymentMethod: method }
      const payment = await paymentService.begin(req.transactionId, method, 625)
      await rejects(method + ' pending cannot complete', () =>
        salesService.complete({ ...req, paymentId: payment.id }),
      )
      await paymentService.simulate(payment.id, 'succeeded')
      const sale = await salesService.complete({
        ...req,
        paymentId: payment.id,
      })
      check(
        method + ' successful confirmation completes',
        sale.paymentMethod === method && sale.change === 0,
      )
    }
    const req2 = { ...request(), paymentMethod: 'gcash' }
    for (const outcome of ['failed', 'cancelled']) {
      const payment = await paymentService.begin(req2.transactionId, 'gcash', 625)
      await paymentService.simulate(payment.id, outcome)
      await rejects(outcome + ' payment cannot complete', () =>
        salesService.complete({ ...req2, paymentId: payment.id }),
      )
    }
    const req3 = { ...request(), paymentMethod: 'maya' },
      paid = await paymentService.begin(req3.transactionId, 'maya', 625)
    await paymentService.simulate(paid.id, 'succeeded')
    await rejects('Payment total mismatch rejected', () =>
      salesService.complete({ ...req3, discount: 0, paymentId: paid.id }),
    )
    const current = productService.snapshot().find((x) => x.id === p.id).stock
    await inventoryService.adjust({
      productId: p.id,
      type: 'stock-out',
      quantity: current,
      reason: 'Test stock depletion',
      actor: owner,
    })
    await rejects('Stock rechecked after payment confirmation', () =>
      salesService.complete({ ...req3, paymentId: paid.id }),
    )
    await inventoryService.adjust({
      productId: p.id,
      type: 'stock-in',
      quantity: 10,
      reason: 'Test delivery',
      actor: staff,
    })
    await inventoryService.adjust({
      productId: p.id,
      type: 'adjustment',
      quantity: 8,
      reason: 'Test counted stock',
      actor: owner,
    })
    check(
      'Stock-in/out and count history',
      getState()
        .movements.slice(-3)
        .map((m) => m.after)
        .join(',') === '0,10,8',
    )
    await rejects('Adjustment reason required', () =>
      inventoryService.adjust({
        productId: p.id,
        type: 'stock-in',
        quantity: 1,
        reason: '',
        actor: owner,
      }),
    )
    const order = (
      await orderService.create([{ productId: p.id, quantity: 2 }], 'pickup', customer)
    ).order
    check(
      'Customer order reserves stock',
      productService.snapshot().find((x) => x.id === p.id).stock === 6,
    )
    check('Unpaid orders excluded from sales', reportService.get(owner).transactions === 4)
    await orderService.cancel(order.id, owner)
    check(
      'Cancelled order restores stock',
      productService.snapshot().find((x) => x.id === p.id).stock === 8,
    )
    const order2 = (
      await orderService.create([{ productId: p.id, quantity: 1 }], 'delivery', customer)
    ).order
    await orderService.settle(order2.id, owner)
    check(
      'Online settlement does not deduct stock twice',
      productService.snapshot().find((x) => x.id === p.id).stock === 7,
    )
    check(
      'Report source and payment filters',
      reportService.get(owner, { source: 'online', payment: 'cash' }).transactions === 1,
    )
    check(
      'Report date filter',
      reportService.get(owner, { from: '2000-01-01', to: '2000-01-02' }).transactions === 0,
    )
    check(
      'Product performance units',
      reportService.get(owner).performance.find((x) => x.id === p.id).quantity === 9,
    )
    const fields = {
      name: p.name,
      sellingPrice: 330,
      costPrice: 265,
      lowStockThreshold: 9,
      isArchived: true,
      isAvailable: true,
    }
    await rejects('Staff cannot edit cost or archive products', () =>
      inventoryService.updateProduct(p.id, fields, staff),
    )
    await inventoryService.updateProduct(p.id, fields, owner)
    check(
      'Owner archive hides product immediately',
      !productService.snapshot().some((x) => x.id === p.id),
    )
    check(
      'Receipt prices remain immutable after product edit',
      getState().sales[0].items[0].unitPrice === 325,
    )
    check(
      'Receipt captures store identity',
      getState().sales[0].storeName === 'ASCENT' && !!getState().sales[0].storeAddress,
    )
    const persisted = mockStorage.read('ascent-commerce-v1', null)
    check(
      'Sales and inventory persisted together',
      persisted.sales.length === 5 &&
        persisted.products.find((x) => x.id === p.id).stockQuantity === 7,
    )
    for (const p of all) {
      const result = await fetch(p.imageUrl)
      if (!result.ok || !result.headers.get('content-type')?.startsWith('image/'))
        throw new Error('Image failed: ' + p.imageUrl)
      const image = new Image()
      image.src = p.imageUrl
      await image.decode()
      if (!image.naturalWidth) throw new Error('Image cannot be decoded: ' + p.imageUrl)
    }
    check('Every product image resolves locally and decodes', true)
    check(
      '37 products use supplied photos; three have explicit placeholders',
      all.filter((p) => /\.(jpg|jpeg)$/.test(p.imageUrl)).length === 37 &&
        all.filter((p) => p.imageUrl === '/images/placeholders/product.svg').length === 3,
    )
    const { resolveProductImage } = await import('/src/services/productImages.ts')
    check(
      'Legacy image paths migrate and custom photos are preserved',
      resolveProductImage('/images/products/staples/premium-rice-5-kg.svg') ===
        '/images/products/staples/jasmine_rice.jpg' &&
        resolveProductImage('https://example.com/owner-photo.jpg') ===
          'https://example.com/owner-photo.jpg',
    )
    return passed
  } finally {
    mutate((draft) => Object.assign(draft, initial))
  }
}
