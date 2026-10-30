import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPrisma } from '@/lib/db';
import { createSession } from '@/lib/auth';
export const runtime = 'nodejs';
const STATE_COOKIE = 'kerssecure_oauth_state';
type DiscordProfile = { id: string; username: string; global_name?: string | null; avatar?: string | null; email?: string | null };
function redirectUri(origin: string) {
  const configured = process.env.DISCORD_REDIRECT_URI?.trim();
  if (configured) return configured;
  const base = process.env.APP_URL?.trim() || origin;
  return new URL('/api/auth/discord/callback', base).toString();
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:';
  const fail = (message: string, status = 400) => {
    const response = NextResponse.json({ error: message }, { status });
    response.cookies.set(STATE_COOKIE, '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  };
  if (url.searchParams.has('error')) return fail('Discord sign-in was cancelled or rejected.');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stateCookie = (await cookies()).get(STATE_COOKIE)?.value;
  if (!code || !state || !stateCookie || state !== stateCookie) return fail('OAuth state validation failed. Please try again.');
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return fail('Discord OAuth credentials are not configured.', 503);
  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri(url.origin) }),
      cache: 'no-store'
    });
    if (!tokenResponse.ok) return fail('Discord token exchange failed. Verify the exact callback URL in the Developer Portal.', 502);
    const token = await tokenResponse.json() as { access_token?: string; token_type?: string };
    if (!token.access_token) return fail('Discord did not return an access token.', 502);
    const profileResponse = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: (token.token_type || 'Bearer') + ' ' + token.access_token }, cache: 'no-store' });
    if (!profileResponse.ok) return fail('Unable to retrieve Discord profile.', 502);
    const profile = await profileResponse.json() as DiscordProfile;
    if (!profile.id || !profile.username) return fail('Discord profile response was invalid.', 502);
    const isOwner = !!process.env.OWNER_DISCORD_ID && profile.id === process.env.OWNER_DISCORD_ID.trim();
    const avatar = profile.avatar ? 'https://cdn.discordapp.com/avatars/' + profile.id + '/' + profile.avatar + '.png?size=128' : null;
    const prisma = await getPrisma();
    const user = await prisma.user.upsert({
      where: { discordId: profile.id },
      create: { discordId: profile.id, discordName: profile.global_name || profile.username, avatar, email: profile.email || null, role: isOwner ? 'OWNER' : 'USER' },
      update: { discordName: profile.global_name || profile.username, avatar, email: profile.email || null, ...(isOwner ? { role: 'OWNER' } : {}) }
    });
    if (user.suspended) return fail('This account has been suspended.', 403);
    const session = await createSession(user.id);
    const response = NextResponse.redirect(new URL('/dashboard', url.origin));
    response.cookies.set(STATE_COOKIE, '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 });
    response.cookies.set('kerssecure_session', session, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    console.error('Discord OAuth callback failed:', error);
    return fail('Sign-in failed. Check database and runtime configuration.', 500);
  }
}
