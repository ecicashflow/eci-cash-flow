import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDatabaseUrl(): string {
  // Check environment variables in priority order
  const url = process.env.DATABASE_URL || process.env.DIRECT_URL

  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
      'Please set DATABASE_URL in your .env file or environment configuration. ' +
      'Example: DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"'
    )
  }

  return url
}

const dbUrl = getDatabaseUrl()

// Add connection pooling for serverless environments
const pooledUrl = dbUrl.includes('connection_limit')
  ? dbUrl
  : dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=5&pool_timeout=30'

export const db = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: { url: pooledUrl },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
