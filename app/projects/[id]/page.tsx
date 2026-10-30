import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import ScriptUpload from "./script-upload";
import LicenseManager from "./license-manager";
import ScriptObfuscator from "./script-obfuscator";
import WorkspaceShell from "@/components/workspace-shell";
import { ArrowLeft, FileCode2, KeyRound } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function ProjectDetailPage({params}:{params:Promise<{id:string}>}){
 const user=await getSessionUser();if(!user)redirect("/login");const {id}=await params;
 const project=await (await getPrisma()).project.findFirst({where:{id,ownerId:user.id},include:{scripts:{orderBy:{updatedAt:"desc"}}}});
 if(!project)notFound();
 return <WorkspaceShell title={project.name}><div className="ks-welcome"><div><div className="ks-overline">SCRIPTS / PROJECT</div><h1>{project.name}</h1><p>{project.description||"Manage source files, releases and access keys for this project."}</p></div><Link href="/projects" className="ks-secondary-btn"><ArrowLeft size={14}/> All projects</Link></div><ScriptUpload projectId={project.id}/><section className="ks-panel ks-script-list"><div className="ks-panel-heading"><div><h2>Hosted scripts</h2><p>{project.scripts.length} script{project.scripts.length===1?"":"s"} in this project</p></div><FileCode2 size={16}/></div>{project.scripts.length?project.scripts.map(script=><article className="ks-script-entry" key={script.id}><Link href={"/scripts/"+script.id} className="ks-script-entry-main"><span className="ks-project-symbol"><FileCode2 size={17}/></span><span><strong>{script.name}</strong><small>{script.filename||"source file"} · v{script.version} · {script.status}</small></span></Link><span className="ks-script-public-id">ID {script.publicId.slice(0,10)}</span><Link href={"/scripts/"+script.id} className="ks-secondary-btn">Configure</Link><ScriptObfuscator scriptId={script.id} scriptName={script.filename||script.name}/></article>):<div className="ks-empty"><div className="ks-empty-icon"><FileCode2 size={20}/></div><strong>No scripts uploaded</strong><p>Upload a Lua or Luau file to add it to this project.</p></div>}</section><section className="ks-panel ks-project-licenses"><div className="ks-panel-heading"><div><h2>License keys</h2><p>Keys associated with this project</p></div><KeyRound size={16}/></div><LicenseManager projectId={project.id}/></section></WorkspaceShell>;
}
