import Link from "next/link";
import WorkspaceShell from "@/components/workspace-shell";
import { Construction, ArrowUpRight } from "lucide-react";

const sections: Record<string,{title:string;description:string;status:string;next:string[]}> = {
 "key-rewards": { title:"Key Rewards", description:"Configure reward-based key issuance and redemption flows.", status:"Not connected yet", next:["Reward provider connections are not implemented in this deployment.","No reward links or provider callbacks are active."] },
 "live-sessions": { title:"Live Sessions", description:"Monitor active Roblox users, devices and script executions.", status:"Session telemetry unavailable", next:["The current web database records execution events, not persistent live sessions.","Live player presence and disconnect controls require a session service."] },
 logs: { title:"Logs", description:"Review security, authentication and script activity.", status:"Basic audit data only", next:["Detailed event filtering and log retention controls are not implemented yet.","Use Analytics for currently available execution summaries."] },
 obfuscator: { title:"Obfuscator", description:"Build and inspect protected Lua/Luau output.", status:"Engine integration incomplete", next:["The current C# project validates Lua syntax only.","No production VM or Luau obfuscation engine is connected; builds are not advertised as protected."] },
 integrations: { title:"Integrations", description:"Connect external services to your protection workspace.", status:"Configuration UI not available", next:["R2 private storage and Discord OAuth are configured separately in deployment settings.","Provider management and signed webhook setup are not implemented in this dashboard."] },
 "discord-bot": { title:"Discord Bot", description:"Manage bot commands, buyer roles, tickets and server events.", status:"Separate bot service", next:["The Discord bot service currently exposes a limited command set.","Guild configuration UI, tickets and buyer-role automation are not connected here."] },
 team: { title:"Team", description:"Invite teammates and manage workspace access.", status:"Not implemented", next:["Project membership models exist, but invitation and permission management are not implemented."] }
};
export default async function WorkspaceSection({params}:{params:Promise<{section:string}>}) {
 const {section}=await params; const item=sections[section] || {title:"Workspace",description:"Workspace tools.",status:"Unavailable",next:["This section is not available."]};
 return <WorkspaceShell title={item.title}><div className="ks-welcome"><div><div className="ks-overline">WORKSPACE / PLATFORM</div><h1>{item.title}</h1><p>{item.description}</p></div></div><section className="ks-panel ks-placeholder"><div className="ks-placeholder-icon"><Construction size={22}/></div><span className="ks-status-chip">{item.status}</span><h2>This feature isn't live yet</h2><p>Kers Secure will only show controls here when they're backed by a working service.</p><ul>{item.next.map(v=><li key={v}>{v}</li>)}</ul><Link href="/dashboard" className="ks-text-link">Back to dashboard <ArrowUpRight size={14}/></Link></section></WorkspaceShell>;
}
