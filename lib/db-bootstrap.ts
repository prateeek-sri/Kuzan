import { PrismaClient } from '@prisma/client';

let bootstrapPromise: Promise<void> | null = null;

/**
 * Ensures all required PostgreSQL database tables, types, and indexes exist.
 * Runs once per server instance with thread-safe singleton caching.
 */
export async function ensureDatabaseSchema(prisma: PrismaClient): Promise<void> {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    try {
      // 1. Enums
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "AnalysisStatus" AS ENUM ('QUEUED', 'FETCHING', 'EXTRACTING_METRICS', 'PREDICTING', 'COMPLETED', 'FAILED');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      // 2. Users table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" TEXT PRIMARY KEY,
          "username" TEXT UNIQUE NOT NULL,
          "email" TEXT UNIQUE NOT NULL,
          "passwordHash" TEXT NOT NULL,
          "role" TEXT NOT NULL DEFAULT 'DEVELOPER',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Sessions table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "sessions" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "token" TEXT UNIQUE NOT NULL,
          "expiresAt" TIMESTAMP(3) NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions"("token");
      `);

      // 4. Repositories table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "repositories" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
          "name" TEXT NOT NULL,
          "owner" TEXT NOT NULL,
          "url" TEXT NOT NULL,
          "defaultBranch" TEXT NOT NULL DEFAULT 'main',
          "isPrivate" BOOLEAN NOT NULL DEFAULT false,
          "lastAnalyzedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "repositories_owner_name_key" UNIQUE ("owner", "name")
        );
        CREATE INDEX IF NOT EXISTS "repositories_url_idx" ON "repositories"("url");
      `);

      // 5. File metrics table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "file_metrics" (
          "id" TEXT PRIMARY KEY,
          "repoId" TEXT NOT NULL REFERENCES "repositories"("id") ON DELETE CASCADE,
          "filePath" TEXT NOT NULL,
          "language" TEXT NOT NULL,
          "loc" INTEGER NOT NULL DEFAULT 0,
          "sloc" INTEGER NOT NULL DEFAULT 0,
          "cyclomaticComplexity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
          "halsteadVolume" DOUBLE PRECISION,
          "commitCount" INTEGER NOT NULL DEFAULT 0,
          "churnLines" INTEGER NOT NULL DEFAULT 0,
          "authorCount" INTEGER NOT NULL DEFAULT 1,
          "bugFixCount" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "file_metrics_repoId_filePath_key" UNIQUE ("repoId", "filePath")
        );
        CREATE INDEX IF NOT EXISTS "file_metrics_repoId_idx" ON "file_metrics"("repoId");
        CREATE INDEX IF NOT EXISTS "file_metrics_language_idx" ON "file_metrics"("language");
      `);

      // 6. Prediction runs table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "prediction_runs" (
          "id" TEXT PRIMARY KEY,
          "repoId" TEXT NOT NULL REFERENCES "repositories"("id") ON DELETE CASCADE,
          "modelType" TEXT NOT NULL DEFAULT 'AutoSelectBest',
          "modelVersion" TEXT NOT NULL DEFAULT '1.0.0',
          "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
          "totalFiles" INTEGER NOT NULL DEFAULT 0,
          "defectProneCount" INTEGER NOT NULL DEFAULT 0,
          "averageComplexity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
          "totalChurnLines" INTEGER NOT NULL DEFAULT 0,
          "errorMessage" TEXT,
          "completedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "prediction_runs_repoId_idx" ON "prediction_runs"("repoId");
        CREATE INDEX IF NOT EXISTS "prediction_runs_status_idx" ON "prediction_runs"("status");
      `);

      // 7. File predictions table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "file_predictions" (
          "id" TEXT PRIMARY KEY,
          "runId" TEXT NOT NULL REFERENCES "prediction_runs"("id") ON DELETE CASCADE,
          "filePath" TEXT NOT NULL,
          "defectProbability" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
          "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
          "riskRank" INTEGER NOT NULL DEFAULT 1,
          "defects" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "file_predictions_runId_idx" ON "file_predictions"("runId");
        CREATE INDEX IF NOT EXISTS "file_predictions_riskLevel_idx" ON "file_predictions"("riskLevel");
      `);

      // 8. Model registry table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "model_registry" (
          "id" TEXT PRIMARY KEY,
          "modelType" TEXT NOT NULL,
          "version" TEXT NOT NULL,
          "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
          "f1Score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
          "rocAuc" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
          "precision" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
          "recall" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
          "artifactPath" TEXT NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "model_registry_modelType_version_key" UNIQUE ("modelType", "version")
        );
      `);

      // 9. AI Defect Cache table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ai_defect_cache" (
          "id" TEXT PRIMARY KEY,
          "contentHash" TEXT UNIQUE NOT NULL,
          "filePath" TEXT NOT NULL,
          "language" TEXT NOT NULL,
          "model" TEXT NOT NULL DEFAULT 'meta/llama-3.1-70b-instruct',
          "defects" JSONB NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "ai_defect_cache_contentHash_idx" ON "ai_defect_cache"("contentHash");
        CREATE INDEX IF NOT EXISTS "ai_defect_cache_filePath_idx" ON "ai_defect_cache"("filePath");
      `);

      // 10. Default Analyst Demo User
      await prisma.$executeRawUnsafe(`
        INSERT INTO "users" ("id", "username", "email", "passwordHash", "role", "createdAt", "updatedAt")
        VALUES (
          'usr_demo_analyst_001',
          'analyst',
          'analyst@bugpulse.ai',
          '$2a$10$WScpqZqjQRH/poUypk6EQeGoJlXpYtuOrUu0EaYdhWg343kZq8j1G',
          'DEVELOPER',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("email") DO NOTHING;
      `);

      console.log('[db-bootstrap] PostgreSQL schema verified and synchronized.');
    } catch (err: unknown) {
      console.warn('[db-bootstrap] Schema check notice:', err instanceof Error ? err.message : String(err));
      // Reset so next request can retry if needed
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}
