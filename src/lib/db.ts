import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Neon PostgreSQL connection string - hardcoded as fallback
const NEON_URL = 'postgresql://neondb_owner:npg_6gSuUdGltT2i@ep-patient-bird-am2cezf5.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'

function getDatabaseUrl(): string {
  // Check env vars in priority order
  const candidates = [
    process.env.NEON_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
  ]

  for (const url of candidates) {
    if (url?.startsWith('postgresql://')) {
      return url
    }
  }

  // Fallback to hardcoded Neon URL
  return NEON_URL
}

const dbUrl = getDatabaseUrl()

// Add connection pooling for Neon serverless
const pooledUrl = dbUrl.includes('connection_limit')
  ? dbUrl
  : dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=5&pool_timeout=30'

export const db = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: { url: pooledUrl },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
