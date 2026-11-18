import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCodeContentHash,
  parseNvidiaDefectsJson,
  inspectFileWithNvidia,
} from '../lib/ai/nvidia';

describe('NVIDIA NIM Semantic Bug & Remediation Engine (TDD)', () => {
  it('computes deterministic SHA-256 hashes for code caching', () => {
    const codeA = `function sum(a: number, b: number) { return a + b; }`;
    const codeB = `function sum(a: number, b: number) {\n  return a + b;\n}`;
    const codeDifferent = `function multiply(a: number, b: number) { return a * b; }`;

    const hash1 = computeCodeContentHash('src/math.ts', codeA);
    const hash2 = computeCodeContentHash('src/math.ts', codeA);
    const hashDiff = computeCodeContentHash('src/math.ts', codeDifferent);

    assert.equal(typeof hash1, 'string');
    assert.equal(hash1.length, 64);
    assert.equal(hash1, hash2);
    assert.notEqual(hash1, hashDiff);
  });

  it('parses structured JSON defects with markdown code fences safely', () => {
    const rawMarkdownJson = `
\`\`\`json
{
  "defects": [
    {
      "category": "UNHANDLED_NULL",
      "severity": "CRITICAL",
      "title": "Unchecked user profile dereference",
      "functionName": "getRole",
      "lineNumber": 14,
      "cause": "user.profile may be null when auth session is uninitialized",
      "impact": "Crashes request thread with TypeError",
      "buggyCodeSnippet": "const role = user.profile.role;",
      "remediedCodeSnippet": "const role = user?.profile?.role ?? 'guest';"
    }
  ]
}
\`\`\`
    `.trim();

    const defects = parseNvidiaDefectsJson(rawMarkdownJson, 'src/auth.ts');
    assert.equal(defects.length, 1);
    assert.equal(defects[0].category, 'UNHANDLED_NULL');
    assert.equal(defects[0].severity, 'CRITICAL');
    assert.equal(defects[0].lineNumber, 14);
    assert.equal(defects[0].functionName, 'getRole');
    assert.ok(defects[0].remediedCodeSnippet.includes('?.'));
  });

  it('falls back seamlessly to local AST defect inspector when no API key is provided', async () => {
    const buggyCode = `
function test(user: any) {
  try {
    fetch(user.profile.url);
  } catch (err) {}
}
    `.trim();

    // Call without API key
    const result = await inspectFileWithNvidia('src/test.ts', buggyCode, 'typescript', {
      apiKey: '',
      forceFresh: true,
    });

    assert.ok(result.defects.length > 0);
    assert.equal(result.source, 'STATIC_FALLBACK');
    assert.equal(result.modelUsed, 'AST-Rule-Inspector');
  });
});

