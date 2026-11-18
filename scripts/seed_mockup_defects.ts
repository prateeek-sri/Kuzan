import { prisma } from '../lib/prisma';

async function seed() {
  const runs = await prisma.predictionRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log('Seeding defect cards matching user mockups for', runs.length, 'runs...');

  const mockupDefectsMap: Record<string, any[]> = {
    'app/login/page.tsx': [
      {
        id: 'def_null_51',
        category: 'UNHANDLED_NULL',
        severity: 'HIGH',
        title: 'Unchecked Null / Undefined Dereference Risk',
        functionName: 'handleChange',
        lineNumber: 51,
        cause: 'Direct nested property access "e.target.value" without null-guards risks runtime TypeError ("Cannot read properties of undefined").',
        impact: 'Uncaught TypeError throws and crashes active user request thread.',
        buggyCodeSnippet: 'const handleChange = (e) => {\n  setValue(e.target.value);\n};',
        remediedCodeSnippet: 'const handleChange = (e) => {\n  setValue(e?.target?.value ?? null);\n};'
      }
    ],
    'app/ClientPage.tsx': [
      {
        id: 'def_nvidia_1_20',
        category: 'RESOURCE_LEAK',
        severity: 'CRITICAL',
        title: 'Unguarded Async State Update (Memory Leak Risk)',
        functionName: 'HabitTracker',
        lineNumber: 20,
        cause: 'Updating component state inside an asynchronous timeout without an isMounted guard or cleanup function triggers memory leaks when the component unmounts.',
        impact: 'React unmounted component state updates lead to stale closures and performance degradation.',
        buggyCodeSnippet: 'setTimeout(() => {\n  setHabits(updatedHabits);\n}, 1000);',
        remediedCodeSnippet: 'useEffect(() => {\n  let isMounted = true;\n  setTimeout(() => {\n    if (isMounted)\n      setHabits(updatedHabits);\n  }, 1000);\n  return () => {\n    isMounted = false;\n  };\n}, []);'
      }
    ],
    'app/api/auth/[...nextauth]/route.ts': [
      {
        id: 'def_nvidia_2_17',
        category: 'UNHANDLED_NULL',
        severity: 'HIGH',
        title: 'Missing Environment Variable Null Check',
        functionName: 'authOptions',
        lineNumber: 17,
        cause: 'process.env.NEXTAUTH_SECRET is accessed directly without runtime validation, risking authentication token forgery if unset.',
        impact: 'Cryptographic operations fail silently with fallback or undefined salt in production.',
        buggyCodeSnippet: 'export const authOptions = {\n  secret: process.env.NEXTAUTH_SECRET,\n  providers: []\n};',
        remediedCodeSnippet: 'if (!process.env.NEXTAUTH_SECRET) {\n  throw new Error("FATAL: NEXTAUTH_SECRET is required in production environment.");\n}\nexport const authOptions = {\n  secret: process.env.NEXTAUTH_SECRET,\n  providers: []\n};'
      }
    ],
    'app/actions.ts': [
      {
        id: 'def_null_28',
        category: 'UNHANDLED_NULL',
        severity: 'HIGH',
        title: 'Unchecked Date Object Dereference',
        functionName: 'getHabits',
        lineNumber: 28,
        cause: 'Calling toISOString directly on potentially null or undefined createdAt timestamp property.',
        impact: 'Runtime TypeError during database query serialization.',
        buggyCodeSnippet: 'const serialized = habits.map(h => ({\n  ...h,\n  createdAt: h.createdAt.toISOString()\n}));',
        remediedCodeSnippet: 'const serialized = habits.map(h => ({\n  ...h,\n  createdAt: h.createdAt ? h.createdAt.toISOString() : new Date().toISOString()\n}));'
      }
    ],
    'lib/db.ts': [
      {
        id: 'def_resource_5',
        category: 'RESOURCE_LEAK',
        severity: 'MEDIUM',
        title: 'Global Prisma Client Hot-Reload Leak',
        functionName: 'dbInit',
        lineNumber: 5,
        cause: 'Creating a new PrismaClient instance on every file reload in Next.js development causes database connection pool exhaustion.',
        impact: 'PostgreSQL reaches max_connections limit and rejects incoming queries.',
        buggyCodeSnippet: "import { PrismaClient } from '@prisma/client';\nexport const prisma = new PrismaClient();",
        remediedCodeSnippet: "import { PrismaClient } from '@prisma/client';\nconst globalForPrisma = globalThis as unknown as { prisma: PrismaClient };\nexport const prisma = globalForPrisma.prisma ?? new PrismaClient();\nif (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;"
      }
    ]
  };

  for (const r of runs) {
    console.log(`Updating run ${r.id}...`);
    for (const [filePath, defects] of Object.entries(mockupDefectsMap)) {
      const pred = await prisma.filePrediction.findFirst({
        where: { runId: r.id, filePath }
      });
      if (pred) {
        await prisma.filePrediction.update({
          where: { id: pred.id },
          data: { defects: defects as any }
        });
        console.log(`   Updated ${filePath} with ${defects.length} defect(s)`);
      }
    }
  }

  console.log('Seeding completed successfully!');
}

seed().catch(console.error).finally(() => process.exit(0));

