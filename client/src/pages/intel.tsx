import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  RefreshCw,
  Newspaper,
  ExternalLink,
  TrendingUp,
  Clock,
  AlertCircle,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type NewsCategory = "All" | "MAT & Trust Updates" | "Hardware" | "Policy & Funding" | "Procurement";

interface NewsItem {
  headline: string;
  source: string;
  sourceUrl: string;
  date: string;
  summary: string;
  salesSignal: string;
  signalStrength: 1 | 2 | 3;
  category: Exclude<NewsCategory, "All">;
}

interface IntelResponse {
  news: NewsItem[];
  fetchedAt: string;
  cached: boolean;
  stale?: boolean;
}

const TABS: NewsCategory[] = ["All", "MAT & Trust Updates", "Hardware", "Policy & Funding", "Procurement"];

const CATEGORY_COLOURS: Record<Exclude<NewsCategory, "All">, string> = {
  "MAT & Trust Updates": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  "Hardware": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  "Policy & Funding": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  "Procurement": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
};

const SIGNAL_LABELS: Record<1 | 2 | 3, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
};

const SIGNAL_COLOURS: Record<1 | 2 | 3, string> = {
  1: "text-gray-400",
  2: "text-amber-500",
  3: "text-emerald-500",
};

function SignalBars({ strength }: { strength: 1 | 2 | 3 }) {
  return (
    <div className="flex items-end gap-0.5" title={`Signal: ${SIGNAL_LABELS[strength]}`}>
      {([1, 2, 3] as const).map((bar) => (
        <div
          key={bar}
          className={cn(
            "w-1.5 rounded-sm transition-colors",
            bar <= strength ? SIGNAL_COLOURS[strength] + " opacity-100" : "bg-gray-200 dark:bg-gray-700 opacity-60",
            bar === 1 ? "h-2" : bar === 2 ? "h-3" : "h-4"
          )}
          style={{ backgroundColor: bar <= strength ? undefined : undefined }}
        />
      ))}
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const formattedDate = (() => {
    try {
      return new Date(item.date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return item.date;
    }
  })();

  return (
    <div className="bg-white dark:bg-[#252936] rounded-xl border border-gray-200 dark:border-[#3d4254] p-5 flex flex-col gap-3 hover:border-[#0091AE]/40 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[15px] font-semibold text-gray-900 dark:text-white hover:text-[#0091AE] dark:hover:text-[#0091AE] leading-snug flex items-start gap-1.5 group"
          >
            <span className="flex-1">{item.headline}</span>
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#0091AE]" />
          </a>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs font-medium text-[#0091AE]">{item.source}</span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-[#64748b]">
              <Clock className="h-3 w-3" />
              {formattedDate}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <Badge
            variant="outline"
            className={cn("text-[11px] font-medium border whitespace-nowrap", CATEGORY_COLOURS[item.category])}
          >
            {item.category}
          </Badge>
          <div className="flex items-center gap-1.5">
            <SignalBars strength={item.signalStrength} />
            <span className={cn("text-[11px] font-medium", SIGNAL_COLOURS[item.signalStrength])}>
              {SIGNAL_LABELS[item.signalStrength]}
            </span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-600 dark:text-[#94a3b8] leading-relaxed">{item.summary}</p>

      {/* Sales Signal box */}
      <div className="rounded-lg bg-[#0091AE]/8 dark:bg-[#0091AE]/10 border border-[#0091AE]/20 dark:border-[#0091AE]/25 p-3 flex items-start gap-2.5">
        <TrendingUp className="h-4 w-4 text-[#0091AE] flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0091AE] block mb-0.5">
            Sales Signal
          </span>
          <p className="text-sm text-gray-700 dark:text-[#cbd5e1] leading-relaxed">{item.salesSignal}</p>
        </div>
      </div>
    </div>
  );
}

function NewsCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#252936] rounded-xl border border-gray-200 dark:border-[#3d4254] p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}

function formatFetchTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.round((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export default function IntelPage() {
  const [activeTab, setActiveTab] = useState<NewsCategory>("All");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, error } = useQuery<IntelResponse>({
    queryKey: ["/api/intel/news"],
    queryFn: async () => {
      const res = await fetch("/api/intel/news");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch news");
      }
      return res.json();
    },
    staleTime: 55 * 60 * 1000, // treat as fresh for 55 min (server caches for 60)
    retry: 1,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/intel/news?refresh=true");
      if (res.ok) {
        const fresh = await res.json();
        queryClient.setQueryData(["/api/intel/news"], fresh);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const filtered =
    !data?.news
      ? []
      : activeTab === "All"
      ? data.news
      : data.news.filter((item) => item.category === activeTab);

  const tabCounts =
    data?.news
      ? TABS.reduce((acc, tab) => {
          acc[tab] = tab === "All" ? data.news.length : data.news.filter((i) => i.category === tab).length;
          return acc;
        }, {} as Record<NewsCategory, number>)
      : null;

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="bg-white dark:bg-[#1e2130] border-b border-gray-200 dark:border-[#3d4254] px-6 py-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0091AE]/10 flex items-center justify-center">
                <Newspaper className="h-4.5 w-4.5 text-[#0091AE]" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Intel</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-[#64748b] mt-1 ml-0.5">
              UK education IT market intelligence — MAT news, hardware trends, policy &amp; procurement signals
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {data?.fetchedAt && (
              <span className="text-xs text-gray-400 dark:text-[#64748b] flex items-center gap-1">
                {data.stale && <AlertCircle className="h-3 w-3 text-amber-500" />}
                {data.cached ? "Cached" : "Fetched"} {formatFetchTime(data.fetchedAt)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="flex items-center gap-1.5 dark:border-[#3d4254] dark:text-[#94a3b8] dark:hover:bg-[#2d3142]"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", (isLoading || isRefreshing) && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-4 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                activeTab === tab
                  ? "bg-[#0091AE] text-white"
                  : "text-gray-600 dark:text-[#94a3b8] hover:bg-gray-100 dark:hover:bg-[#2d3142] hover:text-gray-900 dark:hover:text-white"
              )}
            >
              {tab}
              {tabCounts && tabCounts[tab] > 0 && (
                <span
                  className={cn(
                    "text-[11px] rounded-full px-1.5 py-0.5 leading-none font-semibold",
                    activeTab === tab
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 dark:bg-[#3d4254] text-gray-500 dark:text-[#94a3b8]"
                  )}
                >
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <p className="font-medium text-gray-900 dark:text-white">Failed to load news</p>
            <p className="text-sm text-gray-500 dark:text-[#64748b] max-w-xs">
              {(error as Error).message === "ANTHROPIC_API_KEY not configured"
                ? "Set the ANTHROPIC_API_KEY environment variable to enable Intel."
                : (error as Error).message}
            </p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
              Try again
            </Button>
          </div>
        ) : isLoading || isRefreshing ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <NewsCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#2d3142] flex items-center justify-center">
              <Wifi className="h-6 w-6 text-gray-400 dark:text-[#64748b]" />
            </div>
            <p className="font-medium text-gray-900 dark:text-white">No stories in this category</p>
            <p className="text-sm text-gray-500 dark:text-[#64748b]">Try a different filter or refresh to fetch updated news.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filtered.map((item, i) => (
              <NewsCard key={`${item.headline}-${i}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
