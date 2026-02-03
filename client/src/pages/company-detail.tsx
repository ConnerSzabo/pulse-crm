import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import type { CompanyWithRelations, PipelineStage, Task, Activity, DealWithStage } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Phone, Mail, User, Plus,
  Trash2, Clock, MapPin, Globe, Building2, ExternalLink,
  AlertTriangle, FileText, DollarSign,
  Calendar, TrendingUp, MessageSquare, ThumbsUp, ThumbsDown,
  Pencil, X, Save, StickyNote, Briefcase
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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

export default function CompanyDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [showLogCallDialog, setShowLogCallDialog] = useState(false);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [showAddContactDialog, setShowAddContactDialog] = useState(false);
  const [showDealDialog, setShowDealDialog] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealWithStage | null>(null);

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

  const contactForm = useForm<z.infer<typeof addContactSchema>>({
    resolver: zodResolver(addContactSchema),
    defaultValues: { email: "", name: "", phone: "", role: "" },
  });

  const editForm = useForm<z.infer<typeof editCompanySchema>>({
    resolver: zodResolver(editCompanySchema),
    defaultValues: {
      phone: "",
      ext: "",
      website: "",
      location: "",
      academyTrustName: "",
      budgetStatus: "",
    },
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

  // Update forms when company data loads
  useEffect(() => {
    if (company) {
      editForm.reset({
        phone: company.phone || "",
        ext: company.ext || "",
        website: company.website || "",
        location: company.location || "",
        academyTrustName: company.academyTrustName || "",
        budgetStatus: company.budgetStatus || "",
      });
    }
  }, [company, editForm]);

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
    mutationFn: async (data: z.infer<typeof editCompanySchema>) => {
      return apiRequest("PATCH", `/api/companies/${params.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsEditingDetails(false);
      toast({ title: "Details updated" });
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

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
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

  // Sort activities by date (newest first)
  const sortedActivities = [...(company.activities || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Sort and filter tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sortedTasks = [...(company.tasks || [])].sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return 1;
    if (a.status !== "completed" && b.status === "completed") return -1;
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">In Progress</Badge>;
      default:
        return <Badge variant="outline">To Do</Badge>;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call": return <Phone className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      case "quote": return <FileText className="h-4 w-4" />;
      case "follow_up": return <StickyNote className="h-4 w-4" />;
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
      case "deal_won": return "bg-emerald-500";
      case "deal_lost": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getBudgetStatusBadge = (status: string | null) => {
    if (!status) return <span className="text-muted-foreground">Not set</span>;
    switch (status.toLowerCase()) {
      case "confirmed":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Confirmed</Badge>;
      case "indicative":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Indicative</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calculate total expected GP from all deals
  const totalExpectedGP = (company.deals || []).reduce((sum, deal) => {
    return sum + (deal.expectedGP ? parseFloat(deal.expectedGP) : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Header */}
      <div className="bg-white dark:bg-card border-b px-6 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/companies")}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          data-testid="button-back-to-companies"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Schools
        </Button>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* TOP SECTION: Tasks */}
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-white dark:bg-card pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Tasks
                <Badge variant="secondary" className="ml-2">
                  {company.tasks?.filter(t => t.status !== "completed").length || 0} active
                </Badge>
              </CardTitle>
              <Button
                onClick={() => setShowAddTaskDialog(true)}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-add-task"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sortedTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No tasks yet</p>
                <p className="text-sm">Click "Add Task" to create one</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-muted/50">
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Task Name</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTasks.map((task) => {
                    const overdue = isTaskOverdue(task);
                    return (
                      <TableRow
                        key={task.id}
                        className={`${overdue ? "bg-red-50 dark:bg-red-950/20" : ""} ${task.status === "completed" ? "opacity-60" : ""}`}
                        data-testid={`row-task-${task.id}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={task.status === "completed"}
                            onCheckedChange={() => {
                              updateTaskMutation.mutate({
                                id: task.id,
                                status: task.status === "completed" ? "todo" : "completed"
                              });
                            }}
                            data-testid={`checkbox-task-${task.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <span className={`${overdue ? "text-red-600 font-bold" : ""} ${task.status === "completed" ? "line-through text-muted-foreground" : "font-medium"}`}>
                            {overdue && <AlertTriangle className="inline h-4 w-4 mr-1" />}
                            {task.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          {task.dueDate ? (
                            <span className={overdue ? "text-red-600 font-bold" : "text-muted-foreground"}>
                              {format(new Date(task.dueDate), "MMM d, yyyy")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No date</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(task.status)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteTaskMutation.mutate(task.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            data-testid={`button-delete-task-${task.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* MIDDLE SECTION: Sidebar + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT SIDEBAR: School Details */}
          <div className="lg:col-span-3">
            <Card className="shadow-sm sticky top-6">
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-xl font-bold" data-testid="text-company-detail-name">
                  {company.name}
                </CardTitle>
                {totalExpectedGP > 0 && (
                  <p className="text-sm text-emerald-600 font-medium mt-1">
                    Total Pipeline: £{totalExpectedGP.toLocaleString()}
                  </p>
                )}
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                {isEditingDetails ? (
                  <Form {...editForm}>
                    <form onSubmit={editForm.handleSubmit((data) => updateCompanyMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={editForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Phone Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Phone number" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="ext"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Extension</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Extension" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Website</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Website URL" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Location</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Location" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="academyTrustName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Academy Trust Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Academy trust" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="budgetStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Lead Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="indicative">Indicative</SelectItem>
                                <SelectItem value="unknown">Unknown</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <div className="flex gap-2 pt-2">
                        <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700">
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditingDetails(false);
                            editForm.reset();
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <>
                    {/* Phone Number - Prominent Display */}
                    <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 -mx-1">
                      <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mb-1">
                        <Phone className="h-3 w-3" />
                        Phone Number
                      </p>
                      <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                        {company.phone || <span className="text-muted-foreground text-base font-normal">Not set</span>}
                        {company.ext && <span className="text-sm font-normal text-blue-500 ml-1">ext. {company.ext}</span>}
                      </p>
                      {company.phone && (
                        <a
                          href={`tel:${company.phone}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
                        >
                          <Phone className="h-3 w-3" />
                          Click to call
                        </a>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        Website
                      </p>
                      {company.website ? (
                        <a
                          href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                          data-testid="link-company-website"
                        >
                          {company.website.replace(/^https?:\/\//, '')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <p className="font-medium text-muted-foreground">Not set</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Location
                      </p>
                      <p className="font-medium">
                        {company.location || <span className="text-muted-foreground">Not set</span>}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        Academy Trust Name
                      </p>
                      <p className="font-medium">
                        {company.academyTrustName || <span className="text-muted-foreground">Not set</span>}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Lead Status</p>
                      {getBudgetStatusBadge(company.budgetStatus)}
                    </div>

                    <div className="pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setIsEditingDetails(true)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Details
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* MAIN CENTER: Activity & Notes */}
          <div className="lg:col-span-9">
            <Card className="shadow-sm">
              <CardHeader className="border-b pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Activity & Notes</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowLogCallDialog(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="button-log-call"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Log Call
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowAddNoteDialog(true)}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                      data-testid="button-add-note"
                    >
                      <StickyNote className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {sortedActivities.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No activity yet</p>
                    <p className="text-sm">Log a call or add a note to get started</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
                    <div className="space-y-4">
                      {sortedActivities.map((activity) => (
                        <div
                          key={activity.id}
                          className="relative pl-10"
                          data-testid={`card-activity-${activity.id}`}
                        >
                          <div className={`absolute left-2 top-3 h-5 w-5 rounded-full ${getActivityColor(activity.type)} flex items-center justify-center ring-4 ring-white dark:ring-gray-900`}>
                            <span className="text-white scale-75">{getActivityIcon(activity.type)}</span>
                          </div>
                          <Card className="shadow-sm hover:shadow transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
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
                                    {activity.grossProfit && (
                                      <span className="text-sm font-medium text-emerald-600">
                                        GP: £{parseFloat(activity.grossProfit).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                  {activity.note && (
                                    <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                      {activity.note}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(activity.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                  </p>
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
              </CardContent>
            </Card>
          </div>
        </div>

        {/* BOTTOM SECTION: Contacts & Deals with Tabs */}
        <Card className="shadow-sm">
          <Tabs defaultValue="deals" className="w-full">
            <CardHeader className="border-b pb-0">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="deals" className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Deals
                    <Badge variant="secondary" className="ml-1">
                      {company.deals?.length || 0}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="contacts" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contacts
                    <Badge variant="secondary" className="ml-1">
                      {company.contacts?.length || 0}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>

            <TabsContent value="deals" className="mt-0">
              <CardHeader className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      Active Deals
                    </CardTitle>
                    {totalExpectedGP > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Total Expected GP: <span className="text-emerald-600 font-semibold">£{totalExpectedGP.toLocaleString()}</span>
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={openAddDeal}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-add-deal"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Deal
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {(company.deals?.length || 0) === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No deals yet</p>
                    <p className="text-sm">Add a deal to track opportunities with this school</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-muted/50">
                        <TableHead>Deal Title</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Expected GP</TableHead>
                        <TableHead>Budget Status</TableHead>
                        <TableHead>Timeline</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {company.deals?.map((deal) => (
                        <TableRow key={deal.id} data-testid={`row-deal-${deal.id}`}>
                          <TableCell className="font-medium">{deal.title}</TableCell>
                          <TableCell>
                            {deal.stage ? (
                              <Badge
                                style={{ backgroundColor: deal.stage.color, color: 'white' }}
                                className="font-medium"
                              >
                                {deal.stage.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {deal.expectedGP ? (
                              <span className="text-emerald-600 font-medium">
                                £{parseFloat(deal.expectedGP).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getBudgetStatusBadge(deal.budgetStatus)}
                          </TableCell>
                          <TableCell>
                            {deal.decisionTimeline ? (
                              format(new Date(deal.decisionTimeline), "MMM d, yyyy")
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditDeal(deal)}
                                className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                data-testid={`button-edit-deal-${deal.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteDealMutation.mutate(deal.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                data-testid={`button-delete-deal-${deal.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="contacts" className="mt-0">
              <CardHeader className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Contacts
                  </CardTitle>
                  <Button
                    onClick={() => setShowAddContactDialog(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-add-contact"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {company.contacts?.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No contacts yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-muted/50">
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {company.contacts?.map((contact) => (
                        <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                          <TableCell className="font-medium">
                            {contact.name || "-"}
                          </TableCell>
                          <TableCell>
                            {contact.role ? (
                              <Badge variant="secondary">{contact.role}</Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell>
                            <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                              {contact.email}
                            </a>
                          </TableCell>
                          <TableCell>{contact.phone || "-"}</TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteContactMutation.mutate(contact.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              data-testid={`button-delete-contact-${contact.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

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
