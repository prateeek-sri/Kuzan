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

const rawPrisma =
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
  globalForPrisma.prisma = rawPrisma;
}

// Proxied prisma client that automatically ensures required tables exist on first invocation
export const prisma: PrismaClient = new Proxy(rawPrisma, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);

    // If accessing a model property (e.g. prisma.user, prisma.repository, prisma.filePrediction)
    if (
      typeof prop === 'string' &&
      !prop.startsWith('$') &&
      !prop.startsWith('_') &&
      typeof value === 'object' &&
      value !== null
    ) {
      return new Proxy(value, {
        get(modelTarget, actionProp, modelReceiver) {
          const action = Reflect.get(modelTarget, actionProp, modelReceiver);
          if (typeof action === 'function') {
            return async (...args: unknown[]) => {
              if (!globalForPrisma.schemaBootstrapped && resolvedDbUrl) {
                try {
                  await ensureDatabaseSchema(rawPrisma);
                  globalForPrisma.schemaBootstrapped = true;
                } catch {
                  // Fall through to query if bootstrap encounters notice
                }
              }
              return (action as (...a: unknown[]) => unknown).apply(modelTarget, args);
            };
          }
          return action;
        },
      });
    }

    return value;
  },
}) as unknown as PrismaClient;

export { ensureDatabaseSchema };
