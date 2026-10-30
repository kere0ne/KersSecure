import { NextResponse } from 'next/server';
import { botAuthorized, hashKey, newLicenseKey, logAudit, getSetting, setSetting } from '@/lib/service';
import { getPrisma as __getPrisma } from '@/lib/db';

export const runtime = 'nodejs';

function deny(reason: string, status = 403) { return NextResponse.json({ ok: false, error: reason }, { status, headers: { 'Cache-Control': 'no-store' } }); }

type Ctx = { params: Promise<{ path?: string[] }> };

async function findLicense(key: string) {
  const prisma = await __getPrisma();
  const clean = (key || '').trim();
  if (clean.length < 8) return null;
  return prisma.license.findUnique({ where: { keyHash: hashKey(clean) }, include: { project: { select: { name: true } } } });
}
function licView(l: NonNullable<Awaited<ReturnType<typeof findLicense>>>) {
  return { id: l.id, keyPrefix: l.keyPrefix, status: l.status, banned: l.banned, expiresAt: l.expiresAt, maxDevices: l.maxDevices, devices: JSON.parse(l.devices || '[]').length, usedCount: l.usedCount, execLimit: l.execLimit, robloxUserId: l.robloxUserId, discordId: l.discordId, note: l.note, project: l.project?.name ?? null, createdAt: l.createdAt };
}

export async function GET(request: Request, ctx: Ctx) { return handle(request, ctx, null); }
export async function POST(request: Request, ctx: Ctx) { return handle(request, ctx, await request.json().catch(() => ({}))); }

