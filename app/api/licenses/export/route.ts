import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';
import { logAudit } from '@/lib/service';

export const runtime = 'nodejs';
export async function GET() {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await __getPrisma();
  const projects = await db.project.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } });
  const ids = projects.map(p => p.id);
  const nameOf = new Map(projects.map(p => [p.id, p.name]));
  const rows = await db.license.findMany({ where: { projectId: { in: ids } }, orderBy: { createdAt: 'desc' } });
  const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const lines = ['key_prefix,status,roblox_user_id,discord_id,max_devices,expires_at,used_count,exec_limit,banned,note,project,created_at'];
  for (const l of rows) lines.push([l.keyPrefix, l.status, l.robloxUserId, l.discordId, l.maxDevices, l.expiresAt?.toISOString() ?? '', l.usedCount, l.execLimit ?? '', l.banned, l.note, nameOf.get(l.projectId) ?? '', l.createdAt.toISOString()].map(esc).join(','));
  return new NextResponse(lines.join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="whitelist.csv"', 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await __getPrisma();
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a CSV file.' }, { status: 400 });
  const text = await file.text();
  const projects = await db.project.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } });
  const nameOf = new Map(projects.map(p => [p.name.toLowerCase(), p.id]));
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return NextResponse.json({ error: 'Empty file.' }, { status: 400 });
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const pi = (name: string) => header.indexOf(name);
  if (pi('key') < 0 && pi('key_prefix') < 0) return NextResponse.json({ error: 'CSV needs a key or key_prefix column.' }, { status: 400 });
  const { hashKey } = await import('@/lib/service');
  let imported = 0; const errors: string[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')) ?? [];
    if (!cols.length) continue;
    const key = (cols[pi('key')] || cols[pi('key_prefix')] || '').trim();
    if (!key) continue;
    const projectName = (cols[pi('project')] || '').trim().toLowerCase();
    const projectId = nameOf.get(projectName) || projects[0]?.id;
    if (!projectId) { errors.push('no project for ' + key); continue; }
    try {
      const status = (cols[pi('status')] || 'ACTIVE').toUpperCase();
      const exp = cols[pi('expires_at')] ? new Date(cols[pi('expires_at')]) : null;
      await db.license.create({ data: { keyHash: hashKey(key), keyPrefix: key.slice(0, 9), status: ['ACTIVE', 'SUSPENDED', 'EXPIRED'].includes(status) ? status : 'ACTIVE', robloxUserId: (cols[pi('roblox_user_id')] || '').trim() || null, maxDevices: Math.max(1, Math.min(50, parseInt(cols[pi('max_devices')]) || 1)), expiresAt: exp && !isNaN(exp.getTime()) ? exp : null, projectId } });
      imported++;
    } catch { errors.push(key.slice(0, 9)); }
  }
  await logAudit('whitelist.imported', undefined, user.id, imported + ' imported, ' + errors.length + ' skipped');
  return NextResponse.json({ imported, skipped: errors.length });
}
