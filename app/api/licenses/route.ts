import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';
import { hashKey, logAudit } from '@/lib/service';

export const runtime = 'nodejs';
const createSchema = z.object({
  projectId: z.string().min(1),
  robloxUserId: z.string().trim().max(32).optional(),
  discordId: z.string().trim().max(32).optional(),
  maxDevices: z.number().int().min(1).max(50).default(1),
  expiresInDays: z.number().int().min(1).max(36500).nullable().default(null),
  count: z.number().int().min(1).max(100).default(1),
  note: z.string().trim().max(200).optional(),
});

export async function GET(request: Request) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const status = url.searchParams.get('status') || '';
  const projectId = url.searchParams.get('projectId') || '';
  const db = await __getPrisma();
  const projects = await db.project.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } });
  const ids = projects.map(p => p.id);
  const where: Record<string, unknown> = { projectId: { in: ids } };
  if (status === 'ACTIVE' || status === 'SUSPENDED' || status === 'EXPIRED') where.status = status;
  if (projectId && ids.includes(projectId)) where.projectId = projectId;
  const rows = await db.license.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500, select: { id: true, keyPrefix: true, status: true, maxDevices: true, devices: true, robloxUserId: true, discordId: true, expiresAt: true, usedCount: true, execLimit: true, banned: true, note: true, createdAt: true, projectId: true } });
  let licenses = rows.map(l => ({ ...l, devices: JSON.parse(l.devices || '[]') as string[] }));
  if (q) licenses = licenses.filter(l => (l.keyPrefix + ' ' + (l.robloxUserId || '') + ' ' + (l.note || '')).toLowerCase().includes(q));
  return NextResponse.json({ licenses, projects }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid license settings.' }, { status: 400 });
  const { projectId, robloxUserId, discordId, maxDevices, expiresInDays, count, note } = parsed.data;
  const db = await __getPrisma();
  const project = await db.project.findFirst({ where: { id: projectId, ownerId: user.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const batchId = count > 1 ? 'batch_' + Date.now().toString(36) : null;
  const created: { key: string; id: string }[] = [];
  for (let i = 0; i < count; i++) {
    const key = 'KSEC-' + randomBytes(24).toString('base64url').toUpperCase();
    const license = await db.license.create({ data: { keyHash: hashKey(key), keyPrefix: key.slice(0, 9), maxDevices, robloxUserId: robloxUserId || null, discordId: discordId || null, expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null, note: note || null, batchId, projectId } });
    created.push({ key, id: license.id });
  }
  await logAudit('license.created', projectId, user.id, count + ' key(s)' + (batchId ? ' batch ' + batchId : ''));
  return NextResponse.json({ keys: created, batchId }, { status: 201 });
}
