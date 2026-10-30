import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';
import { hashKey, newLicenseKey, logAudit } from '@/lib/service';

export const runtime = 'nodejs';
const schema = z.object({ projectId: z.string().min(1), count: z.number().int().min(1).max(50).default(1), expiresInDays: z.number().int().min(1).max(3650).nullable().default(null), maxDevices: z.number().int().min(1).max(20).default(1), robloxUserId: z.string().trim().max(32).optional(), execLimit: z.number().int().min(1).max(1000000).nullable().default(null), note: z.string().trim().max(200).optional() });
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const prisma = await __getPrisma();
  const projects = await prisma.project.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } });
  const map = new Map(projects.map(p => [p.id, p.name]));
  const keys = await prisma.license.findMany({ where: { projectId: { in: projects.map(p => p.id) } }, orderBy: { createdAt: 'desc' }, take: 500, select: { id: true, keyPrefix: true, status: true, banned: true, expiresAt: true, maxDevices: true, devices: true, usedCount: true, execLimit: true, discordId: true, robloxUserId: true, note: true, batchId: true, projectId: true, createdAt: true } });
  return NextResponse.json({ keys: keys.map(k => ({ ...k, devices: JSON.parse(k.devices || '[]').length, project: map.get(k.projectId) ?? null })) }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid key settings.' }, { status: 400 });
  const prisma = await __getPrisma();
  const project = await prisma.project.findFirst({ where: { id: parsed.data.projectId, ownerId: user.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  const batchId = 'batch_' + Date.now().toString(36);
  const keys: string[] = [];
  await prisma.$transaction(Array.from({ length: parsed.data.count }, () => {
    const key = newLicenseKey(); keys.push(key);
    return prisma.license.create({
      data: { keyHash: hashKey(key), keyPrefix: key.slice(0, 9), projectId: project.id, maxDevices: parsed.data.maxDevices, robloxUserId: parsed.data.robloxUserId || null, execLimit: parsed.data.execLimit, note: parsed.data.note || null, batchId, expiresAt: parsed.data.expiresInDays ? new Date(Date.now() + parsed.data.expiresInDays * 86400000) : null },
    });
  }));
  await logAudit('license.batch_generated', project.id, user.id, `count=${parsed.data.count} batch=${batchId}`);
  return NextResponse.json({ keys, batchId }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
