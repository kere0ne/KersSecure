"use client";
import { useState } from 'react';
export default function ScriptUpload({projectId}:{projectId:string}) {
 const [file,setFile]=useState<File|null>(null); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();if(!file)return;setBusy(true);setMessage('');try{const body=new FormData();body.set('file',file);const r=await fetch('/api/projects/'+projectId+'/scripts',{method:'POST',body});const d=await r.json();if(!r.ok)throw new Error(d.error||'Upload failed');setMessage('Script uploaded successfully.');setFile(null);location.reload();}catch(err){setMessage(err instanceof Error?err.message:'Upload failed');}finally{setBusy(false);}}
 return <form onSubmit={submit} className="card" style={{marginTop:24,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}><div style={{flex:1,minWidth:180}}><strong>Upload a script</strong><p className="muted" style={{fontSize:12,margin:'5px 0 0'}}>Lua, Luau or TXT · maximum 2 MB</p></div><input type="file" accept=".lua,.luau,.txt,text/plain" onChange={e=>setFile(e.target.files?.[0]||null)} style={{maxWidth:230}}/><button className="btn primary" disabled={!file||busy}>{busy?'Uploading…':'Upload'}</button>{message&&<span className="muted" style={{width:'100%',fontSize:12}}>{message}</span>}</form>;
}
