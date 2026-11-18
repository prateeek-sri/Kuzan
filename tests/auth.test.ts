import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  sanitizeUser,
} from '../lib/auth';

describe('Authentication & Password Hardening (TDD & Security)', () => {
  describe('Password Hashing with Bcrypt', () => {
    it('hashes passwords securely and verifies correct passwords', async () => {
      const plaintext = 'SecretPass123!@#';
      const hash = await hashPassword(plaintext);

      assert.notEqual(hash, plaintext);
      assert.ok(hash.startsWith('$2')); // bcrypt salt prefix ($2a$, $2b$)

      const isValid = await verifyPassword(plaintext, hash);
      assert.equal(isValid, true);
    });

    it('rejects incorrect passwords with false', async () => {
      const plaintext = 'CorrectPassword';
      const hash = await hashPassword(plaintext);

      const isValid = await verifyPassword('WrongPassword', hash);
      assert.equal(isValid, false);
    });
  });

  describe('JWT Session Tokens', () => {
    it('signs and verifies valid JWT session tokens', () => {
      const payload = {
        userId: 'usr_12345',
        username: 'pankaj',
        email: 'pankaj@example.com',
      };

      const token = signToken(payload);
      assert.ok(token);
      assert.equal(typeof token, 'string');

      const decoded = verifyToken(token);
      assert.ok(decoded);
      assert.equal(decoded.userId, payload.userId);
      assert.equal(decoded.username, payload.username);
      assert.equal(decoded.email, payload.email);
    });

    it('rejects tampered or forged JWT tokens', () => {
      const payload = {
        userId: 'usr_12345',
        username: 'pankaj',
        email: 'pankaj@example.com',
      };

      const token = signToken(payload);
      const forgedToken = token.slice(0, -6) + 'abcdef'; // Tamper signature

      const decoded = verifyToken(forgedToken);
      assert.equal(decoded, null);
    });
  });

  describe('Information Disclosure Prevention', () => {
    it('sanitizes user entities and strips password hashes', () => {
      const rawUser = {
        id: 'usr_abc',
        username: 'alice',
        email: 'alice@example.com',
        passwordHash: '$2b$12$superSecretHashThatMustNeverLeak',
        createdAt: new Date('2026-11-01T10:00:00Z'),
      };

      const sanitized = sanitizeUser(rawUser);

      assert.equal(sanitized.id, 'usr_abc');
      assert.equal(sanitized.username, 'alice');
      assert.equal(sanitized.email, 'alice@example.com');
      // Ensure passwordHash is completely stripped
      assert.equal((sanitized as any).passwordHash, undefined);
    });
  });

  describe('Session Token Extraction and Verification', () => {
    it('extracts and verifies valid bearer token from authorization headers', () => {
      const token = signToken({
        userId: 'usr_mock_123',
        username: 'tester',
        email: 'tester@example.com',
      });

      const req = new Request('http://localhost:3000/api/auth/me', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const authHeader = req.headers.get('authorization');
      assert.ok(authHeader);
      const extractedToken = authHeader.replace('Bearer ', '');
      const payload = verifyToken(extractedToken);
      assert.ok(payload);
      assert.equal(payload.userId, 'usr_mock_123');
    });
  });
});
