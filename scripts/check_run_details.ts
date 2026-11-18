import { prisma } from '../lib/prisma';

async function main() {
  const run = await prisma.predictionRun.findUnique({
    where: { id: '643903f8-5823-46fa-9f46-53f36fbf08ea' },
    include: {
      repository: true,
      predictions: {
        orderBy: { riskRank: 'asc' },
        select: { filePath: true, defectProbability: true, riskLevel: true, defects: true }
      }
    }
  });

  console.log(`RUN: ${run?.id} | ${run?.repository.owner}/${run?.repository.name}`);
  for (const p of run?.predictions || []) {
    console.log(`FILE: ${p.filePath} | PROB: ${p.defectProbability} | DEFECTS:`, JSON.stringify(p.defects));
  }
}

main().catch(console.error).finally(() => process.exit(0));

