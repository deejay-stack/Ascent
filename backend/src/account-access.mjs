import { fail } from './validation.mjs'

// Run within a serializable transaction so simultaneous handovers cannot
// disable each other using an owner identity read before the transaction.
export async function setAccountActive(tx, actorId, personId, isActive) {
  const actor = await tx.profile.findUnique({ where: { id: actorId } })
  if (!actor?.isActive || actor.authDeletedAt || actor.role !== 'owner')
    fail(403, 'An active owner account is required.')
  const person = await tx.profile.findUnique({ where: { id: personId } })
  if (!person || person.authDeletedAt) fail(404, 'Account not found.')
  if (!isActive && person.role === 'owner') {
    const otherOwners = await tx.profile.count({
      where: {
        role: 'owner',
        isActive: true,
        authDeletedAt: null,
        id: { not: person.id },
      },
    })
    if (!otherOwners) fail(409, 'The store must keep at least one active owner.')
    if (person.id === actorId)
      fail(403, 'Ask the new owner to disable your access after completing the handover.')
  }
  return tx.profile.update({ where: { id: person.id }, data: { isActive } })
}
