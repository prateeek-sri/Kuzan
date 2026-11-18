/**
 * NVIDIA NIM Semantic Bug & Remediation Engine
 * Standard: api-and-interface-design, performance-optimization & security-and-hardening
 * Features:
 *  - meta/llama-3.1-70b-instruct OpenAI-compatible inference
 *  - SHA-256 Content-Hash Caching to deduplicate LLM calls and conserve API quota
 *  - Automatic fallback to local AST defect inspector on network error or missing key
 */

import crypto from 'node:crypto';
import { prisma } from '../prisma';
import { getOrGenerateFileDefects } from '../metrics/defect-inspector';
import type { CodeDefectItem, DefectPatternCategory } from '@shared/types/contracts';

export interface NvidiaInspectionOptions {
  apiKey?: string;
  model?: string;
  forceFresh?: boolean;
}

export interface NvidiaInspectionResult {
  defects: CodeDefectItem[];
  source: 'NVIDIA_NIM' | 'CACHE' | 'STATIC_FALLBACK';
  modelUsed: string;
}

const DEFAULT_NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
let hasLoggedNimNotice = false;

/**
 * Computes deterministic SHA-256 content hash of the source code and model parameters.
 */
export function computeCodeContentHash(
  filePath: string,
  sourceCode: string,
  model: string = DEFAULT_NVIDIA_MODEL
): string {
  const normalizedCode = sourceCode.replace(/\r\n/g, '\n').trim();
  return crypto
    .createHash('sha256')
    .update(`${filePath}:${model}:${normalizedCode}`)
    .digest('hex');
}

/**
 * Parses and validates LLM completion response into verified CodeDefectItem array.
 */
export function parseNvidiaDefectsJson(
  rawContent: string,
  filePath: string
): CodeDefectItem[] {
  try {
    let clean = rawContent.trim();
    // Strip markdown code fences if model enclosed JSON
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }

    const parsed = JSON.parse(clean);
    const defectArray = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.defects)
      ? parsed.defects
      : [];

    const validCategories: DefectPatternCategory[] = [
      'UNHANDLED_NULL',
      'SWALLOWED_EXCEPTION',
      'DEEP_NESTING',
      'COMPLEX_BRANCHING',
      'RESOURCE_LEAK',
      'UNSAFE_EQUALITY',
      'MISSING_BOUNDARY',
    ];

    return defectArray.map((item: any, idx: number): CodeDefectItem => {
      const lineNum = Number(item.lineNumber) || 1;
      const cat = validCategories.includes(item.category)
        ? (item.category as DefectPatternCategory)
        : 'COMPLEX_BRANCHING';

      return {
        id: `def_nvidia_${idx + 1}_${lineNum}`,
        category: cat,
        severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(item.severity)
          ? item.severity
          : 'MEDIUM',
        title: String(item.title || `Code Risk in ${filePath}`),
        functionName: item.functionName ? String(item.functionName) : undefined,
        lineNumber: lineNum,
        cause: String(
          item.cause || 'Defect detected in execution branch that may lead to unexpected runtime failure.'
        ),
        impact: String(
          item.impact || 'Elevated risk of runtime exception or unhandled state corruption.'
        ),
        buggyCodeSnippet: String(item.buggyCodeSnippet || '// Vulnerable code snippet'),
        remediedCodeSnippet: String(
          item.remediedCodeSnippet || '// Recommended safe implementation'
        ),
      };
    });
  } catch (err) {
    console.warn(`[NVIDIA Parser] Failed to parse JSON response:`, err);
    return [];
  }
}

/**
 * Inspects a source code file using NVIDIA NIM semantic LLM with local SHA-256 caching.
 */
