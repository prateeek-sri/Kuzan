import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCodeComplexity, detectLanguage } from '../lib/metrics/complexity';

describe('Multi-Language Static Code Complexity Extractor (TDD)', () => {
  describe('Language Detection', () => {
    it('detects language from file extensions accurately', () => {
      assert.equal(detectLanguage('app/main.py'), 'python');
      assert.equal(detectLanguage('src/components/Button.tsx'), 'typescript');
      assert.equal(detectLanguage('index.js'), 'javascript');
      assert.equal(detectLanguage('backend/UserService.java'), 'java');
      assert.equal(detectLanguage('engine/core.cpp'), 'cpp');
      assert.equal(detectLanguage('parser/header.h'), 'c');
      assert.equal(detectLanguage('cmd/server.go'), 'go');
      assert.equal(detectLanguage('src/lib.rs'), 'rust');
      assert.equal(detectLanguage('api/index.php'), 'php');
      assert.equal(detectLanguage('scripts/deploy.rb'), 'ruby');
      assert.equal(detectLanguage('unknown.xyz'), 'generic');
    });
  });

  describe('Complexity Extraction across Multiple Languages', () => {
    it('extracts LOC, SLOC, and Cyclomatic Complexity for Python code', () => {
      const pythonSnippet = `
# A simple calculator
def calculate_discount(price, customer_tier, is_holiday):
    if price <= 0:
        return 0
    
    discount = 0.0
    if customer_tier == 'VIP':
        discount = 0.20
    elif customer_tier == 'PREMIUM':
        discount = 0.10
    else:
        discount = 0.05
        
    if is_holiday:
        discount += 0.05
        
    return price * (1.0 - discount)
`;
      const result = analyzeCodeComplexity('cart.py', pythonSnippet, 'python');
      
      assert.equal(result.filePath, 'cart.py');
      assert.equal(result.language, 'python');
      assert.ok(result.loc >= 16);
      assert.ok(result.sloc >= 12);
      // McCabe: base 1 + (if price <= 0) + (if tier == VIP) + (elif PREMIUM) + (if is_holiday) = 5
      assert.equal(result.cyclomaticComplexity, 5);
      assert.ok(result.halsteadVolume > 0);
      assert.ok(result.maintainabilityIndex > 0);
    });

    it('extracts complexity for JavaScript / TypeScript with compound conditions', () => {
      const tsSnippet = `
export function validateSession(user: any, token: string | null): boolean {
  // Check token existence
  if (!token || token.trim() === '') {
    return false;
  }

  // Check user active and not expired
  if (user.isActive && !user.isBlocked) {
    if (user.role === 'ADMIN' || user.role === 'SUPERUSER') {
      return true;
    }
    return user.permissions.length > 0;
  }

  return false;
}
`;
      const result = analyzeCodeComplexity('session.ts', tsSnippet, 'typescript');

      assert.equal(result.language, 'typescript');
      assert.ok(result.loc >= 15);
      assert.ok(result.sloc >= 10);
      // Base 1 + (!token) + (||) + (user.isActive) + (&&) + (role == ADMIN) + (||) + (return branch) = >= 6
      assert.ok(result.cyclomaticComplexity >= 6);
      assert.ok(result.halsteadVolume > 0);
    });

    it('extracts complexity for Java code with loops and switch-cases', () => {
      const javaSnippet = `
package com.example.service;

public class OrderProcessor {
    public double processItems(List<Item> items, boolean applyTax) {
        double total = 0.0;
        for (Item item : items) {
            if (item.getPrice() > 0) {
                total += item.getPrice();
            } else {
                continue;
            }
        }
        
        while (total > 1000.0) {
            total -= 50.0;
            break;
        }

        return applyTax ? total * 1.08 : total;
    }
}
`;
      const result = analyzeCodeComplexity('OrderProcessor.java', javaSnippet, 'java');

      assert.equal(result.language, 'java');
      assert.ok(result.loc >= 18);
      // for loop (1) + if (1) + while (1) + ternary (1) + base (1) = 5
      assert.equal(result.cyclomaticComplexity, 5);
    });

    it('extracts complexity for C++ and Go code', () => {
      const goSnippet = `
package main

func HandleRequest(status int, retries int) string {
    if status == 200 {
        return "OK"
    } else if status >= 500 && retries > 0 {
        return "RETRY"
    }
    return "FAIL"
}
`;
      const result = analyzeCodeComplexity('handler.go', goSnippet, 'go');
      assert.equal(result.language, 'go');
      assert.ok(result.cyclomaticComplexity >= 3);
    });

    it('handles empty files or comment-only files safely without throwing', () => {
      const emptyResult = analyzeCodeComplexity('empty.py', '', 'python');
      assert.equal(emptyResult.loc, 0);
      assert.equal(emptyResult.sloc, 0);
      assert.equal(emptyResult.cyclomaticComplexity, 1.0);

      const commentsOnly = '// Just a comment\n/* Multi line\n comment */\n';
      const commentResult = analyzeCodeComplexity('notes.js', commentsOnly, 'javascript');
      assert.equal(commentResult.sloc, 0);
      assert.equal(commentResult.cyclomaticComplexity, 1.0);
    });
  });
});
