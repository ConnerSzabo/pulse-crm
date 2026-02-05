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
import { Search, ArrowUpDown, Building2, ExternalLink, Check, X, AlertTriangle, Clock, ChevronRight, DollarSign, TrendingUp, Phone, Users } from "lucide-react";
import { formatDistanceToNow, format, isBefore, startOfToday, isToday } from "date-fns";

type CompanyWithStage = Company & { stage?: PipelineStage };

type SortField = "name" | "location" | "lastContactDate" | "academyTrustName";
type SortDirection = "asc" | "desc";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [trustFilter, setTrustFilter] = useState<string>("all");
  const [hasITManagerFilter, setHasITManagerFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const { data: companies, isLoading: loadingCompanies } = useQuery<CompanyWithStage[]>({
    queryKey: ["/api/companies"],
  });

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
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

  // Business Intelligence Metrics
  const { data: pipelineValueData } = useQuery<{ value: number }>({
    queryKey: ["/api/dashboard/pipeline-value"],
  });

  const { data: gpThisMonthData } = useQuery<{ value: number }>({
    queryKey: ["/api/dashboard/gp-this-month"],
  });

  const { data: todayStatsData } = useQuery<{ callsMade: number }>({
    queryKey: ["/api/stats/today"],
  });

  // Today's call analytics for enhanced widget
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

  const upcomingTasks = useMemo(() => {
    if (!allTasks) return [];
    const today = startOfToday();
    return allTasks
      .filter(t => {
        if (t.status === "completed" || !t.dueDate) return false;
        // Only include tasks due today or in the future (not overdue)
        return new Date(t.dueDate) >= today;
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5);
  }, [allTasks]);

  const uniqueLocations = useMemo(() => {
    if (!companies) return [];
    const locations = companies
      .map((c) => c.location)
      .filter((l): l is string => !!l && l.trim() !== "");
    return Array.from(new Set(locations)).sort();
  }, [companies]);

  const uniqueTrusts = useMemo(() => {
    if (!companies) return [];
    const trusts = companies
      .map((c) => c.academyTrustName)
      .filter((t): t is string => !!t && t.trim() !== "");
    return Array.from(new Set(trusts)).sort();
  }, [companies]);

  const filteredAndSortedCompanies = useMemo(() => {
    if (!companies) return [];

    let filtered = companies.filter((company) => {
      const matchesSearch =
        company.name.toLowerCase().includes(search.toLowerCase()) ||
        company.location?.toLowerCase().includes(search.toLowerCase()) ||
        company.academyTrustName?.toLowerCase().includes(search.toLowerCase()) ||
        company.itManagerName?.toLowerCase().includes(search.toLowerCase());

      const matchesLocation = locationFilter === "all" || company.location === locationFilter;
      const matchesStage = stageFilter === "all" || company.stageId === stageFilter;
      const matchesTrust = trustFilter === "all" || company.academyTrustName === trustFilter;
      const matchesITManager =
        hasITManagerFilter === "all" ||
        (hasITManagerFilter === "yes" && company.itManagerName) ||
        (hasITManagerFilter === "no" && !company.itManagerName);

      return matchesSearch && matchesLocation && matchesStage && matchesTrust && matchesITManager;
    });

    filtered.sort((a, b) => {
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
        case "lastContactDate":
          const dateA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
          const dateB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [companies, search, locationFilter, stageFilter, trustFilter, hasITManagerFilter, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  if (loadingCompanies) {
    return (
      <div className="p-6 space-y-6 bg-gray-50 dark:bg-[#1a1d29] min-h-full">
        <Skeleton className="h-8 w-48 dark:bg-[#3d4254]" />
        <Skeleton className="h-10 w-full dark:bg-[#3d4254]" />
        <Skeleton className="h-96 w-full dark:bg-[#3d4254]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-[#1a1d29] min-h-full">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Wave Systems CRM</h1>
        <p className="text-muted-foreground dark:text-[#94a3b8]">
          Managing {companies?.length || 0} schools in your pipeline
        </p>
      </div>

      {/* Business Intelligence Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-pipeline-value" className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-[#10b981]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold dark:text-white">
              £{(pipelineValueData?.value || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground dark:text-[#64748b]">Active quotes total</p>
          </CardContent>
        </Card>

        <Card data-testid="card-gp-this-month" className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">GP This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#10b981]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#10b981]">
              £{(gpThisMonthData?.value || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground dark:text-[#64748b]">Gross profit from won deals</p>
          </CardContent>
        </Card>

        <Link href="/call-analytics">
          <Card data-testid="card-calls-today" className="dark:bg-[#252936] dark:border-[#3d4254] cursor-pointer hover:shadow-md transition-shadow group">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Calls Today</CardTitle>
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4 text-[#0091AE]" />
                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#0091AE]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">{todayCallBreakdown.total || todayStatsData?.callsMade || 0}</div>
              {todayCallBreakdown.total > 0 ? (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-[#10b981]" title="Connected to DM">{todayCallBreakdown.connected} DM</span>
                  <span className="text-xs text-[#0091AE]" title="Decision Maker Details">{todayCallBreakdown.details} details</span>
                  <span className="text-xs text-[#f59e0b]" title="Reception / Voicemail">{todayCallBreakdown.reception} VM</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground dark:text-[#64748b]">Logged call activities</p>
              )}
              {todayCallBreakdown.total > 0 && (
                <p className="text-xs dark:text-[#64748b] mt-0.5">{todayCallBreakdown.connectRate.toFixed(0)}% connect rate</p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Card data-testid="card-needs-followup" className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Needs Follow-up</CardTitle>
            <Users className="h-4 w-4 text-[#f59e0b]" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(dealsNeedingFollowup?.length || 0) > 0 ? "text-[#f59e0b]" : "dark:text-white"}`}>
              {dealsNeedingFollowup?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground dark:text-[#64748b]">Quoted 3+ days ago</p>
          </CardContent>
        </Card>
      </div>

      {/* Task Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-tasks-due-today" className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Tasks Due Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground dark:text-[#64748b]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold dark:text-white">{tasksDueToday?.length || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-overdue-tasks" className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Overdue Tasks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-[#ef4444]" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(overdueTasks?.length || 0) > 0 ? "text-[#ef4444]" : "dark:text-white"}`}>
              {overdueTasks?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 dark:bg-[#252936] dark:border-[#3d4254]" data-testid="card-upcoming-tasks">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Next 5 Upcoming Tasks</CardTitle>
            <Link href="/tasks">
              <div className="flex items-center gap-1 text-xs text-[#0091AE] hover:underline">
                View all <ChevronRight className="h-3 w-3" />
              </div>
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground dark:text-[#64748b]">No upcoming tasks</p>
            ) : (
              <div className="space-y-2">
                {upcomingTasks.map((task) => {
                  const today = startOfToday();
                  const isOverdue = task.dueDate && isBefore(new Date(task.dueDate), today);
                  const isDueToday = task.dueDate && isToday(new Date(task.dueDate));

                  return (
                    <div key={task.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate font-medium dark:text-white">{task.name}</span>
                        <Link href={`/company/${task.companyId}`}>
                          <span className="text-muted-foreground dark:text-[#94a3b8] hover:text-[#0091AE] hover:underline truncate text-xs">
                            {task.company?.name}
                          </span>
                        </Link>
                      </div>
                      <div className={`flex-shrink-0 text-xs ${
                        isOverdue ? "text-[#ef4444]" :
                        isDueToday ? "text-[#f59e0b]" : "text-muted-foreground dark:text-[#64748b]"
                      }`}>
                        {isOverdue && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                        {task.dueDate && format(new Date(task.dueDate), "MMM d")}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-[#64748b]" />
          <Input
            placeholder="Search schools, locations, trusts, IT managers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
            data-testid="input-dashboard-search"
          />
        </div>

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[150px] dark:bg-[#252936] dark:border-[#3d4254] dark:text-white" data-testid="select-filter-location">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
            <SelectItem value="all">All Locations</SelectItem>
            {uniqueLocations.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {loc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px] dark:bg-[#252936] dark:border-[#3d4254] dark:text-white" data-testid="select-filter-stage">
            <SelectValue placeholder="Pipeline Stage" />
          </SelectTrigger>
          <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
            <SelectItem value="all">All Stages</SelectItem>
            {stages?.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={trustFilter} onValueChange={setTrustFilter}>
          <SelectTrigger className="w-[180px] dark:bg-[#252936] dark:border-[#3d4254] dark:text-white" data-testid="select-filter-trust">
            <SelectValue placeholder="Academy Trust" />
          </SelectTrigger>
          <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
            <SelectItem value="all">All Trusts</SelectItem>
            {uniqueTrusts.map((trust) => (
              <SelectItem key={trust} value={trust}>
                {trust}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={hasITManagerFilter} onValueChange={setHasITManagerFilter}>
          <SelectTrigger className="w-[160px] dark:bg-[#252936] dark:border-[#3d4254] dark:text-white" data-testid="select-filter-it-manager">
            <SelectValue placeholder="IT Manager" />
          </SelectTrigger>
          <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Has IT Manager</SelectItem>
            <SelectItem value="no">No IT Manager</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground dark:text-[#94a3b8]">
        Showing {filteredAndSortedCompanies.length} of {companies?.length || 0} schools
      </div>

      <div className="border rounded-lg overflow-hidden dark:border-[#3d4254] dark:bg-[#252936]">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 dark:bg-[#2d3142]">
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort("name")}
              >
                <div className="flex items-center gap-1">
                  School Name
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort("location")}
              >
                <div className="flex items-center gap-1">
                  Location
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort("academyTrustName")}
              >
                <div className="flex items-center gap-1">
                  Academy Trust
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>IT Manager</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort("lastContactDate")}
              >
                <div className="flex items-center gap-1">
                  Last Contact
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead>Next Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedCompanies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 dark:bg-[#252936]">
                  <Building2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground dark:text-[#64748b] opacity-50" />
                  <p className="text-muted-foreground dark:text-[#94a3b8]">No schools match your filters</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedCompanies.map((company, index) => (
                <TableRow
                  key={company.id}
                  className={`cursor-pointer hover:bg-muted/30 dark:hover:bg-[#2d3142] ${index % 2 === 0 ? 'dark:bg-[#252936]' : 'dark:bg-[#1a1d29]'}`}
                  data-testid={`row-company-${company.id}`}
                >
                  <TableCell className="dark:border-[#3d4254]">
                    <Link href={`/company/${company.id}`}>
                      <div className="flex items-center gap-2 font-medium text-[#0091AE] hover:underline">
                        {company.name}
                        <ExternalLink className="h-3 w-3" />
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground dark:text-[#94a3b8] dark:border-[#3d4254]">
                    {company.location || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground dark:text-[#94a3b8] dark:border-[#3d4254]">
                    {company.academyTrustName || "—"}
                  </TableCell>
                  <TableCell className="dark:border-[#3d4254]">
                    {company.stage ? (
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor: company.stage.color + "20",
                          color: company.stage.color,
                          borderColor: company.stage.color + "40"
                        }}
                      >
                        {company.stage.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground dark:text-[#64748b]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="dark:border-[#3d4254]">
                    {company.itManagerName ? (
                      <div className="flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-[#10b981]" />
                        <span className="text-sm dark:text-white">{company.itManagerName}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground dark:text-[#64748b]">
                        <X className="h-3 w-3" />
                        <span className="text-sm">No</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground dark:text-[#94a3b8] text-sm dark:border-[#3d4254]">
                    {company.lastContactDate
                      ? formatDistanceToNow(new Date(company.lastContactDate), { addSuffix: true })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate dark:text-[#94a3b8] dark:border-[#3d4254]">
                    {company.nextAction || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
