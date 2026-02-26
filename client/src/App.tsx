import { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Bell, User, ChevronDown } from "lucide-react";
import Login from "@/pages/login";
import { useToast } from "@/hooks/use-toast";

// Lazy load route components for code splitting
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Companies = lazy(() => import("@/pages/companies"));
const CompanyDetail = lazy(() => import("@/pages/company-detail"));
const Contacts = lazy(() => import("@/pages/contacts"));
const ContactDetail = lazy(() => import("@/pages/contact-detail"));
const Pipeline = lazy(() => import("@/pages/pipeline"));
const TasksPage = lazy(() => import("@/pages/tasks"));
const ImportCSV = lazy(() => import("@/pages/import-csv"));
const CallQueue = lazy(() => import("@/pages/call-queue"));
const CallHistory = lazy(() => import("@/pages/call-history"));
const CallAnalytics = lazy(() => import("@/pages/call-analytics"));
const IntelPage = lazy(() => import("@/pages/intel"));
const TrustsPage = lazy(() => import("@/pages/trusts"));
const TrustDetail = lazy(() => import("@/pages/trust-detail"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="space-y-4 w-64">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/companies" component={Companies} />
        <Route path="/company/:id" component={CompanyDetail} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/contact/:id" component={ContactDetail} />
        <Route path="/pipeline" component={Pipeline} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/call-queue" component={CallQueue} />
        <Route path="/call-history" component={CallHistory} />
        <Route path="/call-analytics" component={CallAnalytics} />
        <Route path="/intel" component={IntelPage} />
        <Route path="/trusts" component={TrustsPage} />
        <Route path="/trust/:id" component={TrustDetail} />
        <Route path="/import" component={ImportCSV} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function TopNavBar({ onLogout, isLoggingOut }: { onLogout: () => void; isLoggingOut: boolean }) {
  return (
    <header className="h-14 flex items-center justify-between px-6 flex-shrink-0 bg-white dark:bg-[#252936] border-b border-gray-200 dark:border-[#3d4254]">
      {/* Global Search */}
      <GlobalSearch />

      {/* Right side actions */}
      <div className="flex items-center gap-3">
        <ThemeToggle />

        <button className="relative p-2 rounded-md transition-colors text-gray-500 dark:text-[#94a3b8] hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2d3142]">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <div className="h-6 w-px bg-gray-200 dark:bg-[#3d4254]" />

        <button
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-[#2d3142]"
          onClick={onLogout}
          disabled={isLoggingOut}
          data-testid="button-logout"
        >
          <div className="w-7 h-7 rounded-full bg-[#0091AE] flex items-center justify-center">
            <span className="text-xs font-semibold text-white">CS</span>
          </div>
          <span className="font-medium">{isLoggingOut ? "..." : "Conner"}</span>
          <ChevronDown className="h-4 w-4 text-gray-400 dark:text-[#64748b]" />
        </button>
      </div>
    </header>
  );
}

function AuthenticatedApp() {
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      queryClient.clear();
      window.location.reload();
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "Please try again",
        variant: "destructive",
      });
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#f5f8fa] dark:bg-[#1a1d29]">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopNavBar onLogout={handleLogout} isLoggingOut={isLoggingOut} />
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-[#1a1d29]">
          <Router />
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && data) {
      setIsAuthenticated(data.authenticated);
      setAuthChecked(true);
    } else if (!isLoading) {
      setAuthChecked(true);
    }
  }, [data, isLoading]);

  if (!authChecked || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f8fa] dark:bg-[#1a1d29]">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Login
        onLogin={() => {
          setIsAuthenticated(true);
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        }}
      />
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
