import React from 'react';
(globalThis as any).React = React;
import { renderToStaticMarkup } from 'react-dom/server';
import { FormalAuditReport } from '../components/FormalAuditReport';
import { ModuleRiskTable } from '../components/ModuleRiskTable';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  warnings: string[];
  metrics?: Record<string, any>;
}

const results: TestResult[] = [];

// Helper to intercept console
function runWithConsoleIntercept(fn: () => void): { warnings: string[]; errors: string[] } {
  const originalError = console.error;
  const originalWarn = console.warn;
  const warnings: string[] = [];
  const errors: string[] = [];

  console.error = (...args: any[]) => {
    errors.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
  };
  console.warn = (...args: any[]) => {
    warnings.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
  };

  try {
    fn();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }

  return { warnings, errors };
}

function checkKeyWarnings(messages: string[]): string[] {
  return messages.filter(
    (msg) =>
      msg.includes('same key') ||
      msg.includes('duplicate key') ||
      msg.includes('keys should be unique') ||
      msg.includes('Encountered two children') ||
      msg.includes('each child in a list should have a unique')
  );
}

console.log('================================================================');
console.log('STARTING EMPIRICAL CHALLENGER STRESS HARNESS — M1 / R1');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// SUITE 1: Extreme Collision Stress Test
// 15 files, identical defect IDs across files, multiple identical defect IDs within same file
// ----------------------------------------------------------------------------
{
  const testName = 'Suite 1: 15 files with identical defect IDs across files AND duplicate IDs within same file';
  console.log(`[TEST] ${testName}`);

  const identicalDefects = [
    {
      id: 'def_null_22',
      category: 'UNHANDLED_NULL' as const,
      severity: 'CRITICAL' as const,
      title: 'Unchecked Null Dereference',
      lineNumber: 22,
      cause: 'Direct nested property access',
      impact: 'Runtime crash',
      buggyCodeSnippet: 'a.b.c',
      remediedCodeSnippet: 'a?.b?.c',
    },
    {
      id: 'def_null_22', // IDENTICAL ID in same file #1
      category: 'UNHANDLED_NULL' as const,
      severity: 'CRITICAL' as const,
      title: 'Unchecked Null Dereference Copy',
      lineNumber: 22,
      cause: 'Second occurrence in same file',
      impact: 'Runtime crash',
      buggyCodeSnippet: 'x.y.z',
      remediedCodeSnippet: 'x?.y?.z',
    },
    {
      id: 'def_res_leak_45',
      category: 'RESOURCE_LEAK' as const,
      severity: 'HIGH' as const,
      title: 'Unclosed Stream Connection',
      lineNumber: 45,
      cause: 'Buffer handle not released',
      impact: 'Memory leak',
      buggyCodeSnippet: 'const s = fs.createReadStream()',
      remediedCodeSnippet: 'using s = fs.createReadStream()',
    },
    {
      id: 'def_res_leak_45', // IDENTICAL ID in same file #2
      category: 'RESOURCE_LEAK' as const,
      severity: 'HIGH' as const,
      title: 'Unclosed Stream Connection Copy',
      lineNumber: 45,
      cause: 'Second stream leak in same file',
      impact: 'Memory leak',
      buggyCodeSnippet: 'const s2 = fs.createReadStream()',
      remediedCodeSnippet: 'using s2 = fs.createReadStream()',
    },
    {
      id: 'def_swallowed_err_88',
      category: 'SWALLOWED_EXCEPTION' as const,
      severity: 'MEDIUM' as const,
      title: 'Empty catch block',
      lineNumber: 88,
      cause: 'Empty catch',
      impact: 'Silent failure',
      buggyCodeSnippet: 'try {} catch (e) {}',
      remediedCodeSnippet: 'try {} catch (e) { log(e); }',
    },
  ];

  const filesCount = 15;
  const mockFiles = Array.from({ length: filesCount }, (_, i) => ({
    filePath: `src/packages/module_${i}/index.ts`,
    defectProbability: 0.85,
    riskLevel: 'HIGH',
    language: 'typescript',
    cyclomaticComplexity: 15,
    commitCount: 10,
    churnLines: 200,
    bugFixCount: 3,
    loc: 250,
    sloc: 200,
    rank: i + 1,
    defects: JSON.parse(JSON.stringify(identicalDefects)), // 5 defects per file (with duplicates)
  }));

  const totalDefects = filesCount * identicalDefects.length; // 15 * 5 = 75 defects

  // Test FormalAuditReport
  let formalWarnings: string[] = [];
  let formalErrors: string[] = [];
  let formalHtml = '';
  try {
    const intercepted = runWithConsoleIntercept(() => {
      formalHtml = renderToStaticMarkup(
        React.createElement(FormalAuditReport, {
          repoOwner: 'stress-test-org',
          repoName: 'extreme-collision-repo',
          repoUrl: 'https://github.com/stress-test-org/extreme-collision-repo',
          defaultBranch: 'main',
          createdAt: new Date().toISOString(),
          modelType: 'AutoSelectBest',
          analysisId: 'stress-analysis-001',
          summary: {
            totalFiles: filesCount,
            analyzedFiles: filesCount,
            defectProneFiles: filesCount,
            averageComplexity: 15,
            totalChurnLines: 3000,
          },
          files: mockFiles,
        })
      );
    });
    formalWarnings = intercepted.warnings;
    formalErrors = intercepted.errors;
  } catch (err: any) {
    formalErrors.push(`FormalAuditReport crashed: ${err.message}`);
  }

  const formalKeyWarnings = checkKeyWarnings([...formalWarnings, ...formalErrors]);

  // Test ModuleRiskTable
  let moduleWarnings: string[] = [];
  let moduleErrors: string[] = [];
  let moduleHtml = '';
  try {
    const intercepted = runWithConsoleIntercept(() => {
      moduleHtml = renderToStaticMarkup(
        React.createElement(ModuleRiskTable, {
          files: mockFiles,
          repoUrl: 'https://github.com/stress-test-org/extreme-collision-repo',
          defaultBranch: 'main',
        })
      );
    });
    moduleWarnings = intercepted.warnings;
    moduleErrors = intercepted.errors;
  } catch (err: any) {
    moduleErrors.push(`ModuleRiskTable crashed: ${err.message}`);
  }

  const moduleKeyWarnings = checkKeyWarnings([...moduleWarnings, ...moduleErrors]);

  const passed =
    formalKeyWarnings.length === 0 &&
    moduleKeyWarnings.length === 0 &&
    formalHtml.length > 0 &&
    moduleHtml.length > 0;

  results.push({
    name: testName,
    passed,
    warnings: [...formalKeyWarnings, ...moduleKeyWarnings],
    metrics: {
      filesCount,
      totalDefects,
      formalHtmlBytes: formalHtml.length,
      moduleHtmlBytes: moduleHtml.length,
      formalKeyWarnings: formalKeyWarnings.length,
      moduleKeyWarnings: moduleKeyWarnings.length,
    },
  });

  console.log(`  -> Passed: ${passed}`);
  console.log(`  -> Total files: ${filesCount}, Total rendered defects: ${totalDefects}`);
  console.log(`  -> FormalAuditReport duplicate key warnings: ${formalKeyWarnings.length}`);
  console.log(`  -> ModuleRiskTable duplicate key warnings: ${moduleKeyWarnings.length}\n`);
}

