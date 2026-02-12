import {
  Building2,
  LayoutDashboard,
  Users,
  Briefcase,
  ListTodo,
  Upload,
  Settings,
  HelpCircle,
  ChevronDown,
  Phone,
  Landmark
} from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";

const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Companies",
    url: "/companies",
    icon: Building2,
  },
  {
    title: "Contacts",
    url: "/contacts",
    icon: Users,
  },
  {
    title: "Deals",
    url: "/pipeline",
    icon: Briefcase,
  },
  {
    title: "Tasks",
    url: "/tasks",
    icon: ListTodo,
  },
  {
    title: "Call Analytics",
    url: "/call-analytics",
    icon: Phone,
  },
  {
    title: "Trusts",
    url: "/companies?type=trusts",
    icon: Landmark,
  },
];

const toolsMenuItems = [
  {
    title: "Import Data",
    url: "/import",
    icon: Upload,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const searchParams = useSearch();

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    // Trusts link is active when on /companies with ?type=trusts
    if (url === "/companies?type=trusts") {
      return location === "/companies" && new URLSearchParams(searchParams).get("type") === "trusts";
    }
    if (url === "/companies") {
      // Companies is active on /companies (without trusts filter) or /company/:id
      const isTrustsFilter = new URLSearchParams(searchParams).get("type") === "trusts";
      return (location === "/companies" && !isTrustsFilter) || location.startsWith("/company/");
    }
    if (url === "/contacts") return location === "/contacts" || location.startsWith("/contact/");
    return location.startsWith(url);
  };

  return (
    <aside className="w-[220px] bg-[#2d3142] flex flex-col h-screen flex-shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-[#3d4254]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-[#0091AE] to-[#06b6d4] flex items-center justify-center shadow-lg">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-white text-lg">Wave CRM</span>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        <div className="px-3 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] px-3">
            Main
          </span>
        </div>
        <ul className="space-y-0.5 px-3">
          {mainMenuItems.map((item) => (
            <li key={item.title}>
              <Link
                href={item.url}
                data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150",
                  isActive(item.url)
                    ? "bg-[#0091AE]/20 text-[#0091AE] font-medium"
                    : "text-[#94a3b8] hover:bg-[#3d4254] hover:text-white"
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
                <span>{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="px-3 mt-6 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] px-3">
            Tools
          </span>
        </div>
        <ul className="space-y-0.5 px-3">
          {toolsMenuItems.map((item) => (
            <li key={item.title}>
              <Link
                href={item.url}
                data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150",
                  isActive(item.url)
                    ? "bg-[#0091AE]/20 text-[#0091AE] font-medium"
                    : "text-[#94a3b8] hover:bg-[#3d4254] hover:text-white"
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
                <span>{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-[#3d4254] p-3">
        <button className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-[#94a3b8] hover:bg-[#3d4254] hover:text-white transition-colors">
          <HelpCircle className="h-[18px] w-[18px]" />
          <span>Help & Support</span>
        </button>
      </div>
    </aside>
  );
}
