'use client';

import React from 'react';

interface SyntaxHighlighterProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'try', 'catch', 'finally', 'throw', 'new', 'typeof', 'instanceof', 'async',
  'await', 'import', 'export', 'from', 'default', 'class', 'extends', 'super',
  'this', 'null', 'undefined', 'true', 'false', 'interface', 'type', 'def',
  'elif', 'pass', 'raise', 'except', 'with', 'as', 'lambda',
]);

const FUNCTIONS = new Set([
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'useEffect',
  'useState', 'useMemo', 'useCallback', 'useRef', 'setHabits', 'fetchUser',
  'console', 'log', 'error', 'warn', 'push', 'map', 'filter', 'reduce',
  'find', 'includes', 'split', 'trim', 'toLowerCase', 'toISOString',
]);

export function SyntaxHighlighter({
  code,
  showLineNumbers = true,
}: SyntaxHighlighterProps) {
  const lines = code.split('\n');

  return (
    <pre className="font-mono text-xs sm:text-[13px] leading-relaxed overflow-x-auto whitespace-pre selection:bg-neutral-800">
      {lines.map((line, lineIdx) => {
        // Regex tokenizer for strings, numbers, identifiers, symbols
        const regex =
          /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/.*$|\b\d+\b|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b|[(){}\[\],;:=><+\-*\/&|!])/g;

        const tokens: React.ReactNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(line)) !== null) {
          // Plain text before match (spaces / indentation)
          if (match.index > lastIndex) {
            tokens.push(line.substring(lastIndex, match.index));
          }

          const token = match[0];

          if (token.startsWith('//')) {
            // Neutral comment
            tokens.push(
              <span key={`${lineIdx}-${match.index}`} className="text-neutral-500 italic">
                {token}
              </span>
            );
          } else if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
            // Strings in clean emerald
            tokens.push(
              <span key={`${lineIdx}-${match.index}`} className="text-emerald-400">
                {token}
              </span>
            );
          } else if (/^\d+$/.test(token)) {
            // Numbers in amber
            tokens.push(
              <span key={`${lineIdx}-${match.index}`} className="text-amber-400">
                {token}
              </span>
            );
          } else if (token === 'true' || token === 'false' || token === 'null' || token === 'undefined') {
            // Literals in amber
            tokens.push(
              <span key={`${lineIdx}-${match.index}`} className="text-amber-400 font-medium">
                {token}
              </span>
            );
          } else if (KEYWORDS.has(token)) {
            // Keywords in crisp white
            tokens.push(
              <span key={`${lineIdx}-${match.index}`} className="text-[#ededed] font-medium">
                {token}
              </span>
            );
          } else if (FUNCTIONS.has(token)) {
            // Function calls in crisp white
            tokens.push(
              <span key={`${lineIdx}-${match.index}`} className="text-white font-medium">
                {token}
              </span>
            );
          } else if (/[(){}\[\],;:]/.test(token)) {
            // Delimiters
            tokens.push(
              <span key={`${lineIdx}-${match.index}`} className="text-neutral-400">
                {token}
              </span>
            );
          } else if (/[=><+\-*\/&|!]/.test(token)) {
            // Operators
            tokens.push(
              <span key={`${lineIdx}-${match.index}`} className="text-neutral-300">
                {token}
              </span>
            );
          } else {
            // Normal identifiers
            tokens.push(
              <span key={`${lineIdx}-${match.index}`} className="text-neutral-200">
                {token}
              </span>
            );
          }

          lastIndex = regex.lastIndex;
        }

        // Remaining text on line
        if (lastIndex < line.length) {
          tokens.push(line.substring(lastIndex));
        }

        return (
          <div key={lineIdx} className="table-row">
            {showLineNumbers && (
              <span className="table-cell select-none pr-4 text-right text-neutral-600 font-mono text-[11px] w-6">
                {lineIdx + 1}
              </span>
            )}
            <span className="table-cell">{tokens}</span>
          </div>
        );
      })}
    </pre>
  );
}
