import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';
import { logAudit } from '@/lib/service';

export const runtime = 'nodejs';
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params; const db = await __getPrisma();
  const license = await db.license.findFirst({ where: { id, project: { ownerId: user.id } } });
  if (!license) return NextResponse.json({ error: 'License not found' }, { status: 404 });
  const body = await request.json().catch(() => null); if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (body.action === 'suspend') data.status = 'SUSPENDED';
  else if (body.action === 'reactivate') data.status = 'ACTIVE';
  else if (body.action === 'ban' && typeof body.banned === 'boolean') data.banned = body.banned;
  else if (body.action === 'extend' && typeof body.days === 'number') {
    const base = license.expiresAt && license.expiresAt > new Date() ? license.expiresAt.getTime() : Date.now();
    data.expiresAt = new Date(base + body.days * 86400000);
    if (license.status === 'EXPIRED') data.status = 'ACTIVE';
  } else if (body.action === 'permanent') data.expiresAt = null;
  else if (body.action === 'setLimit' && typeof body.maxDevices === 'number' && body.maxDevices >= 1 && body.maxDevices <= 50) data.maxDevices = body.maxDevices;
  else if (body.action === 'resetHwid') data.devices = '[]';
  else if (body.action === 'bind') {
    if (typeof body.robloxUserId === 'string') data.robloxUserId = body.robloxUserId.trim().slice(0, 32) || null;
    if (typeof body.discordId === 'string') data.discordId = body.discordId.trim().slice(0, 32) || null;
  } else if (body.action === 'note' && typeof body.note === 'string') data.note = body.note.slice(0, 200);
  else return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  const updated = await db.license.update({ where: { id }, data });
  await logAudit('license.' + body.action, id, user.id);
  return NextResponse.json({ license: { id: updated.id, status: updated.status, expiresAt: updated.expiresAt, maxDevices: updated.maxDevices, banned: updated.banned, robloxUserId: updated.robloxUserId, discordId: updated.discordId } });
}

export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params; const db = await __getPrisma();
  const license = await db.license.findFirst({ where: { id, project: { ownerId: user.id } }, select: { id: true } });
  if (!license) return NextResponse.json({ error: 'License not found' }, { status: 404 });
  await db.license.delete({ where: { id } });
  await logAudit('license.deleted', id, user.id);
  return NextResponse.json({ ok: true });
}