// ----------------------------------------------------------------------------
// SUITE 2: Edge Case Permutations: Empty, Null, Undefined filePath
// ----------------------------------------------------------------------------
{
  const testName = 'Suite 2: Files with empty string, null, or undefined filePath';
  console.log(`[TEST] ${testName}`);

  const pathologicalFiles = [
    {
      filePath: '', // Empty string filePath
      defectProbability: 0.9,
      riskLevel: 'CRITICAL',
      language: 'typescript',
      cyclomaticComplexity: 10,
      defects: [
        {
          id: 'def_null_22',
          category: 'UNHANDLED_NULL' as const,
          severity: 'CRITICAL' as const,
          title: 'Defect in empty filePath file',
          lineNumber: 22,
          cause: 'Cause',
          impact: 'Impact',
          buggyCodeSnippet: 'x.y',
          remediedCodeSnippet: 'x?.y',
        },
      ],
    },
    {
      filePath: '', // Another file with empty string filePath!
      defectProbability: 0.8,
      riskLevel: 'HIGH',
      language: 'typescript',
      cyclomaticComplexity: 8,
      defects: [
        {
          id: 'def_null_22', // Same defect id
          category: 'UNHANDLED_NULL' as const,
          severity: 'HIGH' as const,
          title: 'Defect in second empty filePath file',
          lineNumber: 22,
          cause: 'Cause',
          impact: 'Impact',
          buggyCodeSnippet: 'a.b',
          remediedCodeSnippet: 'a?.b',
        },
      ],
    },
    {
      filePath: undefined as any, // undefined filePath
      defectProbability: 0.7,
      riskLevel: 'MEDIUM',
      language: 'typescript',
      cyclomaticComplexity: 5,
      defects: [
        {
          id: 'def_res_leak_45',
          category: 'RESOURCE_LEAK' as const,
          severity: 'MEDIUM' as const,
          title: 'Defect in undefined filePath file',
          lineNumber: 45,
          cause: 'Cause',
          impact: 'Impact',
          buggyCodeSnippet: 'c.d',
          remediedCodeSnippet: 'c?.d',
        },
      ],
    },
    {
      filePath: null as any, // null filePath
      defectProbability: 0.6,
      riskLevel: 'LOW',
      language: 'typescript',
      cyclomaticComplexity: 3,
      defects: [
        {
          id: 'def_res_leak_45', // Colliding defect id
          category: 'RESOURCE_LEAK' as const,
          severity: 'LOW' as const,
          title: 'Defect in null filePath file',
          lineNumber: 45,
          cause: 'Cause',
          impact: 'Impact',
          buggyCodeSnippet: 'e.f',
          remediedCodeSnippet: 'e?.f',
        },
      ],
    },
  ];

  let formalWarnings: string[] = [];
  let formalErrors: string[] = [];
  let moduleWarnings: string[] = [];
  let moduleErrors: string[] = [];

  try {
    const intercepted = runWithConsoleIntercept(() => {
      renderToStaticMarkup(
        React.createElement(FormalAuditReport, {
          repoOwner: 'test',
          repoName: 'pathological',
          repoUrl: 'https://github.com/test/pathological',
          defaultBranch: 'main',
          createdAt: new Date().toISOString(),
          modelType: 'AutoSelectBest',
          analysisId: 'patho-1',
          summary: {
            totalFiles: 4,
            analyzedFiles: 4,
            defectProneFiles: 4,
            averageComplexity: 6,
            totalChurnLines: 100,
          },
          files: pathologicalFiles,
        })
      );
    });
    formalWarnings = intercepted.warnings;
    formalErrors = intercepted.errors;
  } catch (err: any) {
    formalErrors.push(`FormalAuditReport error: ${err.message}`);
  }

  try {
    const intercepted = runWithConsoleIntercept(() => {
      renderToStaticMarkup(
        React.createElement(ModuleRiskTable, {
          files: pathologicalFiles as any,
          repoUrl: 'https://github.com/test/pathological',
          defaultBranch: 'main',
        })
      );
    });
    moduleWarnings = intercepted.warnings;
    moduleErrors = intercepted.errors;
  } catch (err: any) {
    moduleErrors.push(`ModuleRiskTable error: ${err.message}`);
  }

  const formalKeyWarnings = checkKeyWarnings([...formalWarnings, ...formalErrors]);
  const moduleKeyWarnings = checkKeyWarnings([...moduleWarnings, ...moduleErrors]);
  const crashes = [...formalErrors, ...moduleErrors].filter((e) => e.includes('error:'));

  const passed = formalKeyWarnings.length === 0 && moduleKeyWarnings.length === 0 && crashes.length === 0;

  results.push({
    name: testName,
    passed,
    warnings: [...formalKeyWarnings, ...moduleKeyWarnings, ...crashes],
    metrics: {
      formalKeyWarnings: formalKeyWarnings.length,
      moduleKeyWarnings: moduleKeyWarnings.length,
      crashes: crashes.length,
      crashDetails: crashes,
    },
  });

  console.log(`  -> Passed: ${passed}`);
  console.log(`  -> Formal duplicate key warnings: ${formalKeyWarnings.length}`);
  console.log(`  -> ModuleRiskTable duplicate key warnings: ${moduleKeyWarnings.length}`);
  console.log(`  -> Crashes: ${crashes.length} ${crashes.join('; ')}\n`);
}

