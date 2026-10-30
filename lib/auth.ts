import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from '@/lib/db';

const COOKIE_NAME = 'kerssecure_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;
function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  return new TextEncoder().encode(secret);
}

// Returns a signed token; the route handler sets it on its own response.
export async function createSession(userId: string): Promise<string> {
  return new SignJWT({ purpose: 'kerssecure-session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_SECONDS + 's')
    .sign(secretKey());
}

export async function destroySession() {
  const store = await cookies();
  store.set(COOKIE_NAME, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function getSessionUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (payload.purpose !== 'kerssecure-session' || typeof payload.sub !== 'string') return null;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.suspended) return null;
    return user;
  } catch {
    return null;
  }
}
