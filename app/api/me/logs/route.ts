import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const prisma = await __getPrisma();
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') || 100), 200);
  const outcome = url.searchParams.get('outcome');
  const projects = await prisma.project.findMany({ where: { ownerId: user.id }, select: { id: true } });
  const projectIds = projects.map(p => p.id);
  if (!projectIds.length) return NextResponse.json({ logs: [] }, { headers: { 'Cache-Control': 'no-store' } });
  const logs = await prisma.executionLog.findMany({
    where: { script: { projectId: { in: projectIds } }, ...(outcome ? { outcome } : {}) },
    orderBy: { createdAt: 'desc' }, take: limit,
    select: { id: true, outcome: true, createdAt: true, ipHash: true, licenseId: true, script: { select: { name: true } } },
  });
  const licIds = [...new Set(logs.map(l => l.licenseId).filter((v): v is string => !!v))];
  const lics = licIds.length ? await prisma.license.findMany({ where: { id: { in: licIds } }, select: { id: true, keyPrefix: true, discordId: true } }) : [];
  const licOf = new Map(lics.map(l => [l.id, l]));
  return NextResponse.json({ logs: logs.map(l => ({ id: l.id, outcome: l.outcome, createdAt: l.createdAt, ipHash: l.ipHash ? l.ipHash.slice(0, 12) : null, script: l.script?.name ?? null, key: l.licenseId ? licOf.get(l.licenseId)?.keyPrefix ?? null : null, discordId: l.licenseId ? licOf.get(l.licenseId)?.discordId ?? null : null })) }, { headers: { 'Cache-Control': 'no-store' } });
}
