import {
  LayoutDashboard, Users, ListTodo, Upload, CalendarDays, Building2, Zap, Kanban,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const mainMenuItems = [
  { title: "Dashboard",  url: "/",        icon: LayoutDashboard },
  { title: "TSOs",       url: "/tsos",    icon: Building2 },
  { title: "Shows",      url: "/shows",   icon: CalendarDays },
  { title: "Contacts",   url: "/contacts",icon: Users },
  { title: "Tasks",      url: "/tasks",   icon: ListTodo },
  { title: "Deals",      url: "/deals",   icon: Kanban },
];

const toolsMenuItems = [
  { title: "Import Data", url: "/import", icon: Upload },
];

export function AppSidebar() {
  const [location] = useLocation();

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    if (url === "/tsos")     return location === "/tsos"     || location.startsWith("/tso/");
    if (url === "/shows")    return location === "/shows"    || location.startsWith("/show/");
    if (url === "/contacts") return location === "/contacts" || location.startsWith("/contact/");
    return location.startsWith(url);
  };

  return (
    <aside
      className="w-[220px] flex flex-col h-screen flex-shrink-0 border-r"
      style={{
        background: "#0d1117",
        borderColor: "#1e2433",
      }}>

      {/* Logo */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "#1e2433" }}>
        <Link href="/" className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shrink-0"
            style={{ background: "linear-gradient(135deg, #6366f1, #7c3aed)" }}>
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-white font-semibold text-sm">PokéPulse</p>
            <p className="text-[11px]" style={{ color: "#64748b" }}>Partnerships CRM</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1.5" style={{ color: "#374151" }}>
            Main
          </p>
          <ul className="space-y-0.5">
            {mainMenuItems.map(item => {
              const active = isActive(item.url);
              return (
                <li key={item.title}>
                  <Link
                    href={item.url}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      active
                        ? "text-white"
                        : "hover:text-white"
                    )}
                    style={active
                      ? { background: "rgba(99,102,241,0.18)", color: "#a5b4fc" }
                      : { color: "#4b5563" }
                    }
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "#e2e8f0"; }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "#4b5563"; } }}
                  >
                    <item.icon
                      className="h-[17px] w-[17px] shrink-0"
                      style={{ color: active ? "#818cf8" : undefined }}
                    />
                    <span>{item.title}</span>
                    {active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#6366f1]" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1.5" style={{ color: "#374151" }}>
            Tools
          </p>
          <ul className="space-y-0.5">
            {toolsMenuItems.map(item => {
              const active = isActive(item.url);
              return (
                <li key={item.title}>
                  <Link
                    href={item.url}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      active ? "text-[#a5b4fc]" : "text-[#4b5563] hover:text-[#e2e8f0]"
                    )}
                    style={active ? { background: "rgba(99,102,241,0.18)" } : {}}
                  >
                    <item.icon className="h-[17px] w-[17px] shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t" style={{ borderColor: "#1e2433" }}>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #7c3aed)" }}>
            C
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/80 truncate">Conner</p>
            <p className="text-[10px]" style={{ color: "#374151" }}>Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
