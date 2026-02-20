import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  RefreshCw,
  Newspaper,
  ExternalLink,
  Clock,
  AlertCircle,
  Rss,
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
  category: Exclude<NewsCategory, "All">;
}

interface IntelResponse {
  news: NewsItem[];
  fetchedAt: string;
  cached: boolean;
  stale?: boolean;
  feedErrors?: number;
}

const TABS: NewsCategory[] = ["All", "MAT & Trust Updates", "Hardware", "Policy & Funding", "Procurement"];

const CATEGORY_STYLES: Record<Exclude<NewsCategory, "All">, { badge: string; dot: string }> = {
  "MAT & Trust Updates": {
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-700",
    dot: "bg-purple-500",
  },
  "Hardware": {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-700",
    dot: "bg-blue-500",
  },
  "Policy & Funding": {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700",
    dot: "bg-amber-500",
  },
  "Procurement": {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
    dot: "bg-emerald-500",
  },
};

const SOURCE_COLOURS: Record<string, string> = {
  "Schools Week": "text-blue-600 dark:text-blue-400",
  "TES": "text-rose-600 dark:text-rose-400",
  "Education Business UK": "text-teal-600 dark:text-teal-400",
  "GOV.UK": "text-purple-600 dark:text-purple-400",
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatFetchTime(iso: string) {
  try {
    const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.round(diffMin / 60);
    return `${diffH}h ago`;
  } catch {
    return "";
  }
}

function NewsCard({ item }: { item: NewsItem }) {
  const style = CATEGORY_STYLES[item.category];
  const sourceColour = SOURCE_COLOURS[item.source] ?? "text-[#0091AE]";

  return (
    <article className="bg-white dark:bg-[#252936] rounded-xl border border-gray-200 dark:border-[#3d4254] p-5 flex flex-col gap-3 hover:border-[#0091AE]/40 dark:hover:border-[#0091AE]/40 transition-colors">
      {/* Category + source row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold", sourceColour)}>{item.source}</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-[#64748b]">
            <Clock className="h-3 w-3" />
            {formatDate(item.date)}
          </span>
        </div>
        <Badge
          variant="outline"
          className={cn("text-[11px] font-medium border", style.badge)}
        >
          {item.category}
        </Badge>
      </div>

      {/* Headline */}
      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-1.5"
      >
        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white group-hover:text-[#0091AE] dark:group-hover:text-[#0091AE] leading-snug transition-colors flex-1">
          {item.headline}
        </h3>
        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-gray-400 dark:text-[#64748b] opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>

      {/* Summary */}
      {item.summary && (
        <p className="text-sm text-gray-600 dark:text-[#94a3b8] leading-relaxed line-clamp-3">
          {item.summary}
        </p>
      )}
    </article>
  );
}

function NewsCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#252936] rounded-xl border border-gray-200 dark:border-[#3d4254] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-5 w-28" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
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
    staleTime: 28 * 60 * 1000, // treat as fresh for 28 min (server caches for 30)
    retry: 1,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/intel/news?refresh=true");
      if (res.ok) {
        queryClient.setQueryData(["/api/intel/news"], await res.json());
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const filtered =
    !data?.news ? [] : activeTab === "All" ? data.news : data.news.filter((i) => i.category === activeTab);

  const tabCounts = data?.news
    ? TABS.reduce((acc, tab) => {
        acc[tab] = tab === "All" ? data.news.length : data.news.filter((i) => i.category === tab).length;
        return acc;
      }, {} as Record<NewsCategory, number>)
    : null;

  const isBusy = isLoading || isRefreshing;

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="bg-white dark:bg-[#1e2130] border-b border-gray-200 dark:border-[#3d4254] px-6 py-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0091AE]/10 flex items-center justify-center">
                <Newspaper className="h-[18px] w-[18px] text-[#0091AE]" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Intel</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-[#64748b] mt-1 ml-0.5">
              UK education IT news — MATs, hardware, policy &amp; procurement, live from RSS
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {data && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-[#64748b]">
                <Rss className="h-3 w-3" />
                {data.stale ? (
                  <span className="flex items-center gap-1 text-amber-500">
                    <AlertCircle className="h-3 w-3" /> Stale cache
                  </span>
                ) : (
                  <>{data.cached ? "Cached" : "Fetched"} {formatFetchTime(data.fetchedAt)}</>
                )}
                {typeof data.feedErrors === "number" && data.feedErrors > 0 && (
                  <span className="text-amber-500 ml-1">· {data.feedErrors} feed{data.feedErrors > 1 ? "s" : ""} failed</span>
                )}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isBusy}
              className="flex items-center gap-1.5 dark:border-[#3d4254] dark:text-[#94a3b8] dark:hover:bg-[#2d3142]"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isBusy && "animate-spin")} />
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
              {tab !== "All" && tabCounts && tabCounts[tab] > 0 && (
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    activeTab === tab ? "bg-white/60" : CATEGORY_STYLES[tab as Exclude<NewsCategory, "All">].dot
                  )}
                />
              )}
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
            <p className="font-semibold text-gray-900 dark:text-white">Could not load news feeds</p>
            <p className="text-sm text-gray-500 dark:text-[#64748b] max-w-xs">{(error as Error).message}</p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
              Try again
            </Button>
          </div>
        ) : isBusy ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <NewsCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#2d3142] flex items-center justify-center">
              <Rss className="h-6 w-6 text-gray-400 dark:text-[#64748b]" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-white">No articles in this category</p>
            <p className="text-sm text-gray-500 dark:text-[#64748b]">
              Try a different filter or hit Refresh to re-fetch the feeds.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filtered.map((item, i) => (
              <NewsCard key={`${item.sourceUrl}-${i}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
