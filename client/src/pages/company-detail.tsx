import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation, Link } from "wouter";
import type { CompanyWithRelations, PipelineStage, Task, Activity, DealWithStage, Contact, Company, CompanyRelationshipWithCompany } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Phone, Mail, User, Plus,
  Trash2, Clock, Building2, ExternalLink,
  FileText, DollarSign, Calendar, TrendingUp, MessageSquare,
  ThumbsUp, ThumbsDown, Pencil, X, Save, StickyNote, Briefcase,
  ChevronDown, ChevronRight, MoreHorizontal, Video, Search,
  Users, Ticket, Paperclip, Building, CheckCircle2,
  MapPin, Globe, Hash, Landmark, Tag
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

const TITLE_OPTIONS = ["Mr", "Mrs", "Ms", "Miss", "Dr", "Rev", "Prof"];

const addContactSchema = z.object({
  email: z.string().email("Valid email is required"),
  title: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
});

const addTaskSchema = z.object({
  name: z.string().min(1, "Task description is required"),
  dueDate: z.string().optional(),
  priority: z.string().default("medium"),
  taskType: z.string().default("general"),
});

const logCallSchema = z.object({
  note: z.string().optional(),
  outcome: z.string().optional(),
  callDate: z.string().optional(),
});

const addNoteSchema = z.object({
  note: z.string().min(1, "Note content is required"),
});

const addEmailSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Email body is required"),
});

const addMeetingSchema = z.object({
  title: z.string().min(1, "Meeting title is required"),
  note: z.string().optional(),
});

const editCompanySchema = z.object({
  phone: z.string().optional(),
  ext: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  academyTrustName: z.string().optional(),
  industry: z.string().optional(),
  decisionTimeline: z.string().optional(),
  budgetStatus: z.string().optional(),
  parentCompanyId: z.string().nullable().optional(),
});

const dealSchema = z.object({
  title: z.string().min(1, "Deal title is required"),
  stageId: z.string().min(1, "Please select a pipeline stage"),
  expectedGP: z.string().optional(),
  budgetStatus: z.string().optional(),
  decisionTimeline: z.string().optional(),
  notes: z.string().optional(),
});

