"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Lic = { id: string; keyPrefix: string; status: string; maxDevices: number; devices: string[]; robloxUserId: string | null; discordId: string | null; expiresAt: string | null; usedCount: number; execLimit: number | null; banned: boolean; note: string | null; createdAt: string; projectId: string };
type Project = { id: string; name: string };

export default function WhitelistPage() {
  const [rows, setRows] = useState<Lic[]>([]); const [projects, setProjects] = useState<Project[]>([]);
  const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [projectFilter, setProjectFilter] = useState('');
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ projectId: '', robloxUserId: '', maxDevices: 1, expiresInDays: '', count: 1, note: '' });
  const [keysOut, setKeysOut] = useState<string[]>([]);
  function load() { fetch('/api/licenses').then(r => r.json()).then(d => { if (d.licenses) { setRows(d.licenses); setProjects(d.projects); if (!form.projectId && d.projects[0]) setForm((f) => ({ ...f, projectId: d.projects[0].id })); } }); }
  useEffect(load, []);
  async function create() {
    setBusy(true); setMsg(''); setKeysOut([]);
    const r = await fetch('/api/licenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: form.projectId, robloxUserId: form.robloxUserId || undefined, maxDevices: Number(form.maxDevices) || 1, expiresInDays: form.expiresInDays ? Number(form.expiresInDays) : null, count: Math.max(1, Math.min(100, Number(form.count) || 1)), note: form.note || undefined }) });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || 'Failed'); else { setKeysOut(d.keys.map((k: { key: string }) => k.key)); setMsg(d.keys.length + ' key(s) created. Copy them now, they are shown once.'); load(); }
    setBusy(false);
  }
  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    const r = await fetch('/api/licenses/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
    if (!r.ok) { const d = await r.json(); setMsg(d.error || 'Failed'); } load();
  }
  async function del(id: string) { if (!confirm('Delete this license?')) return; await fetch('/api/licenses/' + id, { method: 'DELETE' }); load(); }
  async function importCsv(file: File) {
    const body = new FormData(); body.set('file', file);
    const r = await fetch('/api/licenses/export', { method: 'POST', body });
    const d = await r.json(); setMsg(r.ok ? 'Imported ' + d.imported + ', skipped ' + d.skipped : (d.error || 'Import failed')); load();
  }
  const filtered = rows.filter(l => (!status || l.status === status));
  const fmtExp = (v: string | null) => (v ? new Date(v).toLocaleDateString() : 'permanent');
  return (
    <div className="shell"><aside className="side">
      <Link href="/" className="brand">KERS<span>SECURE</span></Link>
      <nav className="nav"><Link href="/dashboard">Overview</Link><Link href="/projects">Projects</Link><Link href="/whitelist">Whitelist</Link><Link href="/analytics">Analytics</Link><Link href="/docs">Documentation</Link><Link href="/settings">Settings</Link></nav>
    </aside><main className="main"><header className="top"><strong>Whitelist manager</strong><div style={{ display: 'flex', gap: 8 }}>
      <a className="btn" href="/api/licenses/export">Export CSV</a>
      <label className="btn" style={{ cursor: 'pointer' }}>Import CSV<input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) importCsv(f); }} /></label>
    </div></header><section className="content">
      <div className="card">
        <strong>New whitelist entries</strong>
        <div style={{ display: 'grid', gap: 10, marginTop: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input placeholder="Roblox user ID (optional)" value={form.robloxUserId} onChange={e => setForm({ ...form, robloxUserId: e.target.value })} />
          <input type="number" min={1} max={50} placeholder="Device limit" value={form.maxDevices} onChange={e => setForm({ ...form, maxDevices: Number(e.target.value) })} />
          <input type="number" min={0} placeholder="Expires in days (blank = permanent)" value={form.expiresInDays} onChange={e => setForm({ ...form, expiresInDays: e.target.value })} />
          <input type="number" min={1} max={100} placeholder="How many keys" value={form.count} onChange={e => setForm({ ...form, count: Number(e.target.value) })} />
          <input placeholder="Note (optional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        </div>
        <button className="btn primary" style={{ marginTop: 10 }} onClick={create} disabled={busy || !form.projectId}>{busy ? 'Creating…' : 'Generate keys'}</button>
        {msg && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{msg}</p>}
        {keysOut.length > 0 && (
          <pre style={{ marginTop: 8, background: '#0b0e14', border: '1px solid #232837', borderRadius: 8, padding: 10, fontSize: 12, overflow: 'auto', maxHeight: 180 }}>{keysOut.join('\n')}</pre>
        )}
        {keysOut.length > 0 && <button className="btn" style={{ marginTop: 8 }} onClick={() => navigator.clipboard.writeText(keysOut.join('\n'))}>Copy all keys</button>}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <input placeholder="Search prefix, user ID, note…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="EXPIRED">Expired</option></select>
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {filtered.filter(l => (l.keyPrefix + ' ' + (l.robloxUserId || '') + ' ' + (l.note || '')).toLowerCase().includes(q.toLowerCase())).slice(0, 200).map(l => (
          <div key={l.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{l.keyPrefix}…</strong>
                <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{l.status}{l.banned ? ' · BANNED' : ''} · {fmtExp(l.expiresAt)} · {l.devices.length}/{l.maxDevices} devices · {l.usedCount} uses{l.robloxUserId ? ' · user ' + l.robloxUserId : ''}</span>
                {l.note && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{l.note}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {l.status === 'ACTIVE' ? <button className="btn" onClick={() => act(l.id, 'suspend')}>Suspend</button> : <button className="btn" onClick={() => act(l.id, 'reactivate')}>Reactivate</button>}
                <button className="btn" onClick={() => act(l.id, 'extend', { days: 30 })}>+30d</button>
                <button className="btn" onClick={() => act(l.id, 'permanent')}>Perm</button>
                <button className="btn" onClick={() => act(l.id, 'resetHwid')}>Reset HWID</button>
                <button className="btn" onClick={() => act(l.id, 'ban', { banned: !l.banned })}>{l.banned ? 'Unban' : 'Ban'}</button>
                <button className="btn" onClick={() => { const v = prompt('Roblox user ID to bind'); if (v !== null) act(l.id, 'bind', { robloxUserId: v }); }}>Bind user</button>
                <button className="btn" onClick={() => del(l.id)} style={{ color: '#e07070' }}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="card muted">No whitelist entries yet. Generate your first keys above.</div>}
      </div>
    </section></main></div>
  );
}
