"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const [key,setKey] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/key', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({key}), cache:'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Owner authentication failed.');
      setKey('');
      router.replace('/dashboard');
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} style={{display:'grid',gap:13,marginTop:24}}>
    <label htmlFor="owner-key" className="muted" style={{fontSize:12}}>Owner API key</label>
    <input id="owner-key" type="password" autoComplete="current-password" required minLength={40} value={key} onChange={e=>setKey(e.target.value)} placeholder="Paste your long owner key" className="form-field" />
    <button className="btn primary" disabled={busy || !key.trim()} style={{width:'100%'}}>{busy ? 'Verifying…' : 'Unlock owner dashboard →'}</button>
    {error && <p role="alert" style={{color:'var(--danger, #ff6b6b)',fontSize:12,margin:0}}>{error}</p>}
  </form>;
}
