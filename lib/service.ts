import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getPrisma as __getPrisma } from '@/lib/db';

export function botAuthorized(request: Request): boolean {
  const secret = process.env.BOT_SECRET;
  if (!secret || secret.length < 32) return false;
  const header = request.headers.get('authorization') || '';
  const expected = 'Bearer ' + secret;
  if (header.length !== expected.length) return false;
  try { return timingSafeEqual(Buffer.from(header), Buffer.from(expected)); } catch { return false; }
}

export function hashKey(key: string): string {
  const secret = process.env.LICENSE_HASH_SECRET;
  if (!secret || secret.length < 32) throw new Error('LICENSE_HASH_SECRET must contain at least 32 characters.');
  return createHmac('sha256', secret).update('key:' + key).digest('hex');
}

export function deviceHash(device: string): string {
  const secret = process.env.LICENSE_HASH_SECRET;
  if (!secret || secret.length < 32) throw new Error('LICENSE_HASH_SECRET must contain at least 32 characters.');
  return createHmac('sha256', secret).update('device:' + device).digest('hex');
}

export function newLicenseKey(): string {
  return 'KSEC-' + randomBytes(24).toString('base64url').toUpperCase();
}

export async function logAudit(action: string, target?: string, actorId?: string, detail?: string) {
  try { await (await __getPrisma()).auditLog.create({ data: { action, target: target ?? null, actorId: actorId ?? null, metadata: detail ?? null } }); } catch { /* audit must never break the operation */ }
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const row = await (await __getPrisma()).platformSetting.findUnique({ where: { key } });
  if (!row) return null;
  try { return JSON.parse(row.value) as T; } catch { return null; }
}

export async function setSetting(key: string, value: unknown) {
  const prisma = await __getPrisma();
  await prisma.platformSetting.upsert({ where: { key }, update: { value: JSON.stringify(value) }, create: { key, value: JSON.stringify(value) } });
}
