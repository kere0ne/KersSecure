import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';

export const runtime = 'nodejs';
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const prisma = await __getPrisma();
  let sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!sub) sub = await prisma.subscription.create({ data: { userId: user.id, plan: 'FREE', status: 'ACTIVE' } });
  return NextResponse.json({ subscription: { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } }, { headers: { 'Cache-Control': 'no-store' } });
}
