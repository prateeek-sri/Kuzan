import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, sanitizeUser, signToken } from '@/lib/auth';

const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain alphanumeric characters, hyphens, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password cannot exceed 100 characters'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = RegisterSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid registration details',
            details: result.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      );
    }

    const { username, email, password } = result.data;

    // Check for existing user by email or username
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      const field = existing.email === email ? 'email' : 'username';
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: `User with this ${field} already exists`,
          },
        },
        { status: 409 }
      );
    }

    // Hash password with 12 bcrypt salt rounds
    const passwordHash = await hashPassword(password);

    // Persist to PostgreSQL D1 User DB
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: 'DEVELOPER',
      },
    });

    const token = signToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    const response = NextResponse.json(
      {
        user: sanitizeUser(user),
        token,
      },
      { status: 201 }
    );

    // Set secure HTTP-only session cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred during registration',
        },
      },
      { status: 500 }
    );
  }
}

