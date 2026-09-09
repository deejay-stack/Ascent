import './env.mjs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { required } from './env.mjs'
export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: required('DATABASE_URL') }),
})
export async function transaction(operation) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 15000,
      })
    } catch (error) {
      if (error.code !== 'P2034' || attempt === 2) throw error
    }
  }
}
