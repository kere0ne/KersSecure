import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';
import { getSetting, setSetting, logAudit } from '@/lib/service';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ path?: string[] }> };
function deny(msg: string, status = 403) { return NextResponse.json({ error: msg }, { status, headers: { 'Cache-Control': 'no-store' } }); }
async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { error: deny('Unauthorized', 401) };
  if (user.role !== 'OWNER' && user.role !== 'ADMIN') return { error: deny('Admins only.') };
  return { user };
}
export async function GET(request: Request, ctx: Ctx) {
  const gate = await requireAdmin(); if (gate.error) return gate.error;
  const { path = [] } = await ctx.params;
  const route = path.join('/'); const prisma = await __getPrisma();
  const url = new URL(request.url);
  try {
    switch (route) {
      case 'overview': {
        const since24 = new Date(Date.now() - 86400000); const since7 = new Date(Date.now() - 7 * 86400000); const since14 = new Date(Date.now() - 14 * 86400000);
        const [users, projects, scripts, licenses, active, execsToday, execs7, recentUsers] = await Promise.all([
          prisma.user.count(), prisma.project.count(), prisma.script.count(), prisma.license.count(),
          prisma.license.count({ where: { status: 'ACTIVE' } }),
          prisma.executionLog.count({ where: { createdAt: { gte: since24 } } }),
          prisma.executionLog.count({ where: { createdAt: { gte: since7 } } }),
          prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, discordName: true, discordId: true, role: true, suspended: true, createdAt: true } }),
        ]);
        const rows = await prisma.executionLog.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true, outcome: true } });
        const series: Record<string, { authorized: number; denied: number }> = {};
        for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); series[d.toISOString().slice(0, 10)] = { authorized: 0, denied: 0 }; }
        for (const r of rows) { const k = r.createdAt.toISOString().slice(0, 10); if (series[k]) series[k][r.outcome === 'authorized' ? 'authorized' : 'denied']++; }
        const maintenance = await getSetting<{ enabled?: boolean; message?: string }>('maintenance');
        const beat = await getSetting<{ ts?: number; guilds?: number }>('bot_status');
        return NextResponse.json({ stats: { users, projects, scripts, licenses, active, execsToday, execs7 }, series, maintenance: maintenance ?? { enabled: false }, bot: { online: !!beat?.ts && Date.now() - beat.ts < 600000, lastBeat: beat?.ts ?? null, guilds: beat?.guilds ?? null }, recentUsers }, { headers: { 'Cache-Control': 'no-store' } });
      }
      case 'users': {
        const q = url.searchParams.get('q')?.trim();
        const users = await prisma.user.findMany({ where: q ? { OR: [{ discordName: { contains: q } }, { discordId: { contains: q } }] } : {}, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, discordId: true, discordName: true, role: true, suspended: true, createdAt: true, _count: { select: { projects: true, licenses: true } } } });
        return NextResponse.json({ users }, { headers: { 'Cache-Control': 'no-store' } });
      }
      case 'projects': {
        const projects = await prisma.project.findMany({ orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, name: true, createdAt: true, owner: { select: { discordName: true } }, _count: { select: { scripts: true, licenses: true } } } });
        return NextResponse.json({ projects }, { headers: { 'Cache-Control': 'no-store' } });
      }
      case 'scripts': {
        const scripts = await prisma.script.findMany({ orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, publicId: true, name: true, status: true, createdAt: true, project: { select: { name: true, owner: { select: { discordName: true } } } }, _count: { select: { executions: true, builds: true } } } });
        return NextResponse.json({ scripts }, { headers: { 'Cache-Control': 'no-store' } });
      }
      case 'keys': {
        const q = url.searchParams.get('q')?.trim();
        const keys = await prisma.license.findMany({ where: q ? { OR: [{ keyPrefix: { contains: q } }, { discordId: { contains: q } }, { robloxUserId: { contains: q } }] } : {}, orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, keyPrefix: true, status: true, banned: true, expiresAt: true, maxDevices: true, devices: true, usedCount: true, execLimit: true, discordId: true, robloxUserId: true, note: true, createdAt: true, project: { select: { name: true } } } });
        return NextResponse.json({ keys: keys.map(k => ({ ...k, devices: JSON.parse(k.devices || '[]').length })) }, { headers: { 'Cache-Control': 'no-store' } });
      }
      case 'subscriptions': {
        const subs = await prisma.subscription.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
        const userIds = [...new Set(subs.map(s2 => s2.userId))];
        const owners = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, discordName: true, discordId: true } }) : [];
        const ownerOf = new Map(owners.map(u => [u.id, u]));
        return NextResponse.json({ subscriptions: subs.map(s2 => ({ ...s2, user: s2.userId ? ownerOf.get(s2.userId) ?? null : null })) }, { headers: { 'Cache-Control': 'no-store' } });
      }
      case 'audit': {
        const audit = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { actor: { select: { discordName: true } } } });
        return NextResponse.json({ audit }, { headers: { 'Cache-Control': 'no-store' } });
      }
      case 'settings': return NextResponse.json({ maintenance: await getSetting('maintenance') ?? { enabled: false, message: '' } }, { headers: { 'Cache-Control': 'no-store' } });
      case 'bot': {
        const beat = await getSetting<{ ts?: number; guilds?: number }>('bot_status');
        return NextResponse.json({ bot: { online: !!beat?.ts && Date.now() - beat.ts < 600000, lastBeat: beat?.ts ?? null, guilds: beat?.guilds ?? null } }, { headers: { 'Cache-Control': 'no-store' } });
      }
      default: return deny('Unknown admin endpoint.', 404);
    }
  } catch (error) { console.error('Admin API failure on', route, error); return NextResponse.json({ error: 'Backend error.' }, { status: 500 }); }
}
export async function POST(request: Request, ctx: Ctx) {
  const gate = await requireAdmin(); if (gate.error) return gate.error;
  const admin = gate.user!;
  const { path = [] } = await ctx.params;
  const route = path.join('/'); const prisma = await __getPrisma();
  const b = await request.json().catch(() => ({} as Record<string, unknown>));
  const seg = route.split('/');
  try {
    if (seg[0] === 'users' && seg[1]) {
      const action = (b as { action?: string }).action;
      const user = await prisma.user.findUnique({ where: { id: seg[1] } });
      if (!user) return deny('User not found.', 404);
      if (user.role === 'OWNER' && action && action !== 'demote') return deny('The owner account cannot be modified this way.', 400);
      if (action === 'ban') { await prisma.user.update({ where: { id: user.id }, data: { suspended: true } }); await prisma.license.updateMany({ where: { discordId: user.discordId }, data: { banned: true } }); }
      else if (action === 'unban') { await prisma.user.update({ where: { id: user.id }, data: { suspended: false } }); await prisma.license.updateMany({ where: { discordId: user.discordId }, data: { banned: false } }); }
      else if (action === 'promote') await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
      else if (action === 'demote') await prisma.user.update({ where: { id: user.id }, data: { role: 'CUSTOMER' } });
      else if (action === 'delete') await prisma.user.delete({ where: { id: user.id } });
      else return deny('Unknown action.', 400);
      await logAudit('admin.user.' + action, user.id, admin.id);
      return NextResponse.json({ ok: true });
    }
    if (seg[0] === 'projects' && seg[1]) {
      if ((b as { action?: string }).action === 'delete') { await prisma.project.delete({ where: { id: seg[1] } }); await logAudit('admin.project.deleted', seg[1], admin.id); return NextResponse.json({ ok: true }); }
      return deny('Unknown action.', 400);
    }
    if (seg[0] === 'scripts' && seg[1]) {
      const action = (b as { action?: string }).action;
      const script = await prisma.script.findUnique({ where: { id: seg[1] } });
      if (!script) return deny('Script not found.', 404);
      if (action === 'disable') await prisma.script.update({ where: { id: script.id }, data: { status: 'ARCHIVED' } });
      else if (action === 'enable') await prisma.script.update({ where: { id: script.id }, data: { status: 'PUBLISHED' } });
      else if (action === 'delete') await prisma.script.delete({ where: { id: script.id } });
      else return deny('Unknown action.', 400);
      await logAudit('admin.script.' + action, script.id, admin.id);
      return NextResponse.json({ ok: true });
    }
    if (seg[0] === 'keys' && seg[1]) {
      const action = (b as { action?: string }).action;
      const license = await prisma.license.findUnique({ where: { id: seg[1] } });
      if (!license) return deny('Key not found.', 404);
      const data: Record<string, unknown> = {};
      if (action === 'revoke') data.status = 'REVOKED';
      else if (action === 'activate') data.status = 'ACTIVE';
      else if (action === 'ban') data.banned = true;
      else if (action === 'unban') data.banned = false;
      else if (action === 'reset-hwid') { data.devices = '[]'; data.deviceHash = null; }
      else if (action === 'extend') { const days = Number((b as { days?: number }).days); if (!days || days <= 0) return deny('days required.', 400); const base = license.expiresAt && license.expiresAt > new Date() ? license.expiresAt.getTime() : Date.now(); data.expiresAt = new Date(base + days * 86400000); }
      else if (action === 'limit') { const n = Number((b as { limit?: number }).limit); if (!Number.isFinite(n) || n < 0) return deny('limit required.', 400); data.execLimit = n === 0 ? null : n; }
      else if (action === 'delete') { await prisma.license.delete({ where: { id: license.id } }); await logAudit('admin.key.deleted', license.id, admin.id); return NextResponse.json({ ok: true }); }
      else return deny('Unknown action.', 400);
      await prisma.license.update({ where: { id: license.id }, data });
      await logAudit('admin.key.' + action, license.id, admin.id);
      return NextResponse.json({ ok: true });
    }
    if (seg[0] === 'subscriptions' && seg[1]) {
      const sub = await prisma.subscription.findUnique({ where: { id: seg[1] } });
      if (!sub) return deny('Subscription not found.', 404);
      const plan = typeof (b as { plan?: string }).plan === 'string' ? (b as { plan: string }).plan : sub.plan;
      const status = typeof (b as { status?: string }).status === 'string' ? (b as { status: string }).status : sub.status;
      await prisma.subscription.update({ where: { id: sub.id }, data: { plan: plan.slice(0, 40), status: status.slice(0, 40) } });
      await logAudit('admin.subscription.updated', sub.id, admin.id, `plan=${plan} status=${status}`);
      return NextResponse.json({ ok: true });
    }
    if (seg[0] === 'settings') {
      const m = (b as { maintenance?: { enabled?: boolean; message?: string } }).maintenance;
      if (m && typeof m.enabled === 'boolean') await setSetting('maintenance', { enabled: m.enabled, message: (m.message || '').slice(0, 300) });
      await logAudit('admin.settings.updated', undefined, admin.id);
      return NextResponse.json({ ok: true });
    }
    return deny('Unknown admin endpoint.', 404);
  } catch (error) { console.error('Admin API failure on', route, error); return NextResponse.json({ error: 'Backend error.' }, { status: 500 }); }
}
