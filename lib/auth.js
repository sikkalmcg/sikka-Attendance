import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET_STRING = process.env.JWT_SECRET || 'super-secure-attendance-secret-key-2026-production-grade';
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STRING);
const COOKIE_NAME = 'attendance_session';

/**
 * Hashes a plaintext password using bcrypt
 */
export async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

/**
 * Verifies a plaintext password against a hash
 */
export async function verifyPassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) return false;
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Creates and signs a JWT token with user or employee payload (365 days validity for mobile APK persistence)
 */
export async function createSessionToken(payload) {
  const plainPayload = JSON.parse(JSON.stringify(payload));
  return new SignJWT(plainPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(JWT_SECRET);
}

/**
 * Verifies and decodes a JWT token
 */
export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts session token from Next.js request headers (Authorization: Bearer <token>) or cookies
 */
export async function extractTokenFromRequest(request) {
  let token = null;

  // 1. Check Authorization header
  if (request && request.headers) {
    const authHeader = typeof request.headers.get === 'function'
      ? request.headers.get('authorization')
      : request.headers['authorization'] || request.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  // 2. Check HTTP-only cookie if no Bearer token
  if (!token) {
    try {
      const cookieStore = await cookies();
      const cookie = cookieStore.get(COOKIE_NAME);
      if (cookie) {
        token = cookie.value;
      }
    } catch {
      // Fallback for direct non-Next context or headers
      if (request && request.cookies) {
        const c = typeof request.cookies.get === 'function' 
          ? request.cookies.get(COOKIE_NAME) 
          : request.cookies[COOKIE_NAME];
        if (c) token = c.value || c;
      }
    }
  }

  return token;
}

/**
 * Extracts session from Next.js request headers or cookies
 */
export async function getSessionUser(request) {
  const token = await extractTokenFromRequest(request);
  if (!token) return null;
  return verifySessionToken(token);
}

export { COOKIE_NAME };

