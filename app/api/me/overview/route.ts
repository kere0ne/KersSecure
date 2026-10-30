import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';
import { getSetting } from '@/lib/service';

export const runtime = 'nodejs';
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const prisma = await __getPrisma();
  const projects = await prisma.project.findMany({ where: { ownerId: user.id }, select: { id: true } });
  const projectIds = projects.map(p => p.id);
  const since24 = new Date(Date.now() - 86400000); const since14 = new Date(Date.now() - 14 * 86400000);
  const [scripts, licenses, active, execsToday] = await Promise.all([
    prisma.script.count({ where: { projectId: { in: projectIds } } }),
    prisma.license.count({ where: { projectId: { in: projectIds } } }),
    prisma.license.count({ where: { projectId: { in: projectIds }, status: 'ACTIVE' } }),
    prisma.executionLog.count({ where: { script: { projectId: { in: projectIds } }, createdAt: { gte: since24 } } }),
  ]);
  const rows = projectIds.length ? await prisma.executionLog.findMany({ where: { script: { projectId: { in: projectIds } }, createdAt: { gte: since14 } }, select: { createdAt: true, outcome: true } }) : [];
  const series: Record<string, { authorized: number; denied: number }> = {};
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); series[d.toISOString().slice(0, 10)] = { authorized: 0, denied: 0 }; }
  for (const r of rows) { const k = r.createdAt.toISOString().slice(0, 10); if (series[k]) series[k][r.outcome === 'authorized' ? 'authorized' : 'denied']++; }
  const recentRows = projectIds.length ? await prisma.executionLog.findMany({ where: { script: { projectId: { in: projectIds } } }, orderBy: { createdAt: 'desc' }, take: 12, select: { id: true, outcome: true, createdAt: true, licenseId: true, script: { select: { name: true } } } }) : [];
  const rlicIds = [...new Set(recentRows.map(r => r.licenseId).filter((v): v is string => !!v))];
  const rlics = rlicIds.length ? await prisma.license.findMany({ where: { id: { in: rlicIds } }, select: { id: true, keyPrefix: true } }) : [];
  const rlicOf = new Map(rlics.map(l => [l.id, l.keyPrefix]));
  const recent = recentRows.map(r => ({ id: r.id, outcome: r.outcome, createdAt: r.createdAt, script: r.script?.name ?? null, key: r.licenseId ? rlicOf.get(r.licenseId) ?? null : null }));
  const maintenance = await getSetting<{ enabled?: boolean; message?: string }>('maintenance');
  return NextResponse.json({ stats: { projects: projectIds.length, scripts, licenses, active, execsToday }, series, recent, maintenance: maintenance ?? { enabled: false } }, { headers: { 'Cache-Control': 'no-store' } });
}
