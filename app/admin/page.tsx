"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Any = Record<string, any>;

export default function AdminPage() {
  const [view, setView] = useState('overview'); const [data, setData] = useState<Any>({}); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  async function load(v = view) {
    setErr('');
    const map: Record<string, string> = { overview: 'overview', users: 'users', scripts: 'scripts', keys: 'keys', subs: 'subscriptions', audit: 'audit', settings: 'settings' };
    const r = await fetch('/api/admin/' + map[v]); const d = await r.json();
    if (!r.ok) { setErr(d.error || 'Failed'); return; }
    setData(prev => ({ ...prev, [map[v]]: d }));
  }
  useEffect(() => { load('overview'); load('settings'); }, []);
  useEffect(() => { if (!data[view]) load(view); }, [view]);
  async function act(path: string, body: Record<string, unknown>) {
    const r = await fetch('/api/admin/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json(); setMsg(r.ok ? 'Done.' : (d.error || 'Failed')); load(view); if (view !== 'overview') load('overview');
  }
  const tabs = [['overview', 'Overview'], ['users', 'Users'], ['scripts', 'Scripts'], ['keys', 'Licenses'], ['subs', 'Subscriptions'], ['audit', 'Audit log'], ['settings', 'Settings']];
  return (
    <div className="shell"><aside className="side">
      <Link href="/" className="brand">KERS<span>SECURE</span></Link>
      <nav className="nav"><Link href="/dashboard">Overview</Link><Link href="/projects">Projects</Link><Link href="/whitelist">Whitelist</Link><Link href="/analytics">Analytics</Link><Link href="/admin">Admin</Link><Link href="/docs">Documentation</Link><Link href="/settings">Settings</Link></nav>
    </aside><main className="main"><header className="top"><strong>Admin panel</strong>{msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}{err && <span className="muted" style={{ fontSize: 12, color: '#e07070' }}>{err}</span>}</header><section className="content">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{tabs.map(([id, label]) => <button key={id} className={'btn' + (view === id ? ' primary' : '')} onClick={() => setView(id)}>{label}</button>)}</div>
      {view === 'overview' && data.overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginTop: 16 }}>
          {Object.entries(data.overview.totals ?? {}).map(([k, v]) => <div key={k} className="card"><div className="muted" style={{ fontSize: 12 }}>{k}</div><div style={{ fontSize: 24, fontWeight: 600 }}>{String(v)}</div></div>)}
        </div>
      )}
      {view === 'users' && data.users && (
        <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>{data.users.users.map((u: Any) => (
          <div key={u.id} className="card"><div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div><strong>{u.discordName}</strong> <span className="muted" style={{ fontSize: 12 }}>{u.role}{u.suspended ? ' · SUSPENDED' : ''} · {u.discordId}</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => act('users', { userId: u.id, action: u.suspended ? 'unban' : 'ban' })}>{u.suspended ? 'Unsuspend' : 'Suspend'}</button>
              {u.role === 'CUSTOMER' ? <button className="btn" onClick={() => act('users', { userId: u.id, action: 'promote' })}>Promote</button> : <button className="btn" onClick={() => act('users', { userId: u.id, action: 'demote' })}>Demote</button>}
              <button className="btn" onClick={() => { if (confirm('Delete user ' + u.discordName + '?')) act('users', { userId: u.id, action: 'delete' }); }} style={{ color: '#e07070' }}>Delete</button>
            </div>
          </div></div>
        ))}</div>
      )}
      {view === 'scripts' && data.scripts && (
        <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>{data.scripts.scripts.map((s: Any) => (
          <div key={s.id} className="card"><div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div><strong>{s.name}</strong> <span className="muted" style={{ fontSize: 12 }}>{s.status} · {s.project?.name}</span></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" onClick={() => act('scripts', { scriptId: s.id, action: s.status === 'PUBLISHED' ? 'disable' : 'enable' })}>{s.status === 'PUBLISHED' ? 'Disable' : 'Enable'}</button>
              <button className="btn" onClick={() => { if (confirm('Delete script ' + s.name + '?')) act('scripts', { scriptId: s.id, action: 'delete' }); }} style={{ color: '#e07070' }}>Delete</button>
            </div>
          </div></div>
        ))}</div>
      )}
      {view === 'keys' && data.keys && (
        <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>{data.keys.licenses.map((l: Any) => (
          <div key={l.id} className="card"><div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div><strong style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{l.keyPrefix}…</strong> <span className="muted" style={{ fontSize: 12 }}>{l.status}{l.banned ? ' · BANNED' : ''}</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => act('keys', { licenseId: l.id, action: l.banned ? 'unban' : 'ban' })}>{l.banned ? 'Unban' : 'Ban'}</button>
              <button className="btn" onClick={() => act('keys', { licenseId: l.id, action: 'reset-hwid' })}>Reset HWID</button>
              <button className="btn" onClick={() => act('keys', { licenseId: l.id, action: 'extend', days: 30 })}>+30d</button>
              <button className="btn" onClick={() => act('keys', { licenseId: l.id, action: 'revoke' })} style={{ color: '#e07070' }}>Revoke</button>
            </div>
          </div></div>
        ))}</div>
      )}
      {view === 'subs' && data.subscriptions && (
        <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>{data.subscriptions.subscriptions.map((s: Any) => (
          <div key={s.id} className="card"><div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div><strong>{s.user?.discordName || s.userId}</strong> <span className="muted" style={{ fontSize: 12 }}>{s.plan} · {s.status}</span></div>
            <button className="btn" onClick={() => { const p = prompt('New plan (FREE / PRO / ULTRA / CUSTOM)'); if (p) act('subscriptions', { subscriptionId: s.id, plan: p.toUpperCase(), status: 'ACTIVE' }); }}>Change plan</button>
          </div></div>
        ))}{(data.subscriptions.subscriptions || []).length === 0 && <div className="card muted">No subscriptions yet.</div>}</div>
      )}
      {view === 'audit' && data.audit && (
        <div style={{ display: 'grid', gap: 6, marginTop: 16, fontSize: 12 }}>{(data.audit.logs || []).map((l: Any) => (
          <div key={l.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid #1c2230', paddingBottom: 6 }}><span>{l.action}{l.metadata ? ' · ' + l.metadata : ''}</span><span className="muted">{new Date(l.createdAt).toLocaleString()}</span></div>
        ))}</div>
      )}
      {view === 'settings' && data.settings && (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>Maintenance mode</strong>
          <p className="muted" style={{ fontSize: 12, margin: '5px 0 10px' }}>When enabled, loaders deny every key with a maintenance message. Owner sessions always bypass maintenance.</p>
          <div className="row">
            <input id="mm" type="checkbox" defaultChecked={data.settings.settings?.maintenance?.enabled} />
            <input id="mmm" placeholder="Message shown to users" defaultValue={data.settings.settings?.maintenance?.message || 'KERS SECURE is under maintenance. Try again soon.'} style={{ flex: 1 }} />
            <button className="btn primary" onClick={() => act('settings', { key: 'maintenance', value: { enabled: (document.getElementById('mm') as HTMLInputElement).checked, message: (document.getElementById('mmm') as HTMLInputElement).value } })}>Save</button>
          </div>
        </div>
      )}
    </section></main></div>
  );
}
