import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Phone,
  SkipForward,
  ExternalLink,
  CheckCircle2,
  MapPin,
  Globe,
  Building2,
  Clock,
  PhoneCall,
  RefreshCw,
  Filter,
  MessageSquare,
  User,
  CheckSquare,
  Mail,
  Plus,
  Trash2,
  Save,
  X,
  DollarSign,
  StickyNote,
  Video,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Tag,
  ChevronRight,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import QuickTaskModal from "@/components/QuickTaskModal";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import type {
  Company,
  PipelineStage,
  Trust,
  Activity,
  CompanyWithRelations,
  Contact,
  Task,
  DealWithStage,
} from "@shared/schema";
import { formatPhone } from "@/lib/utils";

type QueueItem = {
  company: Company & { stage?: PipelineStage; trust?: Trust };
  priority: number;
  reason: string;
  lastCallActivity?: Activity | null;
  totalCalls: number;
  hasDmContact: boolean;
  lastDmContact: string | null;
  daysSinceLastCall: number;
  daysSinceDmContact: number | null;
};

const LEAD_STATUS_OPTIONS = [
  { value: "0-unqualified", label: "0 - Unqualified", badgeColor: "bg-gray-500" },
  { value: "1-qualified", label: "1 - Qualified", badgeColor: "bg-blue-500" },
  { value: "2-intent", label: "2 - Intent", badgeColor: "bg-purple-500" },
  { value: "3-quote-presented", label: "3 - Quote Presented", badgeColor: "bg-amber-500" },
  { value: "3b-quoted-lost", label: "3b - Quoted Lost", badgeColor: "bg-red-500" },
  { value: "4-account-active", label: "4 - Account Active", badgeColor: "bg-green-500" },
  { value: "5-outsourced", label: "5 - Outsourced", badgeColor: "bg-cyan-500" },
  { value: "6-time-waste", label: "6 - Time Waste", badgeColor: "bg-rose-500" },
];

const CALL_OUTCOME_GROUPS = [
  {
    label: "Decision Maker Contact",
    outcomes: [
      { value: "Connected to DM - Interested", label: "Connected to DM - Interested" },
      { value: "Connected to DM - Needs Follow-up", label: "Connected to DM - Needs Follow-up" },
      { value: "Decision Maker Details", label: "Decision Maker Details" },
      { value: "Meeting Scheduled with DM", label: "Meeting Scheduled with DM" },
    ],
  },
  {
    label: "General Outcomes",
    outcomes: [
      { value: "Connected - Interested", label: "Connected - Interested" },
      { value: "Connected - Not Interested", label: "Connected - Not Interested" },
      { value: "Connected - Callback Requested", label: "Connected - Callback Requested" },
      { value: "Reception / Voicemail", label: "Reception / Voicemail" },
      { value: "Voicemail Left", label: "Voicemail Left" },
      { value: "No Answer", label: "No Answer" },
      { value: "Gatekeeper", label: "Gatekeeper" },
    ],
  },
];

const FILTER_TABS = [
  { value: "hot_leads", label: "Hot Leads" },
  { value: "high_priority", label: "Urgent" },
  { value: "needs_followup", label: "Follow-Up" },
  { value: "contacted", label: "Contacted" },
  { value: "uncontacted", label: "New" },
] as const;

function getLeadStatusBadge(status: string | null | undefined) {
  const opt = LEAD_STATUS_OPTIONS.find((o) => o.value === status);
  return (
    <Badge className={`${opt?.badgeColor ?? "bg-gray-500"} hover:${opt?.badgeColor ?? "bg-gray-500"} text-white text-[11px] px-2 py-0.5`}>
      {opt?.label ?? "Unqualified"}
    </Badge>
  );
}

function getActivityIcon(type: string) {
  switch (type) {
    case "call": return <Phone className="h-3.5 w-3.5" />;
    case "email": return <Mail className="h-3.5 w-3.5" />;
    case "quote": return <FileText className="h-3.5 w-3.5" />;
    case "follow_up": return <StickyNote className="h-3.5 w-3.5" />;
    case "meeting": return <Video className="h-3.5 w-3.5" />;
    case "deal_won": return <ThumbsUp className="h-3.5 w-3.5" />;
    case "deal_lost": return <ThumbsDown className="h-3.5 w-3.5" />;
    default: return <MessageSquare className="h-3.5 w-3.5" />;
  }
}

function getActivityBubbleColor(type: string) {
  switch (type) {
    case "call": return "bg-blue-500/20 text-blue-400";
    case "email": return "bg-purple-500/20 text-purple-400";
    case "quote": return "bg-amber-500/20 text-amber-400";
    case "follow_up": return "bg-cyan-500/20 text-cyan-400";
    case "meeting": return "bg-green-500/20 text-green-400";
    case "deal_won": return "bg-emerald-500/20 text-emerald-400";
    case "deal_lost": return "bg-red-500/20 text-red-400";
    default: return "bg-gray-500/20 text-gray-400";
  }
}

function getActivityLabel(type: string) {
  switch (type) {
    case "call": return "Call";
    case "email": return "Email";
    case "quote": return "Quote";
    case "follow_up": return "Note";
    case "meeting": return "Meeting";
    case "deal_won": return "Deal Won";
    case "deal_lost": return "Deal Lost";
    default: return type;
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high": return "bg-red-500 text-white";
    case "medium": return "bg-orange-500 text-white";
    default: return "bg-green-500 text-white";
  }
}