async function handle(request: Request, ctx: Ctx, body: unknown) {
  const { path = [] } = await ctx.params;
  const route = path.join('/');
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim() : '');
  const num = (k: string) => (typeof b[k] === 'number' && Number.isFinite(b[k]) ? (b[k] as number) : null);
  const prisma = await __getPrisma();

  if (route === 'status' && request.method === 'GET') {
    const beat = await getSetting<{ ts?: number; guilds?: number }>('bot_status');
    const online = !!beat?.ts && Date.now() - (beat.ts ?? 0) < 10 * 60 * 1000;
    return NextResponse.json({ ok: true, online, lastBeat: beat?.ts ?? null, guilds: beat?.guilds ?? null }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (!botAuthorized(request)) return deny('Unauthorized', 401);

  try {
    switch (route) {
      case 'heartbeat': { await setSetting('bot_status', { ts: Date.now(), guilds: num('guilds') ?? 0 }); return NextResponse.json({ ok: true }); }
      case 'stats': {
        const [users, projects, scripts, licenses, active, execs] = await Promise.all([
          prisma.user.count(), prisma.project.count(), prisma.script.count(), prisma.license.count(),
          prisma.license.count({ where: { status: 'ACTIVE' } }),
          prisma.executionLog.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }),
        ]);
        return NextResponse.json({ ok: true, stats: { users, projects, scripts, licenses, active, execs24h: execs } });
      }
      case 'logs': {
        const limit = Math.min(num('limit') ?? 50, 200);
        const logs = await prisma.executionLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { script: { select: { name: true } } } });
        const licIds = [...new Set(logs.map(l => l.licenseId).filter((v): v is string => !!v))];
        const lics = licIds.length ? await prisma.license.findMany({ where: { id: { in: licIds } }, select: { id: true, keyPrefix: true } }) : [];
        const prefixOf = new Map(lics.map(l => [l.id, l.keyPrefix]));
        return NextResponse.json({ ok: true, logs: logs.map(l => ({ id: l.id, script: l.script?.name ?? null, key: l.licenseId ? prefixOf.get(l.licenseId) ?? null : null, outcome: l.outcome, createdAt: l.createdAt })) });
      }
      case 'projects': {
        const rows = await prisma.project.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, name: true, owner: { select: { discordName: true } } } });
        return NextResponse.json({ ok: true, projects: rows.map(r => ({ id: r.id, name: r.name, owner: r.owner?.discordName ?? null })) });
      }
      case 'scripts': {
        const rows = await prisma.script.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, publicId: true, name: true, status: true, project: { select: { name: true } }, _count: { select: { executions: true } } } });
        return NextResponse.json({ ok: true, scripts: rows.map(r => ({ id: r.id, publicId: r.publicId, name: r.name, status: r.status, project: r.project?.name ?? null, execs: r._count.executions })) });
      }
      case 'projects/create': {
        const name = str('name').slice(0, 80);
        if (!name) return deny('Project name is required.', 400);
        const owner = await prisma.user.findFirst({ where: { role: 'OWNER' }, orderBy: { createdAt: 'asc' } });
        if (!owner) return deny('No owner account exists yet.', 400);
        const project = await prisma.project.create({ data: { name, ownerId: owner.id } });
        await logAudit('project.created_by_bot', project.id, owner.id);
        return NextResponse.json({ ok: true, project: { id: project.id, name: project.name } }, { status: 201 });
      }
      case 'keys/generate': {
        const projectId = str('projectId');
        const count = Math.min(Math.max(num('count') ?? 1, 1), 100);
        if (!projectId) return deny('projectId is required.', 400);
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return deny('Project not found.', 404);
        const days = num('days'); const maxDevices = Math.min(Math.max(num('maxDevices') ?? 1, 1), 20);
        const execLimit = num('execLimit'); const note = str('note').slice(0, 200) || null; const robloxUserId = str('robloxUserId').slice(0, 32) || null;
        const batchId = 'batch_' + Date.now().toString(36);
        const keys: string[] = [];
        await prisma.$transaction(Array.from({ length: count }, () => {
          const key = newLicenseKey(); keys.push(key);
          return prisma.license.create({ data: { keyHash: hashKey(key), keyPrefix: key.slice(0, 9), projectId, maxDevices, robloxUserId, execLimit, note, batchId, expiresAt: days && days > 0 ? new Date(Date.now() + days * 86400000) : null } });
        }));
        await logAudit('license.batch_generated', projectId, undefined, `count=${count} batch=${batchId}`);
        return NextResponse.json({ ok: true, keys, batchId }, { status: 201 });
      }
      case 'keys/info': {
        const license = await findLicense(str('key'));
        if (!license) return NextResponse.json({ ok: true, found: false });
        return NextResponse.json({ ok: true, found: true, license: licView(license) });
      }
      case 'keys/redeem': {
        const license = await findLicense(str('key'));
        const discordId = str('discordId');
        if (!license) return deny('Invalid key.', 404);
        if (license.status !== 'ACTIVE') return deny('Key is not active.', 403);
        if (license.banned) return deny('Key is banned.', 403);
        if (license.expiresAt && license.expiresAt <= new Date()) return deny('Key is expired.', 403);
        if (license.discordId && license.discordId !== discordId) return deny('Key is already linked to another Discord account.', 409);
        await prisma.license.update({ where: { id: license.id }, data: { discordId } });
        await logAudit('license.redeemed_discord', license.id, undefined, `discord=${discordId}`);
        return NextResponse.json({ ok: true, license: licView(license) });
      }
      case 'keys/delete': {
        const license = await findLicense(str('key'));
        if (!license) return deny('Key not found.', 404);
        await prisma.license.delete({ where: { id: license.id } });
        await logAudit('license.deleted_by_bot', license.id);
        return NextResponse.json({ ok: true });
      }
      case 'keys/reset-hwid': {
        const license = await findLicense(str('key'));
        if (!license) return deny('Key not found.', 404);
        await prisma.license.update({ where: { id: license.id }, data: { devices: '[]', deviceHash: null } });
        await logAudit('license.hwid_reset_by_bot', license.id);
        return NextResponse.json({ ok: true });
      }
      case 'keys/extend': {
        const license = await findLicense(str('key'));
        const days = num('days');
        if (!license) return deny('Key not found.', 404);
        if (!days || days <= 0 || days > 3650) return deny('days must be between 1 and 3650.', 400);
        const base = license.expiresAt && license.expiresAt > new Date() ? license.expiresAt.getTime() : Date.now();
        await prisma.license.update({ where: { id: license.id }, data: { expiresAt: new Date(base + days * 86400000) } });
        await logAudit('license.extended_by_bot', license.id, undefined, `days=${days}`);
        return NextResponse.json({ ok: true, expiresAt: new Date(base + days * 86400000) });
      }
      case 'keys/revoke': {
        const license = await findLicense(str('key'));
        if (!license) return deny('Key not found.', 404);
        await prisma.license.update({ where: { id: license.id }, data: { status: 'REVOKED' } });
        await logAudit('license.revoked_by_bot', license.id);
        return NextResponse.json({ ok: true });
      }
      case 'users/get': {
        const discordId = str('discordId');
        const user = await prisma.user.findUnique({ where: { discordId } });
        const licenses = await prisma.license.findMany({ where: { discordId }, include: { project: { select: { name: true } } } });
        return NextResponse.json({ ok: true, user: user ? { id: user.id, discordId, discordName: user.discordName, role: user.role, suspended: user.suspended, createdAt: user.createdAt } : null, licenses: licenses.map(licView) });
      }
      case 'users/ban': {
        const discordId = str('discordId');
        await prisma.license.updateMany({ where: { discordId }, data: { banned: true } });
        await prisma.user.updateMany({ where: { discordId }, data: { suspended: true } });
        await logAudit('user.banned_by_bot', discordId);
        return NextResponse.json({ ok: true });
      }
      case 'users/unban': {
        const discordId = str('discordId');
        await prisma.license.updateMany({ where: { discordId }, data: { banned: false } });
        await prisma.user.updateMany({ where: { discordId }, data: { suspended: false } });
        await logAudit('user.unbanned_by_bot', discordId);
        return NextResponse.json({ ok: true });
      }
      case 'users/setexpiry': {
        const license = await findLicense(str('key'));
        const days = num('days');
        if (!license) return deny('Key not found.', 404);
        if (days == null || days < 0) return deny('days must be 0 or more.', 400);
        const expiresAt = days === 0 ? null : new Date(Date.now() + days * 86400000);
        await prisma.license.update({ where: { id: license.id }, data: { expiresAt } });
        await logAudit('license.expiry_set_by_bot', license.id, undefined, `days=${days}`);
        return NextResponse.json({ ok: true, expiresAt });
      }
      case 'users/remove': {
        const discordId = str('discordId');
        await prisma.license.updateMany({ where: { discordId }, data: { discordId: null } });
        const user = await prisma.user.findUnique({ where: { discordId } });
        if (user && user.role !== 'OWNER') await prisma.user.delete({ where: { id: user.id } });
        await logAudit('user.removed_by_bot', discordId);
        return NextResponse.json({ ok: true });
      }
      case 'scripts/add': {
        const code = typeof b.code === 'string' ? (b.code as string) : '';
        if (!code || code.length > 2 * 1024 * 1024) return deny('code must be between 1 byte and 2 MB.', 400);
        const name = (str('name') || str('filename') || 'script').replace(/\.(lua|luau|txt)$/i, '').slice(0, 120);
        const filename = (str('filename') || name + '.lua').slice(0, 120);
        let projectId = str('projectId');
        if (!projectId) {
          const owner = await prisma.user.findFirst({ where: { role: 'OWNER' }, orderBy: { createdAt: 'asc' } });
          if (!owner) return deny('No owner account exists yet.', 400);
          const project = await prisma.project.create({ data: { name: 'Discord Scripts', ownerId: owner.id } });
          projectId = project.id;
        } else if (!(await prisma.project.findUnique({ where: { id: projectId } }))) return deny('Project not found.', 404);
        const script = await prisma.script.create({ data: { name, filename, code, projectId, status: 'PUBLISHED' } });
        await logAudit('script.added_by_bot', script.id);
        return NextResponse.json({ ok: true, script: { id: script.id, publicId: script.publicId, name: script.name } }, { status: 201 });
      }
      case 'scripts/update': {
        const script = await prisma.script.findUnique({ where: { id: str('scriptId') } });
        if (!script) return deny('Script not found.', 404);
        const code = typeof b.code === 'string' ? (b.code as string) : '';
        if (!code || code.length > 2 * 1024 * 1024) return deny('code must be between 1 byte and 2 MB.', 400);
        await prisma.script.update({ where: { id: script.id }, data: { code, version: { increment: 1 } } });
        await logAudit('script.updated_by_bot', script.id);
        return NextResponse.json({ ok: true });
      }
      case 'scripts/delete': {
        const script = await prisma.script.findUnique({ where: { id: str('scriptId') } });
        if (!script) return deny('Script not found.', 404);
        await prisma.script.delete({ where: { id: script.id } });
        await logAudit('script.deleted_by_bot', script.id);
        return NextResponse.json({ ok: true });
      }
      case 'scripts/disable': {
        const script = await prisma.script.findUnique({ where: { id: str('scriptId') } });
        if (!script) return deny('Script not found.', 404);
        await prisma.script.update({ where: { id: script.id }, data: { status: 'ARCHIVED' } });
        await logAudit('script.disabled_by_bot', script.id);
        return NextResponse.json({ ok: true });
      }
      case 'scripts/enable': {
        const script = await prisma.script.findUnique({ where: { id: str('scriptId') } });
        if (!script) return deny('Script not found.', 404);
        await prisma.script.update({ where: { id: script.id }, data: { status: 'PUBLISHED' } });
        await logAudit('script.enabled_by_bot', script.id);
        return NextResponse.json({ ok: true });
      }
      case 'scripts/stats': {
        const script = await prisma.script.findUnique({ where: { id: str('scriptId') } });
        if (!script) return deny('Script not found.', 404);
        const [total, day, week] = await Promise.all([
          prisma.executionLog.count({ where: { scriptId: script.id } }),
          prisma.executionLog.count({ where: { scriptId: script.id, createdAt: { gte: new Date(Date.now() - 86400000) } } }),
          prisma.executionLog.count({ where: { scriptId: script.id, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
        ]);
        return NextResponse.json({ ok: true, stats: { total, day, week } });
      }
      case 'guild/set': {
        const guildId = str('guildId');
        if (!guildId) return deny('guildId is required.', 400);
        const data = { name: str('name') || null, adminRoles: JSON.stringify(Array.isArray(b.adminRoles) ? b.adminRoles : []), staffRoles: JSON.stringify(Array.isArray(b.staffRoles) ? b.staffRoles : []), buyerRole: str('buyerRole') || null, premiumRole: str('premiumRole') || null, logChannel: str('logChannel') || null, verifyChannel: str('verifyChannel') || null, ticketChannel: str('ticketChannel') || null, welcomeChannel: str('welcomeChannel') || null, announceChannel: str('announceChannel') || null, welcomeMessage: str('welcomeMessage') || null, redeemSettings: JSON.stringify(typeof b.redeemSettings === 'object' && b.redeemSettings ? b.redeemSettings : {}) };
        const guild = await prisma.guildConfig.upsert({ where: { guildId }, update: data, create: { guildId, ...data } });
        await logAudit('guild.configured', guildId);
        return NextResponse.json({ ok: true, guild: { id: guild.id, guildId: guild.guildId } });
      }
      case 'guild/get': {
        const guild = await prisma.guildConfig.findUnique({ where: { guildId: str('guildId') } });
        return NextResponse.json({ ok: true, guild: guild ? { ...guild, adminRoles: JSON.parse(guild.adminRoles || '[]'), staffRoles: JSON.parse(guild.staffRoles || '[]'), redeemSettings: JSON.parse(guild.redeemSettings || '{}') } : null });
      }
      case 'announce': {
        const guildId = str('guildId'); const content = str('content');
        if (!guildId || !content) return deny('guildId and content are required.', 400);
        const row = await prisma.announcement.create({ data: { guildId, channelId: str('channelId') || null, content: content.slice(0, 2000), createdBy: str('createdBy') || null } });
        await logAudit('announcement.created', guildId, undefined, content.slice(0, 80));
        return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
      }
      case 'maintenance': {
        const enabled = b.enabled === true;
        const message = str('message').slice(0, 300) || 'The platform is under maintenance. Please try again shortly.';
        await setSetting('maintenance', { enabled, message });
        await logAudit('maintenance.toggled', undefined, undefined, `enabled=${enabled}`);
        return NextResponse.json({ ok: true, maintenance: { enabled, message } });
      }
      default: return deny('Unknown bot endpoint.', 404);
    }
  } catch (error) {
    console.error('Bot API failure on', route, error);
    return NextResponse.json({ ok: false, error: 'Backend error.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
