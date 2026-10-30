import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';
import ScriptUpload from './script-upload';
import LicenseManager from './license-manager';
import ScriptObfuscator from './script-obfuscator';

export const dynamic = 'force-dynamic';
export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
 const user=await getSessionUser(); if(!user)redirect('/login');
 const {id}=await params;
 const project=await (await __getPrisma()).project.findFirst({where:{id,ownerId:user.id},include:{scripts:{orderBy:{updatedAt:'desc'}}}});
 if(!project)notFound();
 return <div className="shell"><aside className="side"><Link href="/" className="brand">KERS<span>SECURE</span></Link><nav className="nav"><Link href="/dashboard">Overview</Link><Link href="/projects">Projects</Link><Link href="/docs">Documentation</Link></nav></aside><main className="main"><header className="top"><strong>{project.name}</strong><Link href="/projects" className="btn">← Projects</Link></header><section className="content"><div className="eyebrow">PROJECT</div><h1 className="h1">{project.name}</h1><p className="muted">{project.description||'No project description.'}</p><ScriptUpload projectId={project.id}/><h2 style={{fontSize:18,marginTop:32}}>Hosted scripts</h2><div style={{display:'grid',gap:10,marginTop:14}}>{project.scripts.length?project.scripts.map(script=><div key={script.id}><div className="card row"><div><strong>{script.name}</strong><div className="muted" style={{fontSize:12,marginTop:5}}>Version {script.version} · {script.status} · publicId {script.publicId}</div></div><span className="muted" style={{fontSize:12}}>{script.filename||'script'}</span></div><ScriptObfuscator scriptId={script.id} scriptName={script.filename||script.name}/></div>):<div className="card muted">No scripts uploaded yet.</div>}</div><LicenseManager projectId={project.id}/></section></main></div>;
}
