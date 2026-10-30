"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Data = { stats: { projects: number; scripts: number; licenses: number; active: number; execsToday: number }; series: Record<string, { authorized: number; denied: number }>; recent: { id: string; outcome: string; createdAt: string; script: string | null; key: string | null }[] };

export default function AnalyticsPage() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => { fetch('/api/me/overview').then(r => r.json()).then(setData); }, []);
  if (!data) return <div className="shell"><main className="main"><section className="content"><div className="muted">Loading…</div></section></main></div>;
  const days = Object.entries(data.series);
  const max = Math.max(1, ...days.map(([, v]) => v.authorized + v.denied));
  const totalAuth = days.reduce((a, [, v]) => a + v.authorized, 0); const totalDen = days.reduce((a, [, v]) => a + v.denied, 0);
  return (
    <div className="shell"><aside className="side">
      <Link href="/" className="brand">KERS<span>SECURE</span></Link>
      <nav className="nav"><Link href="/dashboard">Overview</Link><Link href="/projects">Projects</Link><Link href="/whitelist">Whitelist</Link><Link href="/analytics">Analytics</Link><Link href="/docs">Documentation</Link><Link href="/settings">Settings</Link></nav>
    </aside><main className="main"><header className="top"><strong>Analytics</strong></header><section className="content">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
        <div className="card"><div className="muted" style={{ fontSize: 12 }}>Executions (24h)</div><div style={{ fontSize: 26, fontWeight: 600 }}>{data.stats.execsToday}</div></div>
        <div className="card"><div className="muted" style={{ fontSize: 12 }}>Authorized (14d)</div><div style={{ fontSize: 26, fontWeight: 600 }}>{totalAuth}</div></div>
        <div className="card"><div className="muted" style={{ fontSize: 12 }}>Denied (14d)</div><div style={{ fontSize: 26, fontWeight: 600 }}>{totalDen}</div></div>
        <div className="card"><div className="muted" style={{ fontSize: 12 }}>Active licenses</div><div style={{ fontSize: 26, fontWeight: 600 }}>{data.stats.active}/{data.stats.licenses}</div></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <strong>Executions, last 14 days</strong>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, marginTop: 14 }}>
          {days.map(([day, v]) => (
            <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={day + ': ' + v.authorized + ' authorized, ' + v.denied + ' denied'}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 130 }}>
                <div style={{ height: (v.authorized / max) * 100 + '%', background: '#3b82f6', borderRadius: 3, minHeight: v.authorized ? 3 : 0 }} />
                <div style={{ height: (v.denied / max) * 100 + '%', background: '#e07070', borderRadius: 3, minHeight: v.denied ? 3 : 0 }} />
              </div>
              <span className="muted" style={{ fontSize: 9 }}>{day.slice(5)}</span>
            </div>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}><span style={{ color: '#3b82f6' }}>■</span> authorized <span style={{ color: '#e07070' }}>■</span> denied</div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <strong>Recent authentication attempts</strong>
        <div style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 12 }}>
          {data.recent.map(r => <div key={r.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid #1c2230', paddingBottom: 6 }}><span><span style={{ color: r.outcome === 'authorized' ? '#4ade80' : '#e07070' }}>{r.outcome}</span>{r.script ? ' · ' + r.script : ''}{r.key ? ' · ' + r.key + '…' : ''}</span><span className="muted">{new Date(r.createdAt).toLocaleString()}</span></div>)}
          {data.recent.length === 0 && <div className="muted">No executions yet.</div>}
        </div>
      </div>
    </section></main></div>
  );
}
