/**
 * Multi-Language Static Code Complexity Extractor
 * Standard: test-driven-development & api-and-interface-design
 * Supports: Python, JavaScript, TypeScript, Java, C, C++, C#, Go, Rust, PHP, Ruby, Kotlin, Swift, Scala, Generic
 */

export type SupportedLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'kotlin'
  | 'swift'
  | 'scala'
  | 'generic';

export interface FileComplexityMetric {
  filePath: string;
  language: SupportedLanguage;
  loc: number;
  sloc: number;
  cyclomaticComplexity: number;
  halsteadVolume: number;
  maintainabilityIndex: number;
}

const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  '.py': 'python',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.cs': 'csharp',
  '.go': 'go',
  '.rs': 'rust',
  '.php': 'php',
  '.rb': 'ruby',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.swift': 'swift',
  '.scala': 'scala',
};

/**
 * Detects programming language from file extension
 */
export function detectLanguage(filePath: string): SupportedLanguage {
  const match = filePath.match(/\.[0-9a-z]+$/i);
  if (!match) return 'generic';
  const ext = match[0].toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] ?? 'generic';
}

/**
 * Strips strings and comments to prepare clean code for tokenization and complexity analysis
 */
function stripStringsAndComments(
  code: string,
  language: SupportedLanguage
): { cleanedCode: string; sloc: number; loc: number } {
  if (!code || code.length === 0) {
    return { cleanedCode: '', sloc: 0, loc: 0 };
  }

  const rawLines = code.split(/\r?\n/);
  const loc = rawLines.length;

  let cleaned = code;

  // 1. Remove multi-line string literals and multi-line comments
  if (language === 'python') {
    // Python docstrings/multi-line strings
    cleaned = cleaned.replace(/"""[\s\S]*?"""/g, ' ');
    cleaned = cleaned.replace(/'''[\s\S]*?'''/g, ' ');
    // Python single line comments
    cleaned = cleaned.replace(/#.*$/gm, ' ');
  } else {
    // C-style block comments: /* ... */
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ' ');
    // C-style line comments: // ...
    cleaned = cleaned.replace(/\/\/.*$/gm, ' ');

    if (language === 'ruby') {
      cleaned = cleaned.replace(/#.*$/gm, ' ');
    } else if (language === 'php') {
      cleaned = cleaned.replace(/(#|\/\/).*$/gm, ' ');
    }
  }

  // 2. Remove string literals so keywords inside quotes are not counted as branches
  cleaned = cleaned.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  cleaned = cleaned.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  cleaned = cleaned.replace(/`(?:[^`\\]|\\.)*`/g, '``');

  // 3. Calculate SLOC (non-empty lines from comment-stripped code)
  const nonCommentLines = cleaned.split(/\r?\n/);
  const sloc = nonCommentLines.filter((l) => l.trim().length > 0).length;

  return { cleanedCode: cleaned, sloc, loc };
}

/**
 * Calculates McCabe Cyclomatic Complexity:
 * CC = 1 + Count of Decision Points
 */
function calculateCyclomaticComplexity(cleanedCode: string, language: SupportedLanguage): number {
  if (!cleanedCode || cleanedCode.trim() === '') {
    return 1.0;
  }

  let decisionPoints = 0;

  // Universal decision patterns
  const patterns: RegExp[] = [
    /\bif\b/g,
    /\belif\b/g,
    /\belse\s+if\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\bexcept\b/g,
    /&&/g,
    /\|\|/g,
    /\?/g, // Ternary
  ];

  // Language specific keywords
  if (language === 'python') {
    patterns.push(/\band\b/g);
    patterns.push(/\bor\b/g);
  } else if (language === 'rust' || language === 'scala' || language === 'kotlin') {
    patterns.push(/\bmatch\b/g);
  } else if (language === 'go') {
    patterns.push(/\bselect\b/g);
  }

  for (const pattern of patterns) {
    const matches = cleanedCode.match(pattern);
    if (matches) {
      decisionPoints += matches.length;
    }
  }

  return 1 + decisionPoints;
}

/**
 * Calculates Halstead Software Metrics (Volume & Vocabulary)
 */
function calculateHalsteadMetrics(cleanedCode: string): { volume: number; vocabulary: number } {
  if (!cleanedCode || cleanedCode.trim() === '') {
    return { volume: 0, vocabulary: 0 };
  }

  // Tokenize operators and operands
  const operatorPattern = /([+\-*\/%=<>!&|^~?:,;().\[\]{}]+)/g;
  const wordPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*|\d+(?:\.\d+)?)\b/g;

  const operators = cleanedCode.match(operatorPattern) ?? [];
  const operands = cleanedCode.match(wordPattern) ?? [];

  const uniqueOperators = new Set(operators);
  const uniqueOperands = new Set(operands);

  const n1 = uniqueOperators.size; // Distinct operators
  const n2 = uniqueOperands.size; // Distinct operands
  const N1 = operators.length; // Total operators
  const N2 = operands.length; // Total operands

  const vocabulary = n1 + n2;
  const length = N1 + N2;

  if (vocabulary === 0 || length === 0) {
    return { volume: 0, vocabulary: 0 };
  }

  // Halstead Volume: V = N * log2(n)
  const volume = Math.round(length * (Math.log2(vocabulary) || 1) * 100) / 100;
  return { volume, vocabulary };
}

/**
 * Calculates SEI Maintainability Index normalized to 0-100 scale
 */
function calculateMaintainabilityIndex(loc: number, cyclomatic: number, volume: number): number {
  if (loc === 0) return 100.0;

  const safeLoc = Math.max(1, loc);
  const safeVolume = Math.max(1, volume);

  // Standard SEI Formula: 171 - 5.2 * ln(V) - 0.23 * CC - 16.2 * ln(LOC)
  const rawMI = 171 - 5.2 * Math.log(safeVolume) - 0.23 * cyclomatic - 16.2 * Math.log(safeLoc);

  // Normalize to 0 - 100
  const normalized = Math.max(0, Math.min(100, (rawMI * 100) / 171));
  return Math.round(normalized * 10) / 10;
}

/**
 * Main public entrypoint for analyzing static code complexity
 */
export function analyzeCodeComplexity(
  filePath: string,
  sourceCode: string,
  language?: SupportedLanguage
): FileComplexityMetric {
  const detected = language ?? detectLanguage(filePath);
  const { cleanedCode, sloc, loc } = stripStringsAndComments(sourceCode, detected);

  if (loc === 0 || sloc === 0) {
    return {
      filePath,
      language: detected,
      loc,
      sloc,
      cyclomaticComplexity: 1.0,
      halsteadVolume: 0.0,
      maintainabilityIndex: 100.0,
    };
  }

  const cyclomatic = calculateCyclomaticComplexity(cleanedCode, detected);
  const { volume } = calculateHalsteadMetrics(cleanedCode);
  const mi = calculateMaintainabilityIndex(loc, cyclomatic, volume);

  return {
    filePath,
    language: detected,
    loc,
    sloc,
    cyclomaticComplexity: cyclomatic,
    halsteadVolume: volume,
    maintainabilityIndex: mi,
  };
}
