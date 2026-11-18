import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Automatically adapt to Neon Postgres on Vercel (POSTGRES_PRISMA_URL),
// standard DATABASE_URL, or POSTGRES_URL
const resolvedDbUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: resolvedDbUrl
      ? {
          db: {
            url: resolvedDbUrl,
          },
        }
      : undefined,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
