import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/auth';
export const runtime = 'nodejs';
type DiscordUser = { id: string; username: string; global_name?: string | null; avatar?: string | null; email?: string | null };
export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get('code'); const state = url.searchParams.get('state');
  const cookie = request.headers.get('cookie') || ''; const stateCookie = cookie.split(';').map(v => v.trim()).find(v => v.startsWith('kerssecure_oauth_state='))?.slice('kerssecure_oauth_state='.length);
  const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
  if (!code || !state || !stateCookie || state !== decodeURIComponent(stateCookie)) return fail('Discord authorization state validation failed.');
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) return fail('Discord sign-in is not configured.', 503);
  const redirectUri = process.env.DISCORD_REDIRECT_URI || url.origin + '/api/auth/discord/callback';
  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: redirectUri }), cache: 'no-store' });
    if (!tokenResponse.ok) return fail('Discord token exchange failed.', 502);
    const token = await tokenResponse.json() as { access_token?: string; token_type?: string }; if (!token.access_token) return fail('Discord did not return an access token.', 502);
    const profileResponse = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: (token.token_type || 'Bearer') + ' ' + token.access_token }, cache: 'no-store' });
    if (!profileResponse.ok) return fail('Could not retrieve your Discord profile.', 502);
    const profile = await profileResponse.json() as DiscordUser; if (!profile.id || !profile.username) return fail('Discord returned an invalid profile.', 502);
    const isOwner = !!process.env.OWNER_DISCORD_ID && profile.id === process.env.OWNER_DISCORD_ID;
    const avatar = profile.avatar ? 'https://cdn.discordapp.com/avatars/' + profile.id + '/' + profile.avatar + '.png?size=128' : null;
    const user = await prisma.user.upsert({ where: { discordId: profile.id }, create: { discordId: profile.id, discordName: profile.global_name || profile.username, avatar, email: profile.email || null, ...(isOwner ? { role: 'OWNER' } : {}) }, update: { discordName: profile.global_name || profile.username, avatar, email: profile.email || null, ...(isOwner ? { role: 'OWNER' } : {}) } });
    if (user.suspended) return fail('This account has been suspended.', 403);
    await createSession(user.id); const response = NextResponse.redirect(new URL('/dashboard', url.origin)); response.cookies.set('kerssecure_oauth_state', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 }); return response;
  } catch (error) { console.error('Discord OAuth callback failed:', error); return fail('Sign-in failed. Check the server configuration and try again.', 500); }
}
