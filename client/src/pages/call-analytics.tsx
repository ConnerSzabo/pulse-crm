import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Activity } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  BarChart3,
  Target,
  Flame,
  Award,
  Building2,
  Clock,
  ChevronRight,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, isToday, isYesterday, getDay, startOfWeek, endOfWeek } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type CallActivity = Activity & { companyName?: string };

type DateRange = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth";

const OUTCOME_COLORS: Record<string, string> = {
  "Reception / Voicemail": "#f59e0b",
  "Decision Maker Details": "#0091AE",
  "Connected to DM": "#10b981",
};

const OUTCOME_LABELS: Record<string, string> = {
  "Reception / Voicemail": "Reception / VM",
  "Decision Maker Details": "DM Details",
  "Connected to DM": "Connected to DM",
};

function getDateRange(range: DateRange): { start: Date; end: Date; label: string } {
  const now = new Date();
  switch (range) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now), label: "Today" };
    case "yesterday": {
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday), label: "Yesterday" };
    }
    case "last7":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now), label: "Last 7 Days" };
    case "last30":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now), label: "Last 30 Days" };
    case "thisMonth":
      return { start: startOfMonth(now), end: endOfDay(now), label: "This Month" };
    case "lastMonth": {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth), label: "Last Month" };
    }
  }
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function CallAnalytics() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange>("last7");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [tableSortBy, setTableSortBy] = useState<"date" | "total" | "reception" | "details" | "connected" | "rate">("date");
  const [tableSortOrder, setTableSortOrder] = useState<"asc" | "desc">("desc");
  const [feedPage, setFeedPage] = useState(0);
  const FEED_PAGE_SIZE = 15;

  const { start, end, label: rangeLabel } = getDateRange(dateRange);

  // Fetch call data for selected range
  const { data: calls, isLoading } = useQuery<CallActivity[]>({
    queryKey: ["/api/call-analytics", dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/call-analytics?startDate=${start.toISOString()}&endDate=${end.toISOString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Fetch all-time calls for streaks and records (last 90 days)
  const { data: allTimeCalls } = useQuery<CallActivity[]>({
    queryKey: ["/api/call-analytics", "alltime"],
    queryFn: async () => {
      const allStart = startOfDay(subDays(new Date(), 89));
      const allEnd = endOfDay(new Date());
      const res = await fetch(`/api/call-analytics?startDate=${allStart.toISOString()}&endDate=${allEnd.toISOString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Fetch yesterday's calls for comparison
  const { data: yesterdayCalls } = useQuery<CallActivity[]>({
    queryKey: ["/api/call-analytics", "yesterday-compare"],
    queryFn: async () => {
      const yStart = startOfDay(subDays(new Date(), 1));
      const yEnd = endOfDay(subDays(new Date(), 1));
      const res = await fetch(`/api/call-analytics?startDate=${yStart.toISOString()}&endDate=${yEnd.toISOString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Migrate outcomes
  const migrateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/call-analytics/migrate-outcomes");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-analytics"] });
      toast({ title: `Migrated ${data.updated || 0} call outcomes to new format` });
    },
  });

  // Computed analytics
  const analytics = useMemo(() => {
    if (!calls) return null;

    const total = calls.length;
    const byOutcome = {
      "Reception / Voicemail": 0,
      "Decision Maker Details": 0,
      "Connected to DM": 0,
    };

    calls.forEach(c => {
      const outcome = c.outcome || "Reception / Voicemail";
      if (outcome in byOutcome) {
        byOutcome[outcome as keyof typeof byOutcome]++;
      } else {
        byOutcome["Reception / Voicemail"]++;
      }
    });

    // Daily breakdown
    const dailyMap = new Map<string, { date: string; total: number; reception: number; details: number; connected: number }>();
    calls.forEach(c => {
      const dateKey = format(new Date(c.createdAt), "yyyy-MM-dd");
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, total: 0, reception: 0, details: 0, connected: 0 });
      }
      const day = dailyMap.get(dateKey)!;
      day.total++;
      const outcome = c.outcome || "Reception / Voicemail";
      if (outcome === "Reception / Voicemail") day.reception++;
      else if (outcome === "Decision Maker Details") day.details++;
      else if (outcome === "Connected to DM") day.connected++;
      else day.reception++;
    });

    // Fill in missing days
    const dailyData: typeof dailyMap extends Map<string, infer V> ? V[] : never = [];
    const current = new Date(start);
    while (current <= end) {
      const dateKey = format(current, "yyyy-MM-dd");
      dailyData.push(dailyMap.get(dateKey) || { date: dateKey, total: 0, reception: 0, details: 0, connected: 0 });
      current.setDate(current.getDate() + 1);
    }

    // Day of week analysis
    const dowData = Array.from({ length: 7 }, (_, i) => ({
      day: DAY_NAMES[i],
      dayIndex: i,
      totalCalls: 0,
      connectedCalls: 0,
      daysCount: 0,
    }));

    // Count unique days per day of week
    const dowDays = new Map<number, Set<string>>();
    dailyData.forEach(d => {
      const dow = getDay(new Date(d.date));
      if (!dowDays.has(dow)) dowDays.set(dow, new Set());
      dowDays.get(dow)!.add(d.date);
      dowData[dow].totalCalls += d.total;
      dowData[dow].connectedCalls += d.connected;
    });
    dowData.forEach(d => {
      d.daysCount = dowDays.get(d.dayIndex)?.size || 0;
    });

    return {
      total,
      byOutcome,
      dailyData,
      dowData: dowData.filter(d => d.dayIndex >= 1 && d.dayIndex <= 5), // Mon-Fri only
      connectRate: total > 0 ? (byOutcome["Connected to DM"] / total) * 100 : 0,
    };
  }, [calls, start, end]);

  // All-time analytics for motivational features
  const motivational = useMemo(() => {
    if (!allTimeCalls) return null;

    // Build daily map for streaks
    const dailyMap = new Map<string, number>();
    allTimeCalls.forEach(c => {
      const dateKey = format(new Date(c.createdAt), "yyyy-MM-dd");
      dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
    });

    // Calculate streak (consecutive days with calls)
    let streak = 0;
    let checkDate = new Date();
    // If no calls today yet, start from yesterday
    const todayKey = format(checkDate, "yyyy-MM-dd");
    if (!dailyMap.has(todayKey)) {
      checkDate = subDays(checkDate, 1);
    }
    while (true) {
      const key = format(checkDate, "yyyy-MM-dd");
      if (dailyMap.has(key)) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }

    // Best connect rate day
    const dailyRates: { date: string; total: number; connected: number; rate: number }[] = [];
    const dailyOutcomes = new Map<string, { total: number; connected: number }>();
    allTimeCalls.forEach(c => {
      const dateKey = format(new Date(c.createdAt), "yyyy-MM-dd");
      if (!dailyOutcomes.has(dateKey)) dailyOutcomes.set(dateKey, { total: 0, connected: 0 });
      const d = dailyOutcomes.get(dateKey)!;
      d.total++;
      if (c.outcome === "Connected to DM") d.connected++;
    });
    dailyOutcomes.forEach((v, k) => {
      if (v.total >= 3) { // Only count days with at least 3 calls
        dailyRates.push({ date: k, total: v.total, connected: v.connected, rate: (v.connected / v.total) * 100 });
      }
    });
    dailyRates.sort((a, b) => b.rate - a.rate);

    // Most productive days
    const productiveDays = Array.from(dailyOutcomes.entries())
      .map(([date, v]) => ({ date, total: v.total, connected: v.connected, rate: v.total > 0 ? (v.connected / v.total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);

    return {
      streak,
      bestConnectDay: dailyRates[0] || null,
      topConnectDays: dailyRates.slice(0, 5),
      topProductiveDays: productiveDays.slice(0, 5),
    };
  }, [allTimeCalls]);

  // Yesterday comparison
  const yesterdayComparison = useMemo(() => {
    if (!yesterdayCalls || !calls) return null;
    const todayCalls = calls.filter(c => isToday(new Date(c.createdAt)));
    const todayTotal = todayCalls.length;
    const yesterdayTotal = yesterdayCalls.length;

    if (yesterdayTotal === 0) return { diff: todayTotal, percentage: 0, isUp: true };
    const diff = todayTotal - yesterdayTotal;
    const percentage = Math.round((diff / yesterdayTotal) * 100);
    return { diff, percentage, isUp: diff >= 0 };
  }, [calls, yesterdayCalls]);

  // Sorting for daily breakdown table
  const sortedDailyData = useMemo(() => {
    if (!analytics) return [];
    const data = [...analytics.dailyData];
    data.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (tableSortBy) {
        case "date": aVal = new Date(a.date).getTime(); bVal = new Date(b.date).getTime(); break;
        case "total": aVal = a.total; bVal = b.total; break;
        case "reception": aVal = a.reception; bVal = b.reception; break;
        case "details": aVal = a.details; bVal = b.details; break;
        case "connected": aVal = a.connected; bVal = b.connected; break;
        case "rate": aVal = a.total > 0 ? a.connected / a.total : 0; bVal = b.total > 0 ? b.connected / b.total : 0; break;
        default: return 0;
      }
      return tableSortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });
    return data;
  }, [analytics, tableSortBy, tableSortOrder]);

  // Filtered feed
  const filteredCalls = useMemo(() => {
    if (!calls) return [];
    if (outcomeFilter === "all") return calls;
    return calls.filter(c => c.outcome === outcomeFilter);
  }, [calls, outcomeFilter]);

  const pagedFeed = filteredCalls.slice(feedPage * FEED_PAGE_SIZE, (feedPage + 1) * FEED_PAGE_SIZE);

  const toggleSort = (col: typeof tableSortBy) => {
    if (tableSortBy === col) {
      setTableSortOrder(o => o === "asc" ? "desc" : "asc");
    } else {
      setTableSortBy(col);
      setTableSortOrder("desc");
    }
  };

  const getConnectRateColor = (rate: number) => {
    if (rate >= 30) return "text-[#10b981]";
    if (rate >= 15) return "text-[#f59e0b]";
    return "text-[#ef4444]";
  };

  // Export to CSV
  const handleExport = () => {
    if (!analytics || !calls) return;

    // Build CSV
    let csv = "Date,Total Calls,Reception/Voicemail,Decision Maker Details,Connected to DM,Connect Rate %\n";
    analytics.dailyData.forEach(d => {
      const rate = d.total > 0 ? ((d.connected / d.total) * 100).toFixed(1) : "0.0";
      csv += `${d.date},${d.total},${d.reception},${d.details},${d.connected},${rate}%\n`;
    });

    csv += "\n\nIndividual Call Logs\n";
    csv += "Date,Time,Company,Outcome,Notes\n";
    calls.forEach(c => {
      const date = format(new Date(c.createdAt), "yyyy-MM-dd");
      const time = format(new Date(c.createdAt), "HH:mm");
      const company = (c.companyName || "").replace(/,/g, " ");
      const notes = (c.note || "").replace(/,/g, " ").replace(/\n/g, " ");
      csv += `${date},${time},${company},${c.outcome || ""},${notes}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Call_Analytics_${rangeLabel.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export downloaded" });
  };

  // Pie chart data
  const pieData = analytics ? [
    { name: "Reception / VM", value: analytics.byOutcome["Reception / Voicemail"], color: OUTCOME_COLORS["Reception / Voicemail"] },
    { name: "DM Details", value: analytics.byOutcome["Decision Maker Details"], color: OUTCOME_COLORS["Decision Maker Details"] },
    { name: "Connected to DM", value: analytics.byOutcome["Connected to DM"], color: OUTCOME_COLORS["Connected to DM"] },
  ].filter(d => d.value > 0) : [];

  // Line chart data
  const lineData = analytics?.dailyData.map(d => ({
    date: format(new Date(d.date), "MMM d"),
    fullDate: d.date,
    calls: d.total,
  })) || [];

  // Stacked bar data
  const stackedBarData = analytics?.dailyData.map(d => ({
    date: format(new Date(d.date), "MMM d"),
    "Reception / VM": d.reception,
    "DM Details": d.details,
    "Connected to DM": d.connected,
  })) || [];

  if (isLoading) {
    return (
      <div className="p-6 dark:bg-[#1a1d29] min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 dark:bg-[#3d4254] rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 dark:bg-[#3d4254] rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-[#3d4254] rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 dark:bg-[#1a1d29] min-h-screen space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Call Analytics</h1>
          <p className="text-sm text-muted-foreground dark:text-[#94a3b8]">
            Track call performance and optimize connection rates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => migrateMutation.mutate()}
            disabled={migrateMutation.isPending}
            className="dark:bg-[#252936] dark:border-[#3d4254] dark:text-[#94a3b8] dark:hover:bg-[#2d3142] dark:hover:text-white"
          >
            {migrateMutation.isPending ? "Migrating..." : "Migrate Old Outcomes"}
          </Button>
          <Select value={dateRange} onValueChange={(v) => { setDateRange(v as DateRange); setFeedPage(0); }}>
            <SelectTrigger className="w-[160px] dark:bg-[#252936] dark:border-[#3d4254] dark:text-white">
              <Calendar className="h-4 w-4 mr-2 dark:text-[#94a3b8]" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
              <SelectItem value="today" className="dark:text-white dark:focus:bg-[#2d3142]">Today</SelectItem>
              <SelectItem value="yesterday" className="dark:text-white dark:focus:bg-[#2d3142]">Yesterday</SelectItem>
              <SelectItem value="last7" className="dark:text-white dark:focus:bg-[#2d3142]">Last 7 Days</SelectItem>
              <SelectItem value="last30" className="dark:text-white dark:focus:bg-[#2d3142]">Last 30 Days</SelectItem>
              <SelectItem value="thisMonth" className="dark:text-white dark:focus:bg-[#2d3142]">This Month</SelectItem>
              <SelectItem value="lastMonth" className="dark:text-white dark:focus:bg-[#2d3142]">Last Month</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleExport}
            className="bg-[#0091AE] hover:bg-[#007a94] text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Motivational Banner */}
      {motivational && (
        <div className="flex gap-4">
          {motivational.streak > 0 && (
            <Card className="flex-1 dark:bg-[#252936] dark:border-[#3d4254]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#f59e0b]/20 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-[#f59e0b]" />
                </div>
                <div>
                  <p className="text-sm font-medium dark:text-white">{motivational.streak} day streak!</p>
                  <p className="text-xs dark:text-[#94a3b8]">{motivational.streak} days in a row with calls made</p>
                </div>
              </CardContent>
            </Card>
          )}
          {motivational.bestConnectDay && (
            <Card className="flex-1 dark:bg-[#252936] dark:border-[#3d4254]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#10b981]/20 flex items-center justify-center">
                  <Award className="h-5 w-5 text-[#10b981]" />
                </div>
                <div>
                  <p className="text-sm font-medium dark:text-white">
                    Personal best: {motivational.bestConnectDay.rate.toFixed(0)}% connect rate
                  </p>
                  <p className="text-xs dark:text-[#94a3b8]">
                    on {format(new Date(motivational.bestConnectDay.date), "MMM d, yyyy")} ({motivational.bestConnectDay.total} calls)
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {yesterdayComparison && dateRange === "today" && (
            <Card className="flex-1 dark:bg-[#252936] dark:border-[#3d4254]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${yesterdayComparison.isUp ? "bg-[#10b981]/20" : "bg-[#ef4444]/20"}`}>
                  {yesterdayComparison.isUp
                    ? <TrendingUp className="h-5 w-5 text-[#10b981]" />
                    : <TrendingDown className="h-5 w-5 text-[#ef4444]" />
                  }
                </div>
                <div>
                  <p className="text-sm font-medium dark:text-white">
                    {yesterdayComparison.isUp ? "↑" : "↓"} {Math.abs(yesterdayComparison.percentage)}% vs yesterday
                  </p>
                  <p className="text-xs dark:text-[#94a3b8]">
                    {Math.abs(yesterdayComparison.diff)} {yesterdayComparison.isUp ? "more" : "fewer"} calls than yesterday
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-[#0091AE]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold dark:text-white">{analytics?.total || 0}</div>
            <p className="text-xs text-muted-foreground dark:text-[#64748b]">{rangeLabel}</p>
          </CardContent>
        </Card>

        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Connected to DM</CardTitle>
            <div className="h-3 w-3 rounded-full bg-[#10b981]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#10b981]">{analytics?.byOutcome["Connected to DM"] || 0}</div>
            <p className="text-xs text-muted-foreground dark:text-[#64748b]">
              {analytics && analytics.total > 0 ? `${analytics.connectRate.toFixed(1)}% of total` : "0% of total"}
            </p>
          </CardContent>
        </Card>

        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">DM Details</CardTitle>
            <div className="h-3 w-3 rounded-full bg-[#0091AE]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#0091AE]">{analytics?.byOutcome["Decision Maker Details"] || 0}</div>
            <p className="text-xs text-muted-foreground dark:text-[#64748b]">
              {analytics && analytics.total > 0
                ? `${((analytics.byOutcome["Decision Maker Details"] / analytics.total) * 100).toFixed(1)}% of total`
                : "0% of total"}
            </p>
          </CardContent>
        </Card>

        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">Reception / VM</CardTitle>
            <div className="h-3 w-3 rounded-full bg-[#f59e0b]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#f59e0b]">{analytics?.byOutcome["Reception / Voicemail"] || 0}</div>
            <p className="text-xs text-muted-foreground dark:text-[#64748b]">
              {analytics && analytics.total > 0
                ? `${((analytics.byOutcome["Reception / Voicemail"] / analytics.total) * 100).toFixed(1)}% of total`
                : "0% of total"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line Chart - Call Volume */}
        <Card className="lg:col-span-2 dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium dark:text-white">Daily Call Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3d4254" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#252936", border: "1px solid #3d4254", borderRadius: "8px", color: "#fff" }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Line type="monotone" dataKey="calls" stroke="#0091AE" strokeWidth={2} dot={{ r: 3, fill: "#0091AE" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Outcome Distribution */}
        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium dark:text-white">Outcome Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground dark:text-[#64748b]">
                  No data for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="45%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#252936", border: "1px solid #3d4254", borderRadius: "8px", color: "#fff" }}
                      formatter={(value: number) => [`${value} calls`, ""]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span style={{ color: "#94a3b8", fontSize: "11px" }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stacked Bar Chart */}
      <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium dark:text-white">Outcome Breakdown by Day</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3d4254" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#252936", border: "1px solid #3d4254", borderRadius: "8px", color: "#fff" }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Legend formatter={(value) => <span style={{ color: "#94a3b8", fontSize: "11px" }}>{value}</span>} />
                <Bar dataKey="Reception / VM" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="DM Details" stackId="a" fill="#0091AE" />
                <Bar dataKey="Connected to DM" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Daily Breakdown Table */}
      <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium dark:text-white">Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-[#3d4254]">
                  {[
                    { key: "date" as const, label: "Date" },
                    { key: "total" as const, label: "Total Calls" },
                    { key: "reception" as const, label: "Reception / VM" },
                    { key: "details" as const, label: "DM Details" },
                    { key: "connected" as const, label: "Connected to DM" },
                    { key: "rate" as const, label: "Connect Rate %" },
                  ].map(col => (
                    <th
                      key={col.key}
                      className="text-left p-3 font-medium dark:text-[#94a3b8] cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2d3142] select-none"
                      onClick={() => toggleSort(col.key)}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedDailyData.map((day, i) => {
                  const rate = day.total > 0 ? (day.connected / day.total) * 100 : 0;
                  const dayOfWeek = format(new Date(day.date), "EEE");
                  return (
                    <tr
                      key={day.date}
                      className={`border-b dark:border-[#3d4254] dark:hover:bg-[#2d3142] ${
                        i % 2 === 0 ? "dark:bg-[#252936]" : "dark:bg-[#1a1d29]"
                      }`}
                    >
                      <td className="p-3 dark:text-white">
                        {format(new Date(day.date), "MMM d, yyyy")}
                        <span className="text-xs dark:text-[#64748b] ml-1">({dayOfWeek})</span>
                      </td>
                      <td className="p-3 font-medium dark:text-white">{day.total}</td>
                      <td className="p-3 text-[#f59e0b]">{day.reception}</td>
                      <td className="p-3 text-[#0091AE]">{day.details}</td>
                      <td className="p-3 text-[#10b981]">{day.connected}</td>
                      <td className={`p-3 font-medium ${getConnectRateColor(rate)}`}>
                        {day.total > 0 ? `${rate.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
                {sortedDailyData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center dark:text-[#64748b]">No call data for this period</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Best Days & Day of Week Analysis Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Best Connect Days */}
        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#10b981]" />
              <CardTitle className="text-sm font-medium dark:text-white">Best Connect Days</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {motivational?.topConnectDays.length === 0 ? (
              <p className="text-sm dark:text-[#64748b] text-center py-4">Need at least 3 calls in a day</p>
            ) : (
              <div className="space-y-2">
                {motivational?.topConnectDays.map((day, i) => (
                  <div key={day.date} className="flex items-center justify-between p-2 rounded dark:hover:bg-[#2d3142]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold w-5 text-center dark:text-[#64748b]">#{i + 1}</span>
                      <div>
                        <p className="text-sm dark:text-white">{format(new Date(day.date), "MMM d, yyyy")}</p>
                        <p className="text-xs dark:text-[#64748b]">{format(new Date(day.date), "EEEE")} · {day.total} calls</p>
                      </div>
                    </div>
                    <Badge className={`${getConnectRateColor(day.rate)} bg-transparent border-0 font-bold`}>
                      {day.rate.toFixed(0)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Most Productive Days */}
        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#0091AE]" />
              <CardTitle className="text-sm font-medium dark:text-white">Most Productive Days</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {motivational?.topProductiveDays.length === 0 ? (
              <p className="text-sm dark:text-[#64748b] text-center py-4">No call data yet</p>
            ) : (
              <div className="space-y-2">
                {motivational?.topProductiveDays.map((day, i) => (
                  <div key={day.date} className="flex items-center justify-between p-2 rounded dark:hover:bg-[#2d3142]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold w-5 text-center dark:text-[#64748b]">#{i + 1}</span>
                      <div>
                        <p className="text-sm dark:text-white">{format(new Date(day.date), "MMM d, yyyy")}</p>
                        <p className="text-xs dark:text-[#64748b]">{format(new Date(day.date), "EEEE")} · {day.rate.toFixed(0)}% connect</p>
                      </div>
                    </div>
                    <Badge className="bg-transparent border-0 font-bold text-[#0091AE]">
                      {day.total} calls
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Day of Week Analysis */}
        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#f59e0b]" />
              <CardTitle className="text-sm font-medium dark:text-white">Day of Week Analysis</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="grid grid-cols-4 gap-2 text-xs font-medium dark:text-[#94a3b8] pb-1 border-b dark:border-[#3d4254]">
                <span>Day</span>
                <span>Avg Calls</span>
                <span>Connect %</span>
                <span>Total</span>
              </div>
              {analytics?.dowData.map(d => {
                const avgCalls = d.daysCount > 0 ? (d.totalCalls / d.daysCount).toFixed(1) : "0";
                const avgRate = d.totalCalls > 0 ? ((d.connectedCalls / d.totalCalls) * 100).toFixed(0) : "0";
                return (
                  <div key={d.day} className="grid grid-cols-4 gap-2 text-sm py-1.5 dark:hover:bg-[#2d3142] rounded px-1">
                    <span className="dark:text-white font-medium">{d.day.slice(0, 3)}</span>
                    <span className="dark:text-[#94a3b8]">{avgCalls}</span>
                    <span className={getConnectRateColor(parseFloat(avgRate))}>{avgRate}%</span>
                    <span className="dark:text-[#64748b]">{d.totalCalls}</span>
                  </div>
                );
              })}
              {(!analytics?.dowData || analytics.dowData.length === 0) && (
                <p className="text-sm dark:text-[#64748b] text-center py-4">No data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium dark:text-white">Recent Calls</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 dark:text-[#64748b]" />
              <Select value={outcomeFilter} onValueChange={(v) => { setOutcomeFilter(v); setFeedPage(0); }}>
                <SelectTrigger className="h-8 w-[180px] text-xs dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                  <SelectValue placeholder="Filter by outcome" />
                </SelectTrigger>
                <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                  <SelectItem value="all" className="dark:text-white dark:focus:bg-[#2d3142]">All Outcomes</SelectItem>
                  <SelectItem value="Reception / Voicemail" className="dark:text-white dark:focus:bg-[#2d3142]">Reception / Voicemail</SelectItem>
                  <SelectItem value="Decision Maker Details" className="dark:text-white dark:focus:bg-[#2d3142]">Decision Maker Details</SelectItem>
                  <SelectItem value="Connected to DM" className="dark:text-white dark:focus:bg-[#2d3142]">Connected to DM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCalls.length === 0 ? (
            <div className="text-center py-8 dark:text-[#64748b]">
              <Phone className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No calls found for this period</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {pagedFeed.map(call => (
                  <div
                    key={call.id}
                    className="flex items-start gap-3 p-3 rounded-lg border dark:border-[#3d4254] dark:hover:bg-[#2d3142] transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-[#0091AE]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Phone className="h-4 w-4 text-blue-600 dark:text-[#0091AE]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm dark:text-white">
                          Call: {call.outcome || "No Outcome"}
                        </span>
                        {call.outcome && (
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: OUTCOME_COLORS[call.outcome] || "#94a3b8" }}
                          />
                        )}
                      </div>
                      {call.companyName && (
                        <Link href={`/company/${call.companyId}`}>
                          <span className="text-xs text-[#0091AE] hover:underline flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3" />
                            {call.companyName}
                          </span>
                        </Link>
                      )}
                      {call.note && (
                        <p className="text-xs dark:text-[#94a3b8] mt-1 line-clamp-2">{call.note}</p>
                      )}
                      <p className="text-xs dark:text-[#64748b] mt-1">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {format(new Date(call.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Pagination */}
              {filteredCalls.length > FEED_PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t dark:border-[#3d4254]">
                  <span className="text-xs dark:text-[#64748b]">
                    Showing {feedPage * FEED_PAGE_SIZE + 1}–{Math.min((feedPage + 1) * FEED_PAGE_SIZE, filteredCalls.length)} of {filteredCalls.length}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={feedPage === 0}
                      onClick={() => setFeedPage(p => p - 1)}
                      className="h-7 text-xs dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]"
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={(feedPage + 1) * FEED_PAGE_SIZE >= filteredCalls.length}
                      onClick={() => setFeedPage(p => p + 1)}
                      className="h-7 text-xs dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
