import type { Prisma, Profile } from '@prisma/client'

export type Actor = Pick<Profile, 'id' | 'name' | 'role'>
export type Transaction = Prisma.TransactionClient
export type SaleWithItems = Prisma.SaleGetPayload<{ include: { items: true } }>
export type OrderWithDetails = Prisma.OrderGetPayload<{
  include: { items: true; payment: true; events: true }
}>
export type PayableOrder = Prisma.OrderGetPayload<{
  include: { payment: true; items: { include: { product: true } } }
}>

declare module 'express-serve-static-core' {
  interface Request {
    // The roles middleware establishes this before every protected handler.
    actor?: Profile
    accessToken?: string
  }
}
