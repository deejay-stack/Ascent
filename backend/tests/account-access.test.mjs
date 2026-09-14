import test from 'node:test'
import assert from 'node:assert/strict'
import { setAccountActive } from '../src/account-access.mjs'

const owner = (id, extra = {}) => ({
  id,
  role: 'owner',
  isActive: true,
  authDeletedAt: null,
  ...extra,
})
function database(people) {
  return {
    profile: {
      findUnique: async ({ where }) => people.find((p) => p.id === where.id),
      count: async ({ where }) =>
        people.filter(
          (p) => p.id !== where.id.not && p.role === 'owner' && p.isActive && !p.authDeletedAt,
        ).length,
      update: async ({ where, data }) =>
        Object.assign(
          people.find((p) => p.id === where.id),
          data,
        ),
    },
  }
}
test('handover preserves the last active owner and rejects self-removal', async () => {
  await assert.rejects(setAccountActive(database([owner('a')]), 'a', 'a', false), { status: 409 })
  await assert.rejects(setAccountActive(database([owner('a'), owner('b')]), 'a', 'a', false), {
    status: 403,
  })
  await assert.rejects(
    setAccountActive(
      database([owner('a'), owner('b', { authDeletedAt: new Date() })]),
      'a',
      'a',
      false,
    ),
    { status: 409 },
  )
})
test('handover rechecks the acting owner and preserves disabled identities', async () => {
  const oldOwner = owner('old'),
    newOwner = owner('new')
  const tx = database([oldOwner, newOwner])
  assert.equal((await setAccountActive(tx, 'new', 'old', false)).isActive, false)
  assert.equal(oldOwner.role, 'owner')
  await assert.rejects(setAccountActive(tx, 'old', 'new', false), {
    status: 403,
  })
  assert.equal((await setAccountActive(tx, 'new', 'old', true)).isActive, true)
})
test('staff, archived and missing accounts cannot administer access', async () => {
  const tx = database([
    owner('a'),
    owner('staff', { role: 'staff' }),
    owner('archived', { authDeletedAt: new Date() }),
  ])
  for (const actor of ['staff', 'archived', 'missing'])
    await assert.rejects(setAccountActive(tx, actor, 'a', false), {
      status: 403,
    })
  for (const target of ['archived', 'missing'])
    await assert.rejects(setAccountActive(tx, 'a', target, true), {
      status: 404,
    })
})
