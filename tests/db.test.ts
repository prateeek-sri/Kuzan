import { prisma } from '../lib/prisma';

async function testDatabaseCRUD() {
  console.log('Testing PostgreSQL CRUD Operations for D1-D4...');

  try {
    // 1. D1: Create User
    const testEmail = `test_${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        username: `user_${Date.now()}`,
        email: testEmail,
        passwordHash: 'dummy_hash_for_test',
        role: 'DEVELOPER',
      },
    });
    console.log('✓ D1 User Created:', user.id, user.email);

    // 2. D2: Create Repository & FileMetric
    const repo = await prisma.repository.create({
      data: {
        userId: user.id,
        owner: 'test-owner',
        name: `test-repo-${Date.now()}`,
        url: 'https://github.com/test-owner/test-repo',
        defaultBranch: 'main',
      },
    });
    console.log('✓ D2 Repository Created:', repo.id, repo.name);

    const metric = await prisma.fileMetric.create({
      data: {
        repoId: repo.id,
        filePath: 'src/main.py',
        language: 'python',
        loc: 120,
        sloc: 95,
        cyclomaticComplexity: 12.4,
        commitCount: 25,
        churnLines: 180,
        authorCount: 3,
        bugFixCount: 4,
      },
    });
    console.log('✓ D2 FileMetric Created:', metric.id, metric.filePath);

    // 3. D3: Create PredictionRun & FilePrediction
    const run = await prisma.predictionRun.create({
      data: {
        repoId: repo.id,
        modelType: 'AutoSelectBest',
        modelVersion: '1.0.0',
        status: 'COMPLETED',
        totalFiles: 1,
        defectProneCount: 1,
        averageComplexity: 12.4,
      },
    });
    console.log('✓ D3 PredictionRun Created:', run.id, run.status);

    const prediction = await prisma.filePrediction.create({
      data: {
        runId: run.id,
        filePath: 'src/main.py',
        defectProbability: 0.78,
        riskLevel: 'HIGH',
        riskRank: 1,
      },
    });
    console.log('✓ D3 FilePrediction Created:', prediction.id, prediction.riskLevel);

    // 4. D4: Create ModelRegistry entry
    const model = await prisma.modelRegistry.create({
      data: {
        modelType: 'RandomForest',
        version: '1.0.0',
        accuracy: 0.88,
        f1Score: 0.82,
        rocAuc: 0.89,
        precision: 0.84,
        recall: 0.81,
        artifactPath: 'ml-service/store/artifacts/rf_v1.0.joblib',
        isActive: true,
      },
    });
    console.log('✓ D4 ModelRegistry Created:', model.id, model.modelType);

    // Cleanup test records
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.modelRegistry.delete({ where: { id: model.id } });
    console.log('✓ Test Data Cleaned up cleanly.');

    console.log('\nAll PostgreSQL D1, D2, D3, D4 checks PASSED successfully!');
  } catch (error) {
    console.error('Database Test Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseCRUD();

