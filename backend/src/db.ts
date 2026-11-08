import type { Prisma } from '@prisma/client'
import './env.ts'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { databaseConfig } from './database-config.ts'
export const db = new PrismaClient({
  adapter: new PrismaPg(databaseConfig(), {
    onPoolError: (error) =>
      console.error(
        'Database idle connection closed:',
        (error as Error & { code?: string }).code || error.name,
      ),
  }),
})
export async function transaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 15000,
      })
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2034' || attempt === 2)
        throw error
    }
  }
  throw new Error('Transaction retry limit reached.')
}