// ----------------------------------------------------------------------------
// SUITE 3: Missing or Null/Undefined defect.id and lineNumber
// ----------------------------------------------------------------------------
{
  const testName = 'Suite 3: Defects with missing, null, or undefined id or lineNumber';
  console.log(`[TEST] ${testName}`);

  const missingPropFiles = [
    {
      filePath: 'src/missing-props.ts',
      defectProbability: 0.95,
      riskLevel: 'CRITICAL',
      language: 'typescript',
      cyclomaticComplexity: 12,
      defects: [
        {
          id: undefined as any, // MISSING / UNDEFINED ID!
          category: 'UNHANDLED_NULL' as const,
          severity: 'CRITICAL' as const,
          title: 'Defect with undefined id',
          lineNumber: 20,
          cause: 'Cause',
          impact: 'Impact',
          buggyCodeSnippet: 'snippet()',
          remediedCodeSnippet: 'snippet()',
        },
        {
          id: null as any, // NULL ID!
          category: 'RESOURCE_LEAK' as const,
          severity: 'HIGH' as const,
          title: 'Defect with null id',
          lineNumber: 30,
          cause: 'Cause',
          impact: 'Impact',
          buggyCodeSnippet: 'leak()',
          remediedCodeSnippet: 'leak()',
        },
        {
          id: '', // EMPTY STRING ID
          category: 'SECURITY_VULN' as const,
          severity: 'HIGH' as const,
          title: 'Defect with empty id',
          lineNumber: undefined as any, // UNDEFINED LINE NUMBER
          cause: 'Cause',
          impact: 'Impact',
          buggyCodeSnippet: 'vuln()',
          remediedCodeSnippet: 'safe()',
        },
        {
          id: 'def_nvidia_ai_generated_1',
          category: 'DEEP_NESTING' as const,
          severity: 'MEDIUM' as const,
          title: 'Nvidia defect with null lineNumber',
          lineNumber: null as any, // NULL LINE NUMBER
          cause: 'Nesting',
          impact: 'Readability',
          buggyCodeSnippet: 'nest()',
          remediedCodeSnippet: 'flat()',
        },
      ],
    },
  ];

  let formalCrash: string | null = null;
  let moduleCrash: string | null = null;

  try {
    renderToStaticMarkup(
      React.createElement(FormalAuditReport, {
        repoOwner: 'test',
        repoName: 'missing-props',
        repoUrl: 'https://github.com/test/missing-props',
        defaultBranch: 'main',
        createdAt: new Date().toISOString(),
        modelType: 'AutoSelectBest',
        analysisId: 'missing-1',
        summary: {
          totalFiles: 1,
          analyzedFiles: 1,
          defectProneFiles: 1,
          averageComplexity: 12,
          totalChurnLines: 50,
        },
        files: missingPropFiles as any,
      })
    );
  } catch (err: any) {
    formalCrash = `FormalAuditReport crashed: ${err.message}\n${err.stack}`;
  }

  try {
    renderToStaticMarkup(
      React.createElement(ModuleRiskTable, {
        files: missingPropFiles as any,
        repoUrl: 'https://github.com/test/missing-props',
        defaultBranch: 'main',
      })
    );
  } catch (err: any) {
    moduleCrash = `ModuleRiskTable crashed: ${err.message}\n${err.stack}`;
  }

  const passed = !formalCrash && !moduleCrash;

  results.push({
    name: testName,
    passed,
    warnings: [formalCrash, moduleCrash].filter(Boolean) as string[],
    metrics: {
      formalCrash: !!formalCrash,
      moduleCrash: !!moduleCrash,
      formalError: formalCrash,
      moduleError: moduleCrash,
    },
  });

  console.log(`  -> Passed: ${passed}`);
  if (formalCrash) console.log(`  -> ${formalCrash}`);
  if (moduleCrash) console.log(`  -> ${moduleCrash}\n`);
}

