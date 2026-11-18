import { PrismaClient } from '@prisma/client';
import { ensureDatabaseSchema } from './db-bootstrap';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  schemaBootstrapped: boolean | undefined;
};

// Automatically adapt to Neon Postgres (POSTGRES1_... or POSTGRES_...) on Vercel,
// standard DATABASE_URL, or POSTGRES_PRISMA_DATABASE_URL
const resolvedDbUrl =
  process.env.POSTGRES1_POSTGRES_PRISMA_URL ||
  process.env.POSTGRES1_DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_PRISMA_DATABASE_URL ||
  process.env.POSTGRES_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

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

// Background self-healing bootstrap if database URL is configured
if (!globalForPrisma.schemaBootstrapped && resolvedDbUrl) {
  ensureDatabaseSchema(prisma)
    .then(() => {
      globalForPrisma.schemaBootstrapped = true;
    })
    .catch(() => {});
}

export { ensureDatabaseSchema };
