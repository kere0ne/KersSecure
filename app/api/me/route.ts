import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getPrisma } from '@/lib/db';

export const runtime = 'nodejs';
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const subscription = await (await getPrisma()).subscription.findUnique({ where: { userId: user.id }, select: { plan: true, status: true, currentPeriodEnd: true } });
  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, name: user.discordName, discordName: user.discordName, discordId: user.discordId, avatar: user.avatar, email: user.email, role: user.role },
    subscription: subscription ?? { plan: 'FREE', status: 'Active', currentPeriodEnd: null }
  }, { headers: { 'Cache-Control': 'no-store' } });
}
