import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/api/auth/discord');
  const [projects, scripts, licenses, recent] = await Promise.all([
    prisma.project.count({ where: { ownerId: user.id } }),
    prisma.script.count({ where: { project: { ownerId: user.id } } }),
    prisma.license.count({ where: { project: { ownerId: user.id } } }),
    prisma.project.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: 'desc' }, take: 6, include: { _count: { select: { scripts: true, licenses: true } } } }),
  ]);
  return <div className="shell"><aside className="side"><Link href="/" className="brand">KERS<span>SECURE</span></Link><nav className="nav"><Link href="/dashboard">Overview</Link><Link href="/projects">Projects</Link><Link href="/docs">Documentation</Link></nav><div style={{marginTop:'auto'}}><div className="muted" style={{fontSize:12,marginBottom:10}}>{user.discordName}</div><form action="/api/auth/logout" method="post"><button className="btn" style={{width:'100%'}}>Sign out</button></form></div></aside><main className="main"><header className="top"><strong>Overview</strong><span className="muted" style={{fontSize:12}}>Signed in with Discord</span></header><section className="content"><div className="eyebrow">WORKSPACE</div><h1 className="h1">Welcome back, {user.discordName}</h1><p className="muted">Manage your hosted scripts, projects and access licenses.</p><div className="grid"><div className="card"><div className="muted">Projects</div><div className="stat">{projects}</div><Link href="/projects" className="muted">Manage projects →</Link></div><div className="card"><div className="muted">Scripts</div><div className="stat">{scripts}</div><span className="muted">Across your projects</span></div><div className="card"><div className="muted">Licenses</div><div className="stat">{licenses}</div><span className="muted">Issued licenses</span></div><div className="card"><div className="muted">Account role</div><div className="stat" style={{fontSize:20}}>{user.role}</div><span className="muted">Discord account</span></div></div><div className="row"><h2 style={{fontSize:18}}>Recent projects</h2><Link href="/projects" className="btn primary">New project +</Link></div><div style={{display:'grid',gap:10,marginTop:15}}>{recent.length ? recent.map(p=><Link key={p.id} href={'/projects/'+p.id} className="card row"><div><strong>{p.name}</strong><div className="muted" style={{fontSize:12,marginTop:5}}>{p.description || 'No description'}</div></div><span className="muted" style={{fontSize:12}}>{p._count.scripts} scripts · {p._count.licenses} licenses →</span></Link>) : <div className="card"><p>No projects yet.</p><Link href="/projects" className="btn primary">Create your first project</Link></div>}</div></section></main></div>;
}
