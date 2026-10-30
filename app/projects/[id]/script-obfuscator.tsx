"use client";
import { useState } from 'react';

type Build = { id: string; preset: string; sizeBefore: number; sizeAfter: number; checksum: string; duration: number; createdAt?: string; code?: string };

export default function ScriptObfuscator({ scriptId, scriptName }: { scriptId: string; scriptName: string }) {
  const [preset, setPreset] = useState('balanced');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [build, setBuild] = useState<Build | null>(null);
  const [history, setHistory] = useState<Build[]>([]);
  async function run() {
    setBusy(true); setMessage('');
    try {
      const r = await fetch('/api/scripts/' + scriptId + '/builds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preset }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Build failed');
      setBuild(d.build); loadHistory();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Build failed'); }
    finally { setBusy(false); }
  }
  async function loadHistory() {
    try { const r = await fetch('/api/scripts/' + scriptId + '/builds'); const d = await r.json(); if (r.ok) setHistory(d.builds || []); } catch {}
  }
  function download() {
    if (!build?.code) return;
    const blob = new Blob([build.code], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = scriptName.replace(/\.(lua|luau|txt)$/i, '') + '.obfuscated.lua'; a.click(); URL.revokeObjectURL(a.href);
  }
  const presets = [
    { id: 'light', label: 'Light', desc: 'Rename + minify only' },
    { id: 'balanced', label: 'Balanced', desc: '+ strings, constants, junk' },
    { id: 'maximum', label: 'Experimental', desc: 'Arithmetic transforms' },
  ];
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <strong>Experimental build</strong>
      <p className="muted" style={{ fontSize: 12, margin: '5px 0 10px' }}>Experimental Lua source transformations with parser round-trip validation. This is not the production C# VM engine or full Luau protection; test output carefully before use.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {presets.map(p => (
          <button key={p.id} onClick={() => setPreset(p.id)} className={'btn' + (preset === p.id ? ' primary' : '')} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <strong style={{ fontSize: 13 }}>{p.label}</strong>
            <span className="muted" style={{ fontSize: 11 }}>{p.desc}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn primary" onClick={run} disabled={busy}>{busy ? 'Building…' : 'Build ' + preset}</button>
        {build && <button className="btn" onClick={download}>Download output</button>}
        {build && <span className="muted" style={{ fontSize: 12 }}>{build.sizeBefore} → {build.sizeAfter} bytes · {build.duration} ms · {build.preset}</span>}
      </div>
      {message && <p className="muted" style={{ fontSize: 12, color: '#e07070', marginTop: 8 }}>{message}</p>}
      {build && (
        <pre style={{ marginTop: 10, background: '#0b0e14', border: '1px solid #232837', borderRadius: 8, padding: 12, fontSize: 12, overflow: 'auto', maxHeight: 260, whiteSpace: 'pre-wrap' }}>
          {build.code!.slice(0, 2000) + (build.code!.length > 2000 ? '\n… (' + build.code!.length + ' bytes total, use Download for the full file)' : '')}
        </pre>
      )}
      {history.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Recent builds</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {history.slice(0, 5).map(b => (
              <div key={b.id} className="row" style={{ fontSize: 12, justifyContent: 'space-between', borderBottom: '1px solid #1c2230', paddingBottom: 6 }}>
                <span>{b.preset}</span>
                <span className="muted">{b.sizeBefore} → {b.sizeAfter} bytes · {b.duration} ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
