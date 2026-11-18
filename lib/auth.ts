/**
 * Authentication & Password Security Service
 * Standard: security-and-hardening & api-and-interface-design
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import type { UserDTO } from '@shared/types/contracts';

const BCRYPT_SALT_ROUNDS = 12;

function getJwtSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL CONFIGURATION ERROR: NEXTAUTH_SECRET is required in production.');
  }
  return secret || 'ai-bug-prediction-dev-secret-key-change-in-production-32chars';
}

const JWT_SECRET = getJwtSecret();
const TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
}

/**
 * Hashes a plaintext password with bcrypt (12 salt rounds)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Signs a tamper-proof JWT token with pinned HS256 algorithm
 */
export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: TOKEN_MAX_AGE_SECONDS,
  });
}

/**
 * Verifies a JWT token signature and expiration with algorithm pinning
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    }) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Strips sensitive fields (passwordHash) to return a safe UserDTO
 */
export function sanitizeUser(user: {
  id: string;
  username: string;
  email: string;
  createdAt: Date | string;
}): UserDTO {
  const createdAtIso =
    user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt);

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: createdAtIso,
  };
}

/**
 * Extracts and validates the authenticated user from cookies or Authorization header
 */
export async function getCurrentUser(req?: Request): Promise<UserDTO | null> {
  let token: string | undefined;

  // 1. Try reading from Authorization Header (Bearer <token>)
  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 1b. Try reading from Cookie Header in Request
    if (!token) {
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }
    }
  }

  // 2. Try reading from Next.js Asynchronous Cookie Store
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('auth_token')?.value;
    } catch {
      // In testing contexts outside request context
    }
  }

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) return null;
  return sanitizeUser(user);
}

