import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';

export const runtime = 'nodejs';
const STATE_COOKIE = 'kerssecure_oauth_state';

function getRedirectUri(origin: string) {
  const configured = process.env.DISCORD_REDIRECT_URI?.trim();
  if (configured) return configured;
  const appUrl = process.env.APP_URL?.trim();
  const base = appUrl ? new URL(appUrl).origin : origin;
  return new URL('/api/auth/discord/callback', base).toString();
}

export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  if (!clientId) return NextResponse.json({ error: 'Discord sign-in is not configured: DISCORD_CLIENT_ID is missing.' }, { status: 503 });

  try {
    const origin = new URL(request.url).origin;
    const redirectUri = getRedirectUri(origin);
    const state = randomBytes(32).toString('hex');
    const authorize = new URL('https://discord.com/oauth2/authorize');
    authorize.searchParams.set('client_id', clientId);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('redirect_uri', redirectUri);
    authorize.searchParams.set('scope', 'identify email');
    authorize.searchParams.set('state', state);

    const response = NextResponse.redirect(authorize);
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: new URL(request.url).protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    console.error('Unable to start Discord OAuth:', error);
    return NextResponse.json({ error: 'Discord sign-in has an invalid redirect URL configuration.' }, { status: 500 });
  }
}
