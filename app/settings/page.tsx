"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [me, setMe] = useState<{ user?: { discordName: string; role: string; discordId: string; email: string | null }; subscription?: { plan: string; status: string } } | null>(null);
  useEffect(() => { fetch('/api/me').then(r => r.json()).then(setMe); }, []);
  return (
    <div className="shell"><aside className="side">
      <Link href="/" className="brand">KERS<span>SECURE</span></Link>
      <nav className="nav"><Link href="/dashboard">Overview</Link><Link href="/projects">Projects</Link><Link href="/whitelist">Whitelist</Link><Link href="/analytics">Analytics</Link><Link href="/docs">Documentation</Link><Link href="/settings">Settings</Link></nav>
    </aside><main className="main"><header className="top"><strong>Account settings</strong></header><section className="content">
      {me?.user && (
        <>
          <div className="card"><strong>Profile</strong>
            <div style={{ display: 'grid', gap: 8, marginTop: 10, fontSize: 13 }}>
              <div>Discord: <strong>{me.user.discordName}</strong></div>
              <div>Role: <span className="muted">{me.user.role}</span></div>
              <div>Discord ID: <span className="muted" style={{ fontFamily: 'ui-monospace, monospace' }}>{me.user.discordId}</span></div>
              {me.user.email && <div>Email: <span className="muted">{me.user.email}</span></div>}
            </div>
          </div>
          <div className="card" style={{ marginTop: 14 }}><strong>Subscription</strong>
            <p className="muted" style={{ fontSize: 13, margin: '8px 0' }}>Current plan: <strong>{me.subscription?.plan || 'FREE'}</strong>{me.subscription?.status ? ' · ' + me.subscription.status : ''}</p>
            <Link href="/pricing" className="btn">View plans</Link>
          </div>
          <div className="card" style={{ marginTop: 14 }}><strong>Session</strong>
            <p className="muted" style={{ fontSize: 13, margin: '8px 0' }}>Signed in with Discord OAuth2. Sessions are HttpOnly, signed JWTs.</p>
            <a className="btn" href="/api/auth/logout">Log out</a>
          </div>
        </>
      )}
    </section></main></div>
  );
}
