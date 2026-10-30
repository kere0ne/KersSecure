import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import WorkspaceShell from "@/components/workspace-shell";
import { Activity, ArrowUpRight, FileCode2, KeyRound, Plus, ShieldCheck, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const db = await getPrisma();
  const [projects, scripts, licenses, recent, executions] = await Promise.all([
    db.project.count({ where: { ownerId: user.id } }),
    db.script.count({ where: { project: { ownerId: user.id } } }),
    db.license.count({ where: { project: { ownerId: user.id } } }),
    db.project.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: "desc" }, take: 5, include: { _count: { select: { scripts: true, licenses: true } } } }),
    db.executionLog.count({ where: { script: { project: { ownerId: user.id } }, createdAt: { gte: new Date(Date.now() - 86400000) } } }),
  ]);
  return <WorkspaceShell userName={user.discordName} role={user.role} title="Dashboard">
    <section className="ks-welcome"><div><div className="ks-overline"><Sparkles size={13}/> WORKSPACE OVERVIEW</div><h1>Welcome back, {user.discordName}</h1><p>Your protection workspace at a glance.</p></div><Link href="/projects" className="ks-primary-btn"><Plus size={16}/> New script project</Link></section>
    <section className="ks-stat-grid">
      <article className="ks-stat-card"><div className="ks-stat-head"><span>Projects</span><span className="ks-stat-icon"><FileCode2 size={16}/></span></div><strong>{projects}</strong><Link href="/projects">Manage projects <ArrowUpRight size={13}/></Link></article>
      <article className="ks-stat-card"><div className="ks-stat-head"><span>Hosted scripts</span><span className="ks-stat-icon"><ShieldCheck size={16}/></span></div><strong>{scripts}</strong><span className="ks-stat-foot">Across your workspace</span></article>
      <article className="ks-stat-card"><div className="ks-stat-head"><span>Issued keys</span><span className="ks-stat-icon"><KeyRound size={16}/></span></div><strong>{licenses}</strong><Link href="/whitelist">Open key manager <ArrowUpRight size={13}/></Link></article>
      <article className="ks-stat-card"><div className="ks-stat-head"><span>Executions · 24h</span><span className="ks-stat-icon"><Activity size={16}/></span></div><strong>{executions}</strong><span className="ks-stat-foot">Recorded loader activity</span></article>
    </section>
    <div className="ks-dashboard-grid"><section className="ks-panel ks-project-panel"><div className="ks-panel-heading"><div><h2>Your projects</h2><p>Recently updated script workspaces</p></div><Link href="/projects" className="ks-text-link">View all <ArrowUpRight size={14}/></Link></div>
      {recent.length ? <div className="ks-project-list">{recent.map(p=><Link key={p.id} href={"/projects/"+p.id} className="ks-project-row"><div className="ks-project-symbol"><FileCode2 size={17}/></div><div className="ks-project-info"><strong>{p.name}</strong><span>{p.description || "No description"}</span></div><div className="ks-project-counts"><span>{p._count.scripts} scripts</span><span>{p._count.licenses} keys</span></div><ArrowUpRight size={15} className="ks-row-arrow"/></Link>)}</div> : <div className="ks-empty"><div className="ks-empty-icon"><FileCode2 size={20}/></div><strong>Your workspace is ready</strong><p>Create a project to start hosting and managing scripts.</p><Link href="/projects" className="ks-secondary-btn">Create first project</Link></div>}
    </section><aside className="ks-side-stack"><section className="ks-panel ks-quick-panel"><div className="ks-panel-heading"><div><h2>Quick actions</h2><p>Jump back into your workflow</p></div></div><Link href="/projects" className="ks-action-row"><span><FileCode2 size={16}/></span><div><strong>Manage scripts</strong><small>Upload and configure projects</small></div><ArrowUpRight size={14}/></Link><Link href="/whitelist" className="ks-action-row"><span><KeyRound size={16}/></span><div><strong>Generate keys</strong><small>Create or manage access keys</small></div><ArrowUpRight size={14}/></Link><Link href="/analytics" className="ks-action-row"><span><Activity size={16}/></span><div><strong>View analytics</strong><small>Review execution activity</small></div><ArrowUpRight size={14}/></Link></section><section className="ks-notice-panel"><div className="ks-notice-icon"><ShieldCheck size={17}/></div><div><strong>Protection status</strong><p>Private script delivery and key validation are handled by your configured backend services.</p><Link href="/docs">Read deployment and security docs <ArrowUpRight size={12}/></Link></div></section></aside></div>
  </WorkspaceShell>;
}