export default function CallQueue() {
  const { toast } = useToast();

  // Queue state
  const [filter, setFilter] = useState("all");
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  // Center tab
  const [activeTab, setActiveTab] = useState<"all" | "calls" | "notes">("all");

  // Modal open states
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Log call form
  const [callNote, setCallNote] = useState("");
  const [callOutcome, setCallOutcome] = useState("");

  // Add note form
  const [noteText, setNoteText] = useState("");

  // Add contact form
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactRole, setContactRole] = useState("");

  // Edit contact form (mirrors add)
  const [editContactName, setEditContactName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactRole, setEditContactRole] = useState("");

  // Deal form
  const [dealTitle, setDealTitle] = useState("");
  const [dealStageId, setDealStageId] = useState("");
  const [dealGP, setDealGP] = useState("");
  const [dealNotes, setDealNotes] = useState("");

  // Lead status inline edit
  const [editingLeadStatus, setEditingLeadStatus] = useState(false);
  const [newLeadStatus, setNewLeadStatus] = useState("");

  // Skip confirmation
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: queue, isLoading } = useQuery<QueueItem[]>({
    queryKey: ["/api/call-queue", filter],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/call-queue?filter=${filter}`);
      return res.json();
    },
  });

  const activeQueue = useMemo(
    () =>
      queue?.filter(
        (item) =>
          !completedIds.has(item.company.id) && !skippedIds.has(item.company.id)
      ) ?? [],
    [queue, completedIds, skippedIds]
  );

  const currentItem = activeQueue[0] ?? null;

  const { data: company, isLoading: companyLoading } = useQuery<CompanyWithRelations>({
    queryKey: ["/api/companies", currentItem?.company.id],
    enabled: !!currentItem?.company.id,
  });

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const totalItems = queue?.length ?? 0;
  const processed = completedIds.size + skippedIds.size;
  const progressPercent = totalItems > 0 ? (processed / totalItems) * 100 : 0;

  // ── Mutations ─────────────────────────────────────────────────────────────

  const logCallMutation = useMutation({
    mutationFn: async ({
      companyId,
      note,
      outcome,
    }: {
      companyId: string;
      note: string;
      outcome: string;
    }) => {
      const res = await apiRequest("POST", `/api/companies/${companyId}/activities`, {
        type: "call",
        note,
        outcome,
      });
      return res.json() as Promise<Activity>;
    },
    onSuccess: (newActivity, { companyId }) => {
      queryClient.setQueryData<CompanyWithRelations>(
        ["/api/companies", companyId],
        (old) => (old ? { ...old, activities: [newActivity, ...old.activities] } : old)
      );
      queryClient.invalidateQueries({ queryKey: ["/api/call-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ companyId, note }: { companyId: string; note: string }) => {
      const res = await apiRequest("POST", `/api/companies/${companyId}/activities`, {
        type: "follow_up",
        note,
      });
      return res.json() as Promise<Activity>;
    },
    onSuccess: (newActivity, { companyId }) => {
      queryClient.setQueryData<CompanyWithRelations>(
        ["/api/companies", companyId],
        (old) => (old ? { ...old, activities: [newActivity, ...old.activities] } : old)
      );
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Note added" });
    },
  });

  const addContactMutation = useMutation({
    mutationFn: async ({
      companyId,
      name,
      email,
      phone,
      role,
    }: {
      companyId: string;
      name: string;
      email: string;
      phone: string;
      role: string;
    }) => {
      const res = await apiRequest("POST", `/api/companies/${companyId}/contacts`, {
        companyId,
        name: name || null,
        email,
        phone: phone || null,
        role: role || null,
      });
      return res.json();
    },
    onSuccess: (_data, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      toast({ title: "Contact added" });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({
      contactId,
      name,
      email,
      phone,
      role,
    }: {
      contactId: string;
      name: string;
      email: string;
      phone: string;
      role: string;
    }) => {
      return apiRequest("PATCH", `/api/contacts/${contactId}`, {
        name: name || null,
        email,
        phone: phone || null,
        role: role || null,
      });
    },
    onSuccess: () => {
      if (currentItem) {
        queryClient.invalidateQueries({
          queryKey: ["/api/companies", currentItem.company.id],
        });
      }
      toast({ title: "Contact updated" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) =>
      apiRequest("DELETE", `/api/contacts/${contactId}`),
    onSuccess: () => {
      if (currentItem) {
        queryClient.invalidateQueries({
          queryKey: ["/api/companies", currentItem.company.id],
        });
      }
      toast({ title: "Contact removed" });
    },
  });

  const addDealMutation = useMutation({
    mutationFn: async ({
      companyId,
      title,
      stageId,
      expectedGP,
      notes,
    }: {
      companyId: string;
      title: string;
      stageId: string;
      expectedGP: string;
      notes: string;
    }) => {
      return apiRequest("POST", `/api/companies/${companyId}/deals`, {
        companyId,
        title,
        stageId,
        expectedGP: expectedGP || null,
        notes: notes || null,
      });
    },
    onSuccess: (_data, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({ title: "Deal created" });
    },
  });

  const updateLeadStatusMutation = useMutation({
    mutationFn: async ({ companyId, status }: { companyId: string; status: string }) =>
      apiRequest("PATCH", `/api/companies/${companyId}`, { budgetStatus: status }),
    onSuccess: (_data, { companyId, status }) => {
      queryClient.setQueryData<CompanyWithRelations>(
        ["/api/companies", companyId],
        (old) => (old ? { ...old, budgetStatus: status } : old)
      );
      queryClient.invalidateQueries({ queryKey: ["/api/call-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setEditingLeadStatus(false);
      toast({ title: "Lead status updated" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/tasks/${id}`, { status }),
    onSuccess: () => {
      if (currentItem) {
        queryClient.invalidateQueries({
          queryKey: ["/api/companies", currentItem.company.id],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async (companyId: string) =>
      apiRequest("POST", `/api/call-queue/skip/${companyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-queue"] });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSkip = () => {
    if (!currentItem) return;
    setShowSkipConfirm(true);
  };

  const confirmSkip = () => {
    if (!currentItem) return;
    setSkippedIds((prev) => new Set(prev).add(currentItem.company.id));
    skipMutation.mutate(currentItem.company.id);
    setShowSkipConfirm(false);
    const remaining = activeQueue.length - 1;
    toast({
      title: "School skipped",
      description: remaining > 0 ? `${remaining} school${remaining !== 1 ? "s" : ""} remaining` : "Queue complete!",
    });
  };

  const handleReset = () => {
    setCompletedIds(new Set());
    setSkippedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["/api/call-queue"] });
  };

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setCompletedIds(new Set());
    setSkippedIds(new Set());
  };

  const handleSubmitCall = () => {
    if (!currentItem || !callOutcome) return;
    const companyId = currentItem.company.id;
    logCallMutation.mutate(
      { companyId, note: callNote, outcome: callOutcome },
      {
        onSuccess: () => {
          setCompletedIds((prev) => new Set(prev).add(companyId));
          setLogCallOpen(false);
          setCallNote("");
          setCallOutcome("");
          // Refetch queue so server-side 21-day exclusion applies on next render
          queryClient.invalidateQueries({ queryKey: ["/api/call-queue"] });
          const remaining = activeQueue.length - 1;
          toast({
            title: "Call logged — moving to next school",
            description: remaining > 0 ? `${remaining} school${remaining !== 1 ? "s" : ""} remaining in queue` : "🎉 Queue complete!",
          });
        },
      }
    );
  };

  const handleSubmitNote = () => {
    if (!currentItem || !noteText.trim()) return;
    addNoteMutation.mutate(
      { companyId: currentItem.company.id, note: noteText },
      {
        onSuccess: () => {
          setAddNoteOpen(false);
          setNoteText("");
        },
      }
    );
  };

  const handleSubmitContact = () => {
    if (!currentItem || !contactEmail.trim()) return;
    addContactMutation.mutate(
      {
        companyId: currentItem.company.id,
        name: contactName,
        email: contactEmail,
        phone: contactPhone,
        role: contactRole,
      },
      {
        onSuccess: () => {
          setAddContactOpen(false);
          setContactName("");
          setContactEmail("");
          setContactPhone("");
          setContactRole("");
        },
      }
    );
  };

  const handleSubmitDeal = () => {
    if (!currentItem || !dealTitle.trim() || !dealStageId) return;
    addDealMutation.mutate(
      {
        companyId: currentItem.company.id,
        title: dealTitle,
        stageId: dealStageId,
        expectedGP: dealGP,
        notes: dealNotes,
      },
      {
        onSuccess: () => {
          setAddDealOpen(false);
          setDealTitle("");
          setDealStageId("");
          setDealGP("");
          setDealNotes("");
        },
      }
    );
  };

  const openEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setEditContactName(contact.name ?? "");
    setEditContactEmail(contact.email ?? "");
    setEditContactPhone(contact.phone ?? "");
    setEditContactRole(contact.role ?? "");
  };

  const handleSubmitEditContact = () => {
    if (!editingContact) return;
    updateContactMutation.mutate(
      {
        contactId: editingContact.id,
        name: editContactName,
        email: editContactEmail,
        phone: editContactPhone,
        role: editContactRole,
      },
      { onSuccess: () => setEditingContact(null) }
    );
  };

  const handleSaveLeadStatus = () => {
    if (!currentItem) return;
    updateLeadStatusMutation.mutate({
      companyId: currentItem.company.id,
      status: newLeadStatus,
    });
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const filteredActivities = useMemo(() => {
    if (!company?.activities) return [];
    let list = [...company.activities];
    if (activeTab === "calls") list = list.filter((a) => a.type === "call");
    if (activeTab === "notes") list = list.filter((a) => a.type === "follow_up");
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [company?.activities, activeTab]);

  const activeTasks = useMemo(
    () => company?.tasks?.filter((t) => t.status !== "completed") ?? [],
    [company?.tasks]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full dark:bg-[#1a1d29]">
        <div className="w-80 p-6 border-r dark:border-[#3d4254] space-y-4">
          <Skeleton className="h-6 w-40 dark:bg-[#3d4254]" />
          <Skeleton className="h-20 w-full dark:bg-[#3d4254]" />
          <Skeleton className="h-32 w-full dark:bg-[#3d4254]" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-48 dark:bg-[#3d4254]" />
          <Skeleton className="h-48 w-full dark:bg-[#3d4254]" />
        </div>
        <div className="w-72 p-6 border-l dark:border-[#3d4254] space-y-4">
          <Skeleton className="h-32 w-full dark:bg-[#3d4254]" />
          <Skeleton className="h-32 w-full dark:bg-[#3d4254]" />
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden dark:bg-[#1a1d29]">

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col overflow-y-auto dark:bg-[#252936] border-r dark:border-[#3d4254]">
        <div className="p-4 space-y-4">

          {/* Header row */}
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold dark:text-white">Call Queue</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-7 px-2 dark:text-[#94a3b8] dark:hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
          </div>

          {/* Progress */}
          <div className="dark:bg-[#1a1d29] rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium dark:text-white">Progress</span>
              <span className="text-xs dark:text-[#64748b]">{processed}/{totalItems}</span>
            </div>
            <Progress value={progressPercent} className="h-1.5 mb-2" />
            <div className="flex gap-3 text-[11px] dark:text-[#64748b]">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {completedIds.size} called
              </span>
              <span className="flex items-center gap-1">
                <SkipForward className="h-3 w-3 text-amber-500" />
                {skippedIds.size} skipped
              </span>
              <span>{activeQueue.length} remaining</span>
            </div>
          </div>

          {/* Queue analytics summary */}
          {queue && queue.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              <div className="dark:bg-[#1a1d29] rounded-lg p-2 border border-red-500/20">
                <p className="text-[10px] dark:text-[#64748b]">Hot Leads</p>
                <p className="text-sm font-bold text-red-400">
                  {queue.filter((s) => s.hasDmContact && (s.daysSinceDmContact ?? 0) >= 21).length}
                </p>
                <p className="text-[9px] text-red-400/70">DM + 21d</p>
              </div>
              <div className="dark:bg-[#1a1d29] rounded-lg p-2 border border-orange-500/20">
                <p className="text-[10px] dark:text-[#64748b]">Urgent</p>
                <p className="text-sm font-bold text-orange-400">
                  {queue.filter((s) => s.daysSinceLastCall >= 30).length}
                </p>
                <p className="text-[9px] text-orange-400/70">30+ days</p>
              </div>
              <div className="dark:bg-[#1a1d29] rounded-lg p-2 border border-yellow-500/20">
                <p className="text-[10px] dark:text-[#64748b]">Follow-Up</p>
                <p className="text-sm font-bold text-yellow-400">
                  {queue.filter((s) => s.daysSinceLastCall >= 21 && s.daysSinceLastCall < 30).length}
                </p>
                <p className="text-[9px] text-yellow-400/70">21–29 days</p>
              </div>
              <div className="dark:bg-[#1a1d29] rounded-lg p-2 border border-cyan-500/20">
                <p className="text-[10px] dark:text-[#64748b]">In Queue</p>
                <p className="text-sm font-bold text-cyan-400">{queue.length}</p>
                <p className="text-[9px] text-cyan-400/70">21d+ only</p>
              </div>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-[#1a1d29] p-1 rounded-lg">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleFilterChange(tab.value)}
                className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  filter === tab.value
                    ? tab.value === "hot_leads"
                      ? "bg-red-500 text-white shadow-sm"
                      : tab.value === "high_priority"
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-white dark:bg-[#0091AE] text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-[#94a3b8] hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {tab.value === "hot_leads" ? "🔥 Hot"
                  : tab.value === "high_priority" ? "🚨 Urgent"
                  : tab.label}
              </button>
            ))}
          </div>

          {/* Smart Queue info */}
          <div className="flex items-start gap-2 p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <AlertCircle className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-300/80 leading-relaxed">
              21-day minimum — only schools not contacted in 3+ weeks. 🚨 Urgent = 30d+, 🔥 Hot = DM + 21d.
            </p>
          </div>

          {/* ── Current school ─────────────────────────────────────────── */}
          {currentItem ? (
            <>
              {/* School name + open link */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold dark:text-white leading-tight truncate" title={currentItem.company.name}>
                    {currentItem.company.name}
                  </h2>
                  <p className="text-[11px] text-amber-400 mt-0.5">{currentItem.reason}</p>
                </div>
                <Link href={`/company/${currentItem.company.id}`}>
                  <button className="text-[#64748b] hover:text-[#0091AE] mt-0.5 flex-shrink-0">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </Link>
              </div>

              {/* Priority badge */}
              {currentItem.priority >= 3000 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500/15 border border-orange-500/30 rounded-lg">
                  <TrendingUp className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">Urgent — Overdue</p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {currentItem.daysSinceLastCall < 999 ? `${currentItem.daysSinceLastCall} days since last contact` : "Never contacted"}
                    </p>
                  </div>
                </div>
              )}
              {currentItem.priority >= 2000 && currentItem.priority < 3000 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/15 border border-red-500/30 rounded-lg">
                  <TrendingUp className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">High Priority</p>
                    <p className="text-[10px] text-gray-400 truncate">
                      DM contact — {currentItem.daysSinceDmContact} days ago
                    </p>
                  </div>
                </div>
              )}
              {currentItem.priority >= 500 && currentItem.priority < 2000 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-500/15 border border-yellow-500/30 rounded-lg">
                  <Clock className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider">Ready for Follow-Up</p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {currentItem.daysSinceLastCall < 999 ? `${currentItem.daysSinceLastCall} days since last contact` : "Never contacted"}
                    </p>
                  </div>
                </div>
              )}

              {/* Lead status */}
              <div>
                {editingLeadStatus ? (
                  <div className="flex items-center gap-1.5">
                    <Select value={newLeadStatus} onValueChange={setNewLeadStatus}>
                      <SelectTrigger className="h-7 text-xs flex-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                        {LEAD_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs dark:text-white dark:focus:bg-[#3d4254]">
                            <span className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${opt.badgeColor}`} />
                              {opt.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-green-400 hover:text-green-300"
                      onClick={handleSaveLeadStatus}
                      disabled={updateLeadStatusMutation.isPending}
                    >
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 dark:text-[#94a3b8]"
                      onClick={() => setEditingLeadStatus(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setNewLeadStatus(company?.budgetStatus ?? currentItem.company.budgetStatus ?? "0-unqualified");
                      setEditingLeadStatus(true);
                    }}
                    className="flex items-center gap-2 group w-full hover:bg-[#2d3142] rounded p-1 -mx-1 transition-colors"
                  >
                    <Tag className="h-3.5 w-3.5 text-[#64748b]" />
                    {getLeadStatusBadge(company?.budgetStatus ?? currentItem.company.budgetStatus)}
                    <Pencil className="h-3 w-3 text-[#64748b] opacity-0 group-hover:opacity-70 ml-auto" />
                  </button>
                )}
              </div>

              {/* Call count + DM badges */}
              <div className="flex flex-wrap gap-1.5">
                {currentItem.totalCalls > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-cyan-500/15 text-cyan-400 text-[10px] rounded-full">
                    <Phone className="h-2.5 w-2.5" />
                    {currentItem.totalCalls}x contacted
                  </span>
                )}
                {currentItem.hasDmContact && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/15 text-purple-400 text-[10px] rounded-full">
                    <User className="h-2.5 w-2.5" />
                    DM contact
                    {currentItem.daysSinceDmContact !== null && ` · ${currentItem.daysSinceDmContact}d ago`}
                  </span>
                )}
              </div>

              {/* Quick info */}
              <div className="space-y-1.5 text-xs dark:text-[#94a3b8]">
                {currentItem.company.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-[#64748b] flex-shrink-0" />
                    <span className="truncate">{currentItem.company.location}</span>
                  </div>
                )}
                {currentItem.company.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-[#64748b] flex-shrink-0" />
                    <a
                      href={currentItem.company.website.startsWith("http") ? currentItem.company.website : `https://${currentItem.company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0091AE] hover:underline truncate"
                    >
                      {currentItem.company.website.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  </div>
                )}
                {currentItem.company.lastContactDate && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-[#64748b] flex-shrink-0" />
                    <span>{formatDistanceToNow(new Date(currentItem.company.lastContactDate), { addSuffix: true })}</span>
                  </div>
                )}
              </div>

              {/* Click-to-call */}
              {currentItem.company.phone && (
                <div className="bg-[#0091AE]/10 border border-[#0091AE]/30 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#0091AE] mb-1">Main Phone</p>
                  <p className="text-sm font-bold dark:text-white mb-2">
                    {formatPhone(currentItem.company.phone)}
                    {currentItem.company.ext && (
                      <span className="text-xs font-normal dark:text-[#94a3b8] ml-1">ext. {currentItem.company.ext}</span>
                    )}
                  </p>
                  <a
                    href={`tel:${formatPhone(currentItem.company.phone)}`}
                    className="flex items-center justify-center gap-2 w-full py-2 bg-[#0091AE] hover:bg-[#007a94] text-white rounded-md text-sm font-medium transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    Call Now
                  </a>
                </div>
              )}

              {/* IT Manager / DM callout */}
              {(currentItem.company.itManagerName || currentItem.company.decisionMakerName) && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-green-400 mb-1">
                    {currentItem.company.itManagerName ? "IT Manager" : "Decision Maker"}
                  </p>
                  <p className="text-sm font-medium dark:text-white">
                    {currentItem.company.itManagerName ?? currentItem.company.decisionMakerName}
                  </p>
                  {currentItem.company.itManagerEmail && (
                    <a
                      href={`mailto:${currentItem.company.itManagerEmail}`}
                      className="text-[10px] text-[#0091AE] hover:underline mt-0.5 block truncate"
                    >
                      {currentItem.company.itManagerEmail}
                    </a>
                  )}
                </div>
              )}

              {/* Contacts section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold dark:text-white flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-[#0091AE]" />
                    Contacts ({company?.contacts?.length ?? 0})
                  </h3>
                  <button
                    onClick={() => setAddContactOpen(true)}
                    className="text-[#0091AE] hover:text-[#007a94]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {companyLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full dark:bg-[#3d4254]" />
                  </div>
                ) : (company?.contacts?.length ?? 0) > 0 ? (
                  <div className="space-y-2">
                    {company!.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="dark:bg-[#1a1d29] rounded-lg p-2.5 group"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium dark:text-white truncate">
                              {contact.name ?? contact.email}
                            </p>
                            {contact.role && (
                              <p className="text-[10px] dark:text-[#64748b]">{contact.role}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0">
                            <button
                              onClick={() => openEditContact(contact)}
                              className="text-[#64748b] hover:text-[#94a3b8]"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => deleteContactMutation.mutate(contact.id)}
                              className="text-[#64748b] hover:text-red-400"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        {contact.phone && (
                          <a
                            href={`tel:${contact.phone}`}
                            className="flex items-center gap-1 text-[11px] text-[#0091AE] hover:underline mb-0.5"
                          >
                            <Phone className="h-2.5 w-2.5" />
                            {formatPhone(contact.phone)}
                          </a>
                        )}
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="flex items-center gap-1 text-[11px] text-[#0091AE] hover:underline truncate"
                          >
                            <Mail className="h-2.5 w-2.5 flex-shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] dark:text-[#64748b] text-center py-2">
                    No contacts yet
                  </p>
                )}
              </div>

              {/* Quick action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setLogCallOpen(true); setCallNote(""); setCallOutcome(""); }}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-[#0091AE] hover:bg-[#007a94] text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  Log Call
                </button>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Add Task
                </button>
                <button
                  onClick={() => { setAddNoteOpen(true); setNoteText(""); }}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <StickyNote className="h-3.5 w-3.5" />
                  Add Note
                </button>
                <button
                  onClick={() => {
                    setAddDealOpen(true);
                    setDealTitle("");
                    setDealStageId(stages?.[0]?.id ?? "");
                    setDealGP("");
                    setDealNotes("");
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Add Deal
                </button>
              </div>

              {/* Navigation */}
              <div className="flex gap-2">
                <button
                  onClick={handleSkip}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 dark:bg-[#1a1d29] hover:dark:bg-[#2d3142] dark:text-[#94a3b8] hover:dark:text-white rounded-lg text-xs font-medium transition-colors border dark:border-[#3d4254]"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  Skip School
                </button>
              </div>
            </>
          ) : (
            /* Empty queue state */
            <div className="text-center py-8 px-2">
              {totalItems === 0 ? (
                <>
                  <Building2 className="h-10 w-10 dark:text-[#3d4254] mx-auto mb-3" />
                  <p className="text-sm font-semibold dark:text-white mb-1">Queue Empty</p>
                  <p className="text-xs dark:text-[#64748b]">No schools match this filter</p>
                </>
              ) : (
                <>
                  <div className="text-3xl mb-2">🎉</div>
                  <p className="text-sm font-semibold dark:text-white mb-1">Queue Complete!</p>
                  <p className="text-xs dark:text-[#64748b] mb-3">Great work today</p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="dark:bg-[#1a1d29] rounded-lg p-2 border border-green-500/20">
                      <p className="text-lg font-bold text-green-400">{completedIds.size}</p>
                      <p className="text-[10px] dark:text-[#64748b]">Called</p>
                    </div>
                    <div className="dark:bg-[#1a1d29] rounded-lg p-2 border border-amber-500/20">
                      <p className="text-lg font-bold text-amber-400">{skippedIds.size}</p>
                      <p className="text-[10px] dark:text-[#64748b]">Skipped</p>
                    </div>
                  </div>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleReset}
                className="dark:border-[#3d4254] dark:text-[#94a3b8] text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Start Over
              </Button>
            </div>
          )}

          {/* Up next list */}
          {activeQueue.length > 1 && (
            <div className="border-t dark:border-[#3d4254] pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider dark:text-[#64748b] mb-2">
                Up Next ({activeQueue.length - 1})
              </p>
              <div className="space-y-0.5">
                {activeQueue.slice(1, 7).map((item, idx) => (
                  <div
                    key={item.company.id}
                    className="flex items-center gap-2 py-1.5 px-1.5 rounded hover:dark:bg-[#2d3142] transition-colors"
                  >
                    <span className="text-[10px] dark:text-[#64748b] w-4 text-right flex-shrink-0">{idx + 2}</span>
                    {item.priority >= 3000 ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse flex-shrink-0" />
                    ) : item.priority >= 2000 ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    ) : item.priority >= 500 ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 flex-shrink-0" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-600 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs dark:text-[#94a3b8] truncate">{item.company.name}</p>
                      <div className="flex gap-1.5 mt-0.5">
                        {item.hasDmContact && (
                          <span className="text-[9px] text-purple-400">DM</span>
                        )}
                        {item.totalCalls > 0 && (
                          <span className="text-[9px] text-cyan-400">{item.totalCalls}x</span>
                        )}
                        {item.daysSinceLastCall < 999 && (
                          <span className="text-[9px] dark:text-[#64748b]">{item.daysSinceLastCall}d</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-3 w-3 dark:text-[#64748b] flex-shrink-0" />
                  </div>
                ))}
                {activeQueue.length > 7 && (
                  <p className="text-[10px] dark:text-[#64748b] text-center pt-1">
                    +{activeQueue.length - 7} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER — Activity feed ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {currentItem ? (
          <>
            {/* Center header */}
            <div className="px-5 pt-4 pb-0 border-b dark:border-[#3d4254] flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold dark:text-white">
                  Activity — {currentItem.company.name}
                </h2>
                <div className="flex items-center gap-2 text-xs dark:text-[#64748b]">
                  {company?.activities?.length ?? 0} activities
                </div>
              </div>
              {/* Tabs */}
              <div className="flex gap-0">
                {(["all", "calls", "notes"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors capitalize ${
                      activeTab === tab
                        ? "border-[#0091AE] text-[#0091AE]"
                        : "border-transparent dark:text-[#64748b] hover:dark:text-[#94a3b8]"
                    }`}
                  >
                    {tab === "all" ? "All Activity" : tab === "calls" ? "Calls" : "Notes"}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {companyLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full dark:bg-[#3d4254]" />
                  ))}
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="text-center py-16 dark:bg-[#252936] rounded-xl border dark:border-[#3d4254]">
                  <Clock className="h-10 w-10 dark:text-[#3d4254] mx-auto mb-3" />
                  <p className="text-sm dark:text-[#64748b]">No activity yet</p>
                  <p className="text-xs dark:text-[#3d4254] mt-1">Log a call or add a note to get started</p>
                </div>
              ) : (
                filteredActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex gap-3 dark:bg-[#252936] rounded-xl border dark:border-[#3d4254] p-4"
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${getActivityBubbleColor(activity.type)}`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-semibold dark:text-white">
                          {getActivityLabel(activity.type)}
                        </span>
                        {activity.outcome && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 dark:bg-[#3d4254] dark:text-[#94a3b8]">
                            {activity.outcome}
                          </Badge>
                        )}
                        <span className="text-[10px] dark:text-[#64748b] ml-auto">
                          {format(new Date(activity.createdAt), "d MMM yyyy, HH:mm")}
                        </span>
                      </div>
                      {activity.note && (
                        <p className="text-sm dark:text-[#94a3b8] leading-relaxed whitespace-pre-wrap">
                          {activity.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Building2 className="h-12 w-12 dark:text-[#3d4254] mx-auto mb-4" />
              <p className="text-sm dark:text-[#64748b]">Select a school from the queue</p>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT SIDEBAR — Deals & Tasks ────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col overflow-y-auto dark:bg-[#252936] border-l dark:border-[#3d4254]">
        {currentItem && (
          <div className="p-4 space-y-5">

            {/* Deals */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold dark:text-white flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-[#0091AE]" />
                  Deals ({company?.deals?.length ?? 0})
                </h3>
                <button
                  onClick={() => {
                    setAddDealOpen(true);
                    setDealTitle("");
                    setDealStageId(stages?.[0]?.id ?? "");
                    setDealGP("");
                    setDealNotes("");
                  }}
                  className="text-[#0091AE] hover:text-[#007a94]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {companyLoading ? (
                <Skeleton className="h-16 w-full dark:bg-[#3d4254]" />
              ) : (company?.deals?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  {company!.deals.map((deal) => (
                    <div key={deal.id} className="dark:bg-[#1a1d29] rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-medium dark:text-white leading-tight">
                          {deal.title}
                        </p>
                        {deal.expectedGP && (
                          <p className="text-xs font-bold text-green-400 flex-shrink-0">
                            £{Number(deal.expectedGP).toLocaleString()}
                          </p>
                        )}
                      </div>
                      {deal.stage && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: deal.stage.color }}
                          />
                          <p className="text-[10px] dark:text-[#64748b]">{deal.stage.name}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 dark:bg-[#1a1d29] rounded-lg border dark:border-[#3d4254]">
                  <DollarSign className="h-6 w-6 dark:text-[#3d4254] mx-auto mb-1.5" />
                  <p className="text-[11px] dark:text-[#64748b]">No deals yet</p>
                </div>
              )}
            </div>

            {/* Tasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold dark:text-white flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5 text-[#0091AE]" />
                  Tasks ({activeTasks.length})
                </h3>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="text-[#0091AE] hover:text-[#007a94]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {companyLoading ? (
                <Skeleton className="h-16 w-full dark:bg-[#3d4254]" />
              ) : activeTasks.length > 0 ? (
                <div className="space-y-2">
                  {activeTasks.map((task) => {
                    const overdue = task.dueDate && new Date(task.dueDate) < today;
                    return (
                      <div key={task.id} className="dark:bg-[#1a1d29] rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={task.status === "completed"}
                            onChange={() =>
                              updateTaskMutation.mutate({ id: task.id, status: "completed" })
                            }
                            className="mt-0.5 h-3.5 w-3.5 rounded accent-[#0091AE] cursor-pointer flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs dark:text-white leading-snug">{task.name}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge className={`text-[9px] h-4 px-1.5 ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                              </Badge>
                              {task.dueDate && (
                                <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? "text-red-400" : "dark:text-[#64748b]"}`}>
                                  {overdue && <AlertCircle className="h-2.5 w-2.5" />}
                                  {format(new Date(task.dueDate), "d MMM")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 dark:bg-[#1a1d29] rounded-lg border dark:border-[#3d4254]">
                  <CheckCircle2 className="h-6 w-6 dark:text-[#3d4254] mx-auto mb-1.5" />
                  <p className="text-[11px] dark:text-[#64748b]">No active tasks</p>
                </div>
              )}
            </div>

            {/* Last call summary */}
            {currentItem.lastCallActivity && (
              <div>
                <h3 className="text-xs font-semibold dark:text-white mb-2 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-[#0091AE]" />
                  Last Call
                </h3>
                <div className="dark:bg-[#1a1d29] rounded-lg p-3 border-l-2 border-[#0091AE]">
                  {currentItem.lastCallActivity.outcome && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 dark:bg-[#3d4254] dark:text-[#94a3b8] mb-1.5">
                      {currentItem.lastCallActivity.outcome}
                    </Badge>
                  )}
                  {currentItem.lastCallActivity.note && (
                    <p className="text-xs dark:text-[#94a3b8] line-clamp-3 leading-relaxed">
                      {currentItem.lastCallActivity.note}
                    </p>
                  )}
                  <p className="text-[10px] dark:text-[#64748b] mt-1.5">
                    {format(new Date(currentItem.lastCallActivity.createdAt), "d MMM yyyy")}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODALS ───────────────────────────────────────────────────────── */}

      {/* Log Call */}
      <Dialog open={logCallOpen} onOpenChange={setLogCallOpen}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254] max-w-md">
          <DialogHeader>
            <DialogTitle className="dark:text-white">
              Log Call — {currentItem?.company.name}
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
                  {CALL_OUTCOME_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider dark:text-[#64748b]">
                        {group.label}
                      </div>
                      {group.outcomes.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="dark:text-white dark:focus:bg-[#3d4254]">
                          {o.label}
                        </SelectItem>
                      ))}
                    </div>
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
          <div className="text-[11px] text-center dark:text-[#64748b] -mt-1 px-1">
            This school will be marked as contacted and removed from today's queue.
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
              {logCallMutation.isPending ? "Logging..." : "Log Call & Next School"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note */}
      <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254] max-w-md">
          <DialogHeader>
            <DialogTitle className="dark:text-white">
              Add Note — {currentItem?.company.name}
            </DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium dark:text-[#94a3b8]">Note *</label>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Enter your note..."
              className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
              rows={4}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNoteOpen(false)} className="dark:border-[#3d4254] dark:text-[#94a3b8]">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitNote}
              disabled={!noteText.trim() || addNoteMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {addNoteMutation.isPending ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254] max-w-md">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Add Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Name</label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Full name"
                className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
              />
            </div>
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Email *</label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="email@school.ac.uk"
                className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
              />
            </div>
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Phone</label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="01234 567890"
                className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
              />
            </div>
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Role</label>
              <Input
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value)}
                placeholder="e.g. IT Manager, Head Teacher"
                className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddContactOpen(false)} className="dark:border-[#3d4254] dark:text-[#94a3b8]">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitContact}
              disabled={!contactEmail.trim() || addContactMutation.isPending}
              className="bg-[#0091AE] hover:bg-[#007a94]"
            >
              {addContactMutation.isPending ? "Adding..." : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contact */}
      <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254] max-w-md">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Name</label>
              <Input
                value={editContactName}
                onChange={(e) => setEditContactName(e.target.value)}
                className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Email *</label>
              <Input
                type="email"
                value={editContactEmail}
                onChange={(e) => setEditContactEmail(e.target.value)}
                className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Phone</label>
              <Input
                value={editContactPhone}
                onChange={(e) => setEditContactPhone(e.target.value)}
                className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Role</label>
              <Input
                value={editContactRole}
                onChange={(e) => setEditContactRole(e.target.value)}
                className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingContact(null)} className="dark:border-[#3d4254] dark:text-[#94a3b8]">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitEditContact}
              disabled={!editContactEmail.trim() || updateContactMutation.isPending}
              className="bg-[#0091AE] hover:bg-[#007a94]"
            >
              {updateContactMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Deal */}
      <Dialog open={addDealOpen} onOpenChange={setAddDealOpen}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254] max-w-md">
          <DialogHeader>
            <DialogTitle className="dark:text-white">
              Create Deal — {currentItem?.company.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Deal Title *</label>
              <Input
                value={dealTitle}
                onChange={(e) => setDealTitle(e.target.value)}
                placeholder="e.g. Laptop Refresh 2026"
                className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
              />
            </div>
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Pipeline Stage *</label>
              <Select value={dealStageId} onValueChange={setDealStageId}>
                <SelectTrigger className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                  <SelectValue placeholder="Select stage..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                  {stages?.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="dark:text-white dark:focus:bg-[#3d4254]">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Expected GP (£)</label>
              <Input
                type="number"
                value={dealGP}
                onChange={(e) => setDealGP(e.target.value)}
                placeholder="0"
                className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
              />
            </div>
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8]">Notes</label>
              <Textarea
                value={dealNotes}
                onChange={(e) => setDealNotes(e.target.value)}
                placeholder="Deal notes..."
                className="mt-1 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDealOpen(false)} className="dark:border-[#3d4254] dark:text-[#94a3b8]">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitDeal}
              disabled={!dealTitle.trim() || !dealStageId || addDealMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {addDealMutation.isPending ? "Creating..." : "Create Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Task Modal (existing component) */}
      {showTaskModal && currentItem && (
        <QuickTaskModal
          company={currentItem.company}
          onClose={() => setShowTaskModal(false)}
        />
      )}

      {/* Skip Confirmation */}
      <Dialog open={showSkipConfirm} onOpenChange={setShowSkipConfirm}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254] max-w-sm">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Skip this school?</DialogTitle>
          </DialogHeader>
          <p className="text-sm dark:text-[#94a3b8]">
            This will remove <span className="font-semibold dark:text-white">{currentItem?.company.name}</span> from today's queue. It will appear again in 21+ days.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSkipConfirm(false)} className="dark:border-[#3d4254] dark:text-[#94a3b8]">
              Keep in Queue
            </Button>
            <Button
              onClick={confirmSkip}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <SkipForward className="h-4 w-4 mr-1.5" />
              Skip School
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
