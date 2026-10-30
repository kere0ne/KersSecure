"use client";
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Data = { script: { id: string; publicId: string; name: string; filename: string | null; status: string; version: number; code: string; project: { id: string; name: string }; versions: { id: string; version: number; checksum: string; createdAt: string }[] } };

export default function ScriptEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const router = useRouter();
  const [data, setData] = useState<Data | null>(null); const [error, setError] = useState('');
  const [code, setCode] = useState(''); const [name, setName] = useState('');
  const [busy, setBusy] = useState(''); const [saved, setSaved] = useState('');
  useEffect(() => { fetch('/api/scripts/' + id).then(r => r.json()).then(d => { if (d.error) { setError(d.error); return; } setData(d); setCode(d.script.code); setName(d.script.name); }); }, [id]);
  async function save(publish?: boolean) {
    setBusy('save'); setSaved('');
    const body: Record<string, unknown> = { name, code };
    if (publish !== undefined) body.status = publish ? 'PUBLISHED' : 'DRAFT';
    const r = await fetch('/api/scripts/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) { setError(d.error || 'Save failed'); } else {
      setSaved(d.newVersion ? 'Saved as version v' + d.newVersion : 'Saved'); fetch('/api/scripts/' + id).then(r => r.json()).then(dd => { if (dd.script) setData(dd); });
    }
    setBusy('');
  }
  async function del() { if (!confirm('Delete this script permanently? All versions, builds and logs go with it.')) return; const r = await fetch('/api/scripts/' + id, { method: 'DELETE' }); if (r.ok) router.push('/projects/' + (data?.script.project.id || '')); }
  function download() { if (!data) return; const blob = new Blob([code], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = data.script.filename || data.script.name + '.lua'; a.click(); URL.revokeObjectURL(a.href); }
  const loaderUrl = data ? 'https://kerssecure.itskers0ne.workers.dev/api/loader/' + data.script.publicId : '';
  if (error) return <div className="shell"><main className="main"><section className="content"><div className="card muted">{error}</div></section></main></div>;
  if (!data) return <div className="shell"><main className="main"><section className="content"><div className="muted">Loading…</div></section></main></div>;
  const s = data.script;
  return (
    <div className="shell"><aside className="side">
      <Link href="/" className="brand">KERS<span>SECURE</span></Link>
      <nav className="nav"><Link href="/dashboard">Overview</Link><Link href="/projects">Projects</Link><Link href="/whitelist">Whitelist</Link><Link href="/analytics">Analytics</Link><Link href="/docs">Documentation</Link><Link href="/settings">Settings</Link></nav>
    </aside><main className="main"><header className="top">
      <strong>{s.name}</strong><div style={{ display: 'flex', gap: 8 }}><span className="muted" style={{ fontSize: 12 }}>v{s.version} · {s.status}</span><Link href="/projects" className="btn">Projects</Link></div></header>
      <section className="content">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={name} onChange={e => setName(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
          {s.status === 'PUBLISHED'
            ? <button className="btn" onClick={() => save(false)} disabled={busy !== ''}>Unpublish</button>
            : <button className="btn primary" onClick={() => save(true)} disabled={busy !== ''}>Publish</button>}
          <button className="btn" onClick={download}>Download</button>
          <button className="btn" onClick={del} style={{ color: '#e07070' }}>Delete</button>
        </div>
        <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck={false} style={{ width: '100%', minHeight: 420, marginTop: 12, background: '#0b0e14', color: '#d7dce6', border: '1px solid #232837', borderRadius: 10, padding: 14, fontFamily: 'ui-monospace, monospace', fontSize: 13, lineHeight: 1.5, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
          <button className="btn primary" onClick={() => save()} disabled={busy !== ''}>{busy === 'save' ? 'Saving…' : 'Save new version'}</button>
          {saved && <span className="muted" style={{ fontSize: 12 }}>{saved}</span>}
          {error && <span className="muted" style={{ fontSize: 12, color: '#e07070' }}>{error}</span>}
        </div>
        <div className="card" style={{ marginTop: 18 }}>
          <strong>Loader</strong>
          <p className="muted" style={{ fontSize: 12, margin: '5px 0 8px' }}>One-liner for your users. The key is checked server-side; the source never leaves the Worker.</p>
          <code style={{ display: 'block', background: '#0b0e14', border: '1px solid #232837', borderRadius: 8, padding: 10, fontSize: 12, overflowX: 'auto', whiteSpace: 'nowrap' }}>loadstring(game:HttpGet("{loaderUrl}?key=KEY"))()</code>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={() => navigator.clipboard.writeText(loaderUrl)}>Copy loader URL</button>
            <button className="btn" onClick={() => navigator.clipboard.writeText('loadstring(game:HttpGet("' + loaderUrl + '?key=KEY"))()')}>Copy one-liner</button>
          </div>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <strong>Version history</strong>
          <div style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 12 }}>
            {s.versions.map(v => <div key={v.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid #1c2230', paddingBottom: 6 }}><span>v{v.version}{v.version === s.version ? ' (current)' : ''}</span><span className="muted">{v.checksum.slice(0, 12)}… · {new Date(v.createdAt).toLocaleString()}</span></div>)}
          </div>
        </div>
      </section>
    </main></div>
  );
}
