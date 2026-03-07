import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Activity } from "@shared/schema";
import { Link } from "wouter";
import type { Company, PipelineStage, TaskWithCompany } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ArrowUpDown, Building2, ExternalLink, Check, X, AlertTriangle, Clock, ChevronRight, DollarSign, TrendingUp, Phone, PhoneCall, ListTodo, Flame, FileText, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow, format, isBefore, startOfToday, isToday, isThisWeek } from "date-fns";

type CompanyWithStage = Company & { stage?: PipelineStage };
type RecentActivity = {
  id: string;
  companyId: string;
  type: string;
  note: string | null;
  outcome: string | null;
  quoteValue: string | null;
  createdAt: string;
  companyName: string | null;
};

type SortField = "name" | "location" | "lastContactDate" | "academyTrustName";
type SortDirection = "asc" | "desc";

const LEAD_STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "0-unqualified", label: "Unqualified", color: "bg-gray-500" },
  { value: "0.5-dm-details", label: "DM Details", color: "bg-teal-500" },
  { value: "1-qualified", label: "Qualified", color: "bg-blue-500" },
  { value: "2-intent", label: "Intent", color: "bg-purple-500" },
  { value: "3-quote-presented", label: "Quote Presented", color: "bg-amber-500" },
  { value: "3b-quoted-lost", label: "Quoted Lost", color: "bg-red-500" },
  { value: "4-account-active", label: "Account Active", color: "bg-green-500" },
  { value: "5-outsourced", label: "Outsourced", color: "bg-cyan-500" },
  { value: "6-time-waste", label: "Time Waste", color: "bg-rose-500" },
];

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("all");
  const [trustFilter, setTrustFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const { data: companies, isLoading: loadingCompanies } = useQuery<CompanyWithStage[]>({
    queryKey: ["/api/companies"],
  });

  const { data: allTasks } = useQuery<TaskWithCompany[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: tasksDueToday } = useQuery<TaskWithCompany[]>({
    queryKey: ["/api/tasks/due-today"],
  });

  const { data: overdueTasks } = useQuery<TaskWithCompany[]>({
    queryKey: ["/api/tasks/overdue"],
  });

  const { data: pipelineValueData } = useQuery<{ value: number }>({
    queryKey: ["/api/dashboard/pipeline-value"],
  });

  const { data: gpThisMonthData } = useQuery<{ value: number }>({
    queryKey: ["/api/dashboard/gp-this-month"],
  });

  const { data: todayCalls } = useQuery<Activity[]>({
    queryKey: ["/api/call-analytics", "dashboard-today"],
    queryFn: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const res = await fetch(`/api/call-analytics?startDate=${start.toISOString()}&endDate=${end.toISOString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const todayCallBreakdown = useMemo(() => {
    if (!todayCalls) return { connected: 0, details: 0, reception: 0, total: 0, connectRate: 0 };
    const connected = todayCalls.filter(c => c.outcome === "Connected to DM").length;
    const details = todayCalls.filter(c => c.outcome === "Decision Maker Details").length;
    const reception = todayCalls.filter(c => c.outcome === "Reception / Voicemail" || !c.outcome).length;
    const total = todayCalls.length;
    return { connected, details, reception, total, connectRate: total > 0 ? (connected / total) * 100 : 0 };
  }, [todayCalls]);

  const { data: dealsNeedingFollowup } = useQuery<CompanyWithStage[]>({
    queryKey: ["/api/dashboard/deals-needing-followup"],
  });

  const { data: callQueue } = useQuery<{ company: Company; priority: number; reason: string }[]>({
    queryKey: ["/api/call-queue"],
  });

  const { data: hotLeadsData } = useQuery<{ count: number; companies: { id: string; name: string }[] }>({
    queryKey: ["/api/dashboard/hot-leads"],
  });

  const { data: recentActivity } = useQuery<RecentActivity[]>({
    queryKey: ["/api/dashboard/recent-activity"],
  });

  // Group tasks by time bucket
  const taskGroups = useMemo(() => {
    if (!allTasks) return { overdue: [], today: [], thisWeek: [], later: [] };
    const today = startOfToday();
    const nonCompleted = allTasks.filter(t => t.status !== "completed" && t.dueDate);

    const overdue = nonCompleted
      .filter(t => isBefore(new Date(t.dueDate!), today) && !isToday(new Date(t.dueDate!)))
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    const todayTasks = nonCompleted
      .filter(t => isToday(new Date(t.dueDate!)))
      .sort((a, b) => a.name.localeCompare(b.name));

    const thisWeek = nonCompleted
      .filter(t => {
        const d = new Date(t.dueDate!);
        return !isBefore(d, today) && !isToday(d) && isThisWeek(d, { weekStartsOn: 1 });
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    const later = nonCompleted
      .filter(t => {
        const d = new Date(t.dueDate!);
        return !isBefore(d, today) && !isToday(d) && !isThisWeek(d, { weekStartsOn: 1 });
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5);

    return { overdue, today: todayTasks, thisWeek, later };
  }, [allTasks]);

  // Schools only (exclude trusts)
  const schoolCompanies = useMemo(() => {
    return companies?.filter(c => !c.isTrust) || [];
  }, [companies]);

  const uniqueLocations = useMemo(() => {
    const locations = schoolCompanies
      .map((c) => c.location)
      .filter((l): l is string => !!l && l.trim() !== "");
    return Array.from(new Set(locations)).sort();
  }, [schoolCompanies]);

  const uniqueTrusts = useMemo(() => {
    const trusts = schoolCompanies
      .map((c) => c.academyTrustName)
      .filter((t): t is string => !!t && t.trim() !== "");
    return Array.from(new Set(trusts)).sort();
  }, [schoolCompanies]);

  const filteredAndSortedCompanies = useMemo(() => {
    let filtered = schoolCompanies;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((company) =>
        company.name.toLowerCase().includes(searchLower) ||
        company.location?.toLowerCase().includes(searchLower) ||
        company.academyTrustName?.toLowerCase().includes(searchLower) ||
        company.itManagerName?.toLowerCase().includes(searchLower)
      );
    }

    if (locationFilter !== "all") {
      filtered = filtered.filter(c => c.location === locationFilter);
    }
    if (leadStatusFilter !== "all") {
      filtered = filtered.filter(c => (c.budgetStatus || "0-unqualified") === leadStatusFilter);
    }
    if (trustFilter !== "all") {
      filtered = filtered.filter(c => c.academyTrustName === trustFilter);
    }

    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "location":
          comparison = (a.location || "").localeCompare(b.location || "");
          break;
        case "academyTrustName":
          comparison = (a.academyTrustName || "").localeCompare(b.academyTrustName || "");
          break;
        case "lastContactDate": {
          const dateA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
          const dateB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [schoolCompanies, search, locationFilter, leadStatusFilter, trustFilter, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getLeadStatusBadge = (status: string | null) => {
    const s = status || "0-unqualified";
    const option = LEAD_STATUS_OPTIONS.find(o => o.value === s);
    if (option) {
      return <Badge className={`text-[10px] text-white ${option.color}`}>{option.label}</Badge>;
    }
    return <Badge variant="outline" className="text-xs">{s}</Badge>;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call": return <Phone className="h-3.5 w-3.5 text-[#0091AE]" />;
      case "email": return <FileText className="h-3.5 w-3.5 text-purple-500" />;
      case "quote": return <DollarSign className="h-3.5 w-3.5 text-amber-500" />;
      case "deal_won": return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case "deal_lost": return <X className="h-3.5 w-3.5 text-red-500" />;
      default: return <FileText className="h-3.5 w-3.5 text-gray-500" />;
    }
  };

  if (loadingCompanies) {
    return (
      <div className="p-6 space-y-6 bg-gray-50 dark:bg-[#1a1d29] min-h-full">
        <Skeleton className="h-8 w-48 dark:bg-[#3d4254]" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 dark:bg-[#3d4254]" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 dark:bg-[#3d4254]" />)}
        </div>
        <Skeleton className="h-96 dark:bg-[#3d4254]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-[#1a1d29] min-h-full">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Good Morning</h1>
        <p className="text-muted-foreground dark:text-[#94a3b8]">
          {format(new Date(), "EEEE, d MMMM yyyy")} &middot; {schoolCompanies.length} schools in pipeline
        </p>
      </div>

      {/* ROW 1: TODAY'S ACTION STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/call-queue">
          <Card className="dark:bg-[#252936] dark:border-[#3d4254] cursor-pointer hover:shadow-md transition-shadow group h-full">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Call Queue</CardTitle>
              <div className="flex items-center gap-1">
                <PhoneCall className="h-4 w-4 text-[#0091AE]" />
                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#0091AE]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">{callQueue?.length || 0}</div>
              <p className="text-xs text-muted-foreground dark:text-[#64748b]">schools waiting</p>
              {callQueue && callQueue.length > 0 && (
                <p className="text-xs text-[#0091AE] mt-1 font-medium">Start Calling →</p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/tasks">
          <Card className="dark:bg-[#252936] dark:border-[#3d4254] cursor-pointer hover:shadow-md transition-shadow group h-full">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Tasks Due</CardTitle>
              <div className="flex items-center gap-1">
                <ListTodo className="h-4 w-4 text-[#f59e0b]" />
                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#f59e0b]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(overdueTasks?.length || 0) > 0 ? "text-[#ef4444]" : "dark:text-white"}`}>
                {(tasksDueToday?.length || 0) + (overdueTasks?.length || 0)}
              </div>
              <p className="text-xs text-muted-foreground dark:text-[#64748b]">
                {tasksDueToday?.length || 0} due today{(overdueTasks?.length || 0) > 0 && `, ${overdueTasks?.length} overdue`}
              </p>
              <p className="text-xs text-[#f59e0b] mt-1 font-medium">View Tasks →</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/call-analytics">
          <Card className="dark:bg-[#252936] dark:border-[#3d4254] cursor-pointer hover:shadow-md transition-shadow group h-full">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Called Today</CardTitle>
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4 text-[#0091AE]" />
                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#0091AE]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">{todayCallBreakdown.total}</div>
              {todayCallBreakdown.total > 0 ? (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-[#10b981]">{todayCallBreakdown.connected} DM</span>
                  <span className="text-xs text-[#0091AE]">{todayCallBreakdown.details} details</span>
                  <span className="text-xs text-[#f59e0b]">{todayCallBreakdown.reception} VM</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground dark:text-[#64748b]">calls logged</p>
              )}
              <p className="text-xs text-[#0091AE] mt-1 font-medium">Log a Call →</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/companies?status=intent">
          <Card className="dark:bg-[#252936] dark:border-[#3d4254] cursor-pointer hover:shadow-md transition-shadow group h-full">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Hot Leads</CardTitle>
              <div className="flex items-center gap-1">
                <Flame className="h-4 w-4 text-[#ef4444]" />
                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#ef4444]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(hotLeadsData?.count || 0) > 0 ? "text-[#ef4444]" : "dark:text-white"}`}>
                {hotLeadsData?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground dark:text-[#64748b]">Intent status</p>
              <p className="text-xs text-[#ef4444] mt-1 font-medium">View Leads →</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ROW 2: PIPELINE OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/pipeline">
          <Card className="dark:bg-[#252936] dark:border-[#3d4254] cursor-pointer hover:shadow-md transition-shadow group h-full">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Active Pipeline</CardTitle>
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-[#10b981]" />
                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#10b981]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">
                £{(pipelineValueData?.value || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground dark:text-[#64748b]">across active deals</p>
            </CardContent>
          </Card>
        </Link>

        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Won This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#10b981]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#10b981]">
              £{(gpThisMonthData?.value || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground dark:text-[#64748b]">gross profit from won deals</p>
          </CardContent>
        </Card>

        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Needs Follow-up</CardTitle>
            <AlertTriangle className="h-4 w-4 text-[#f59e0b]" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(dealsNeedingFollowup?.length || 0) > 0 ? "text-[#f59e0b]" : "dark:text-white"}`}>
              {dealsNeedingFollowup?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground dark:text-[#64748b]">quoted 3+ days ago</p>
          </CardContent>
        </Card>
      </div>

      {/* ROW 3: TWO COLUMNS - Recent Activity + Upcoming Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {!recentActivity || recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground dark:text-[#64748b]">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium capitalize dark:text-[#94a3b8]">{activity.type.replace("_", " ")}</span>
                        {activity.companyName && (
                          <Link href={`/company/${activity.companyId}`}>
                            <span className="text-xs text-[#0091AE] hover:underline truncate">
                              {activity.companyName}
                            </span>
                          </Link>
                        )}
                      </div>
                      {(activity.note || activity.outcome) && (
                        <p className="text-xs text-muted-foreground dark:text-[#64748b] truncate mt-0.5">
                          {activity.outcome || activity.note}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground dark:text-[#64748b] mt-0.5">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Upcoming Tasks</CardTitle>
            <Link href="/tasks">
              <div className="flex items-center gap-1 text-xs text-[#0091AE] hover:underline">
                View all <ChevronRight className="h-3 w-3" />
              </div>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Overdue */}
              {taskGroups.overdue.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3 w-3 text-[#ef4444]" />
                    <span className="text-xs font-semibold text-[#ef4444] uppercase">Overdue ({taskGroups.overdue.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {taskGroups.overdue.slice(0, 5).map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate dark:text-white">{task.name}</span>
                          <Link href={`/company/${task.companyId}`}>
                            <span className="text-[10px] text-muted-foreground dark:text-[#94a3b8] hover:text-[#0091AE] truncate">
                              {task.company?.name}
                            </span>
                          </Link>
                        </div>
                        <span className="text-xs text-[#ef4444] flex-shrink-0">
                          {task.dueDate && format(new Date(task.dueDate), "MMM d")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Today */}
              {taskGroups.today.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-3 w-3 text-[#f59e0b]" />
                    <span className="text-xs font-semibold text-[#f59e0b] uppercase">Today ({taskGroups.today.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {taskGroups.today.map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate dark:text-white">{task.name}</span>
                          <Link href={`/company/${task.companyId}`}>
                            <span className="text-[10px] text-muted-foreground dark:text-[#94a3b8] hover:text-[#0091AE] truncate">
                              {task.company?.name}
                            </span>
                          </Link>
                        </div>
                        <span className="text-xs text-[#f59e0b] flex-shrink-0">Today</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* This Week */}
              {taskGroups.thisWeek.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground dark:text-[#94a3b8] uppercase">This Week ({taskGroups.thisWeek.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {taskGroups.thisWeek.map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate dark:text-white">{task.name}</span>
                          <Link href={`/company/${task.companyId}`}>
                            <span className="text-[10px] text-muted-foreground dark:text-[#94a3b8] hover:text-[#0091AE] truncate">
                              {task.company?.name}
                            </span>
                          </Link>
                        </div>
                        <span className="text-xs text-muted-foreground dark:text-[#64748b] flex-shrink-0">
                          {task.dueDate && format(new Date(task.dueDate), "MMM d")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Later */}
              {taskGroups.later.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground dark:text-[#94a3b8] uppercase">Later</span>
                  </div>
                  <div className="space-y-1.5">
                    {taskGroups.later.map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate dark:text-white">{task.name}</span>
                          <Link href={`/company/${task.companyId}`}>
                            <span className="text-[10px] text-muted-foreground dark:text-[#94a3b8] hover:text-[#0091AE] truncate">
                              {task.company?.name}
                            </span>
                          </Link>
                        </div>
                        <span className="text-xs text-muted-foreground dark:text-[#64748b] flex-shrink-0">
                          {task.dueDate && format(new Date(task.dueDate), "MMM d")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {taskGroups.overdue.length === 0 && taskGroups.today.length === 0 && taskGroups.thisWeek.length === 0 && taskGroups.later.length === 0 && (
                <p className="text-sm text-muted-foreground dark:text-[#64748b]">No upcoming tasks</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ROW 4: SCHOOLS TABLE */}
      <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Schools Overview</CardTitle>
            <span className="text-xs text-muted-foreground dark:text-[#64748b]">
              {filteredAndSortedCompanies.length} of {schoolCompanies.length} schools
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-[#64748b]" />
              <Input
                placeholder="Search schools..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
              />
            </div>

            <Select value={leadStatusFilter} onValueChange={setLeadStatusFilter}>
              <SelectTrigger className="w-[150px] h-9 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                <SelectItem value="all">All Statuses</SelectItem>
                {LEAD_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={trustFilter} onValueChange={setTrustFilter}>
              <SelectTrigger className="w-[150px] h-9 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                <SelectValue placeholder="Trust" />
              </SelectTrigger>
              <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                <SelectItem value="all">All Trusts</SelectItem>
                {uniqueTrusts.map((trust) => (
                  <SelectItem key={trust} value={trust}>{trust}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[150px] h-9 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                <SelectItem value="all">All Locations</SelectItem>
                {uniqueLocations.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg overflow-hidden dark:border-[#3d4254]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 dark:bg-[#2d3142]">
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("name")}>
                    <div className="flex items-center gap-1">School Name <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("location")}>
                    <div className="flex items-center gap-1">Location <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("academyTrustName")}>
                    <div className="flex items-center gap-1">Trust <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead>Lead Status</TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("lastContactDate")}>
                    <div className="flex items-center gap-1">Last Contact <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 dark:bg-[#252936]">
                      <Building2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground dark:text-[#64748b] opacity-50" />
                      <p className="text-muted-foreground dark:text-[#94a3b8]">No schools match your filters</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedCompanies.slice(0, 50).map((company, index) => (
                    <TableRow
                      key={company.id}
                      className={`cursor-pointer hover:bg-muted/30 dark:hover:bg-[#2d3142] ${index % 2 === 0 ? 'dark:bg-[#252936]' : 'dark:bg-[#1a1d29]'}`}
                    >
                      <TableCell className="dark:border-[#3d4254]">
                        <Link href={`/company/${company.id}`}>
                          <div className="flex items-center gap-2 font-medium text-[#0091AE] hover:underline min-w-0" title={company.name}>
                            <span className="truncate">{company.name}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground dark:text-[#94a3b8] dark:border-[#3d4254]">
                        <span className="truncate block" title={company.location || undefined}>{company.location || "—"}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground dark:text-[#94a3b8] dark:border-[#3d4254]">
                        <span className="truncate block" title={company.academyTrustName || undefined}>{company.academyTrustName || "—"}</span>
                      </TableCell>
                      <TableCell className="dark:border-[#3d4254]">
                        {getLeadStatusBadge(company.budgetStatus)}
                      </TableCell>
                      <TableCell className="text-muted-foreground dark:text-[#94a3b8] text-sm dark:border-[#3d4254]">
                        {company.lastContactDate
                          ? formatDistanceToNow(new Date(company.lastContactDate), { addSuffix: true })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {filteredAndSortedCompanies.length > 50 && (
              <div className="px-4 py-2 text-xs text-center text-muted-foreground dark:text-[#64748b] border-t dark:border-[#3d4254]">
                Showing 50 of {filteredAndSortedCompanies.length} schools &middot;{" "}
                <Link href="/companies">
                  <span className="text-[#0091AE] hover:underline">View all in Companies</span>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
