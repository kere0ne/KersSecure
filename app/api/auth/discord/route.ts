import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID; if (!clientId) return NextResponse.json({ error: 'Discord sign-in is not configured.' }, { status: 503 });
  const origin = new URL(request.url).origin; const redirectUri = process.env.DISCORD_REDIRECT_URI || origin + '/api/auth/discord/callback'; const state = randomBytes(32).toString('hex');
  const authorize = new URL('https://discord.com/oauth2/authorize'); authorize.searchParams.set('client_id', clientId); authorize.searchParams.set('response_type', 'code'); authorize.searchParams.set('redirect_uri', redirectUri); authorize.searchParams.set('scope', 'identify email'); authorize.searchParams.set('state', state);
  const response = NextResponse.redirect(authorize); response.cookies.set('kerssecure_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 }); return response;
}
