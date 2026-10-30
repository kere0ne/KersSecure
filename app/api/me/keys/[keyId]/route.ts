import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';
import { logAudit } from '@/lib/service';

export const runtime = 'nodejs';
export async function PATCH(request: Request, ctx: { params: Promise<{ keyId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { keyId } = await ctx.params;
  const prisma = await __getPrisma();
  const license = await prisma.license.findFirst({ where: { id: keyId, project: { ownerId: user.id } } });
  if (!license) return NextResponse.json({ error: 'Key not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({} as { action?: string; days?: number }));
  const data: Record<string, unknown> = {};
  if (b.action === 'reset-hwid') { data.devices = '[]'; data.deviceHash = null; }
  else if (b.action === 'revoke') data.status = 'REVOKED';
  else if (b.action === 'activate') data.status = 'ACTIVE';
  else if (b.action === 'extend') { const days = Number(b.days); if (!days || days <= 0) return NextResponse.json({ error: 'days required.' }, { status: 400 }); const base = license.expiresAt && license.expiresAt > new Date() ? license.expiresAt.getTime() : Date.now(); data.expiresAt = new Date(base + days * 86400000); }
  else return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  await prisma.license.update({ where: { id: license.id }, data });
  await logAudit('license.' + (b.action ?? 'updated'), license.id, user.id);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function DELETE(_request: Request, ctx: { params: Promise<{ keyId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { keyId } = await ctx.params;
  const prisma = await __getPrisma();
  const license = await prisma.license.findFirst({ where: { id: keyId, project: { ownerId: user.id } }, select: { id: true } });
  if (!license) return NextResponse.json({ error: 'Key not found.' }, { status: 404 });
  await prisma.license.delete({ where: { id: license.id } });
  await logAudit('license.deleted', license.id, user.id);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