// Collapsible section component
function CollapsibleSection({
  title,
  count,
  icon: Icon,
  children,
  onAdd,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onAdd?: () => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b dark:border-[#3d4254]">
      <CollapsibleTrigger className="flex items-center justify-between w-full py-3.5 px-5 hover:bg-muted/50 dark:hover:bg-[#2d3142]/60 transition-all duration-200 cursor-pointer">
        <div className="flex items-center gap-2.5">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
          )}
          <Icon className="h-4 w-4 text-[#0091AE]" />
          <span className="font-semibold text-sm dark:text-white">{title}</span>
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs dark:bg-[#3d4254] dark:text-[#94a3b8]">
            {count}
          </Badge>
        </div>
        {onAdd && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2.5 text-[#0091AE] hover:text-[#007a94] hover:bg-[#0091AE]/10 dark:hover:bg-[#0091AE]/10 rounded-md transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-5 pb-5">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function CompanyDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // State for dialogs
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [showLogCallDialog, setShowLogCallDialog] = useState(false);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [showAddEmailDialog, setShowAddEmailDialog] = useState(false);
  const [showAddMeetingDialog, setShowAddMeetingDialog] = useState(false);
  const [showAddContactDialog, setShowAddContactDialog] = useState(false);
  const [showDealDialog, setShowDealDialog] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealWithStage | null>(null);
  const [showDeleteCompanyDialog, setShowDeleteCompanyDialog] = useState(false);
  const [deleteCompanyConfirmName, setDeleteCompanyConfirmName] = useState("");
  const [showDeleteDealDialog, setShowDeleteDealDialog] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<DealWithStage | null>(null);
  const [showLinkSchoolsDialog, setShowLinkSchoolsDialog] = useState(false);
  const [showAddRelationshipDialog, setShowAddRelationshipDialog] = useState(false);
  const [linkSchoolSearch, setLinkSchoolSearch] = useState("");
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<Set<string>>(new Set());
  const [relationshipCompanySearch, setRelationshipCompanySearch] = useState("");
  const [selectedRelCompanyId, setSelectedRelCompanyId] = useState("");
  const [selectedRelType, setSelectedRelType] = useState("");
  const [relNotes, setRelNotes] = useState("");

  // Key information inline editing
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  // Activity edit/delete
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showEditActivityDialog, setShowEditActivityDialog] = useState(false);
  const [editActivityNote, setEditActivityNote] = useState("");
  const [editActivityOutcome, setEditActivityOutcome] = useState("");
  const [editActivityDate, setEditActivityDate] = useState("");
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [showDeleteActivityDialog, setShowDeleteActivityDialog] = useState(false);

  // Activity filters
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [activitySearch, setActivitySearch] = useState("");
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());

  const { data: company, isLoading, error } = useQuery<CompanyWithRelations>({
    queryKey: ["/api/companies", params.id],
    enabled: !!params.id, // Only run query if ID exists
  });

  // Handle missing ID
  if (!params.id) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Invalid Company ID</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">No company ID was provided in the URL.</p>
          <Button onClick={() => navigate("/companies")}>Back to Companies</Button>
        </div>
      </div>
    );
  }

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const { data: trustCompanies } = useQuery<Company[]>({
    queryKey: ["/api/trust-companies"],
  });

  const { data: allCompanies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const taskForm = useForm<z.infer<typeof addTaskSchema>>({
    resolver: zodResolver(addTaskSchema),
    defaultValues: { name: "", dueDate: "", priority: "medium", taskType: "general" },
  });

  const logCallForm = useForm<z.infer<typeof logCallSchema>>({
    resolver: zodResolver(logCallSchema),
    defaultValues: { note: "", outcome: "", callDate: format(new Date(), "yyyy-MM-dd'T'HH:mm") },
  });

  const addNoteForm = useForm<z.infer<typeof addNoteSchema>>({
    resolver: zodResolver(addNoteSchema),
    defaultValues: { note: "" },
  });

  const addEmailForm = useForm<z.infer<typeof addEmailSchema>>({
    resolver: zodResolver(addEmailSchema),
    defaultValues: { subject: "", body: "" },
  });

  const addMeetingForm = useForm<z.infer<typeof addMeetingSchema>>({
    resolver: zodResolver(addMeetingSchema),
    defaultValues: { title: "", note: "" },
  });

  const contactForm = useForm<z.infer<typeof addContactSchema>>({
    resolver: zodResolver(addContactSchema),
    defaultValues: { email: "", title: "", name: "", phone: "", role: "" },
  });

  const dealForm = useForm<z.infer<typeof dealSchema>>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: "",
      stageId: "",
      expectedGP: "",
      budgetStatus: "",
      decisionTimeline: "",
      notes: "",
    },
  });

  // Update deal form when editing a deal
  useEffect(() => {
    if (editingDeal) {
      dealForm.reset({
        title: editingDeal.title,
        stageId: editingDeal.stageId || "",
        expectedGP: editingDeal.expectedGP?.toString() || "",
        budgetStatus: editingDeal.budgetStatus || "",
        decisionTimeline: editingDeal.decisionTimeline ? format(new Date(editingDeal.decisionTimeline), "yyyy-MM-dd") : "",
        notes: editingDeal.notes || "",
      });
    } else {
      dealForm.reset({
        title: "",
        stageId: "",
        expectedGP: "",
        budgetStatus: "",
        decisionTimeline: "",
        notes: "",
      });
    }
  }, [editingDeal, dealForm]);

  // Mutations
  const addTaskMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addTaskSchema>) => {
      return apiRequest("POST", `/api/companies/${params.id}/tasks`, {
        companyId: params.id,
        name: data.name,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        priority: data.priority,
        status: "todo",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      taskForm.reset();
      setShowAddTaskDialog(false);
      toast({ title: "Task added" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status?: string }) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, data);
    },
    onMutate: async ({ id, status }) => {
      // Optimistic update for task status changes
      await queryClient.cancelQueries({ queryKey: ["/api/companies", params.id] });
      const previous = queryClient.getQueryData<CompanyWithRelations>(["/api/companies", params.id]);
      if (previous && status) {
        queryClient.setQueryData<CompanyWithRelations>(["/api/companies", params.id], {
          ...previous,
          tasks: previous.tasks.map(t => t.id === id ? { ...t, status } : t),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/companies", params.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task updated" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task removed" });
    },
  });

  const logCallMutation = useMutation({
    mutationFn: async (data: z.infer<typeof logCallSchema>) => {
      return apiRequest("POST", `/api/companies/${params.id}/activities`, {
        companyId: params.id,
        type: "call",
        note: data.note || null,
        outcome: data.outcome || null,
        createdAt: data.callDate ? new Date(data.callDate).toISOString() : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/today"] });
      logCallForm.reset({ note: "", outcome: "", callDate: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
      setShowLogCallDialog(false);
      toast({ title: "Call logged" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addNoteSchema>) => {
      return apiRequest("POST", `/api/companies/${params.id}/activities`, {
        companyId: params.id,
        type: "follow_up",
        note: data.note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      addNoteForm.reset();
      setShowAddNoteDialog(false);
      toast({ title: "Note added" });
    },
  });

  const addEmailMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addEmailSchema>) => {
      return apiRequest("POST", `/api/companies/${params.id}/activities`, {
        companyId: params.id,
        type: "email",
        note: `Subject: ${data.subject}\n\n${data.body}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      addEmailForm.reset();
      setShowAddEmailDialog(false);
      toast({ title: "Email logged" });
    },
  });

  const addMeetingMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addMeetingSchema>) => {
      return apiRequest("POST", `/api/companies/${params.id}/activities`, {
        companyId: params.id,
        type: "meeting",
        note: `Meeting: ${data.title}${data.note ? `\n\n${data.note}` : ""}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      addMeetingForm.reset();
      setShowAddMeetingDialog(false);
      toast({ title: "Meeting logged" });
    },
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addContactSchema>) => {
      return apiRequest("POST", `/api/companies/${params.id}/contacts`, {
        companyId: params.id,
        email: data.email,
        title: data.title && data.title !== "none" ? data.title : null,
        name: data.name || null,
        phone: data.phone || null,
        role: data.role || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      contactForm.reset();
      setShowAddContactDialog(false);
      toast({ title: "Contact added" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return apiRequest("DELETE", `/api/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      toast({ title: "Contact removed" });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      return apiRequest("DELETE", `/api/activities/${activityId}`);
    },
    onMutate: async (activityId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/companies", params.id] });
      const previous = queryClient.getQueryData<CompanyWithRelations>(["/api/companies", params.id]);
      if (previous) {
        queryClient.setQueryData<CompanyWithRelations>(["/api/companies", params.id], {
          ...previous,
          activities: previous.activities.filter(a => a.id !== activityId),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/companies", params.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-analytics"] });
      setShowDeleteActivityDialog(false);
      setActivityToDelete(null);
      toast({ title: activityToDelete?.type === "call" ? "Call log deleted successfully" : "Note deleted successfully" });
    },
  });

  const editActivityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { note?: string; outcome?: string; createdAt?: string } }) => {
      return apiRequest("PATCH", `/api/activities/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-analytics"] });
      setShowEditActivityDialog(false);
      setEditingActivity(null);
      toast({ title: editingActivity?.type === "call" ? "Call log updated" : "Note updated" });
    },
  });

  const openEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    setEditActivityNote(activity.note || "");
    setEditActivityOutcome(activity.outcome || "");
    setEditActivityDate(format(new Date(activity.createdAt), "yyyy-MM-dd'T'HH:mm"));
    setShowEditActivityDialog(true);
  };

  const openDeleteActivity = (activity: Activity) => {
    setActivityToDelete(activity);
    setShowDeleteActivityDialog(true);
  };

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: Partial<z.infer<typeof editCompanySchema>>) => {
      return apiRequest("PATCH", `/api/companies/${params.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setEditingField(null);
      toast({ title: "Updated" });
    },
  });

  const addDealMutation = useMutation({
    mutationFn: async (data: z.infer<typeof dealSchema>) => {
      return apiRequest("POST", `/api/companies/${params.id}/deals`, {
        companyId: params.id,
        title: data.title,
        stageId: data.stageId,
        expectedGP: data.expectedGP || null,
        budgetStatus: data.budgetStatus || null,
        decisionTimeline: data.decisionTimeline ? new Date(data.decisionTimeline).toISOString() : null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      dealForm.reset();
      setShowDealDialog(false);
      setEditingDeal(null);
      toast({ title: "Deal added" });
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & z.infer<typeof dealSchema>) => {
      return apiRequest("PATCH", `/api/deals/${id}`, {
        title: data.title,
        stageId: data.stageId,
        expectedGP: data.expectedGP || null,
        budgetStatus: data.budgetStatus || null,
        decisionTimeline: data.decisionTimeline ? new Date(data.decisionTimeline).toISOString() : null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      dealForm.reset();
      setShowDealDialog(false);
      setEditingDeal(null);
      toast({ title: "Deal updated" });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (dealId: string) => {
      return apiRequest("DELETE", `/api/deals/${dealId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      setShowDeleteDealDialog(false);
      setDealToDelete(null);
      toast({ title: "Deal deleted successfully" });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      return apiRequest("DELETE", `/api/companies/${companyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: `${company?.name} deleted successfully` });
      navigate("/companies");
    },
  });

  const handleDealSubmit = (data: z.infer<typeof dealSchema>) => {
    if (editingDeal) {
      updateDealMutation.mutate({ id: editingDeal.id, ...data });
    } else {
      addDealMutation.mutate(data);
    }
  };

  const openEditDeal = (deal: DealWithStage) => {
    setEditingDeal(deal);
    setShowDealDialog(true);
  };

  const openAddDeal = () => {
    setEditingDeal(null);
    setShowDealDialog(true);
  };

  // Inline field editing
  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditingValue(currentValue || "");
  };

  const saveField = (field: string) => {
    updateCompanyMutation.mutate({ [field]: editingValue || null });
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditingValue("");
  };

  // Filter and sort activities
  const filteredActivities = useMemo(() => {
    if (!company?.activities) return [];

    let filtered = [...company.activities];

    // Apply type filter
    if (activityFilter !== "all") {
      filtered = filtered.filter((a) => {
        if (activityFilter === "notes") return a.type === "follow_up";
        if (activityFilter === "emails") return a.type === "email";
        if (activityFilter === "calls") return a.type === "call";
        if (activityFilter === "tasks") return false; // Tasks are separate
        if (activityFilter === "meetings") return a.type === "meeting";
        return true;
      });
    }

    // Apply search
    if (activitySearch) {
      const search = activitySearch.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.note?.toLowerCase().includes(search) ||
          a.type.toLowerCase().includes(search) ||
          a.outcome?.toLowerCase().includes(search)
      );
    }

    // Sort by date (newest first)
    return filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [company?.activities, activityFilter, activitySearch]);

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <div className="w-72 p-6 border-r">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-10 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="w-80 p-6 border-l">
          <Skeleton className="h-32 w-full mb-4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Company not found</p>
        <p className="text-sm text-gray-500 mt-2">ID: {params.id}</p>
        {error && (
          <p className="text-sm text-red-500 mt-2">Error: {error instanceof Error ? error.message : String(error)}</p>
        )}
        <Button onClick={() => navigate("/companies")} className="mt-4">
          Back to Companies
        </Button>
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call": return <Phone className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      case "quote": return <FileText className="h-4 w-4" />;
      case "follow_up": return <StickyNote className="h-4 w-4" />;
      case "meeting": return <Video className="h-4 w-4" />;
      case "deal_won": return <ThumbsUp className="h-4 w-4" />;
      case "deal_lost": return <ThumbsDown className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getActivityLabel = (type: string) => {
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
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "call": return "bg-blue-500";
      case "email": return "bg-purple-500";
      case "quote": return "bg-amber-500";
      case "follow_up": return "bg-cyan-500";
      case "meeting": return "bg-green-500";
      case "deal_won": return "bg-emerald-500";
      case "deal_lost": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  // Lead Status options with colors
  const leadStatusOptions = [
    { value: "0-unqualified", label: "0 - Unqualified", color: "bg-gray-100 text-gray-700", badgeColor: "bg-[#6b7280]" },
    { value: "1-qualified", label: "1 - Qualified", color: "bg-blue-100 text-blue-700", badgeColor: "bg-[#3b82f6]" },
    { value: "2-intent", label: "2 - Intent", color: "bg-purple-100 text-purple-700", badgeColor: "bg-[#8b5cf6]" },
    { value: "3-quote-presented", label: "3 - Quote Presented", color: "bg-amber-100 text-amber-700", badgeColor: "bg-[#f59e0b]" },
    { value: "3b-quoted-lost", label: "3b - Quoted Lost", color: "bg-red-100 text-red-700", badgeColor: "bg-[#ef4444]" },
    { value: "4-account-active", label: "4 - Account Active", color: "bg-green-100 text-green-700", badgeColor: "bg-[#10b981]" },
  ];

  const getLeadStatusBadge = (status: string | null) => {
    if (!status) {
      return <Badge className="bg-[#6b7280] hover:bg-[#6b7280] px-2 py-1 rounded-md text-[12px] font-medium text-white">0 - Unqualified</Badge>;
    }
    const option = leadStatusOptions.find(opt => opt.value === status);
    if (option) {
      return <Badge className={`${option.badgeColor} hover:${option.badgeColor} px-2 py-1 rounded-md text-[12px] font-medium text-white`}>{option.label}</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const totalExpectedGP = (company.deals || []).reduce((sum, deal) => {
    return sum + (deal.expectedGP ? parseFloat(deal.expectedGP) : 0);
  }, 0);

  const activeTasks = company.tasks?.filter(t => t.status !== "completed") || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isTaskOverdue = (task: Task) => {
    return task.dueDate && new Date(task.dueDate) < today && task.status !== "completed";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500 text-white";
      case "medium": return "bg-orange-500 text-white";
      case "low": return "bg-green-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  // Editable field component
  const EditableField = ({
    label,
    field,
    value,
    type = "text",
  }: {
    label: string;
    field: string;
    value: string | null | undefined;
    type?: "text" | "select";
  }) => {
    const isEditing = editingField === field;

    if (isEditing) {
      return (
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b]">{label}</p>
          <div className="flex items-center gap-1">
            {type === "select" && field === "industry" ? (
              <Select
                value={editingValue || "Secondary School"}
                onValueChange={(val) => {
                  setEditingValue(val);
                  updateCompanyMutation.mutate({ [field]: val });
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {["Secondary School", "Primary School", "Primary/Secondary Education", "Further Education", "Special Educational Needs"].map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : type === "select" && field === "budgetStatus" ? (
              <Select
                value={editingValue || "0-unqualified"}
                onValueChange={(val) => {
                  setEditingValue(val);
                  updateCompanyMutation.mutate({ [field]: val });
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select lead status" />
                </SelectTrigger>
                <SelectContent>
                  {leadStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${option.badgeColor}`} />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                <Input
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveField(field);
                    if (e.key === "Escape") cancelEditing();
                  }}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8 transition-all duration-200 ease-in-out" onClick={() => saveField(field)}>
                  <Save className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 transition-all duration-200 ease-in-out" onClick={cancelEditing}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        className="space-y-1 cursor-pointer hover:bg-[#2d3142] rounded p-1.5 -mx-1.5 transition-all duration-200 ease-in-out group"
        onClick={() => startEditing(field, value || "")}
      >
        <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b] flex items-center justify-between">
          {label}
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-all duration-200 ease-in-out" />
        </p>
        <p className="text-[14px] font-medium text-white">
          {field === "budgetStatus" ? (
            getLeadStatusBadge(value || null)
          ) : (
            value || <span className="text-muted-foreground font-normal">--</span>
          )}
        </p>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#1a1d29]">
      {/* LEFT SIDEBAR - Full height with scrolling */}
      <div className="w-72 bg-white dark:bg-[#252936] border-r dark:border-[#3d4254] flex flex-col h-screen overflow-hidden">
        {/* Back button - Compact spacing */}
        <div className="px-4 py-2 border-b dark:border-[#3d4254] flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/companies")}
            className="text-[#0091AE] hover:text-[#007a94] hover:bg-blue-50 dark:hover:bg-[#2d3142] -ml-2"
            data-testid="button-back-to-companies"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Schools
          </Button>
        </div>

        {/* Company name and quick actions - Optimized spacing */}
        <div className="px-4 pt-3 pb-4 border-b dark:border-[#3d4254] flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-xl font-bold text-white" data-testid="text-company-detail-name">
              {company.name}
            </h1>
            {(company.relationships?.some(r => r.relationshipType === "Part of Trust") || company.isTrust) && (
              <Badge className="bg-purple-600 hover:bg-purple-600 text-white text-[10px] px-2 py-0.5">
                Trust
              </Badge>
            )}
          </div>
          {company.website && (
            <a
              href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#0091AE] hover:underline flex items-center gap-1 mb-3 transition-all duration-200 ease-in-out"
            >
              {company.website.replace(/^https?:\/\//, "").slice(0, 30)}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {totalExpectedGP > 0 && (
            <p className="text-xs text-emerald-600 font-medium mb-4">
              Pipeline: £{totalExpectedGP.toLocaleString()}
            </p>
          )}

          {/* Quick Action Orbs */}
          <div className="flex items-center justify-center gap-3 pt-2 pb-2">
            {[
              { icon: StickyNote, label: "Note", onClick: () => setShowAddNoteDialog(true), testId: "button-add-note" },
              { icon: Mail, label: "Email", onClick: () => setShowAddEmailDialog(true) },
              { icon: Phone, label: "Call", onClick: () => setShowLogCallDialog(true), testId: "button-log-call" },
              { icon: CheckCircle2, label: "Task", onClick: () => setShowAddTaskDialog(true), testId: "button-add-task" },
              { icon: Video, label: "Meeting", onClick: () => setShowAddMeetingDialog(true) },
            ].map((action) => (
              <div key={action.label} className="flex flex-col items-center gap-1">
                <button
                  onClick={action.onClick}
                  data-testid={action.testId}
                  className="w-9 h-9 rounded-full bg-[#2d3142] border border-[#3d4254] flex items-center justify-center text-[#0091AE] hover:bg-[#353849] hover:scale-110 hover:border-[#0091AE]/40 hover:shadow-[0_0_12px_rgba(0,145,174,0.2)] transition-all duration-200 ease-in-out cursor-pointer"
                >
                  <action.icon className="h-4 w-4" />
                </button>
                <span className="text-[9px] text-[#64748b]">{action.label}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-9 h-9 rounded-full bg-[#2d3142] border border-[#3d4254] flex items-center justify-center text-[#0091AE] hover:bg-[#353849] hover:scale-110 hover:border-[#0091AE]/40 hover:shadow-[0_0_12px_rgba(0,145,174,0.2)] transition-all duration-200 ease-in-out cursor-pointer">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="dark:bg-[#252936] dark:border-[#3d4254]">
                  <DropdownMenuItem onClick={openAddDeal} className="dark:text-white dark:focus:bg-[#2d3142]">
                    <Briefcase className="h-4 w-4 mr-2" />
                    Add Deal
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowAddContactDialog(true)} className="dark:text-white dark:focus:bg-[#2d3142]">
                    <User className="h-4 w-4 mr-2" />
                    Add Contact
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="dark:bg-[#3d4254]" />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteCompanyDialog(true)}
                    className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400 dark:focus:bg-[#2d3142]"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Company
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-[9px] text-[#64748b]">More</span>
            </div>
          </div>
        </div>

        {/* Key Information - Scrollable area */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="bg-[#252936] rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.15)] border border-[#3d4254]/50">
              <h3 className="text-[10px] uppercase tracking-[1px] text-[#64748b] font-semibold mb-3 flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                Key Information
              </h3>

              {/* Group 1: Contact */}
              <div className="space-y-0.5">
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <Phone className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <EditableField label="Phone" field="phone" value={company.phone} />
                    {company.phone && (
                      <a
                        href={`tel:${company.phone}`}
                        className="text-[11px] text-[#0091AE] hover:underline flex items-center gap-1 mt-0.5 transition-all duration-200"
                      >
                        Click to call
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <Hash className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <EditableField label="Extension" field="ext" value={company.ext} />
                  </div>
                </div>
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <Globe className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b]">Website</p>
                    {company.website ? (
                      <a
                        href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] font-medium text-[#0091AE] hover:underline flex items-center gap-1 transition-all duration-200"
                        data-testid="link-company-website"
                      >
                        {company.website.replace(/^https?:\/\//, "").slice(0, 25)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="text-[13px] text-muted-foreground cursor-pointer hover:bg-[#2d3142] rounded p-1 -mx-1 transition-all duration-200"
                        onClick={() => startEditing("website", "")}>
                        --
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[#3d4254] my-2" />

              {/* Group 2: Organization */}
              <div className="space-y-0.5">
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <MapPin className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <EditableField label="Location" field="location" value={company.location} />
                  </div>
                </div>
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <MapPin className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <EditableField label="Postcode" field="postcode" value={company.postcode} />
                  </div>
                </div>
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <MapPin className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <EditableField label="Street" field="street" value={company.street} />
                  </div>
                </div>
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <MapPin className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <EditableField label="County" field="county" value={company.county} />
                  </div>
                </div>
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <Landmark className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-[#64748b] uppercase tracking-wider mb-1">Academy Trust</p>
                    {(() => {
                      // Show trust from relationships (Part of Trust where this company is the related side)
                      const trustRel = company.relationships?.find(r => r.relationshipType === "Part of Trust");
                      const parentTrust = company.parentCompany;
                      const trustCompanyLink = trustRel?.relatedCompany || parentTrust;

                      if (trustCompanyLink) {
                        return (
                          <div className="flex items-center gap-2">
                            <Link href={`/company/${trustCompanyLink.id}`} className="text-sm text-[#0091AE] hover:underline font-medium truncate">
                              {trustCompanyLink.name}
                            </Link>
                          </div>
                        );
                      }
                      return (
                        <p className="text-[13px] text-muted-foreground cursor-pointer hover:bg-[#2d3142] rounded p-1 -mx-1 transition-all duration-200"
                          onClick={() => setShowAddRelationshipDialog(true)}>
                          {company.academyTrustName || "-- click to link trust --"}
                        </p>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <Tag className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <EditableField label="School Type" field="schoolType" value={company.schoolType} />
                  </div>
                </div>
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <Tag className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <EditableField label="Industry" field="industry" value={company.industry} type="select" />
                  </div>
                </div>
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <Hash className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <EditableField label="URN" field="urn" value={company.urn} />
                  </div>
                </div>
                {(company.schoolCapacity !== null && company.schoolCapacity !== undefined) && (
                  <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                    <Users className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b]">Capacity</p>
                      <p className="text-[13px] font-medium text-white">{company.schoolCapacity?.toLocaleString()} pupils</p>
                    </div>
                  </div>
                )}
                {(company.pupilHeadcount !== null && company.pupilHeadcount !== undefined) && (
                  <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                    <Users className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b]">Headcount</p>
                      <p className="text-[13px] font-medium text-white">{company.pupilHeadcount?.toLocaleString()} pupils</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <Calendar className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <EditableField label="Decision Timeline" field="decisionTimeline" value={company.decisionTimeline} />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[#3d4254] my-2" />

              {/* Group 3: Sales */}
              <div className="space-y-0.5">
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <TrendingUp className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <EditableField label="Lead Status" field="budgetStatus" value={company.budgetStatus} type="select" />
                  </div>
                </div>
                <div className="flex items-start gap-2.5 py-2 border-b border-[#3d4254]/50">
                  <User className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <EditableField label="Company Owner" field="decisionMakerName" value={company.decisionMakerName} />
                  </div>
                </div>
                <div className="flex items-start gap-2.5 py-2">
                  <Clock className="h-3.5 w-3.5 text-[#64748b] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b]">Last Contacted</p>
                    <p className="text-[13px] font-medium text-white">
                      {company.lastContactDate ? (
                        formatDistanceToNow(new Date(company.lastContactDate), { addSuffix: true })
                      ) : (
                        <span className="text-muted-foreground font-normal">Never</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* CENTER AREA - Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <Tabs defaultValue="activities" className="flex-1 flex flex-col">
          <div className="bg-white dark:bg-[#252936] border-b dark:border-[#3d4254] px-6">
            <TabsList className="h-12 bg-transparent border-0 p-0 gap-6">
              <TabsTrigger
                value="about"
                className="h-12 border-b-2 border-transparent data-[state=active]:border-[#0091AE] data-[state=active]:bg-transparent data-[state=active]:text-[#0091AE] dark:text-[#94a3b8] dark:data-[state=active]:text-[#0091AE] rounded-none px-0 text-sm font-medium"
              >
                About
              </TabsTrigger>
              <TabsTrigger
                value="activities"
                className="h-12 border-b-2 border-transparent data-[state=active]:border-[#0091AE] data-[state=active]:bg-transparent data-[state=active]:text-[#0091AE] dark:text-[#94a3b8] dark:data-[state=active]:text-[#0091AE] rounded-none px-0 text-sm font-medium"
              >
                Activities
              </TabsTrigger>
              <TabsTrigger
                value="revenue"
                className="h-12 border-b-2 border-transparent data-[state=active]:border-[#0091AE] data-[state=active]:bg-transparent data-[state=active]:text-[#0091AE] dark:text-[#94a3b8] dark:data-[state=active]:text-[#0091AE] rounded-none px-0 text-sm font-medium"
              >
                Revenue
              </TabsTrigger>
              <TabsTrigger
                value="intelligence"
                className="h-12 border-b-2 border-transparent data-[state=active]:border-[#0091AE] data-[state=active]:bg-transparent data-[state=active]:text-[#0091AE] dark:text-[#94a3b8] dark:data-[state=active]:text-[#0091AE] rounded-none px-0 text-sm font-medium"
              >
                Intelligence
              </TabsTrigger>
            </TabsList>
          </div>

          {/* About Tab */}
          <TabsContent value="about" className="flex-1 overflow-auto m-0 p-6">
            <div className="max-w-2xl space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Company Details</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Name</p>
                    <p className="font-medium">{company.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Phone</p>
                    <p className="font-medium">{company.phone || "--"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Website</p>
                    <p className="font-medium">{company.website || "--"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Location</p>
                    <p className="font-medium">{company.location || "--"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Academy Trust</p>
                    <p className="font-medium">{company.academyTrustName || "--"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Created</p>
                    <p className="font-medium">{format(new Date(company.createdAt), "MMM d, yyyy")}</p>
                  </div>
                </CardContent>
              </Card>

              {company.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{company.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities" className="flex-1 flex flex-col overflow-hidden m-0">
            {/* Search and filters */}
            <div className="bg-white dark:bg-[#252936] border-b dark:border-[#3d4254] px-6 py-3">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search activities..."
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <div className="flex gap-1">
                  {[
                    { key: "all", label: "Activity" },
                    { key: "notes", label: "Notes" },
                    { key: "emails", label: "Emails" },
                    { key: "calls", label: "Calls" },
                    { key: "tasks", label: "Tasks" },
                    { key: "meetings", label: "Meetings" },
                  ].map((filter) => (
                    <Button
                      key={filter.key}
                      size="sm"
                      variant={activityFilter === filter.key ? "default" : "ghost"}
                      className={`h-8 px-3 text-xs ${
                        activityFilter === filter.key
                          ? "bg-[#0091AE] hover:bg-[#007a94] text-white"
                          : "dark:text-[#94a3b8] dark:hover:bg-[#2d3142]"
                      }`}
                      onClick={() => setActivityFilter(filter.key)}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Activity Timeline */}
            <ScrollArea className="flex-1">
              <div className="p-6">
                {activityFilter === "tasks" ? (
                  // Show tasks
                  <div className="space-y-3">
                    {(company.tasks || []).length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>No tasks yet</p>
                        <Button
                          className="mt-3 bg-[#0091AE] hover:bg-[#007a94]"
                          onClick={() => setShowAddTaskDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Task
                        </Button>
                      </div>
                    ) : (
                      company.tasks?.map((task) => (
                        <Card key={task.id} className={`dark:bg-[#252936] dark:border-[#3d4254] ${isTaskOverdue(task) ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30" : ""}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={task.status === "completed"}
                                onCheckedChange={() => {
                                  updateTaskMutation.mutate({
                                    id: task.id,
                                    status: task.status === "completed" ? "todo" : "completed",
                                  });
                                }}
                              />
                              <div className="flex-1">
                                <p className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                                  {task.name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge className={getPriorityColor(task.priority)} variant="secondary">
                                    {task.priority}
                                  </Badge>
                                  {task.dueDate && (
                                    <span className={`text-xs ${isTaskOverdue(task) ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                      Due {format(new Date(task.dueDate), "MMM d")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                onClick={() => deleteTaskMutation.mutate(task.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                ) : filteredActivities.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No activities found</p>
                    <p className="text-sm">Log a call or add a note to get started</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#3d4254] via-[#3d4254] to-transparent" />
                    <div className="space-y-3">
                      {filteredActivities.map((activity) => (
                        <div
                          key={activity.id}
                          className="relative pl-11"
                          data-testid={`card-activity-${activity.id}`}
                        >
                          <div className={`absolute left-2 top-5 h-5 w-5 rounded-full ${getActivityColor(activity.type)} flex items-center justify-center ring-4 ring-white dark:ring-[#1a1d29] shadow-sm`}>
                            <span className="text-white scale-75">{getActivityIcon(activity.type)}</span>
                          </div>
                          <Card className="group/activity hover:shadow-lg hover:shadow-black/10 hover:border-[#4d5264] transition-all duration-200 ease-in-out dark:bg-[#252936] dark:border-[#3d4254] rounded-xl">
                            <CardContent className="p-4 px-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    {activity.type === "call" ? (
                                      <Badge className="font-semibold text-[11px] bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/15 px-2.5 py-0.5">
                                        Call: {activity.outcome || "No Outcome"}
                                      </Badge>
                                    ) : (
                                      <>
                                        <Badge className={`font-semibold text-[11px] px-2.5 py-0.5 border ${
                                          activity.type === "email" ? "bg-purple-500/15 text-purple-400 border-purple-500/25 hover:bg-purple-500/15" :
                                          activity.type === "meeting" ? "bg-green-500/15 text-green-400 border-green-500/25 hover:bg-green-500/15" :
                                          activity.type === "follow_up" ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/25 hover:bg-cyan-500/15" :
                                          "bg-gray-500/15 text-gray-400 border-gray-500/25 hover:bg-gray-500/15"
                                        }`}>
                                          {getActivityLabel(activity.type)}
                                        </Badge>
                                        {activity.outcome && (
                                          <Badge variant="outline" className="text-[11px] dark:border-[#3d4254] dark:text-[#94a3b8]">{activity.outcome}</Badge>
                                        )}
                                      </>
                                    )}
                                    {activity.quoteValue && (
                                      <span className="text-sm font-medium text-emerald-600">
                                        £{parseFloat(activity.quoteValue).toLocaleString()}
                                      </span>
                                    )}
                                    {activity.editedAt && (
                                      <span
                                        className="text-[10px] text-[#64748b] italic cursor-default"
                                        title={`Last edited on ${format(new Date(activity.editedAt), "MMM d, yyyy 'at' h:mm a")}`}
                                      >
                                        (edited)
                                      </span>
                                    )}
                                  </div>
                                  {activity.note && (() => {
                                    const lines = activity.note.split('\n');
                                    const isLong = lines.length > 2 || activity.note.length > 150;
                                    const isExpanded = expandedActivities.has(activity.id);
                                    const displayText = isLong && !isExpanded
                                      ? activity.note.split('\n').slice(0, 2).join('\n').substring(0, 150) + (activity.note.length > 150 ? '...' : '')
                                      : activity.note;

                                    return (
                                      <div className="mt-2">
                                        <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-[#94a3b8]">
                                          {displayText}
                                        </p>
                                        {isLong && (
                                          <button
                                            className="text-xs text-[#0091AE] hover:text-[#06b6d4] mt-1 font-medium"
                                            onClick={() => {
                                              setExpandedActivities(prev => {
                                                const next = new Set(prev);
                                                if (isExpanded) next.delete(activity.id);
                                                else next.add(activity.id);
                                                return next;
                                              });
                                            }}
                                          >
                                            {isExpanded ? "Show less" : "Read more"}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  <div className="flex items-center gap-3 mt-2.5 text-[11px] text-[#64748b]">
                                    <span className="flex items-center gap-1.5">
                                      <Clock className="h-3 w-3 text-[#4d5264]" />
                                      {(() => {
                                        const activityDate = new Date(activity.createdAt);
                                        const now = new Date();
                                        const diffHours = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60);
                                        if (diffHours < 24) {
                                          return formatDistanceToNow(activityDate, { addSuffix: true });
                                        }
                                        return format(activityDate, "MMM d, yyyy 'at' h:mm a");
                                      })()}
                                    </span>
                                    {activity.loggedBy && (
                                      <span className="flex items-center gap-1">
                                        <User className="h-3 w-3 text-[#4d5264]" />
                                        {activity.loggedBy}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {(activity.type === "call" || activity.type === "follow_up" || activity.type === "email" || activity.type === "meeting") && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-muted-foreground opacity-20 group-hover/activity:opacity-100 hover:text-[#0091AE] transition-all duration-200 ease-in-out"
                                      onClick={() => openEditActivity(activity)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground opacity-20 group-hover/activity:opacity-100 hover:text-red-600 transition-all duration-200 ease-in-out"
                                    onClick={() => openDeleteActivity(activity)}
                                    data-testid={`button-delete-activity-${activity.id}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="flex-1 overflow-auto m-0 p-6">
            <div className="max-w-4xl space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total Pipeline</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      £{totalExpectedGP.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Active Deals</p>
                    <p className="text-2xl font-bold">{company.deals?.length || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Last Quote</p>
                    <p className="text-2xl font-bold">
                      {company.lastQuoteValue ? `£${parseFloat(company.lastQuoteValue).toLocaleString()}` : "--"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Deals</CardTitle>
                  <Button size="sm" onClick={openAddDeal} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Deal
                  </Button>
                </CardHeader>
                <CardContent>
                  {(company.deals?.length || 0) === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No deals yet</p>
                  ) : (
                    <div className="space-y-3">
                      {company.deals?.map((deal) => (
                        <div
                          key={deal.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                        >
                          <div>
                            <p className="font-medium">{deal.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {deal.stage && (
                                <Badge style={{ backgroundColor: deal.stage.color, color: "white" }}>
                                  {deal.stage.name}
                                </Badge>
                              )}
                              {deal.expectedGP && (
                                <span className="text-sm text-emerald-600 font-medium">
                                  £{parseFloat(deal.expectedGP).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditDeal(deal)}
                              className="h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setDealToDelete(deal);
                                setShowDeleteDealDialog(true);
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Intelligence Tab */}
          <TabsContent value="intelligence" className="flex-1 overflow-auto m-0 p-6">
            <div className="max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Company Intelligence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Decision Maker</p>
                      <p className="font-medium">{company.decisionMakerName || "--"}</p>
                      {company.decisionMakerRole && (
                        <p className="text-xs text-muted-foreground">{company.decisionMakerRole}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Lead Status</p>
                      {getLeadStatusBadge(company.budgetStatus)}
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Buyer Score</p>
                      <p className="font-medium">{company.buyerHonestyScore || "--"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Trade-in Interest</p>
                      <p className="font-medium">{company.tradeInInterest ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Next Budget Cycle</p>
                      <p className="font-medium">
                        {company.nextBudgetCycle
                          ? format(new Date(company.nextBudgetCycle), "MMM yyyy")
                          : "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Total Activities</p>
                      <p className="font-medium">{company.activities?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="w-80 bg-white dark:bg-[#252936] border-l dark:border-[#3d4254] flex flex-col overflow-hidden shadow-[-2px_0_8px_rgba(0,0,0,0.05)]">
        <ScrollArea className="flex-1">
          {/* Contacts Section */}
          <CollapsibleSection
            title="Contacts"
            count={company.contacts?.length || 0}
            icon={Users}
            onAdd={() => setShowAddContactDialog(true)}
          >
            {(company.contacts?.length || 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No contacts</p>
            ) : (
              <div className="space-y-2">
                {company.contacts?.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-3 border dark:border-[#3d4254] rounded-xl hover:bg-[#2d3142]/60 hover:border-[#4d5264] group transition-all duration-200 cursor-default"
                    data-testid={`card-contact-${contact.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-[#0091AE]/15 flex items-center justify-center">
                          <User className="h-4 w-4 text-[#0091AE]" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{contact.title ? `${contact.title} ` : ""}{contact.name || contact.email}</p>
                          {contact.role && (
                            <p className="text-xs text-muted-foreground">{contact.role}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600"
                        onClick={() => deleteContactMutation.mutate(contact.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="mt-2 space-y-1">
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </a>
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Related Companies Section */}
          <CollapsibleSection
            title="Related Companies"
            count={company.relationships?.length || 0}
            icon={Building}
            onAdd={() => setShowAddRelationshipDialog(true)}
            defaultOpen={true}
          >
            {(company.relationships?.length || 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No related companies</p>
            ) : (
              <div className="space-y-2">
                {company.relationships?.map((rel) => (
                  <div
                    key={rel.id}
                    className="p-3 border dark:border-[#3d4254] rounded-xl hover:bg-[#2d3142]/60 hover:border-[#4d5264] group transition-all duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <Link href={`/company/${rel.relatedCompany.id}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="h-8 w-8 rounded-md bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                          <Building className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-[#0091AE] hover:underline truncate">{rel.relatedCompany.name}</p>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-0.5 dark:bg-[#3d4254]">{rel.relationshipType}</Badge>
                        </div>
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600"
                        onClick={() => {
                          apiRequest("DELETE", `/api/company-relationships/${rel.id}`).then(() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
                            toast({ title: "Relationship removed" });
                          });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {rel.notes && (
                      <p className="text-xs text-muted-foreground mt-1 pl-[42px] line-clamp-2">{rel.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Deals Section */}
          <CollapsibleSection
            title="Deals"
            count={company.deals?.length || 0}
            icon={Briefcase}
          >
            {(company.deals?.length || 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <div className="w-12 h-12 rounded-full bg-[#3d4254] flex items-center justify-center mb-3">
                  <DollarSign className="h-6 w-6 text-[#64748b]" />
                </div>
                <p className="text-sm text-[#94a3b8] text-center mb-1">No deals yet.</p>
                <p className="text-xs text-[#64748b] text-center mb-4">Create your first deal to track revenue opportunities.</p>
                <Button
                  size="sm"
                  className="bg-[#0091AE] hover:bg-[#007a94] text-white font-medium shadow-sm"
                  onClick={openAddDeal}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Deal
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {company.deals?.map((deal) => {
                  const stageName = deal.stage?.name || "";
                  const isClosedWon = stageName === "Closed Won";
                  const isClosedLost = stageName === "Closed Lost";
                  const stageBadgeClass = isClosedWon
                    ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/30"
                    : isClosedLost
                    ? "bg-red-600/20 text-red-400 border border-red-600/30"
                    : "bg-blue-600/20 text-blue-400 border border-blue-600/30";

                  return (
                    <div
                      key={deal.id}
                      className="bg-[#2d3142] border border-[#3d4254] rounded-md p-4 cursor-pointer group relative hover:bg-[#353849] hover:shadow-lg hover:shadow-black/10 transition-all duration-200"
                      onClick={() => openEditDeal(deal)}
                      data-testid={`card-deal-${deal.id}`}
                    >
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 text-[#64748b] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDealToDelete(deal);
                          setShowDeleteDealDialog(true);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-md bg-[#3d4254] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <DollarSign className="h-4 w-4 text-[#10b981]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-white truncate pr-6">{deal.title}</p>
                          {deal.expectedGP && (
                            <p className="text-base font-bold text-[#10b981] mt-0.5">
                              £{parseFloat(deal.expectedGP).toLocaleString()}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {deal.stage && (
                              <Badge className={`text-[11px] h-5 px-2 font-medium ${stageBadgeClass}`}>
                                {deal.stage.name}
                              </Badge>
                            )}
                            {deal.decisionTimeline && (
                              <span className="text-[11px] text-[#64748b] flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(deal.decisionTimeline), "MMM d, yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button
                  size="sm"
                  className="w-full bg-[#0091AE] hover:bg-[#007a94] text-white font-medium shadow-sm mt-2 rounded-lg transition-all duration-200 hover:shadow-md hover:shadow-[#0091AE]/10"
                  onClick={openAddDeal}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Deal
                </Button>
              </div>
            )}
          </CollapsibleSection>

          {/* Tasks Section */}
          <CollapsibleSection
            title="Tasks"
            count={activeTasks.length}
            icon={CheckCircle2}
            onAdd={() => setShowAddTaskDialog(true)}
          >
            {activeTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active tasks</p>
            ) : (
              <div className="space-y-2">
                {activeTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className={`p-2.5 border rounded-xl text-sm transition-all duration-200 hover:bg-[#2d3142]/60 ${
                      isTaskOverdue(task) ? "border-red-500/30 bg-red-950/20 dark:border-red-500/30 dark:bg-red-950/20" : "dark:border-[#3d4254] hover:border-[#4d5264]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={task.status === "completed"}
                        onCheckedChange={() => {
                          updateTaskMutation.mutate({
                            id: task.id,
                            status: task.status === "completed" ? "todo" : "completed",
                          });
                        }}
                        className="h-4 w-4"
                      />
                      <span className={isTaskOverdue(task) ? "text-red-600" : ""}>
                        {task.name}
                      </span>
                    </div>
                    {task.dueDate && (
                      <p className={`text-xs ml-6 mt-0.5 ${
                        isTaskOverdue(task) ? "text-red-600" : "text-muted-foreground"
                      }`}>
                        Due {format(new Date(task.dueDate), "MMM d")}
                      </p>
                    )}
                  </div>
                ))}
                {activeTasks.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => setActivityFilter("tasks")}
                  >
                    View all {activeTasks.length} tasks
                  </Button>
                )}
              </div>
            )}
          </CollapsibleSection>

          {/* Tickets Section (Placeholder) */}
          <CollapsibleSection
            title="Tickets"
            count={0}
            icon={Ticket}
            defaultOpen={false}
          >
            <p className="text-sm text-muted-foreground text-center py-4">No tickets</p>
          </CollapsibleSection>

          {/* Attachments Section (Placeholder) */}
          <CollapsibleSection
            title="Attachments"
            count={0}
            icon={Paperclip}
            defaultOpen={false}
          >
            <p className="text-sm text-muted-foreground text-center py-4">No attachments</p>
          </CollapsibleSection>
        </ScrollArea>
      </div>

      {/* DIALOGS */}

      {/* Add Task Dialog */}
      <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <Form {...taskForm}>
            <form onSubmit={taskForm.handleSubmit((data) => addTaskMutation.mutate(data))} className="space-y-4">
              <FormField
                control={taskForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Description</FormLabel>
                    <FormControl>
                      <Input placeholder="What needs to be done?" data-testid="input-task-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={taskForm.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" data-testid="input-task-due-date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={taskForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-task-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddTaskDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={addTaskMutation.isPending}>
                  Add Task
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Log Call Dialog */}
      <Dialog open={showLogCallDialog} onOpenChange={setShowLogCallDialog}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Log Call</DialogTitle>
          </DialogHeader>
          <Form {...logCallForm}>
            <form onSubmit={logCallForm.handleSubmit((data) => logCallMutation.mutate(data))} className="space-y-4">
              <FormField
                control={logCallForm.control}
                name="callDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-[#94a3b8]">Date / Time</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={logCallForm.control}
                name="outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-[#94a3b8]">Outcome</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-call-outcome" className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                          <SelectValue placeholder="Select outcome" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                        <SelectItem value="Reception / Voicemail" className="dark:text-white dark:focus:bg-[#2d3142]">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                            Reception / Voicemail
                          </span>
                        </SelectItem>
                        <SelectItem value="Decision Maker Details" className="dark:text-white dark:focus:bg-[#2d3142]">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[#0091AE]" />
                            Decision Maker Details
                          </span>
                        </SelectItem>
                        <SelectItem value="Connected to DM" className="dark:text-white dark:focus:bg-[#2d3142]">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[#10b981]" />
                            Connected to DM
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={logCallForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-[#94a3b8]">Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Call notes and details..."
                        className="min-h-[120px] dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder-[#64748b]"
                        data-testid="input-call-note"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowLogCallDialog(false)} className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]">
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#0091AE] hover:bg-[#007a94] text-white" disabled={logCallMutation.isPending}>
                  {logCallMutation.isPending ? "Saving..." : "Save Call Log"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showAddNoteDialog} onOpenChange={setShowAddNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <Form {...addNoteForm}>
            <form onSubmit={addNoteForm.handleSubmit((data) => addNoteMutation.mutate(data))} className="space-y-4">
              <div className="text-sm text-muted-foreground bg-gray-50 dark:bg-muted p-3 rounded-md">
                <Clock className="inline h-4 w-4 mr-1" />
                {format(new Date(), "MMM d, yyyy 'at' h:mm a")}
              </div>
              <FormField
                control={addNoteForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add your note..."
                        className="min-h-[120px]"
                        data-testid="input-note-content"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddNoteDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={addNoteMutation.isPending}>
                  Add Note
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Email Dialog */}
      <Dialog open={showAddEmailDialog} onOpenChange={setShowAddEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Email</DialogTitle>
          </DialogHeader>
          <Form {...addEmailForm}>
            <form onSubmit={addEmailForm.handleSubmit((data) => addEmailMutation.mutate(data))} className="space-y-4">
              <FormField
                control={addEmailForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Email subject..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addEmailForm.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Body</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Email content..."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddEmailDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={addEmailMutation.isPending}>
                  Log Email
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Meeting Dialog */}
      <Dialog open={showAddMeetingDialog} onOpenChange={setShowAddMeetingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Meeting</DialogTitle>
          </DialogHeader>
          <Form {...addMeetingForm}>
            <form onSubmit={addMeetingForm.handleSubmit((data) => addMeetingMutation.mutate(data))} className="space-y-4">
              <FormField
                control={addMeetingForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Meeting title..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addMeetingForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Meeting notes..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddMeetingDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={addMeetingMutation.isPending}>
                  Log Meeting
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContactDialog} onOpenChange={setShowAddContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit((data) => addContactMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <FormField
                  control={contactForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-contact-title">
                            <SelectValue placeholder="--" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">--</SelectItem>
                          {TITLE_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact name" data-testid="input-contact-name" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Headteacher" data-testid="input-contact-role" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={contactForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input placeholder="email@school.edu" data-testid="input-contact-email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone number" data-testid="input-contact-phone" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddContactDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={addContactMutation.isPending}>
                  Add Contact
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Company Confirmation Dialog */}
      <AlertDialog open={showDeleteCompanyDialog} onOpenChange={(open) => {
        setShowDeleteCompanyDialog(open);
        if (!open) setDeleteCompanyConfirmName("");
      }}>
        <AlertDialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Delete {company.name}?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-[#94a3b8]">
              This will permanently delete this company and all associated contacts, deals, tasks, and activity history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium dark:text-[#94a3b8]">
              Type the company name to confirm
            </label>
            <Input
              value={deleteCompanyConfirmName}
              onChange={(e) => setDeleteCompanyConfirmName(e.target.value)}
              placeholder={company.name}
              className="mt-2 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder-[#64748b]"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteCompanyConfirmName !== company.name || deleteCompanyMutation.isPending}
              onClick={() => deleteCompanyMutation.mutate(company.id)}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-600 dark:hover:bg-red-700"
            >
              {deleteCompanyMutation.isPending ? "Deleting..." : "Delete Company"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Deal Confirmation Dialog */}
      <AlertDialog open={showDeleteDealDialog} onOpenChange={(open) => {
        setShowDeleteDealDialog(open);
        if (!open) setDealToDelete(null);
      }}>
        <AlertDialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Delete this deal?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-[#94a3b8]">
              This will permanently remove this deal from the pipeline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteDealMutation.isPending}
              onClick={() => dealToDelete && deleteDealMutation.mutate(dealToDelete.id)}
              className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700"
            >
              {deleteDealMutation.isPending ? "Deleting..." : "Delete Deal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Deal Dialog */}
      <Dialog open={showDealDialog} onOpenChange={(open) => {
        setShowDealDialog(open);
        if (!open) setEditingDeal(null);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingDeal ? "Edit Deal" : "Add Deal"}
            </DialogTitle>
          </DialogHeader>
          <Form {...dealForm}>
            <form onSubmit={dealForm.handleSubmit(handleDealSubmit)} className="space-y-4">
              <FormField
                control={dealForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Title *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Laptop Refresh, Server Upgrade"
                        {...field}
                        data-testid="input-deal-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={dealForm.control}
                name="stageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pipeline Stage *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-deal-stage">
                          <SelectValue placeholder="Select a stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={dealForm.control}
                name="expectedGP"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected GP (£)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g. 5000"
                        {...field}
                        data-testid="input-deal-gp"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={dealForm.control}
                name="budgetStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-deal-budget">
                          <SelectValue placeholder="Select budget status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="indicative">Indicative</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={dealForm.control}
                name="decisionTimeline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Decision Timeline</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-deal-timeline"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={dealForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any notes about this deal..."
                        className="min-h-[80px]"
                        {...field}
                        data-testid="textarea-deal-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDealDialog(false);
                    setEditingDeal(null);
                  }}
                  data-testid="button-cancel-deal"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={addDealMutation.isPending || updateDealMutation.isPending}
                  data-testid="button-save-deal"
                >
                  {addDealMutation.isPending || updateDealMutation.isPending ? "Saving..." : (editingDeal ? "Update Deal" : "Add Deal")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Activity Dialog */}
      <Dialog open={showEditActivityDialog} onOpenChange={(open) => {
        setShowEditActivityDialog(open);
        if (!open) setEditingActivity(null);
      }}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <DialogHeader>
            <DialogTitle className="dark:text-white">
              {editingActivity?.type === "call" ? "Edit Call Log" : editingActivity?.type === "follow_up" ? "Edit Note" : `Edit ${editingActivity?.type === "email" ? "Email" : "Meeting"}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-[#94a3b8]">Date / Time</label>
              <Input
                type="datetime-local"
                value={editActivityDate}
                onChange={(e) => setEditActivityDate(e.target.value)}
                className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white"
              />
            </div>
            {(editingActivity?.type === "call") && (
              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-[#94a3b8]">Outcome</label>
                <Select value={editActivityOutcome} onValueChange={setEditActivityOutcome}>
                  <SelectTrigger className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                    <SelectItem value="Reception / Voicemail" className="dark:text-white dark:focus:bg-[#2d3142]">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                        Reception / Voicemail
                      </span>
                    </SelectItem>
                    <SelectItem value="Decision Maker Details" className="dark:text-white dark:focus:bg-[#2d3142]">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#0091AE]" />
                        Decision Maker Details
                      </span>
                    </SelectItem>
                    <SelectItem value="Connected to DM" className="dark:text-white dark:focus:bg-[#2d3142]">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#10b981]" />
                        Connected to DM
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-[#94a3b8]">Notes</label>
              <Textarea
                value={editActivityNote}
                onChange={(e) => setEditActivityNote(e.target.value)}
                placeholder="Notes and details..."
                className={`dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder-[#64748b] ${
                  editingActivity?.type === "follow_up" ? "min-h-[180px]" : "min-h-[120px]"
                }`}
              />
            </div>
            {/* Metadata */}
            <div className="text-xs text-[#64748b] space-y-1 pt-2 border-t dark:border-[#3d4254]">
              {editingActivity && (
                <p>
                  Created {editingActivity.loggedBy ? `by ${editingActivity.loggedBy} ` : ""}on{" "}
                  {format(new Date(editingActivity.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              )}
              {editingActivity?.editedAt && (
                <p>Last edited on {format(new Date(editingActivity.editedAt), "MMM d, yyyy 'at' h:mm a")}</p>
              )}
            </div>
          </div>
          <DialogFooter className="flex !justify-between items-center">
            <Button
              type="button"
              variant="ghost"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => {
                if (editingActivity) {
                  setShowEditActivityDialog(false);
                  openDeleteActivity(editingActivity);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {editingActivity?.type === "call" ? "Delete Call Log" : "Delete Note"}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditActivityDialog(false)}
                className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]"
              >
                Cancel
              </Button>
              <Button
                className="bg-[#0091AE] hover:bg-[#007a94] text-white"
                disabled={editActivityMutation.isPending}
                onClick={() => {
                  if (!editingActivity) return;
                  editActivityMutation.mutate({
                    id: editingActivity.id,
                    data: {
                      note: editActivityNote || undefined,
                      outcome: editingActivity.type === "call" ? editActivityOutcome || undefined : undefined,
                      createdAt: editActivityDate ? new Date(editActivityDate).toISOString() : undefined,
                    },
                  });
                }}
              >
                {editActivityMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Activity Confirmation Dialog */}
      <AlertDialog open={showDeleteActivityDialog} onOpenChange={(open) => {
        setShowDeleteActivityDialog(open);
        if (!open) setActivityToDelete(null);
      }}>
        <AlertDialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">
              {activityToDelete?.type === "call" ? "Delete this call log?" : "Delete this note?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-[#94a3b8]">
              This will permanently remove this {activityToDelete?.type === "call" ? "call activity" : "note"} from the timeline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteActivityMutation.isPending}
              onClick={() => activityToDelete && deleteActivityMutation.mutate(activityToDelete.id)}
              className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700"
            >
              {deleteActivityMutation.isPending ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link Schools Dialog (for trust companies) */}
      <Dialog open={showLinkSchoolsDialog} onOpenChange={(open) => {
        setShowLinkSchoolsDialog(open);
        if (!open) { setSelectedSchoolIds(new Set()); setLinkSchoolSearch(""); }
      }}>
        <DialogContent className="sm:max-w-[500px] dark:bg-[#252936] dark:border-[#3d4254]">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Add Schools to Trust</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search schools..."
                value={linkSchoolSearch}
                onChange={(e) => setLinkSchoolSearch(e.target.value)}
                className="pl-10 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {allCompanies
                ?.filter(c => c.id !== params.id)
                .filter(c => !linkSchoolSearch || c.name.toLowerCase().includes(linkSchoolSearch.toLowerCase()))
                .slice(0, 50)
                .map(c => (
                  <label key={c.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-[#2d3142] cursor-pointer">
                    <Checkbox
                      checked={selectedSchoolIds.has(c.id)}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedSchoolIds);
                        if (checked) newSet.add(c.id); else newSet.delete(c.id);
                        setSelectedSchoolIds(newSet);
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium dark:text-white">{c.name}</p>
                      {c.location && <p className="text-xs text-muted-foreground">{c.location}</p>}
                    </div>
                  </label>
                ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkSchoolsDialog(false)} className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white">Cancel</Button>
            <Button
              className="bg-[#0091AE] hover:bg-[#007a94] text-white"
              disabled={selectedSchoolIds.size === 0}
              onClick={async () => {
                try {
                  for (const schoolId of Array.from(selectedSchoolIds)) {
                    await apiRequest("POST", `/api/companies/${params.id}/relationships`, {
                      relatedCompanyId: schoolId,
                      relationshipType: "Part of Trust",
                    });
                  }
                  queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
                  setShowLinkSchoolsDialog(false);
                  setSelectedSchoolIds(new Set());
                  setLinkSchoolSearch("");
                  toast({ title: `${selectedSchoolIds.size} school(s) linked` });
                } catch {
                  toast({ title: "Failed to link schools", variant: "destructive" });
                }
              }}
            >
              Link {selectedSchoolIds.size} School{selectedSchoolIds.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Related Company Dialog */}
      <Dialog open={showAddRelationshipDialog} onOpenChange={(open) => {
        setShowAddRelationshipDialog(open);
        if (!open) { setSelectedRelCompanyId(""); setSelectedRelType(""); setRelNotes(""); setRelationshipCompanySearch(""); }
      }}>
        <DialogContent className="sm:max-w-[500px] dark:bg-[#252936] dark:border-[#3d4254]">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Add Related Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8] mb-2 block">Company</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search companies..."
                  value={relationshipCompanySearch}
                  onChange={(e) => setRelationshipCompanySearch(e.target.value)}
                  className="pl-10 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white"
                />
              </div>
              {relationshipCompanySearch && (
                <div className="max-h-[200px] overflow-y-auto mt-1 border dark:border-[#3d4254] rounded-md">
                  {allCompanies
                    ?.filter(c => c.id !== params.id && c.name.toLowerCase().includes(relationshipCompanySearch.toLowerCase()))
                    .slice(0, 20)
                    .map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedRelCompanyId(c.id); setRelationshipCompanySearch(c.name); }}
                        className={`w-full text-left px-3 py-2 hover:bg-[#2d3142] text-sm ${selectedRelCompanyId === c.id ? "bg-[#0091AE]/20 text-[#0091AE]" : "dark:text-white"}`}
                      >
                        {c.name}
                        {c.location && <span className="text-xs text-muted-foreground ml-2">{c.location}</span>}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8] mb-2 block">Relationship Type</label>
              <Select value={selectedRelType} onValueChange={setSelectedRelType}>
                <SelectTrigger className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {["Part of Trust", "Sister School", "Feeder School", "Partner Organization", "Supplier", "Parent Organization", "Diocese/Regional Authority", "Shared Services", "Other"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium dark:text-[#94a3b8] mb-2 block">Notes (optional)</label>
              <Textarea
                value={relNotes}
                onChange={(e) => setRelNotes(e.target.value)}
                placeholder="Add notes about this relationship..."
                className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRelationshipDialog(false)} className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white">Cancel</Button>
            <Button
              className="bg-[#0091AE] hover:bg-[#007a94] text-white"
              disabled={!selectedRelCompanyId || !selectedRelType}
              onClick={() => {
                apiRequest("POST", `/api/companies/${params.id}/relationships`, {
                  relatedCompanyId: selectedRelCompanyId,
                  relationshipType: selectedRelType,
                  notes: relNotes || null,
                }).then(() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
                  setShowAddRelationshipDialog(false);
                  setSelectedRelCompanyId("");
                  setSelectedRelType("");
                  setRelNotes("");
                  setRelationshipCompanySearch("");
                  toast({ title: "Relationship added" });
                });
              }}
            >
              Add Relationship
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
