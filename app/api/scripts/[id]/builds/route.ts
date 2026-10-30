import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';
import { obfuscateLua } from '@/lib/obfuscator';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params; const db = await __getPrisma();
  const script = await db.script.findFirst({ where: { id, project: { ownerId: user.id } } });
  if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  let body: any = {};
  try { body = await request.json(); } catch {}
  const preset = ['light', 'balanced', 'maximum'].includes(body.preset) ? body.preset : 'balanced';
  const src = script.code ?? '';
  if (!src || !src.trim()) return NextResponse.json({ error: 'This script has no source stored. Re-upload it.' }, { status: 400 });
  try {
    const t0 = Date.now();
    const result = obfuscateLua(src, preset as 'light' | 'balanced' | 'maximum');
    const duration = Date.now() - t0;
    const checksum = createHash('sha256').update(result.code).digest('hex');
    const build = await db.build.create({ data: { scriptId: script.id, code: result.code, preset, sizeBefore: result.sizeBefore, sizeAfter: result.sizeAfter, checksum, duration } });
    await db.auditLog.create({ data: { actorId: user.id, action: 'build.created', target: build.id } });
    return NextResponse.json({ build: { id: build.id, preset, sizeBefore: result.sizeBefore, sizeAfter: result.sizeAfter, checksum, duration, code: result.code } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Obfuscation failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params; const db = await __getPrisma();
  const script = await db.script.findFirst({ where: { id, project: { ownerId: user.id } }, select: { id: true } });
  if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  const builds = await db.build.findMany({ where: { scriptId: id }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, preset: true, sizeBefore: true, sizeAfter: true, checksum: true, duration: true, createdAt: true } });
  return NextResponse.json({ builds });
}
