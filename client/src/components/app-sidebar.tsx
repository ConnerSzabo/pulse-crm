import {
  LayoutDashboard,
  Users,
  ListTodo,
  Upload,
  HelpCircle,
  CalendarDays,
  Building2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const mainMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "TSOs", url: "/tsos", icon: Building2 },
  { title: "Shows", url: "/shows", icon: CalendarDays },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Tasks", url: "/tasks", icon: ListTodo },
];

const toolsMenuItems = [
  { title: "Import Data", url: "/import", icon: Upload },
];

export function AppSidebar() {
  const [location] = useLocation();

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    if (url === "/tsos") return location === "/tsos" || location.startsWith("/tso/");
    if (url === "/shows") return location === "/shows" || location.startsWith("/show/");
    if (url === "/contacts") return location === "/contacts" || location.startsWith("/contact/");
    return location.startsWith(url);
  };

  return (
    <aside className="w-[220px] bg-[#1a1033] flex flex-col h-screen flex-shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-[#2d2050]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-[#e91e8c] to-[#9b59b6] flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-sm">PP</span>
          </div>
          <span className="font-semibold text-white text-base leading-tight">
            PokéPulse<br/>
            <span className="text-[10px] font-normal text-[#9b6dcc]">Partnerships CRM</span>
          </span>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6b4fa0] px-3">
            Main
          </span>
        </div>
        <ul className="space-y-0.5 px-3">
          {mainMenuItems.map((item) => (
            <li key={item.title}>
              <Link
                href={item.url}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150",
                  isActive(item.url)
                    ? "bg-[#e91e8c]/20 text-[#e91e8c] font-medium"
                    : "text-[#9b8cc0] hover:bg-[#2d2050] hover:text-white"
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
                <span>{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="px-3 mt-6 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6b4fa0] px-3">
            Tools
          </span>
        </div>
        <ul className="space-y-0.5 px-3">
          {toolsMenuItems.map((item) => (
            <li key={item.title}>
              <Link
                href={item.url}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150",
                  isActive(item.url)
                    ? "bg-[#e91e8c]/20 text-[#e91e8c] font-medium"
                    : "text-[#9b8cc0] hover:bg-[#2d2050] hover:text-white"
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
                <span>{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-[#2d2050] p-3">
        <button className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-[#9b8cc0] hover:bg-[#2d2050] hover:text-white transition-colors">
          <HelpCircle className="h-[18px] w-[18px]" />
          <span>Help & Support</span>
        </button>
      </div>
    </aside>
  );
}
