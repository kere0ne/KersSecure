import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ authenticated: true, user: { id: user.id, discordId: user.discordId, discordName: user.discordName, avatar: user.avatar, role: user.role } }, { headers: { 'Cache-Control': 'no-store' } });
}
