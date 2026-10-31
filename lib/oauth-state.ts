import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const STATE_COOKIE = 'kerssecure_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;

function stateKey() {
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (sessionSecret && sessionSecret.length >= 32) return sessionSecret;
  return process.env.DISCORD_CLIENT_SECRET?.trim() || 'kerssecure-oauth-state';
}

// The state is self-authenticating: nonce + issue time + HMAC. The cookie is
// still set as the primary check, but the callback no longer depends on the
// browser round-tripping it (a wiped cookie after a failed attempt used to
// mask the real error with a bogus "state validation failed").
export function issueState(): string {
  const nonce = randomBytes(16).toString('hex');
  const issued = Date.now().toString(36);
  const mac = createHmac('sha256', stateKey()).update(nonce + '.' + issued).digest('base64url');
  return nonce + '.' + issued + '.' + mac;
}

export function verifyState(state: unknown): boolean {
  const parts = String(state || '').split('.');
  if (parts.length !== 3) return false;
  const [nonce, issued, mac] = parts;
  if (!/^[0-9a-f]{32}$/.test(nonce) || !/^[0-9a-z]+$/.test(issued)) return false;
  const expected = createHmac('sha256', stateKey()).update(nonce + '.' + issued).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const ts = parseInt(issued, 36);
  if (!Number.isFinite(ts) || Date.now() - ts > STATE_TTL_MS) return false;
  return true;
}
