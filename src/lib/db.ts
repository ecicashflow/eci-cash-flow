import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const NEON_URL = 'postgresql://neondb_owner:npg_6gSuUdGltT2i@ep-patient-bird-am2cezf5.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getNeonUrl(): string {
  // 1. Check for NEON_DATABASE_URL env var (system won't override this name)
  if (process.env.NEON_DATABASE_URL?.startsWith('postgresql://')) {
    return process.env.NEON_DATABASE_URL
  }

  // 2. Check DATABASE_URL if it's actually PostgreSQL (not SQLite file: override)
  if (process.env.DATABASE_URL?.startsWith('postgresql://')) {
    return process.env.DATABASE_URL
  }

  // 3. Read from .env.local file directly (system env overrides .env in Next.js)
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    const match = content.match(/^NEON_DATABASE_URL=(.+)$/m) || content.match(/^DATABASE_URL=(.+)$/m)
    if (match && match[1].trim().startsWith('postgresql://')) {
      return match[1].trim()
    }
  } catch { /* .env.local may not exist */ }

  // 4. Hardcoded fallback from user-provided Neon connection string
  return NEON_URL
}

// CRITICAL: Override process.env BEFORE any PrismaClient is instantiated.
// The system environment has DATABASE_URL=file:.../custom.db which overrides
// the .env files (system env takes precedence in Next.js).
const neonUrl = getNeonUrl()
process.env.DATABASE_URL = neonUrl
process.env.DIRECT_URL = neonUrl

// Use connection_limit=5 and pool_timeout=30 for Neon serverless
const urlWithPoolLimit = neonUrl.includes('connection_limit')
  ? neonUrl
  : neonUrl + (neonUrl.includes('?') ? '&' : '?') + 'connection_limit=5&pool_timeout=30'

export const db = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: { url: urlWithPoolLimit },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
