import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone,
  SkipForward,
  ExternalLink,
  ListTodo,
  CheckCircle2,
  MapPin,
  Globe,
  Building2,
  Clock,
  ChevronRight,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  Filter,
  MessageSquare,
  User,
  CheckSquare,
  Mail,
} from "lucide-react";
import QuickTaskModal from "@/components/QuickTaskModal";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import type { Company, PipelineStage, Trust, Activity, CompanyWithRelations } from "@shared/schema";

type QueueItem = {
  company: Company & { stage?: PipelineStage; trust?: Trust };
  priority: number;
  reason: string;
  lastCallActivity?: Activity | null;
};

const LEAD_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  "0-unqualified": { label: "Unqualified", color: "bg-gray-500" },
  "1-qualified": { label: "Qualified", color: "bg-blue-500" },
  "2-intent": { label: "Intent", color: "bg-purple-500" },
  "3-quote-presented": { label: "Quote Presented", color: "bg-amber-500" },
  "3b-quoted-lost": { label: "Quoted Lost", color: "bg-red-500" },
  "4-account-active": { label: "Account Active", color: "bg-green-500" },
};

const CALL_OUTCOMES = [
  { value: "Reception / Voicemail", label: "Reception / Voicemail" },
  { value: "Decision Maker Details", label: "Decision Maker Details" },
  { value: "Connected to DM", label: "Connected to DM" },
];

const FILTER_TABS = [
  { value: "all", label: "All with Phone #" },
  { value: "contacted", label: "Previously Contacted" },
  { value: "needs_followup", label: "Needs Follow-Up" },
  { value: "uncontacted", label: "Never Contacted" },
] as const;

const FILTER_DESCRIPTIONS: Record<string, string> = {
  all: "Showing all schools with valid phone numbers (trusts excluded)",
  contacted: "Showing only schools you've contacted before with valid phone numbers",
  uncontacted: "Showing schools with phone numbers that have never been contacted",
  needs_followup: "Showing schools not contacted in the last 7 days",
};

