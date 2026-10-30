import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getPrisma } from '@/lib/db';
import { createSession } from '@/lib/auth';

export const runtime = 'nodejs';

function digest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest();
}

export async function POST(request: Request) {
  const expected = process.env.OWNER_API_KEY;
  if (!expected || expected.length < 80) {
    return NextResponse.json({ error: 'Owner API authentication is not configured. Set OWNER_API_KEY in Cloudflare Worker secrets.' }, { status: 503 });
  }

  let supplied = '';
  try {
    const body = await request.json() as { key?: unknown };
    supplied = typeof body.key === 'string' ? body.key : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (supplied.length < 80 || supplied.length > 512 || !timingSafeEqual(digest(supplied), digest(expected))) {
    return NextResponse.json({ error: 'Invalid owner key.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const prisma = await getPrisma();
    const owner = await prisma.user.upsert({
      where: { discordId: 'kerssecure-owner-account' },
      create: { discordId: 'kerssecure-owner-account', discordName: 'Kers Secure Owner', role: 'OWNER' },
      update: { discordName: 'Kers Secure Owner', role: 'OWNER', suspended: false },
    });
    const token = await createSession(owner.id);
    const response = NextResponse.json({ ok: true });
    response.cookies.set('kerssecure_session', token, {
      httpOnly: true,
      secure: new URL(request.url).protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('Owner key sign-in failed:', error);
    return NextResponse.json({ error: 'Could not create owner session. Check the database connection.' }, { status: 500 });
  }
}
