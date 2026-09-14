import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { calculateTotals, cents } from '../../src/services/money.ts'
import { createScanGuard } from '../../src/services/posScanner.ts'

test('frontend totals use cents for fractional prices, discounts and tax', () => {
  assert.deepEqual(calculateTotals([{price:0.1,quantity:3},{price:0.2,quantity:1}],0.1,12),{subtotal:0.5,discount:0.1,tax:0.05,total:0.45})
  assert.deepEqual(calculateTotals([{price:25,quantity:2}],50,12),{subtotal:50,discount:50,tax:0,total:0})
  assert.throws(()=>calculateTotals([{price:1,quantity:1}],2,0))
  for(const value of [-1,Infinity,NaN,100000001])assert.throws(()=>cents(value))
  for(const value of [-1,101,Infinity])assert.throws(()=>calculateTotals([{price:1,quantity:1}],0,value))
})
test('scanner blocks accidental duplicates and permits another product or deliberate rescan', () => {
  const scan=createScanGuard()
  assert.equal(scan('4801234567890',1000),true)
  assert.equal(scan('4801234567890',1100),false)
  assert.equal(scan('4801234567891',1150),true)
  assert.equal(scan('4801234567890',1500),true)
})
test('catalog replacement manifest points to files shipped by the frontend', async () => {
  const mapping=JSON.parse(await readFile(new URL('../../src/data/productImages.json',import.meta.url),'utf8'))
  assert.equal(Object.keys(mapping).length,40)
  for(const value of Object.values(mapping))await access(new URL('../../public'+value,import.meta.url))
  assert.equal(Object.values(mapping).filter(value=>/\.jpe?g$/.test(value)).length,37)
})
