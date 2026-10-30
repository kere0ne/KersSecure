"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity, BarChart3, Bot, BookOpen, Boxes, ChevronDown, Command, FileCode2,
  KeyRound, LayoutDashboard, LifeBuoy, Logs, Moon, Plug, Settings2, ShieldCheck,
  Sun, Users, Zap, Menu, X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const primary: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Scripts", href: "/projects", icon: FileCode2 },
  { label: "Keys", href: "/whitelist", icon: KeyRound },
  { label: "Key Rewards", href: "/workspace/key-rewards", icon: Zap },
  { label: "Live Sessions", href: "/workspace/live-sessions", icon: Activity },
  { label: "Logs", href: "/workspace/logs", icon: Logs },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];
const platform: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Obfuscator", href: "/workspace/obfuscator", icon: ShieldCheck },
  { label: "Integrations", href: "/workspace/integrations", icon: Plug },
  { label: "Discord Bot", href: "/workspace/discord-bot", icon: Bot },
  { label: "Team", href: "/workspace/team", icon: Users },
];
export default function WorkspaceShell({ children, userName = "Workspace", role = "MEMBER", title = "Dashboard" }: {
  children: React.ReactNode; userName?: string; role?: string; title?: string;
}) {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [light, setLight] = useState(false);\n  const [profileName, setProfileName] = useState(userName);\n  const [profileRole, setProfileRole] = useState(role);
  useEffect(() => { setLight(localStorage.getItem("ks-theme") === "light"); if (userName === "Workspace") fetch("/api/me").then(r => r.json()).then(d => { if (d.user?.discordName) setProfileName(d.user.discordName); if (d.user?.role) setProfileRole(d.user.role); }).catch(() => {}); }, [userName]);
  useEffect(() => { document.documentElement.dataset.theme = light ? "light" : "dark"; localStorage.setItem("ks-theme", light ? "light" : "dark"); }, [light]);
  const nav = (items: typeof primary) => items.map(item => {
    const Icon = item.icon;
    const active = path === item.href || (item.href === "/projects" && path.startsWith("/projects")) || (item.href === "/whitelist" && path.startsWith("/whitelist"));
    return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={"ks-nav-link" + (active ? " active" : "")}><Icon size={16} strokeWidth={1.8}/><span>{item.label}</span>{active && <span className="ks-nav-active"/>}</Link>;
  });
  return <div className="ks-workspace">
    {mobileOpen && <button className="ks-mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>}
    <aside className={"ks-sidebar" + (mobileOpen ? " open" : "")}>
      <div className="ks-brand-row"><Link href="/dashboard" className="ks-brand"><span className="ks-brand-mark">K</span><span>KERS<span className="ks-brand-muted">SECURE</span></span></Link><button className="ks-icon-btn ks-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="ks-workspace-switch"><div className="ks-workspace-avatar">K</div><div className="ks-workspace-meta"><strong>Personal workspace</strong><span>Private workspace</span></div><ChevronDown size={14}/></div>
      <div className="ks-nav-scroll"><div className="ks-nav-label">WORKSPACE</div><nav className="ks-nav">{nav(primary)}</nav><div className="ks-nav-label ks-platform-label">PROTECTION</div><nav className="ks-nav">{nav(platform)}</nav></div>
      <div className="ks-sidebar-bottom"><Link href="/docs" className="ks-nav-link"><BookOpen size={16}/><span>Documentation</span></Link><Link href="/settings" className={"ks-nav-link" + (path === "/settings" ? " active" : "")}><Settings2 size={16}/><span>Settings</span></Link><div className="ks-user-card"><div className="ks-user-avatar">{profileName.slice(0,1).toUpperCase()}</div><div className="ks-user-copy"><strong>{profileName}</strong><span>{profileRole}</span></div><form action="/api/auth/logout" method="post"><button className="ks-icon-btn" title="Sign out"><Command size={15}/></button></form></div></div>
    </aside>
    <main className="ks-main"><header className="ks-topbar"><div className="ks-top-left"><button className="ks-icon-btn ks-menu-trigger" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19}/></button><div className="ks-breadcrumb"><span>Workspace</span><span className="ks-breadcrumb-sep">/</span><strong>{title}</strong></div></div><div className="ks-top-actions"><span className="ks-live-indicator"><i/>Workspace</span><button className="ks-icon-btn" onClick={() => setLight(v => !v)} aria-label="Toggle theme">{light ? <Moon size={17}/> : <Sun size={17}/>}</button><Link href="/settings" className="ks-top-avatar">{profileName.slice(0,1).toUpperCase()}</Link></div></header><div className="ks-page-content">{children}</div></main>
  </div>;
}
