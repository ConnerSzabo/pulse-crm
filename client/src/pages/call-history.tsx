import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Phone,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  MessageSquare,
  PhoneCall,
  Clock,
  X,
} from "lucide-react";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import type { Activity } from "@shared/schema";

type CallHistoryItem = Activity & {
  companyName?: string;
  contactName?: string;
};

type CallHistoryResponse = {
  calls: CallHistoryItem[];
  total: number;
};

const OUTCOMES = [
  { value: "Reception / Voicemail", label: "Reception / Voicemail" },
  { value: "Decision Maker Details", label: "DM Details" },
  { value: "Connected to DM", label: "Connected to DM" },
];

function getOutcomeBadge(outcome: string | null | undefined) {
  if (!outcome) {
    return (
      <Badge variant="outline" className="text-xs font-medium dark:bg-[#252936] dark:text-[#64748b] dark:border-[#3d4254]">
        No outcome
      </Badge>
    );
  }
  if (outcome === "Connected to DM") {
    return (
      <Badge className="text-xs font-medium bg-emerald-600/15 text-emerald-500 border border-emerald-600/30 hover:bg-emerald-600/15">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
        {outcome}
      </Badge>
    );
  }
  if (outcome === "Decision Maker Details") {
    return (
      <Badge className="text-xs font-medium bg-[#0091AE]/15 text-[#0091AE] border border-[#0091AE]/30 hover:bg-[#0091AE]/15">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0091AE] mr-1.5" />
        {outcome}
      </Badge>
    );
  }
  if (outcome === "Reception / Voicemail") {
    return (
      <Badge className="text-xs font-medium bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/15">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
        {outcome}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs font-medium dark:bg-[#252936] dark:text-[#94a3b8] dark:border-[#3d4254]">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5" />
      {outcome}
    </Badge>
  );
}

function formatCallDate(date: Date | string) {
  const d = new Date(date);
  if (isToday(d)) return `Today at ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `Yesterday at ${format(d, "h:mm a")}`;
  return format(d, "d MMM yyyy 'at' h:mm a");
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function CallHistory() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Simple debounce on search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
    clearTimeout((window as any).__callHistorySearchTimer);
    (window as any).__callHistorySearchTimer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    if (outcomeFilter !== "all") params.set("outcome", outcomeFilter);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    return params.toString();
  }, [page, pageSize, outcomeFilter, debouncedSearch]);

  const { data, isLoading } = useQuery<CallHistoryResponse>({
    queryKey: ["/api/call-history", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/call-history?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch call history");
      return res.json();
    },
    staleTime: 30_000,
  });

  const calls = data?.calls ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const hasActiveFilters = outcomeFilter !== "all" || debouncedSearch.trim().length > 0;

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setOutcomeFilter("all");
    setPage(0);
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-[#1a1d29]">
      {/* Header */}
      <div className="bg-white dark:bg-[#252936] border-b border-gray-200 dark:border-[#3d4254] px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold dark:text-white flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-[#0091AE]" />
              Call History
            </h1>
            <p className="text-sm text-muted-foreground dark:text-[#94a3b8] mt-0.5">
              {isLoading ? "Loading..." : `${total.toLocaleString()} call${total !== 1 ? "s" : ""} logged`}
            </p>
          </div>

          {/* Stats summary row */}
          {!isLoading && total > 0 && (
            <div className="hidden md:flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1.5 text-[#10b981]">
                <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                <span className="dark:text-[#94a3b8]">
                  {calls.filter(c => c.outcome === "Connected to DM").length} connected this page
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Filters row */}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#64748b]" />
            <Input
              placeholder="Search by company name..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
            />
            {search && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Select value={outcomeFilter} onValueChange={(v) => { setOutcomeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[190px] h-9 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
              <SelectValue placeholder="All outcomes" />
            </SelectTrigger>
            <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
              <SelectItem value="all" className="dark:text-white dark:focus:bg-[#2d3142]">All outcomes</SelectItem>
              {OUTCOMES.map((o) => (
                <SelectItem key={o.value} value={o.value} className="dark:text-white dark:focus:bg-[#2d3142]">
                  {o.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 text-[#0091AE] hover:text-[#06b6d4] hover:bg-[#0091AE]/10"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full dark:bg-[#3d4254]" />
            ))}
          </div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#3d4254] flex items-center justify-center mb-4">
              <Phone className="h-8 w-8 text-gray-400 dark:text-[#64748b]" />
            </div>
            <h3 className="text-lg font-semibold dark:text-white mb-1">
              {hasActiveFilters ? "No calls match your filters" : "No calls logged yet"}
            </h3>
            <p className="text-sm text-muted-foreground dark:text-[#94a3b8] mb-4 text-center max-w-sm">
              {hasActiveFilters
                ? "Try adjusting your search or outcome filter."
                : "Calls logged against companies will appear here."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}
                className="dark:border-[#3d4254] dark:text-[#94a3b8] dark:hover:bg-[#2d3142]">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#252936]">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-[#2d3142] hover:bg-gray-50 dark:hover:bg-[#2d3142]">
                  <TableHead className="w-[180px] dark:text-[#94a3b8] font-semibold">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Date / Time
                    </div>
                  </TableHead>
                  <TableHead className="dark:text-[#94a3b8] font-semibold">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      Company
                    </div>
                  </TableHead>
                  <TableHead className="w-[160px] dark:text-[#94a3b8] font-semibold">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      Contact
                    </div>
                  </TableHead>
                  <TableHead className="w-[210px] dark:text-[#94a3b8] font-semibold">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      Outcome
                    </div>
                  </TableHead>
                  <TableHead className="dark:text-[#94a3b8] font-semibold">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Notes
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call, index) => (
                  <TableRow
                    key={call.id}
                    className={`border-b dark:border-[#3d4254] transition-colors ${
                      index % 2 === 0
                        ? "bg-white dark:bg-[#252936]"
                        : "bg-gray-50/60 dark:bg-[#1a1d29]"
                    } hover:bg-blue-50/40 dark:hover:bg-[#2d3142]`}
                  >
                    {/* Date/Time */}
                    <TableCell className="py-3 dark:border-[#3d4254]">
                      <div className="text-sm font-medium dark:text-white">
                        {formatCallDate(call.createdAt)}
                      </div>
                      <div className="text-xs text-muted-foreground dark:text-[#64748b] mt-0.5">
                        {formatDistanceToNow(new Date(call.createdAt), { addSuffix: true })}
                      </div>
                    </TableCell>

                    {/* Company */}
                    <TableCell className="py-3 dark:border-[#3d4254]">
                      {call.companyName ? (
                        <Link href={`/company/${call.companyId}`}>
                          <div className="flex items-center gap-2 min-w-0 group">
                            <div className="w-7 h-7 rounded-md bg-[#0091AE]/15 flex items-center justify-center flex-shrink-0">
                              <Building2 className="h-3.5 w-3.5 text-[#0091AE]" />
                            </div>
                            <span className="text-sm font-semibold text-[#0091AE] group-hover:underline truncate min-w-0">
                              {call.companyName}
                            </span>
                          </div>
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground dark:text-[#64748b]">—</span>
                      )}
                    </TableCell>

                    {/* Contact */}
                    <TableCell className="py-3 dark:border-[#3d4254]">
                      {call.contactName ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User className="h-3.5 w-3.5 text-muted-foreground dark:text-[#64748b] flex-shrink-0" />
                          <span className="text-sm dark:text-[#94a3b8] truncate">{call.contactName}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground dark:text-[#64748b]">—</span>
                      )}
                    </TableCell>

                    {/* Outcome */}
                    <TableCell className="py-3 dark:border-[#3d4254]">
                      {getOutcomeBadge(call.outcome)}
                    </TableCell>

                    {/* Notes */}
                    <TableCell className="py-3 dark:border-[#3d4254] max-w-xs">
                      {call.note ? (
                        <p className="text-sm text-gray-600 dark:text-[#94a3b8] line-clamp-2 leading-snug">
                          {call.note}
                        </p>
                      ) : (
                        <span className="text-sm text-muted-foreground dark:text-[#64748b]">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="bg-white dark:bg-[#252936] border-t border-gray-200 dark:border-[#3d4254] px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-[#94a3b8]">
            <Select
              value={String(pageSize)}
              onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}
            >
              <SelectTrigger className="w-[110px] h-8 text-xs dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                {PAGE_SIZE_OPTIONS.map(n => (
                  <SelectItem key={n} value={String(n)} className="dark:text-white dark:focus:bg-[#2d3142]">
                    {n} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="dark:text-[#64748b]">
              {total === 0 ? "0" : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)}`} of {total.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-8 px-3 dark:border-[#3d4254] dark:bg-[#252936] dark:text-white dark:hover:bg-[#2d3142] disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>

            {/* Page number buttons */}
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) pageNum = i;
              else if (page < 4) pageNum = i;
              else if (page >= totalPages - 4) pageNum = totalPages - 7 + i;
              else pageNum = page - 3 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`min-w-[32px] h-8 px-2 text-sm font-medium rounded-md transition-colors mx-0.5 ${
                    page === pageNum
                      ? "bg-[#0091AE] text-white shadow-sm"
                      : "text-gray-700 dark:text-[#94a3b8] hover:bg-gray-100 dark:hover:bg-[#2d3142]"
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="h-8 px-3 dark:border-[#3d4254] dark:bg-[#252936] dark:text-white dark:hover:bg-[#2d3142] disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
