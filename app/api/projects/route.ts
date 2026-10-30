import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';

export const runtime = 'nodejs';
const projectInput = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(500).optional().default('') });

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const projects = await (await __getPrisma()).project.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: 'desc' }, include: { _count: { select: { scripts: true, licenses: true } } } });
  return NextResponse.json({ projects }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = projectInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a project name between 2 and 80 characters.' }, { status: 400 });
  const project = await (await __getPrisma()).project.create({ data: { name: parsed.data.name, description: parsed.data.description || null, ownerId: user.id } });
  await (await __getPrisma()).auditLog.create({ data: { actorId: user.id, action: 'project.created', target: project.id } });
  return NextResponse.json({ project }, { status: 201 });
}
