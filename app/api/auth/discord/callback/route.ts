import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/auth';

export const runtime = 'nodejs';
const STATE_COOKIE = 'kerssecure_oauth_state';
const SESSION_COOKIE = 'kerssecure_session';
type DiscordUser = { id: string; username: string; global_name?: string | null; avatar?: string | null; email?: string | null };

function getRedirectUri(origin: string) {
  const configured = process.env.DISCORD_REDIRECT_URI?.trim();
  if (configured) return configured;
  const appUrl = process.env.APP_URL?.trim();
  const base = appUrl ? new URL(appUrl).origin : origin;
  return new URL('/api/auth/discord/callback', base).toString();
}

function clearState(response: NextResponse, secure: boolean) {
  response.cookies.set(STATE_COOKIE, '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:';
  const fail = (message: string, status = 400) => clearState(NextResponse.json({ error: message }, { status }), secure);
  const oauthError = url.searchParams.get('error');
  if (oauthError) return fail(oauthError === 'access_denied' ? 'Discord sign-in was cancelled.' : 'Discord authorization failed.', 400);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stateCookie = (await cookies()).get(STATE_COOKIE)?.value;
  if (!code || !state || !stateCookie || state !== stateCookie) return fail('Discord authorization state validation failed. Please try signing in again.');

  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return fail('Discord sign-in is not configured. Check DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET.', 503);

  try {
    const redirectUri = getRedirectUri(url.origin);
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
      cache: 'no-store',
    });
    if (!tokenResponse.ok) {
      const details = await tokenResponse.text();
      console.error('Discord token exchange rejected:', tokenResponse.status, details.slice(0, 500));
      return fail('Discord rejected the callback. Make sure the OAuth2 redirect URL exactly matches DISCORD_REDIRECT_URI in the Discord Developer Portal.', 502);
    }
    const token = await tokenResponse.json() as { access_token?: string; token_type?: string };
    if (!token.access_token) return fail('Discord did not return an access token.', 502);

    const profileResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: (token.token_type || 'Bearer') + ' ' + token.access_token },
      cache: 'no-store',
    });
    if (!profileResponse.ok) return fail('Could not retrieve your Discord profile. Please try again.', 502);
    const profile = await profileResponse.json() as DiscordUser;
    if (!profile.id || !profile.username) return fail('Discord returned an invalid profile.', 502);

    const isOwner = !!process.env.OWNER_DISCORD_ID && profile.id === process.env.OWNER_DISCORD_ID.trim();
    const avatar = profile.avatar ? 'https://cdn.discordapp.com/avatars/' + profile.id + '/' + profile.avatar + '.png?size=128' : null;
    const user = await prisma.user.upsert({
      where: { discordId: profile.id },
      create: { discordId: profile.id, discordName: profile.global_name || profile.username, avatar, email: profile.email || null, ...(isOwner ? { role: 'OWNER' } : {}) },
      update: { discordName: profile.global_name || profile.username, avatar, email: profile.email || null, ...(isOwner ? { role: 'OWNER' } : {}) },
    });
    if (user.suspended) return fail('This account has been suspended.', 403);

    await createSession(user.id);
    const response = NextResponse.redirect(new URL('/dashboard', url.origin));
    response.cookies.set(STATE_COOKIE, '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 });
    // Re-issue the session on this response to ensure Cloudflare forwards Set-Cookie.
    const sessionCookie = (await cookies()).get(SESSION_COOKIE)?.value;
    if (sessionCookie) response.cookies.set(SESSION_COOKIE, sessionCookie, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    console.error('Discord OAuth callback failed:', error);
    return fail('Sign-in failed. Check the database connection and server configuration, then try again.', 500);
  }
}
