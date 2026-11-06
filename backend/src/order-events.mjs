export async function orderEvent(tx, order, message, actor = 'Store') {
  await tx.orderEvent.create({ data: { orderId: order.id, message, actor } })
  const operators = await tx.profile.findMany({
    where: { isActive: true, authDeletedAt: null, role: { in: ['owner', 'staff'] } },
    select: { id: true },
  })
  const recipients = [...new Set([order.userId, ...operators.map((p) => p.id)])]
  await tx.notification.createMany({
    data: recipients.map((userId) => ({ userId, orderId: order.id, message })),
  })
  await tx.storeEvent.createMany({
    data: [
      { scope: 'catalog' },
      { scope: 'operations' },
      { scope: 'customer', audienceId: order.userId },
    ],
  })
}