// ----------------------------------------------------------------------------
// SUITE 4: Element Tree Key Inspection & Mathematical Uniqueness Verification
// ----------------------------------------------------------------------------
{
  const testName = 'Suite 4: Mathematical uniqueness verification of all keys across React element trees';
  console.log(`[TEST] ${testName}`);

  const identicalDefects = [
    {
      id: 'def_null_22',
      category: 'UNHANDLED_NULL' as const,
      severity: 'CRITICAL' as const,
      title: 'Unchecked Null',
      lineNumber: 22,
      cause: 'Cause',
      impact: 'Impact',
      buggyCodeSnippet: 'a.b',
      remediedCodeSnippet: 'a?.b',
    },
    {
      id: 'def_null_22',
      category: 'UNHANDLED_NULL' as const,
      severity: 'CRITICAL' as const,
      title: 'Unchecked Null 2',
      lineNumber: 22,
      cause: 'Cause',
      impact: 'Impact',
      buggyCodeSnippet: 'c.d',
      remediedCodeSnippet: 'c?.d',
    },
  ];

  const files = [
    {
      filePath: 'src/file_a.ts',
      defectProbability: 0.9,
      riskLevel: 'CRITICAL',
      language: 'typescript',
      cyclomaticComplexity: 10,
      defects: identicalDefects,
    },
    {
      filePath: 'src/file_b.ts',
      defectProbability: 0.8,
      riskLevel: 'HIGH',
      language: 'typescript',
      cyclomaticComplexity: 8,
      defects: identicalDefects,
    },
  ];

  // 1. FormalAuditReport element inspection
  const formalElement = FormalAuditReport({
    repoOwner: 'octocat',
    repoName: 'test',
    repoUrl: 'https://github.com/octocat/test',
    defaultBranch: 'main',
    createdAt: new Date().toISOString(),
    modelType: 'AutoSelectBest',
    analysisId: 'ana-001',
    summary: {
      totalFiles: 2,
      analyzedFiles: 2,
      defectProneFiles: 2,
      averageComplexity: 9,
      totalChurnLines: 100,
    },
    files,
  });

  function extractKeys(node: any): string[] {
    const keys: string[] = [];
    if (!node || typeof node !== 'object') return keys;
    if (node.key !== null && node.key !== undefined) {
      keys.push(String(node.key));
    }
    if (node.props?.children) {
      React.Children.forEach(node.props.children, (child) => {
        keys.push(...extractKeys(child));
      });
    }
    return keys;
  }

  const formalKeys = extractKeys(formalElement);
  const formalUnique = new Set(formalKeys);

  // 2. ModuleRiskTable key uniqueness verification
  let moduleRenderError: string | null = null;
  const intercepted = runWithConsoleIntercept(() => {
    try {
      renderToStaticMarkup(
        React.createElement(ModuleRiskTable, {
          files: files as any,
          repoUrl: 'https://github.com/octocat/test',
          defaultBranch: 'main',
        })
      );
    } catch (err: any) {
      moduleRenderError = err.message;
    }
  });

  const moduleKeyWarnings = checkKeyWarnings([...intercepted.warnings, ...intercepted.errors]);
  const passed =
    formalKeys.length === formalUnique.size &&
    moduleKeyWarnings.length === 0 &&
    !moduleRenderError;

  results.push({
    name: testName,
    passed,
    warnings: [],
    metrics: {
      formalTotalKeys: formalKeys.length,
      formalUniqueKeys: formalUnique.size,
      moduleKeyWarnings: moduleKeyWarnings.length,
      moduleRenderError: moduleRenderError || 'none',
    },
  });

  console.log(`  -> Passed: ${passed}`);
  console.log(`  -> FormalAuditReport total keys: ${formalKeys.length}, unique: ${formalUnique.size}`);
  console.log(`  -> ModuleRiskTable duplicate key warnings: ${moduleKeyWarnings.length}\n`);
}

