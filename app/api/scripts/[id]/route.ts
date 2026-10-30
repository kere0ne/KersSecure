import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';
import { logAudit } from '@/lib/service';

export const runtime = 'nodejs';
const MAX_CODE = 2 * 1024 * 1024;

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params; const db = await __getPrisma();
  const script = await db.script.findFirst({ where: { id, project: { ownerId: user.id } }, include: { project: { select: { id: true, name: true } } } });
  if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  const versions = await db.scriptVersion.findMany({ where: { scriptId: id }, orderBy: { version: 'desc' }, select: { id: true, version: true, checksum: true, createdAt: true, storageKey: true } });
  return NextResponse.json({ script: { id: script.id, publicId: script.publicId, name: script.name, filename: script.filename, status: script.status, version: script.version, code: script.code ?? '', project: script.project, versions } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params; const db = await __getPrisma();
  const script = await db.script.findFirst({ where: { id, project: { ownerId: user.id } } });
  if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  const body = await request.json().catch(() => null); if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 120);
  if (body.status === 'PUBLISHED' || body.status === 'DRAFT' || body.status === 'ARCHIVED') data.status = body.status;
  let newVersion: number | null = null;
  if (typeof body.code === 'string') {
    const code = body.code; if (code.length > MAX_CODE) return NextResponse.json({ error: 'Script source exceeds 2 MB.' }, { status: 400 });
    const checksum = createHash('sha256').update(code).digest('hex');
    if (checksum !== createHash('sha256').update(script.code ?? '').digest('hex')) {
      newVersion = script.version + 1;
      data.code = code; data.version = newVersion;
      await db.scriptVersion.create({ data: { scriptId: id, storageKey: 'editor/' + id + '/v' + newVersion, version: newVersion, checksum } });
    }
  }
  const updated = await db.script.update({ where: { id }, data });
  if (newVersion) await db.script.update({ where: { id }, data: { updatedAt: new Date() } });
  await logAudit('script.updated', id, user.id, newVersion ? 'v' + newVersion : 'meta');
  return NextResponse.json({ script: { id: updated.id, name: updated.name, status: updated.status, version: updated.version, publicId: updated.publicId }, newVersion });
}

export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params; const db = await __getPrisma();
  const script = await db.script.findFirst({ where: { id, project: { ownerId: user.id } }, select: { id: true } });
  if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  await db.script.delete({ where: { id } });
  await logAudit('script.deleted', id, user.id);
  return NextResponse.json({ ok: true });
}