export default function CallQueue() {
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [callNote, setCallNote] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [showTaskModal, setShowTaskModal] = useState(false);

  const { data: queue, isLoading } = useQuery<QueueItem[]>({
    queryKey: ["/api/call-queue", filter],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/call-queue?filter=${filter}`);
      return res.json();
    },
  });

  const logCallMutation = useMutation({
    mutationFn: async ({ companyId, note, outcome }: { companyId: string; note: string; outcome: string }) => {
      const res = await apiRequest("POST", `/api/companies/${companyId}/activities`, {
        type: "call",
        note,
        outcome,
      });
      return res.json() as Promise<Activity>;
    },
    onSuccess: (newActivity, { companyId }) => {
      // Write the new activity directly into the company's cached data so the
      // school detail page shows it immediately without waiting for a refetch.
      queryClient.setQueryData<CompanyWithRelations>(
        ["/api/companies", companyId],
        (old) => old ? { ...old, activities: [newActivity, ...old.activities] } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/call-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Call logged", description: "Activity recorded successfully" });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async (companyId: string) => {
      return apiRequest("POST", `/api/call-queue/skip/${companyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-queue"] });
    },
  });

  // Filter out completed/skipped items
  const activeQueue = queue?.filter(
    (item) => !completedIds.has(item.company.id) && !skippedIds.has(item.company.id)
  ) || [];

  const totalItems = queue?.length || 0;
  const processed = completedIds.size + skippedIds.size;
  const progressPercent = totalItems > 0 ? (processed / totalItems) * 100 : 0;

  const currentItem = activeQueue[0];

  const handleLogCall = () => {
    if (!currentItem) return;
    setLogCallOpen(true);
    setCallNote("");
    setCallOutcome("");
  };

  const handleSubmitCall = () => {
    if (!currentItem || !callOutcome) return;
    logCallMutation.mutate(
      { companyId: currentItem.company.id, note: callNote, outcome: callOutcome },
      {
        onSuccess: () => {
          setCompletedIds((prev) => new Set(prev).add(currentItem.company.id));
          setLogCallOpen(false);
        },
      }
    );
  };

  const handleSkip = () => {
    if (!currentItem) return;
    // Immediately hide in UI for a snappy feel
    setSkippedIds((prev) => new Set(prev).add(currentItem.company.id));
    // Persist to DB — updates lastContactDate so the company drops off the
    // queue on every future page load until the contact threshold passes again
    skipMutation.mutate(currentItem.company.id);
  };

  const handleReset = () => {
    setCompletedIds(new Set());
    setSkippedIds(new Set());
    setCurrentIndex(0);
    queryClient.invalidateQueries({ queryKey: ["/api/call-queue"] });
  };

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setCompletedIds(new Set());
    setSkippedIds(new Set());
    setCurrentIndex(0);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64 dark:bg-[#3d4254]" />
        <Skeleton className="h-4 w-96 dark:bg-[#3d4254]" />
        <Skeleton className="h-64 w-full dark:bg-[#3d4254]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-[#1a1d29] min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Call Queue</h1>
          <p className="text-muted-foreground dark:text-[#94a3b8]">
            {activeQueue.length} schools to call &middot; {completedIds.size} called &middot; {skippedIds.size} skipped
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} className="dark:border-[#3d4254] dark:text-[#94a3b8]">
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset Queue
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-[#252936] p-1 rounded-lg inline-flex flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleFilterChange(tab.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-white dark:bg-[#0091AE] text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-[#94a3b8] hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg text-sm">
        <Filter className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-blue-700 dark:text-blue-300">{FILTER_DESCRIPTIONS[filter]}</p>
      </div>

      {/* Progress Bar */}
      <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium dark:text-white">Today's Progress</span>
            <span className="text-sm text-muted-foreground dark:text-[#94a3b8]">
              {processed} / {totalItems}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground dark:text-[#64748b]">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" /> {completedIds.size} called
            </span>
            <span className="flex items-center gap-1">
              <SkipForward className="h-3 w-3 text-amber-500" /> {skippedIds.size} skipped
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Current School Card */}
      {currentItem ? (
        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-lg bg-[#0091AE]/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-[#0091AE]" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg dark:text-white truncate" title={currentItem.company.name}>{currentItem.company.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      className={`text-[10px] text-white ${LEAD_STATUS_LABELS[currentItem.company.budgetStatus || "0-unqualified"]?.color || "bg-gray-500"}`}
                    >
                      {LEAD_STATUS_LABELS[currentItem.company.budgetStatus || "0-unqualified"]?.label || "Unknown"}
                    </Badge>
                    <span className="text-xs text-amber-500 font-medium">{currentItem.reason}</span>
                  </div>
                </div>
              </div>
              <Link href={`/company/${currentItem.company.id}`}>
                <Button variant="ghost" size="sm" className="dark:text-[#94a3b8] dark:hover:text-white">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {/* Click-to-Call — main phone */}
            {currentItem.company.phone && (
              <div className="mb-4 p-3 rounded-lg bg-[#0091AE]/10 border border-[#0091AE]/30 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#0091AE] mb-0.5">Main Phone</p>
                  <p className="text-base font-bold dark:text-white">
                    {currentItem.company.phone}
                    {currentItem.company.ext && (
                      <span className="text-sm font-normal dark:text-[#94a3b8] ml-1">ext. {currentItem.company.ext}</span>
                    )}
                  </p>
                </div>
                <a
                  href={`tel:${currentItem.company.phone}`}
                  className="px-4 py-2 bg-[#0091AE] hover:bg-[#007a94] text-white rounded-lg font-medium flex items-center gap-2 transition-colors text-sm flex-shrink-0"
                >
                  <Phone className="h-4 w-4" />
                  Call Now
                </a>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Phone (compact repeat for the grid) */}
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground dark:text-[#64748b]" />
                <span className="dark:text-white font-medium">
                  {currentItem.company.phone || "No phone"}
                </span>
                {currentItem.company.ext && (
                  <span className="text-muted-foreground dark:text-[#64748b]">ext. {currentItem.company.ext}</span>
                )}
              </div>
              {/* Location */}
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground dark:text-[#64748b]" />
                <span className="dark:text-[#94a3b8]">{currentItem.company.location || "No location"}</span>
              </div>
              {/* Website */}
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground dark:text-[#64748b]" />
                {currentItem.company.website ? (
                  <a
                    href={currentItem.company.website.startsWith("http") ? currentItem.company.website : `https://${currentItem.company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0091AE] hover:underline truncate"
                  >
                    {currentItem.company.website}
                  </a>
                ) : (
                  <span className="dark:text-[#64748b]">No website</span>
                )}
              </div>
            </div>

            {/* Key contacts + meta row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
              {/* IT Manager — highlighted */}
              {currentItem.company.itManagerName ? (
                <div className="md:col-span-2 flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <User className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-green-400 mb-0.5">IT Manager</p>
                    <p className="dark:text-white font-medium">{currentItem.company.itManagerName}</p>
                    {currentItem.company.itManagerEmail && (
                      <a
                        href={`mailto:${currentItem.company.itManagerEmail}`}
                        className="text-[#0091AE] hover:underline text-xs truncate block"
                      >
                        {currentItem.company.itManagerEmail}
                      </a>
                    )}
                  </div>
                </div>
              ) : currentItem.company.decisionMakerName ? (
                <div className="md:col-span-2 flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <User className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-400 mb-0.5">Decision Maker</p>
                    <p className="dark:text-white font-medium">{currentItem.company.decisionMakerName}</p>
                  </div>
                </div>
              ) : null}
              {/* Last contact / quote meta */}
              <div className="flex flex-col gap-1 text-xs text-muted-foreground dark:text-[#64748b]">
                {currentItem.company.lastContactDate && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(currentItem.company.lastContactDate), { addSuffix: true })}
                  </span>
                )}
                {currentItem.company.lastQuoteValue && (
                  <span>Last quote: <span className="dark:text-white font-medium">£{Number(currentItem.company.lastQuoteValue).toLocaleString()}</span></span>
                )}
                {currentItem.company.notes && (
                  <span className="italic line-clamp-2 dark:text-[#94a3b8]">{currentItem.company.notes}</span>
                )}
              </div>
            </div>

            {/* Last call notes */}
            {currentItem.lastCallActivity ? (
              <div className="mb-4 p-4 rounded-lg border-l-4 border-[#0091AE] bg-gray-50 dark:bg-[#1a1d29]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-[#0091AE]" />
                    <span className="text-sm font-medium dark:text-white">Last Call</span>
                  </div>
                  <span className="text-xs text-muted-foreground dark:text-[#64748b]">
                    {format(new Date(currentItem.lastCallActivity.createdAt), "d MMM yyyy")}
                  </span>
                </div>
                {currentItem.lastCallActivity.outcome && (
                  <Badge variant="secondary" className="mb-2 dark:bg-[#3d4254] dark:text-[#94a3b8] text-xs">
                    {currentItem.lastCallActivity.outcome}
                  </Badge>
                )}
                {currentItem.lastCallActivity.note && (
                  <p className="text-sm dark:text-[#94a3b8] line-clamp-3">{currentItem.lastCallActivity.note}</p>
                )}
              </div>
            ) : !currentItem.company.lastContactDate && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600 dark:text-amber-400">
                First contact with this school — no previous call history
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-[#3d4254]">
              <Button onClick={handleLogCall} className="bg-[#0091AE] hover:bg-[#007a94]">
                <PhoneCall className="h-4 w-4 mr-2" />
                Log Call
              </Button>
              <Button
                onClick={() => setShowTaskModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Create Task
              </Button>
              {currentItem.company.itManagerEmail && (
                <Button
                  variant="outline"
                  asChild
                  className="dark:border-[#3d4254] dark:text-[#94a3b8]"
                >
                  <a href={`mailto:${currentItem.company.itManagerEmail}?subject=IT Equipment Quote`}>
                    <Mail className="h-4 w-4 mr-2" />
                    Email IT Manager
                  </a>
                </Button>
              )}
              <Button variant="outline" onClick={handleSkip} className="dark:border-[#3d4254] dark:text-[#94a3b8]">
                <SkipForward className="h-4 w-4 mr-2" />
                Skip
              </Button>
              <Link href={`/company/${currentItem.company.id}`}>
                <Button variant="outline" className="dark:border-[#3d4254] dark:text-[#94a3b8]">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open School
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold dark:text-white mb-2">
              {totalItems === 0 ? "No Schools in Queue" : "Queue Complete!"}
            </h3>
            <p className="text-muted-foreground dark:text-[#94a3b8]">
              {totalItems === 0
                ? FILTER_DESCRIPTIONS[filter]
                : `You've worked through all ${totalItems} schools. ${completedIds.size} calls logged, ${skippedIds.size} skipped.`}
            </p>
            <Button onClick={handleReset} variant="outline" className="mt-4 dark:border-[#3d4254]">
              <RefreshCw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Queue List */}
      {activeQueue.length > 1 && (
        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-[#94a3b8]">
              Up Next ({activeQueue.length - 1} remaining)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {activeQueue.slice(1, 11).map((item, idx) => (
                <div
                  key={item.company.id}
                  className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-[#2d3142] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs text-muted-foreground dark:text-[#64748b] w-5 text-right flex-shrink-0">{idx + 2}</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium dark:text-white truncate block">{item.company.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.company.itManagerName && (
                          <span className="text-[10px] text-green-500 truncate">{item.company.itManagerName}</span>
                        )}
                        {item.lastCallActivity && (
                          <span className="text-[10px] text-muted-foreground dark:text-[#64748b]">
                            {format(new Date(item.lastCallActivity.createdAt), "d MMM")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-[#64748b] flex-shrink-0">
                    {item.company.location && <span>{item.company.location}</span>}
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              ))}
              {activeQueue.length > 11 && (
                <p className="text-xs text-muted-foreground dark:text-[#64748b] text-center pt-2">
                  + {activeQueue.length - 11} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Task Modal */}
      {showTaskModal && currentItem && (
        <QuickTaskModal
          company={currentItem.company}
          onClose={() => setShowTaskModal(false)}
        />
      )}

      {/* Log Call Dialog */}
      <Dialog open={logCallOpen} onOpenChange={setLogCallOpen}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <DialogHeader>
            <DialogTitle className="dark:text-white">
              Log Call - {currentItem?.company.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Outcome *</label>
              <Select value={callOutcome} onValueChange={setCallOutcome}>
                <SelectTrigger className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                  <SelectValue placeholder="Select outcome..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                  {CALL_OUTCOMES.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="dark:text-white dark:focus:bg-[#3d4254]">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Notes</label>
              <Textarea
                value={callNote}
                onChange={(e) => setCallNote(e.target.value)}
                placeholder="What happened on the call..."
                className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogCallOpen(false)} className="dark:border-[#3d4254] dark:text-[#94a3b8]">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitCall}
              disabled={!callOutcome || logCallMutation.isPending}
              className="bg-[#0091AE] hover:bg-[#007a94]"
            >
              {logCallMutation.isPending ? "Logging..." : "Log Call"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