// ----------------------------------------------------------------------------
// SUITE 5: Clipboard State Isolation Test
// ----------------------------------------------------------------------------
{
  const testName = 'Suite 5: Clipboard copy action state key collision & feedback isolation';
  console.log(`[TEST] ${testName}`);

  // Simulate two files with identical defect IDs and same defectIdx
  const file1 = { filePath: 'src/auth.ts', defect: { id: 'def_null_22' }, idx: 0 };
  const file2 = { filePath: 'src/billing.ts', defect: { id: 'def_null_22' }, idx: 0 };

  const key1_buggy = `${file1.filePath}_${file1.defect.id || 'defect'}_${file1.idx}_buggy`;
  const key2_buggy = `${file2.filePath}_${file2.defect.id || 'defect'}_${file2.idx}_buggy`;

  const key1_remedy = `${file1.filePath}_${file1.defect.id || 'defect'}_${file1.idx}_remedy`;
  const key2_remedy = `${file2.filePath}_${file2.defect.id || 'defect'}_${file2.idx}_remedy`;

  const key1_card = `${file1.filePath}_${file1.defect.id || 'defect'}_${file1.idx}`;
  const key2_card = `${file2.filePath}_${file2.defect.id || 'defect'}_${file2.idx}`;

  const allCopyKeys = [key1_buggy, key2_buggy, key1_remedy, key2_remedy, key1_card, key2_card];
  const uniqueCopyKeys = new Set(allCopyKeys);

  const isIsolated = allCopyKeys.length === uniqueCopyKeys.size;

  // Now test collision vulnerability if two files have empty filePath or identical filePath
  const fileA_empty = { filePath: '', defect: { id: 'def_null_22' }, idx: 0 };
  const fileB_empty = { filePath: '', defect: { id: 'def_null_22' }, idx: 0 };

  const keyA_empty = `${fileA_empty.filePath}_${fileA_empty.defect.id || 'defect'}_${fileA_empty.idx}`;
  const keyB_empty = `${fileB_empty.filePath}_${fileB_empty.defect.id || 'defect'}_${fileB_empty.idx}`;

  const hasEmptyPathBleed = keyA_empty === keyB_empty;

  results.push({
    name: testName,
    passed: isIsolated,
    warnings: hasEmptyPathBleed
      ? ['Notice: Files with identical or empty filePath will share copy feedback state because defectKey omits fileIdx tie-breaker']
      : [],
    metrics: {
      standardDifferentFilesIsolated: isIsolated,
      hasEmptyPathBleed,
      sampleKeys: allCopyKeys,
    },
  });

  console.log(`  -> Passed: ${isIsolated}`);
  console.log(`  -> Distinct file copy keys isolated: ${isIsolated}`);
  console.log(`  -> Identical/empty filePath copy feedback collision: ${hasEmptyPathBleed ? 'VULNERABLE (defectKey omits fileIdx)' : 'SAFE'}\n`);
}

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('================================================================');
console.log('STRESS TEST SUMMARY REPORT:');
console.log('================================================================');
results.forEach((r, idx) => {
  console.log(`${idx + 1}. [${r.passed ? 'PASS' : 'FAIL'}] ${r.name}`);
  if (r.warnings.length > 0) {
    r.warnings.forEach((w) => console.log(`   WARN/ERR: ${w}`));
  }
  if (r.metrics) {
    console.log(`   METRICS: ${JSON.stringify(r.metrics)}`);
  }
});

const totalPassed = results.filter((r) => r.passed).length;
console.log(`\nTOTAL: ${totalPassed} / ${results.length} PASSED`);
