import { prisma } from '../lib/prisma';

async function main() {
  const runs = await prisma.predictionRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      repository: true,
      predictions: {
        take: 3,
        select: { filePath: true, defectProbability: true, riskLevel: true, defects: true }
      }
    }
  });

  for (const r of runs) {
    console.log(`RUN ID: ${r.id} | REPO: ${r.repository.owner}/${r.repository.name} | STATUS: ${r.status}`);
    for (const p of r.predictions) {
      const defCount = Array.isArray(p.defects) ? p.defects.length : (p.defects ? 'object' : 'null');
      console.log(`   ${p.filePath} -> defects: ${defCount}`);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));