export async function inspectFileWithNvidia(
  filePath: string,
  sourceCode: string,
  language: string,
  options: NvidiaInspectionOptions = {}
): Promise<NvidiaInspectionResult> {
  const model = options.model || process.env.NVIDIA_MODEL || DEFAULT_NVIDIA_MODEL;
  const apiKey = (options.apiKey || process.env.NVIDIA_API_KEY || '').trim();

  // 1. Check SHA-256 Content-Hash Cache in PostgreSQL
  const contentHash = computeCodeContentHash(filePath, sourceCode, model);

  if (!options.forceFresh) {
    try {
      const cached = await prisma.aiDefectCache.findUnique({
        where: { contentHash },
      });

      if (cached && Array.isArray(cached.defects) && cached.defects.length > 0) {
        return {
          defects: cached.defects as unknown as CodeDefectItem[],
          source: 'CACHE',
          modelUsed: cached.model,
        };
      }
    } catch (dbErr) {
      console.warn(`[NVIDIA Cache] Cache lookup error:`, dbErr);
    }
  }

  // 2. If no API key configured, use local AST defect inspector fallback
  if (!apiKey) {
    const fallbackDefects = getOrGenerateFileDefects(filePath, sourceCode, language);
    return {
      defects: fallbackDefects,
      source: 'STATIC_FALLBACK',
      modelUsed: 'AST-Rule-Inspector',
    };
  }

  // 3. Call NVIDIA NIM API with meta/llama-3.1-70b-instruct
  try {
    const prompt = `You are an expert compiler engineer and automated software defect auditor.
Analyze the provided code file to discover REAL, concrete software defects, runtime exceptions, unhandled promises, memory leaks, bad state mutations, and security flaws.
Output ONLY a valid JSON object matching this exact schema:
{
  "defects": [
    {
      "category": "UNHANDLED_NULL" | "SWALLOWED_EXCEPTION" | "DEEP_NESTING" | "COMPLEX_BRANCHING" | "RESOURCE_LEAK" | "UNSAFE_EQUALITY" | "MISSING_BOUNDARY",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "title": "Short title describing the defect",
      "functionName": "optional enclosing function",
      "lineNumber": 12,
      "cause": "Clear root cause explaining why this code will fail or produce incorrect behavior in production",
      "impact": "Runtime crash, memory leak, UI freeze, or state corruption consequence",
      "buggyCodeSnippet": "Exact vulnerable lines from the source",
      "remediedCodeSnippet": "Production-ready corrected code patch that fixes the defect"
    }
  ]
}
If no real defects exist, return {"defects": []}. Do not output any prose, commentary, or conversational markdown outside the JSON.`;

    const userMessage = `File: ${filePath}
Language: ${language}
Source Code:
\`\`\`${language}
${sourceCode.slice(0, 10000)}
\`\`\``;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout

    const res = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 2048,
        top_p: 0.7,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      if (!hasLoggedNimNotice) {
        hasLoggedNimNotice = true;
        const errText = await res.text().catch(() => '');
        console.warn(`[NVIDIA NIM] Service returned HTTP ${res.status}. Falling back to multi-language AST inspector. Details: ${errText.slice(0, 160)}`);
      }
      const fallbackDefects = getOrGenerateFileDefects(filePath, sourceCode, language);
      return {
        defects: fallbackDefects,
        source: 'STATIC_FALLBACK',
        modelUsed: 'AST-Rule-Inspector',
      };
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    const defects = parseNvidiaDefectsJson(rawContent, filePath);

    // If model returned no defects or parsing failed, fallback gracefully
    const finalDefects =
      defects.length > 0
        ? defects
        : getOrGenerateFileDefects(filePath, sourceCode, language);

    // 4. Save to SHA-256 Cache in PostgreSQL
    try {
      await prisma.aiDefectCache.upsert({
        where: { contentHash },
        update: {
          defects: finalDefects as any,
          updatedAt: new Date(),
        },
        create: {
          contentHash,
          filePath,
          language,
          model,
          defects: finalDefects as any,
        },
      });
    } catch (cacheErr) {
      console.warn(`[NVIDIA Cache] Failed to persist cache:`, cacheErr);
    }

    return {
      defects: finalDefects,
      source: 'NVIDIA_NIM',
      modelUsed: model,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[NVIDIA NIM Exception] Failed to call model (${msg}). Falling back to AST inspector.`);
    const fallbackDefects = getOrGenerateFileDefects(filePath, sourceCode, language);
    return {
      defects: fallbackDefects,
      source: 'STATIC_FALLBACK',
      modelUsed: 'AST-Rule-Inspector',
    };
  }
}

