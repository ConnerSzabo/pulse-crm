import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation, Link } from "wouter";
import type { ContactWithCompany, Company, Activity, Task, DealWithStage } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Phone, Mail, User, Plus, Trash2, Clock,
  Building2, ExternalLink, FileText, Calendar, MessageSquare,
  Pencil, X, Save, StickyNote, Briefcase, ChevronDown,
  ChevronRight, MoreHorizontal, Video, Search, Users,
  ArrowUpRight, CheckSquare, Paperclip, Upload, DollarSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { formatPhone } from "@/lib/utils";

const logCallSchema = z.object({
  note: z.string().optional(),
  outcome: z.string().optional(),
});

const addNoteSchema = z.object({
  note: z.string().min(1, "Note content is required"),
});

const addTaskSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.string().default("medium"),
});

const addMeetingSchema = z.object({
  note: z.string().min(1, "Meeting details are required"),
  scheduledDate: z.string().optional(),
});

const leadStatusOptions = [
  { value: "0-unqualified", label: "0 - Unqualified", color: "bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-600 dark:text-white dark:border-gray-500", dotColor: "bg-gray-500 dark:bg-gray-300", badgeColor: "bg-gray-500" },
  { value: "0.5-dm-details", label: "0.5 - Decision Maker Details", color: "bg-teal-200 text-teal-900 border-teal-300 dark:bg-teal-700 dark:text-white dark:border-teal-600", dotColor: "bg-teal-600 dark:bg-white", badgeColor: "bg-teal-600" },
  { value: "1-qualified", label: "1 - Qualified", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-[#0091AE] dark:text-white dark:border-[#0091AE]", dotColor: "bg-blue-500 dark:bg-white", badgeColor: "bg-blue-500" },
  { value: "2-intent", label: "2 - Intent", color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-[#f59e0b] dark:text-white dark:border-[#f59e0b]", dotColor: "bg-orange-500 dark:bg-white", badgeColor: "bg-orange-500" },
  { value: "3-quote-presented", label: "3 - Quote Presented", color: "bg-green-100 text-green-800 border-green-200 dark:bg-[#10b981] dark:text-white dark:border-[#10b981]", dotColor: "bg-green-500 dark:bg-white", badgeColor: "bg-green-500" },
  { value: "3b-quoted-lost", label: "3b - Quoted Lost", color: "bg-red-100 text-red-800 border-red-200 dark:bg-[#ef4444] dark:text-white dark:border-[#ef4444]", dotColor: "bg-red-500 dark:bg-white", badgeColor: "bg-red-500" },
  { value: "4-account-active", label: "4 - Account Active", color: "bg-emerald-200 text-emerald-900 border-emerald-300 dark:bg-emerald-700 dark:text-white dark:border-emerald-600", dotColor: "bg-emerald-600 dark:bg-white", badgeColor: "bg-emerald-600" },
  { value: "5-outsourced", label: "5 - Outsourced", color: "bg-cyan-200 text-cyan-900 border-cyan-300 dark:bg-cyan-700 dark:text-white dark:border-cyan-600", dotColor: "bg-cyan-600 dark:bg-white", badgeColor: "bg-cyan-600" },
  { value: "6-time-waste", label: "6 - Time Waste", color: "bg-rose-200 text-rose-900 border-rose-300 dark:bg-rose-700 dark:text-white dark:border-rose-600", dotColor: "bg-rose-600 dark:bg-white", badgeColor: "bg-rose-600" },
];

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

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
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 dark:hover:bg-[#2d3142] transition-colors">
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm dark:text-white">{title}</span>
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{count}</Badge>
        </div>
        {onAdd && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[#0091AE] hover:text-[#007a94] hover:bg-blue-50 dark:hover:bg-[#2d3142]"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add
          </Button>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ContactDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const TITLE_OPTIONS = ["Mr", "Mrs", "Ms", "Miss", "Dr", "Rev", "Prof"];

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editCompanyId, setEditCompanyId] = useState("");
  const [editLeadStatus, setEditLeadStatus] = useState("");

  const [showLogCallDialog, setShowLogCallDialog] = useState(false);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [showAddMeetingDialog, setShowAddMeetingDialog] = useState(false);
  const [showAddDealDialog, setShowAddDealDialog] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [activitySearch, setActivitySearch] = useState("");
  const [activeTab, setActiveTab] = useState<"about" | "activities" | "revenue">("activities");
  const [isEditingLeadStatus, setIsEditingLeadStatus] = useState(false);

  const { data: contact, isLoading, error } = useQuery<ContactWithCompany>({
    queryKey: ["/api/contacts", params.id],
    enabled: !!params.id,
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  // Get activities from the contact's company
  const { data: companyData } = useQuery<{ activities: Activity[]; tasks: Task[]; deals: DealWithStage[] }>({
    queryKey: ["/api/companies", contact?.companyId],
    enabled: !!contact?.companyId,
  });

  const activities = companyData?.activities || [];
  const tasks = companyData?.tasks || [];
  const deals = companyData?.deals || [];

  if (!params.id) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Invalid Contact ID</h2>
          <Button onClick={() => navigate("/contacts")}>Back to Contacts</Button>
        </div>
      </div>
    );
  }

  const logCallForm = useForm<z.infer<typeof logCallSchema>>({
    resolver: zodResolver(logCallSchema),
    defaultValues: { note: "", outcome: "" },
  });

  const addNoteForm = useForm<z.infer<typeof addNoteSchema>>({
    resolver: zodResolver(addNoteSchema),
    defaultValues: { note: "" },
  });

  const addTaskForm = useForm<z.infer<typeof addTaskSchema>>({
    resolver: zodResolver(addTaskSchema),
    defaultValues: { name: "", description: "", dueDate: "", priority: "medium" },
  });

  const addMeetingForm = useForm<z.infer<typeof addMeetingSchema>>({
    resolver: zodResolver(addMeetingSchema),
    defaultValues: { note: "", scheduledDate: "" },
  });

  const updateContactMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("PATCH", `/api/contacts/${params.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setIsEditing(false);
      toast({ title: "Contact updated" });
    },
  });

  const logCallMutation = useMutation({
    mutationFn: async (data: z.infer<typeof logCallSchema>) => {
      if (!contact?.companyId) throw new Error("No company linked");
      return apiRequest("POST", `/api/companies/${contact.companyId}/activities`, {
        companyId: contact.companyId,
        type: "call",
        note: data.note || null,
        outcome: data.outcome || null,
        contactId: contact.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", contact?.companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      logCallForm.reset();
      setShowLogCallDialog(false);
      toast({ title: "Call logged" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addNoteSchema>) => {
      if (!contact?.companyId) throw new Error("No company linked");
      return apiRequest("POST", `/api/companies/${contact.companyId}/activities`, {
        companyId: contact.companyId,
        type: "follow_up",
        note: data.note,
        contactId: contact.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", contact?.companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      addNoteForm.reset();
      setShowAddNoteDialog(false);
      toast({ title: "Note added" });
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addTaskSchema>) => {
      if (!contact?.companyId) throw new Error("No company linked");
      return apiRequest("POST", `/api/companies/${contact.companyId}/tasks`, {
        name: data.name,
        description: data.description || null,
        dueDate: data.dueDate || null,
        priority: data.priority,
        status: "pending",
        contactId: contact.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", contact?.companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      addTaskForm.reset();
      setShowAddTaskDialog(false);
      toast({ title: "Task created" });
    },
  });

  const addMeetingMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addMeetingSchema>) => {
      if (!contact?.companyId) throw new Error("No company linked");
      return apiRequest("POST", `/api/companies/${contact.companyId}/activities`, {
        companyId: contact.companyId,
        type: "meeting",
        note: data.note,
        contactId: contact.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", contact?.companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      addMeetingForm.reset();
      setShowAddMeetingDialog(false);
      toast({ title: "Meeting logged" });
    },
  });

  const updateLeadStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      return apiRequest("PATCH", `/api/contacts/${params.id}`, {
        leadStatus: newStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setIsEditingLeadStatus(false);
      toast({ title: "Lead status updated" });
    },
  });

  const startEditing = () => {
    if (!contact) return;
    setEditTitle(contact.title || "");
    setEditName(contact.name || "");
    setEditEmail(contact.email);
    setEditPhone(contact.phone || "");
    setEditRole(contact.role || "");
    setEditCompanyId(contact.companyId || "");
    setEditLeadStatus(contact.leadStatus || "0-unqualified");
    setIsEditing(true);
  };

  const saveEditing = () => {
    updateContactMutation.mutate({
      title: editTitle || null,
      name: editName || null,
      email: editEmail,
      phone: editPhone || null,
      role: editRole || null,
      companyId: editCompanyId === "none" ? null : editCompanyId || null,
      leadStatus: editLeadStatus,
    });
  };

  const getLeadStatusBadge = (status: string | null | undefined) => {
    const effectiveStatus = status || "0-unqualified";
    const option = leadStatusOptions.find((opt) => opt.value === effectiveStatus);
    if (option) {
      return (
        <Badge className={`${option.color} border text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-sm`}>
          <span className={`inline-block w-2 h-2 rounded-full ${option.dotColor} mr-1.5`} />
          {option.label}
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs">{status}</Badge>;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call": return <Phone className="h-4 w-4 text-blue-400" />;
      case "email": return <Mail className="h-4 w-4 text-purple-400" />;
      case "follow_up": return <StickyNote className="h-4 w-4 text-yellow-400" />;
      case "quote": return <FileText className="h-4 w-4 text-green-400" />;
      case "meeting": return <Video className="h-4 w-4 text-cyan-400" />;
      case "deal_won": return <Briefcase className="h-4 w-4 text-emerald-400" />;
      case "deal_lost": return <Briefcase className="h-4 w-4 text-red-400" />;
      default: return <MessageSquare className="h-4 w-4 text-gray-400" />;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case "call": return "Call";
      case "email": return "Email";
      case "follow_up": return "Note";
      case "quote": return "Quote";
      case "meeting": return "Meeting";
      case "deal_won": return "Deal Won";
      case "deal_lost": return "Deal Lost";
      default: return type;
    }
  };

  const filteredActivities = useMemo(() => {
    let filtered = activities;
    if (activityFilter !== "all") {
      const typeMap: Record<string, string[]> = {
        calls: ["call"],
        emails: ["email"],
        notes: ["follow_up"],
        tasks: [],
      };
      const types = typeMap[activityFilter];
      if (types && types.length > 0) {
        filtered = filtered.filter((a) => types.includes(a.type));
      }
    }
    if (activitySearch) {
      const s = activitySearch.toLowerCase();
      filtered = filtered.filter((a) => a.note?.toLowerCase().includes(s) || a.outcome?.toLowerCase().includes(s));
    }
    return filtered;
  }, [activities, activityFilter, activitySearch]);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-[#1a1d29]">
        <div className="w-64 bg-white dark:bg-[#252936] border-r dark:border-[#3d4254] p-6 space-y-4">
          <Skeleton className="h-8 w-32 dark:bg-[#3d4254]" />
          <Skeleton className="h-16 w-16 rounded-full dark:bg-[#3d4254]" />
          <Skeleton className="h-6 w-48 dark:bg-[#3d4254]" />
          <Skeleton className="h-4 w-36 dark:bg-[#3d4254]" />
        </div>
        <div className="flex-1 p-6"><Skeleton className="h-64 dark:bg-[#3d4254]" /></div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Contact not found</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">This contact may have been deleted.</p>
          <Button onClick={() => navigate("/contacts")}>Back to Contacts</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#1a1d29] overflow-hidden">
      {/* LEFT SIDEBAR */}
      <div className="w-64 shrink-0 bg-white dark:bg-[#252936] border-r dark:border-[#3d4254] flex flex-col overflow-hidden">
        {/* Back button */}
        <div className="p-4 border-b dark:border-[#3d4254]">
          <Button variant="ghost" size="sm" onClick={() => navigate("/contacts")}
            className="text-[#0091AE] hover:text-[#007a94] hover:bg-blue-50 dark:hover:bg-[#2d3142] -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Contacts
          </Button>
        </div>

        {/* Contact Header */}
        <div className="p-4 border-b dark:border-[#3d4254] text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0091AE] to-[#06b6d4] flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-xl font-bold text-white">{getInitials(contact.name)}</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{contact.title ? `${contact.title} ` : ""}{contact.name || "Unnamed Contact"}</h2>
          {contact.role && <p className="text-sm text-gray-500 dark:text-[#94a3b8] mt-0.5">{contact.role}</p>}

          {/* Quick Actions */}
          <div className="flex items-center justify-center gap-1 mt-3">
            {[
              { icon: StickyNote, label: "Note", onClick: () => setShowAddNoteDialog(true), needsCompany: true },
              { icon: Mail, label: "Email", onClick: () => contact.email && window.open(`mailto:${contact.email}`), needsCompany: false },
              { icon: Phone, label: "Call", onClick: () => setShowLogCallDialog(true), needsCompany: true },
              { icon: CheckSquare, label: "Task", onClick: () => setShowAddTaskDialog(true), needsCompany: true },
              { icon: Video, label: "Meeting", onClick: () => setShowAddMeetingDialog(true), needsCompany: true },
            ].map((action) => (
              <Button key={action.label} variant="ghost" size="sm" className="h-8 px-2 text-xs text-[#94a3b8] hover:text-white hover:bg-[#2d3142]"
                onClick={action.onClick} disabled={!contact.companyId && action.needsCompany}>
                <action.icon className="h-3.5 w-3.5 mr-1" />{action.label}
              </Button>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-[#94a3b8] hover:text-white hover:bg-[#2d3142]">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="dark:bg-[#252936] dark:border-[#3d4254]">
                <DropdownMenuItem className="dark:text-white dark:focus:bg-[#2d3142]" onClick={startEditing}>
                  <Pencil className="h-4 w-4 mr-2" />Edit Details
                </DropdownMenuItem>
                <DropdownMenuSeparator className="dark:bg-[#3d4254]" />
                <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => {
                  if (confirm("Delete this contact?")) {
                    apiRequest("DELETE", `/api/contacts/${params.id}`).then(() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
                      navigate("/contacts");
                      toast({ title: "Contact deleted" });
                    });
                  }
                }}>
                  <Trash2 className="h-4 w-4 mr-2" />Delete Contact
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Key Information */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <div className="bg-[#252936] rounded-lg p-5 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
              <h3 className="text-[11px] uppercase tracking-[0.5px] text-[#64748b] font-semibold mb-4">Key Information</h3>

              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.5px] text-[#64748b] block mb-1">Title</label>
                    <Select value={editTitle || "none"} onValueChange={(v) => setEditTitle(v === "none" ? "" : v)}>
                      <SelectTrigger className="h-8 text-sm dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                        <SelectValue placeholder="--" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                        <SelectItem value="none" className="dark:text-[#94a3b8]">--</SelectItem>
                        {TITLE_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t} className="dark:text-white dark:focus:bg-[#2d3142]">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.5px] text-[#64748b] block mb-1">Name</label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.5px] text-[#64748b] block mb-1">Email</label>
                    <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-8 text-sm dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.5px] text-[#64748b] block mb-1">Phone</label>
                    <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-8 text-sm dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.5px] text-[#64748b] block mb-1">Job Title</label>
                    <Input value={editRole} onChange={(e) => setEditRole(e.target.value)} className="h-8 text-sm dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.5px] text-[#64748b] block mb-1">Company</label>
                    <Select value={editCompanyId || "none"} onValueChange={(v) => setEditCompanyId(v === "none" ? "" : v)}>
                      <SelectTrigger className="h-8 text-sm dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 dark:bg-[#252936] dark:border-[#3d4254]">
                        <SelectItem value="none" className="dark:text-[#94a3b8]">No company</SelectItem>
                        {companies?.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="dark:text-white dark:focus:bg-[#2d3142]">{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.5px] text-[#64748b] block mb-1">Lead Status</label>
                    <Select value={editLeadStatus} onValueChange={setEditLeadStatus}>
                      <SelectTrigger className="h-8 text-sm dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                        {leadStatusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="dark:text-white dark:focus:bg-[#2d3142]">
                            <span className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${opt.badgeColor}`} />{opt.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1 bg-[#0091AE] hover:bg-[#007a94] text-white" onClick={saveEditing} disabled={updateContactMutation.isPending}>
                      <Save className="h-3.5 w-3.5 mr-1" />{updateContactMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white" onClick={() => setIsEditing(false)}>
                      <X className="h-3.5 w-3.5 mr-1" />Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Contact Info */}
                  <div className="space-y-4">
                    {contact.title && (
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b]">Title</p>
                        <p className="text-[14px] font-medium text-white">{contact.title}</p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b]">Email</p>
                      <a href={`mailto:${contact.email}`} className="text-[14px] font-medium text-[#0091AE] hover:underline flex items-center gap-1 min-w-0">
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{contact.email}</span>
                      </a>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b]">Phone</p>
                      {contact.phone ? (
                        <a href={`tel:${formatPhone(contact.phone)}`} className="text-[14px] font-medium text-[#0091AE] hover:underline flex items-center gap-1 min-w-0">
                          <Phone className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{formatPhone(contact.phone)}</span>
                        </a>
                      ) : (
                        <p className="text-[14px] text-muted-foreground">--</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b]">Job Title</p>
                      <p className="text-[14px] font-medium text-white">{contact.role || <span className="text-muted-foreground font-normal">--</span>}</p>
                    </div>
                  </div>

                  <div className="border-t border-[#3d4254] my-4" />

                  {/* Organization */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b]">Company</p>
                      {contact.companyId && contact.companyName ? (
                        <Link href={`/company/${contact.companyId}`}
                          className="text-[14px] font-medium text-[#0091AE] hover:underline flex items-center gap-1.5 min-w-0">
                          <Building2 className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{contact.companyName}</span><ArrowUpRight className="h-3 w-3 flex-shrink-0" />
                        </Link>
                      ) : (
                        <p className="text-[14px] text-muted-foreground">No company</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b]">Lead Status</p>
                        <button
                          onClick={() => setIsEditingLeadStatus(!isEditingLeadStatus)}
                          className="text-[#0091AE] hover:text-[#007a94] text-xs"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                      {isEditingLeadStatus ? (
                        <Select
                          value={contact.leadStatus || "0-unqualified"}
                          onValueChange={(value) => updateLeadStatusMutation.mutate(value)}
                        >
                          <SelectTrigger className="h-8 text-sm dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                            {leadStatusOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="dark:text-white dark:focus:bg-[#2d3142]">
                                <span className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${opt.badgeColor}`} />{opt.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        getLeadStatusBadge(contact.leadStatus)
                      )}
                    </div>
                  </div>

                  <div className="border-t border-[#3d4254] my-4" />

                  {/* Dates */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b]">Last Contacted</p>
                      <p className="text-[14px] font-medium text-white">
                        {contact.lastContactDate ? formatDistanceToNow(new Date(contact.lastContactDate), { addSuffix: true }) : <span className="text-muted-foreground font-normal">Never</span>}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.5px] text-[#64748b]">Create Date</p>
                      <p className="text-[14px] font-medium text-white">{format(new Date(contact.createdAt), "MMM d, yyyy")}</p>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="w-full mt-4 dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]" onClick={startEditing}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />Edit Details
                  </Button>
                </>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* CENTER - Activity Timeline */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="bg-white dark:bg-[#252936] border-b dark:border-[#3d4254] px-6">
          <div className="flex items-center gap-6 h-12">
            {(["about", "activities", "revenue"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm font-medium border-b-2 h-full flex items-center transition-colors capitalize ${
                  activeTab === tab
                    ? "border-[#0091AE] text-[#0091AE]"
                    : "border-transparent text-[#94a3b8] hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "about" && (
          <ScrollArea className="flex-1 bg-gray-50 dark:bg-[#1a1d29]">
            <div className="p-6 max-w-3xl">
              <div className="bg-white dark:bg-[#252936] border dark:border-[#3d4254] rounded-lg p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-[#64748b] mb-1">Full Name</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{contact.name || "--"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#64748b] mb-1">Email Address</p>
                      <a href={`mailto:${contact.email}`} className="text-sm font-medium text-[#0091AE] hover:underline">{contact.email}</a>
                    </div>
                    <div>
                      <p className="text-xs text-[#64748b] mb-1">Phone Number</p>
                      {contact.phone ? (
                        <a href={`tel:${formatPhone(contact.phone)}`} className="text-sm font-medium text-[#0091AE] hover:underline">{formatPhone(contact.phone)}</a>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-[#64748b]">--</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-[#64748b] mb-1">Job Title</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{contact.role || "--"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#64748b] mb-1">Company</p>
                      {contact.companyId && contact.companyName ? (
                        <Link href={`/company/${contact.companyId}`} className="text-sm font-medium text-[#0091AE] hover:underline">{contact.companyName}</Link>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-[#64748b]">No company</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-[#64748b] mb-1">Lead Status</p>
                      <div className="mt-1">{getLeadStatusBadge(contact.leadStatus)}</div>
                    </div>
                    <div>
                      <p className="text-xs text-[#64748b] mb-1">Last Contacted</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {contact.lastContactDate ? format(new Date(contact.lastContactDate), "MMM d, yyyy") : "Never"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#64748b] mb-1">Created</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{format(new Date(contact.createdAt), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        {activeTab === "activities" && (
          <>
            {/* Activity Toolbar */}
            <div className="bg-white dark:bg-[#252936] border-b dark:border-[#3d4254] px-6 py-3 flex items-center gap-3">
              <Button size="sm" className="bg-[#0091AE] hover:bg-[#007a94] text-white" onClick={() => setShowLogCallDialog(true)} disabled={!contact.companyId}>
                <Phone className="h-3.5 w-3.5 mr-1.5" />Log Call
              </Button>
              <Button size="sm" variant="outline" className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]" onClick={() => setShowAddNoteDialog(true)} disabled={!contact.companyId}>
                <StickyNote className="h-3.5 w-3.5 mr-1.5" />Add Note
              </Button>
              <div className="flex-1" />
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748b]" />
                <Input
                  type="search"
                  placeholder="Search activities..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  className="pl-9 h-8 text-sm dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
                />
              </div>
            </div>

            {/* Activity Filters */}
            <div className="bg-white dark:bg-[#252936] border-b dark:border-[#3d4254] px-6 py-2 flex items-center gap-1">
              {[
                { key: "all", label: "All" },
                { key: "calls", label: "Calls" },
                { key: "emails", label: "Emails" },
                { key: "notes", label: "Notes" },
                { key: "tasks", label: "Tasks" },
              ].map((f) => (
                <Button key={f.key} variant="ghost" size="sm"
                  className={`h-7 px-3 text-xs ${activityFilter === f.key ? "bg-[#0091AE]/10 text-[#0091AE] font-medium" : "text-[#94a3b8] hover:text-white hover:bg-[#2d3142]"}`}
                  onClick={() => setActivityFilter(f.key)}>
                  {f.label}
                </Button>
              ))}
            </div>

            {/* Activity List */}
            <ScrollArea className="flex-1 bg-gray-50 dark:bg-[#1a1d29]">
              <div className="p-6">
                {!contact.companyId ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-[#3d4254] flex items-center justify-center mx-auto mb-4">
                      <Building2 className="h-8 w-8 text-[#64748b]" />
                    </div>
                    <p className="text-[#94a3b8] mb-1">No company linked</p>
                    <p className="text-sm text-[#64748b]">Link this contact to a company to view and log activities.</p>
                    <Button size="sm" variant="outline" className="mt-4 dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white" onClick={startEditing}>
                      <Building2 className="h-3.5 w-3.5 mr-1.5" />Link Company
                    </Button>
                  </div>
                ) : filteredActivities.length === 0 && activityFilter === "all" ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-[#3d4254] flex items-center justify-center mx-auto mb-4">
                      <Clock className="h-8 w-8 text-[#64748b]" />
                    </div>
                    <p className="text-[#94a3b8] mb-1">No activities yet</p>
                    <p className="text-sm text-[#64748b]">Log a call or add a note to get started.</p>
                  </div>
                ) : filteredActivities.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-[#94a3b8]">No matching activities</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredActivities.map((activity) => (
                      <div key={activity.id} className="bg-white dark:bg-[#252936] border dark:border-[#3d4254] rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-[#2d3142] transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#2d3142] dark:bg-[#3d4254] flex items-center justify-center flex-shrink-0 mt-0.5">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {getActivityLabel(activity.type)}
                              </span>
                              {activity.outcome && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 dark:border-[#3d4254] dark:text-[#94a3b8]">
                                  {activity.outcome}
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500 dark:text-[#64748b] ml-auto flex-shrink-0">
                                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            {activity.note && (
                              <p className="text-sm text-gray-600 dark:text-[#94a3b8] whitespace-pre-wrap">{activity.note}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}

        {activeTab === "revenue" && (
          <ScrollArea className="flex-1 bg-gray-50 dark:bg-[#1a1d29]">
            <div className="p-6">
              {!contact.companyId ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-[#3d4254] flex items-center justify-center mx-auto mb-4">
                    <Building2 className="h-8 w-8 text-[#64748b]" />
                  </div>
                  <p className="text-[#94a3b8] mb-1">No company linked</p>
                  <p className="text-sm text-[#64748b]">Link this contact to a company to view revenue information.</p>
                </div>
              ) : deals.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-[#3d4254] flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="h-8 w-8 text-[#64748b]" />
                  </div>
                  <p className="text-[#94a3b8] mb-1">No deals yet</p>
                  <p className="text-sm text-[#64748b]">No revenue data available for this contact.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-[#252936] border dark:border-[#3d4254] rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue Summary</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-[#64748b] mb-1">Total Deals</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{deals.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#64748b] mb-1">Expected GP</p>
                        <p className="text-2xl font-bold text-[#10b981]">
                          £{deals.reduce((sum, d) => sum + (d.expectedGP ? parseFloat(d.expectedGP) : 0), 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#64748b] mb-1">Active Deals</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {deals.filter(d => d.stage?.name !== 'Closed Won' && d.stage?.name !== 'Closed Lost').length}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#252936] border dark:border-[#3d4254] rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Deals</h3>
                    <div className="space-y-3">
                      {deals.map((deal) => (
                        <div key={deal.id} className="p-4 bg-gray-50 dark:bg-[#1a1d29] border dark:border-[#3d4254] rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 dark:text-white">{deal.title}</h4>
                              {deal.stage && (
                                <Badge className="mt-1 text-xs bg-blue-600/20 text-blue-400 border border-blue-600/30">
                                  {deal.stage.name}
                                </Badge>
                              )}
                            </div>
                            {deal.expectedGP && (
                              <p className="text-lg font-bold text-[#10b981]">£{parseFloat(deal.expectedGP).toLocaleString()}</p>
                            )}
                          </div>
                          {deal.decisionTimeline && (
                            <p className="text-xs text-[#64748b]">Expected close: {format(new Date(deal.decisionTimeline), "MMM d, yyyy")}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="w-80 shrink-0 bg-white dark:bg-[#252936] border-l dark:border-[#3d4254] overflow-auto">
        <CollapsibleSection title="Companies" count={contact.companyId ? 1 : 0} icon={Building2}>
          {contact.companyId && contact.companyName ? (
            <Link href={`/company/${contact.companyId}`}
              className="block p-3 bg-[#2d3142] border border-[#3d4254] rounded-md hover:bg-[#353849] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#0091AE]/20 to-[#06b6d4]/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-4 w-4 text-[#0091AE]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[#0091AE] truncate">{contact.companyName}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-[#64748b]" />
              </div>
            </Link>
          ) : (
            <p className="text-sm text-[#94a3b8] text-center py-4">No company linked</p>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Deals" count={deals.length} icon={Briefcase} onAdd={() => setShowAddDealDialog(true)}>
          {deals.length === 0 ? (
            <p className="text-sm text-[#94a3b8] text-center py-4">No deals</p>
          ) : (
            <div className="space-y-2">
              {deals.map((deal) => (
                <div key={deal.id} className="p-3 bg-[#2d3142] border border-[#3d4254] rounded-md">
                  <p className="font-medium text-sm text-white truncate">{deal.title}</p>
                  {deal.expectedGP && (
                    <p className="text-sm font-bold text-[#10b981] mt-0.5">£{parseFloat(deal.expectedGP).toLocaleString()}</p>
                  )}
                  {deal.stage && (
                    <Badge className="text-[10px] h-4 px-1.5 mt-1.5 bg-blue-600/20 text-blue-400 border border-blue-600/30">{deal.stage.name}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Tasks" count={tasks.filter(t => t.status !== "completed").length} icon={FileText} onAdd={() => setShowAddTaskDialog(true)}>
          {tasks.filter((t) => t.status !== "completed").length === 0 ? (
            <p className="text-sm text-[#94a3b8] text-center py-4">No tasks</p>
          ) : (
            <div className="space-y-2">
              {tasks.filter((t) => t.status !== "completed").slice(0, 5).map((task) => (
                <div key={task.id} className="p-3 bg-[#2d3142] border border-[#3d4254] rounded-md">
                  <p className="text-sm text-white">{task.name}</p>
                  {task.dueDate && (
                    <p className="text-xs text-[#64748b] mt-1">Due {format(new Date(task.dueDate), "MMM d")}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Attachments" count={0} icon={Paperclip}>
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[#3d4254] flex items-center justify-center mx-auto mb-3">
              <Paperclip className="h-6 w-6 text-[#64748b]" />
            </div>
            <p className="text-sm text-[#94a3b8] mb-3">No attachments</p>
            <Button size="sm" variant="outline" className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload File
            </Button>
          </div>
        </CollapsibleSection>
      </div>

      {/* Log Call Dialog */}
      <Dialog open={showLogCallDialog} onOpenChange={setShowLogCallDialog}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Log a Call</DialogTitle>
          </DialogHeader>
          <Form {...logCallForm}>
            <form onSubmit={logCallForm.handleSubmit((data) => logCallMutation.mutate(data))} className="space-y-4">
              <FormField control={logCallForm.control} name="outcome" render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-[#94a3b8]">Outcome</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                        <SelectValue placeholder="Select outcome" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                      <SelectItem value="Reception / Voicemail" className="dark:text-white dark:focus:bg-[#2d3142]">Reception / Voicemail</SelectItem>
                      <SelectItem value="Decision Maker Details" className="dark:text-white dark:focus:bg-[#2d3142]">Decision Maker Details</SelectItem>
                      <SelectItem value="Connected to DM" className="dark:text-white dark:focus:bg-[#2d3142]">Connected to DM</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={logCallForm.control} name="note" render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-[#94a3b8]">Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Call notes..." className="min-h-[100px] dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" {...field} />
                  </FormControl>
                </FormItem>
              )} />
              <Button type="submit" className="w-full bg-[#0091AE] hover:bg-[#007a94] text-white" disabled={logCallMutation.isPending}>
                {logCallMutation.isPending ? "Logging..." : "Log Call"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showAddNoteDialog} onOpenChange={setShowAddNoteDialog}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Add a Note</DialogTitle>
          </DialogHeader>
          <Form {...addNoteForm}>
            <form onSubmit={addNoteForm.handleSubmit((data) => addNoteMutation.mutate(data))} className="space-y-4">
              <FormField control={addNoteForm.control} name="note" render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-[#94a3b8]">Note</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Write your note..." className="min-h-[120px] dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full bg-[#0091AE] hover:bg-[#007a94] text-white" disabled={addNoteMutation.isPending}>
                {addNoteMutation.isPending ? "Saving..." : "Save Note"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Add a Task</DialogTitle>
          </DialogHeader>
          <Form {...addTaskForm}>
            <form onSubmit={addTaskForm.handleSubmit((data) => addTaskMutation.mutate(data))} className="space-y-4">
              <FormField control={addTaskForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-[#94a3b8]">Task Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Follow up on quote" className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={addTaskForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-[#94a3b8]">Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Task details..." className="min-h-[80px] dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" {...field} />
                  </FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={addTaskForm.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-[#94a3b8]">Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" {...field} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={addTaskForm.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-[#94a3b8]">Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                        <SelectItem value="low" className="dark:text-white dark:focus:bg-[#2d3142]">Low</SelectItem>
                        <SelectItem value="medium" className="dark:text-white dark:focus:bg-[#2d3142]">Medium</SelectItem>
                        <SelectItem value="high" className="dark:text-white dark:focus:bg-[#2d3142]">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <Button type="submit" className="w-full bg-[#0091AE] hover:bg-[#007a94] text-white" disabled={addTaskMutation.isPending || !contact.companyId}>
                {addTaskMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Meeting Dialog */}
      <Dialog open={showAddMeetingDialog} onOpenChange={setShowAddMeetingDialog}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Log a Meeting</DialogTitle>
          </DialogHeader>
          <Form {...addMeetingForm}>
            <form onSubmit={addMeetingForm.handleSubmit((data) => addMeetingMutation.mutate(data))} className="space-y-4">
              <FormField control={addMeetingForm.control} name="note" render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-[#94a3b8]">Meeting Details *</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What was discussed..." className="min-h-[120px] dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={addMeetingForm.control} name="scheduledDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-[#94a3b8]">Meeting Date</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" {...field} />
                  </FormControl>
                </FormItem>
              )} />
              <Button type="submit" className="w-full bg-[#0091AE] hover:bg-[#007a94] text-white" disabled={addMeetingMutation.isPending}>
                {addMeetingMutation.isPending ? "Logging..." : "Log Meeting"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Deal Dialog - Placeholder */}
      <Dialog open={showAddDealDialog} onOpenChange={setShowAddDealDialog}>
        <DialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Add Deal</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <p className="text-[#94a3b8] mb-4">Deal creation from contacts is coming soon.</p>
            <p className="text-sm text-[#64748b] mb-4">For now, please create deals from the Pipeline page or Company detail page.</p>
            <Button onClick={() => navigate("/pipeline")} className="bg-[#0091AE] hover:bg-[#007a94] text-white">
              Go to Pipeline
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
