import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import type { CompanyWithRelations, PipelineStage, Task, Activity, DealWithStage, Contact } from "@shared/schema";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  Users, Ticket, Paperclip, Building, CheckCircle2
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

const addContactSchema = z.object({
  email: z.string().email("Valid email is required"),
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
  budgetStatus: z.string().optional(),
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
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{title}</span>
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
            {count}
          </Badge>
        </div>
        {onAdd && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
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
        <div className="px-4 pb-4">
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

  // Key information inline editing
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  // Activity filters
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [activitySearch, setActivitySearch] = useState("");

  const { data: company, isLoading } = useQuery<CompanyWithRelations>({
    queryKey: ["/api/companies", params.id],
  });

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const taskForm = useForm<z.infer<typeof addTaskSchema>>({
    resolver: zodResolver(addTaskSchema),
    defaultValues: { name: "", dueDate: "", priority: "medium", taskType: "general" },
  });

  const logCallForm = useForm<z.infer<typeof logCallSchema>>({
    resolver: zodResolver(logCallSchema),
    defaultValues: { note: "", outcome: "" },
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
    defaultValues: { email: "", name: "", phone: "", role: "" },
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
    onSuccess: () => {
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
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/today"] });
      logCallForm.reset();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      toast({ title: "Activity removed" });
    },
  });

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
      toast({ title: "Deal removed" });
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
        <div className="w-64 p-6 border-r">
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
    { value: "0-unqualified", label: "0 - Unqualified", color: "bg-gray-100 text-gray-700" },
    { value: "1-qualified", label: "1 - Qualified", color: "bg-blue-100 text-blue-700" },
    { value: "2-intent", label: "2 - Intent", color: "bg-purple-100 text-purple-700" },
    { value: "3-quote-presented", label: "3 - Quote Presented", color: "bg-amber-100 text-amber-700" },
    { value: "3b-quoted-lost", label: "3b - Quoted Lost", color: "bg-red-100 text-red-700" },
    { value: "4-account-active", label: "4 - Account Active", color: "bg-green-100 text-green-700" },
  ];

  const getLeadStatusBadge = (status: string | null) => {
    if (!status) {
      // Default to Unqualified for display
      return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">0 - Unqualified</Badge>;
    }
    const option = leadStatusOptions.find(opt => opt.value === status);
    if (option) {
      return <Badge className={`${option.color} hover:${option.color}`}>{option.label}</Badge>;
    }
    // Fallback for old values
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
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="flex items-center gap-1">
            {type === "select" && field === "budgetStatus" ? (
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
                        <span className={`h-2 w-2 rounded-full ${option.color.split(' ')[0]}`} />
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
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveField(field)}>
                  <Save className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEditing}>
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
        className="space-y-1 cursor-pointer hover:bg-muted/50 rounded p-1.5 -mx-1.5 transition-colors group"
        onClick={() => startEditing(field, value || "")}
      >
        <p className="text-xs text-muted-foreground flex items-center justify-between">
          {label}
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50" />
        </p>
        <p className="text-sm font-medium">
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
    <div className="flex h-screen bg-gray-50 dark:bg-background">
      {/* LEFT SIDEBAR - ~250px */}
      <div className="w-64 bg-white dark:bg-card border-r flex flex-col">
        {/* Back button */}
        <div className="p-4 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/companies")}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 -ml-2"
            data-testid="button-back-to-companies"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Schools
          </Button>
        </div>

        {/* Company name and quick actions */}
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold mb-1" data-testid="text-company-detail-name">
            {company.name}
          </h1>
          {totalExpectedGP > 0 && (
            <p className="text-xs text-emerald-600 font-medium mb-3">
              Pipeline: £{totalExpectedGP.toLocaleString()}
            </p>
          )}

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs"
              onClick={() => setShowAddNoteDialog(true)}
              data-testid="button-add-note"
            >
              <StickyNote className="h-3.5 w-3.5 mr-1" />
              Note
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs"
              onClick={() => setShowAddEmailDialog(true)}
            >
              <Mail className="h-3.5 w-3.5 mr-1" />
              Email
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs"
              onClick={() => setShowLogCallDialog(true)}
              data-testid="button-log-call"
            >
              <Phone className="h-3.5 w-3.5 mr-1" />
              Call
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs"
              onClick={() => setShowAddTaskDialog(true)}
              data-testid="button-add-task"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Task
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs"
              onClick={() => setShowAddMeetingDialog(true)}
            >
              <Video className="h-3.5 w-3.5 mr-1" />
              Meeting
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openAddDeal}>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Add Deal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAddContactDialog(true)}>
                  <User className="h-4 w-4 mr-2" />
                  Add Contact
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Key Information */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Key Information
            </h3>
            <div className="space-y-3">
              <EditableField label="Company Owner" field="decisionMakerName" value={company.decisionMakerName} />
              <EditableField label="Lead Status" field="budgetStatus" value={company.budgetStatus} type="select" />
              <EditableField label="Type" field="academyTrustName" value={company.academyTrustName} />
              <EditableField label="Lifecycle Stage" field="decisionTimeline" value={company.decisionTimeline} />

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Last Contacted</p>
                <p className="text-sm font-medium">
                  {company.lastContactDate ? (
                    formatDistanceToNow(new Date(company.lastContactDate), { addSuffix: true })
                  ) : (
                    <span className="text-muted-foreground font-normal">Never</span>
                  )}
                </p>
              </div>

              <div className="pt-2 border-t">
                <EditableField label="Phone" field="phone" value={company.phone} />
                {company.phone && (
                  <a
                    href={`tel:${company.phone}`}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                  >
                    <Phone className="h-3 w-3" />
                    Click to call
                  </a>
                )}
              </div>

              <EditableField label="Extension" field="ext" value={company.ext} />

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Website</p>
                {company.website ? (
                  <a
                    href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                    data-testid="link-company-website"
                  >
                    {company.website.replace(/^https?:\/\//, "").slice(0, 25)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 rounded p-1 -mx-1"
                    onClick={() => startEditing("website", "")}>
                    --
                  </p>
                )}
              </div>

              <EditableField label="Location" field="location" value={company.location} />
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* CENTER AREA - Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <Tabs defaultValue="activities" className="flex-1 flex flex-col">
          <div className="bg-white dark:bg-card border-b px-6">
            <TabsList className="h-12 bg-transparent border-0 p-0 gap-6">
              <TabsTrigger
                value="about"
                className="h-12 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-medium"
              >
                About
              </TabsTrigger>
              <TabsTrigger
                value="activities"
                className="h-12 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-medium"
              >
                Activities
              </TabsTrigger>
              <TabsTrigger
                value="revenue"
                className="h-12 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-medium"
              >
                Revenue
              </TabsTrigger>
              <TabsTrigger
                value="intelligence"
                className="h-12 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-medium"
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
            <div className="bg-white dark:bg-card border-b px-6 py-3">
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
                          ? "bg-blue-600 hover:bg-blue-700"
                          : ""
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
                          className="mt-3 bg-blue-600 hover:bg-blue-700"
                          onClick={() => setShowAddTaskDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Task
                        </Button>
                      </div>
                    ) : (
                      company.tasks?.map((task) => (
                        <Card key={task.id} className={`${isTaskOverdue(task) ? "border-red-200 bg-red-50/50" : ""}`}>
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
                    <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
                    <div className="space-y-4">
                      {filteredActivities.map((activity) => (
                        <div
                          key={activity.id}
                          className="relative pl-10"
                          data-testid={`card-activity-${activity.id}`}
                        >
                          <div className={`absolute left-2 top-4 h-5 w-5 rounded-full ${getActivityColor(activity.type)} flex items-center justify-center ring-4 ring-white dark:ring-gray-900`}>
                            <span className="text-white scale-75">{getActivityIcon(activity.type)}</span>
                          </div>
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="secondary" className="font-medium">
                                      {getActivityLabel(activity.type)}
                                    </Badge>
                                    {activity.outcome && (
                                      <Badge variant="outline">{activity.outcome}</Badge>
                                    )}
                                    {activity.quoteValue && (
                                      <span className="text-sm font-medium text-emerald-600">
                                        £{parseFloat(activity.quoteValue).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                  {activity.note && (
                                    <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300 mt-2">
                                      {activity.note}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {format(new Date(activity.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                    </span>
                                    {activity.loggedBy && (
                                      <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {activity.loggedBy}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                  onClick={() => deleteActivityMutation.mutate(activity.id)}
                                  data-testid={`button-delete-activity-${activity.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
                              onClick={() => deleteDealMutation.mutate(deal.id)}
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

      {/* RIGHT SIDEBAR - ~350px */}
      <div className="w-80 bg-white dark:bg-card border-l flex flex-col overflow-hidden">
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
                    className="p-3 border rounded-lg hover:bg-muted/50 group"
                    data-testid={`card-contact-${contact.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{contact.name || contact.email}</p>
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

          {/* Deals Section */}
          <CollapsibleSection
            title="Deals"
            count={company.deals?.length || 0}
            icon={Briefcase}
            onAdd={openAddDeal}
          >
            {(company.deals?.length || 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No deals</p>
            ) : (
              <div className="space-y-2">
                {company.deals?.map((deal) => (
                  <div
                    key={deal.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer group"
                    onClick={() => openEditDeal(deal)}
                    data-testid={`card-deal-${deal.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{deal.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {deal.stage && (
                            <Badge
                              className="text-xs h-5"
                              style={{ backgroundColor: deal.stage.color, color: "white" }}
                            >
                              {deal.stage.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {deal.expectedGP && (
                        <span className="text-sm font-medium text-emerald-600">
                          £{parseFloat(deal.expectedGP).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
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
                    className={`p-2 border rounded-lg text-sm ${
                      isTaskOverdue(task) ? "border-red-200 bg-red-50/50" : ""
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

          {/* Companies Section (Related) */}
          <CollapsibleSection
            title="Companies"
            count={0}
            icon={Building}
            defaultOpen={false}
          >
            <p className="text-sm text-muted-foreground text-center py-4">No related companies</p>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Call</DialogTitle>
          </DialogHeader>
          <Form {...logCallForm}>
            <form onSubmit={logCallForm.handleSubmit((data) => logCallMutation.mutate(data))} className="space-y-4">
              <div className="text-sm text-muted-foreground bg-gray-50 dark:bg-muted p-3 rounded-md">
                <Clock className="inline h-4 w-4 mr-1" />
                {format(new Date(), "MMM d, yyyy 'at' h:mm a")}
              </div>
              <FormField
                control={logCallForm.control}
                name="outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outcome</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-call-outcome">
                          <SelectValue placeholder="Select outcome" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="answered">Answered</SelectItem>
                        <SelectItem value="voicemail">Voicemail</SelectItem>
                        <SelectItem value="no_answer">No Answer</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="wrong_number">Wrong Number</SelectItem>
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
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add call notes..."
                        className="min-h-[100px]"
                        data-testid="input-call-note"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowLogCallDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={logCallMutation.isPending}>
                  Log Call
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={contactForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
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
                      <FormLabel>Role</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. IT Manager" data-testid="input-contact-role" {...field} />
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
    </div>
  );
}
