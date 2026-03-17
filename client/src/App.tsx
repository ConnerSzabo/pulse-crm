import { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut } from "lucide-react";
import Login from "@/pages/login";
import { useToast } from "@/hooks/use-toast";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const TsosPage = lazy(() => import("@/pages/tsos"));
const TsoDetail = lazy(() => import("@/pages/tso-detail"));
const ShowsPage = lazy(() => import("@/pages/shows"));
const ShowDetail = lazy(() => import("@/pages/show-detail"));
const ContactsPage = lazy(() => import("@/pages/contacts"));
const TasksPage = lazy(() => import("@/pages/tasks"));
const DealsPage = lazy(() => import("@/pages/deals"));
const ImportPage = lazy(() => import("@/pages/import"));
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
        <Route path="/tsos" component={TsosPage} />
        <Route path="/tso/:id" component={TsoDetail} />
        <Route path="/shows" component={ShowsPage} />
        <Route path="/show/:id" component={ShowDetail} />
        <Route path="/contacts" component={ContactsPage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/deals" component={DealsPage} />
        <Route path="/import" component={ImportPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function TopNavBar({ onLogout, isLoggingOut }: { onLogout: () => void; isLoggingOut: boolean }) {
  return (
    <header
      className="h-12 flex items-center justify-end px-5 flex-shrink-0 border-b"
      style={{ background: "#0d1117", borderColor: "#1e2433" }}>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="h-5 w-px mx-1" style={{ background: "#1e2433" }} />
        <button
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors"
          style={{ color: "#94a3b8" }}
          onClick={onLogout}
          disabled={isLoggingOut}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "#f1f5f9"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "#94a3b8"; }}
        >
          <LogOut className="h-4 w-4" />
          <span className="font-medium">{isLoggingOut ? "Signing out..." : "Sign out"}</span>
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
    } catch {
      toast({ title: "Logout failed", variant: "destructive" });
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex h-screen w-full" style={{ background: "#0f1419" }}>
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopNavBar onLogout={handleLogout} isLoggingOut={isLoggingOut} />
        <main className="flex-1 overflow-auto" style={{ background: "#0f1419" }}>
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
      <div className="min-h-screen flex items-center justify-center bg-[#1a1033]">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Login onLogin={() => {
        setIsAuthenticated(true);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      }} />
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
