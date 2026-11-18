#!/usr/bin/env node
const { execSync } = require('child_process');

// Auto-detect Vercel database variables (Neon or Prisma Postgres)
const dbUrl =
  process.env.POSTGRES1_POSTGRES_PRISMA_URL ||
  process.env.POSTGRES1_DATABASE_URL ||
  process.env.POSTGRES_PRISMA_DATABASE_URL ||
  process.env.POSTGRES_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

const directUrl =
  process.env.POSTGRES1_POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES1_DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  dbUrl;

if (dbUrl) {
  process.env.DATABASE_URL = dbUrl;
  process.env.DIRECT_URL = directUrl;
  console.log('[db-init] Database URL detected. Running prisma db push...');
  try {
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      stdio: 'inherit',
      env: process.env,
    });
    console.log('[db-init] Database schema pushed successfully!');
  } catch (err) {
    console.error('[db-init] Warning: prisma db push exited with error, continuing build:', err.message);
  }
} else {
  console.log('[db-init] No remote database URL detected in build environment.');
}
