import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
const STATE_COOKIE = 'kerssecure_oauth_state';
import { issueState } from '@/lib/oauth-state';
function redirectUri(origin: string) {
  const configured = process.env.DISCORD_REDIRECT_URI?.trim();
  if (configured) return configured;
  const base = process.env.APP_URL?.trim() || origin;
  return new URL('/api/auth/discord/callback', base).toString();
}
export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  if (!clientId) return NextResponse.json({ error: 'Discord OAuth is not configured: DISCORD_CLIENT_ID is missing.' }, { status: 503 });
  try {
    const state = issueState();
    const authorize = new URL('https://discord.com/oauth2/authorize');
    authorize.searchParams.set('client_id', clientId);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('redirect_uri', redirectUri(new URL(request.url).origin));
    authorize.searchParams.set('scope', 'identify email');
    authorize.searchParams.set('state', state);
    const response = NextResponse.redirect(authorize);
    response.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 600 });
    return response;
  } catch (error) {
    console.error('Discord OAuth start failed:', error);
    return NextResponse.json({ error: 'Invalid Discord OAuth redirect configuration.' }, { status: 500 });
  }
}
