import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inspectCodeForDefects } from '../lib/metrics/defect-inspector';

describe('Concrete Code Defect & Remediation Inspector (TDD)', () => {
  it('detects swallowed exceptions and provides concrete code remediation', () => {
    const code = `
function loadUserData(userId: string) {
  try {
    const data = fetchUser(userId);
    return data;
  } catch (err) {
  }
}
    `.trim();

    const defects = inspectCodeForDefects('src/user.ts', code, 'typescript');
    assert.ok(defects.length > 0);

    const swallowed = defects.find((d) => d.category === 'SWALLOWED_EXCEPTION');
    assert.ok(swallowed);
    assert.equal(swallowed.severity, 'HIGH');
    assert.ok(swallowed.lineNumber > 0);
    assert.ok(swallowed.cause.includes('Silent exception swallowing'));
    assert.ok(swallowed.buggyCodeSnippet.includes('catch (err)'));
    assert.ok(swallowed.remediedCodeSnippet.includes('console.error'));
  });

  it('detects unhandled null pointer chains and provides optional chaining fix', () => {
    const code = `
function getPermissions(user: any) {
  const role = user.profile.permissions.role;
  return role;
}
    `.trim();

    const defects = inspectCodeForDefects('src/auth.ts', code, 'typescript');
    const nullRisk = defects.find((d) => d.category === 'UNHANDLED_NULL');
    assert.ok(nullRisk);
    assert.equal(nullRisk.severity, 'HIGH');
    assert.ok(nullRisk.cause.includes('null'));
    assert.ok(nullRisk.remediedCodeSnippet.includes('?.'));
  });

  it('detects deep conditional nesting and provides early return fix', () => {
    const code = `
function processOrder(order: any) {
  if (order) {
    if (order.items) {
      if (order.items.length > 0) {
        if (order.paid) {
          if (order.shipped) {
            console.log('Complete');
          }
        }
      }
    }
  }
}
    `.trim();

    const defects = inspectCodeForDefects('src/order.ts', code, 'typescript');
    const nestingDefect = defects.find((d) => d.category === 'DEEP_NESTING');
    assert.ok(nestingDefect);
    assert.equal(nestingDefect.severity, 'MEDIUM');
    assert.ok(nestingDefect.cause.includes('nesting'));
    assert.ok(nestingDefect.remediedCodeSnippet.includes('return'));
  });

  it('detects unsafe loose equality comparisons', () => {
    const code = `
function checkStatus(code: any) {
  if (code == false) {
    return 'disabled';
  }
}
    `.trim();

    const defects = inspectCodeForDefects('src/status.ts', code, 'typescript');
    const eqDefect = defects.find((d) => d.category === 'UNSAFE_EQUALITY');
    assert.ok(eqDefect);
    assert.ok(eqDefect.remediedCodeSnippet.includes('==='));
  });
});
