import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import type { CompanyWithRelations, PipelineStage, Task, Activity } from "@shared/schema";
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
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ArrowLeft, Phone, Mail, User, Plus, 
  Trash2, Clock, MapPin, Globe, Building2, ExternalLink,
  ListTodo, AlertTriangle, CheckCircle2, FileText, DollarSign,
  Calendar, TrendingUp, MessageSquare, ThumbsUp, ThumbsDown
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

const addNoteSchema = z.object({
  note: z.string().min(1, "Note content is required"),
});

const nextActionSchema = z.object({
  nextAction: z.string().optional(),
});

const addTaskSchema = z.object({
  name: z.string().min(1, "Task description is required"),
  dueDate: z.string().optional(),
  priority: z.string().default("medium"),
  taskType: z.string().default("general"),
});

const addActivitySchema = z.object({
  type: z.enum(["call", "email", "quote", "follow_up", "deal_won", "deal_lost"]),
  note: z.string().optional(),
  outcome: z.string().optional(),
  quoteValue: z.string().optional(),
  grossProfit: z.string().optional(),
});

export default function CompanyDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: company, isLoading } = useQuery<CompanyWithRelations>({
    queryKey: ["/api/companies", params.id],
  });

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const contactForm = useForm<z.infer<typeof addContactSchema>>({
    resolver: zodResolver(addContactSchema),
    defaultValues: { email: "", name: "", phone: "", role: "" },
  });

  const noteForm = useForm<z.infer<typeof addNoteSchema>>({
    resolver: zodResolver(addNoteSchema),
    defaultValues: { note: "" },
  });

  const taskForm = useForm<z.infer<typeof addTaskSchema>>({
    resolver: zodResolver(addTaskSchema),
    defaultValues: { name: "", dueDate: "", priority: "medium", taskType: "general" },
  });

  const activityForm = useForm<z.infer<typeof addActivitySchema>>({
    resolver: zodResolver(addActivitySchema),
    defaultValues: { type: "call", note: "", outcome: "", quoteValue: "", grossProfit: "" },
  });

  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const activityType = activityForm.watch("type");

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
      toast({ title: "Contact added" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addNoteSchema>) => {
      return apiRequest("POST", `/api/companies/${params.id}/notes`, {
        companyId: params.id,
        note: data.note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      noteForm.reset();
      toast({ title: "Call logged" });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: Partial<{ stageId: string; nextAction: string }>) => {
      return apiRequest("PATCH", `/api/companies/${params.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
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

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiRequest("DELETE", `/api/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      toast({ title: "Note removed" });
    },
  });

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

  const addActivityMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addActivitySchema>) => {
      return apiRequest("POST", `/api/companies/${params.id}/activities`, {
        companyId: params.id,
        type: data.type,
        note: data.note || null,
        outcome: data.outcome || null,
        quoteValue: data.quoteValue || null,
        grossProfit: data.grossProfit || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pipeline-value"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/gp-this-month"] });
      activityForm.reset();
      toast({ title: "Activity logged" });
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

  const sortedNotes = [...(company.callNotes || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const sortedActivities = [...(company.activities || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call": return <Phone className="h-3 w-3" />;
      case "email": return <Mail className="h-3 w-3" />;
      case "quote": return <FileText className="h-3 w-3" />;
      case "follow_up": return <Calendar className="h-3 w-3" />;
      case "deal_won": return <ThumbsUp className="h-3 w-3" />;
      case "deal_lost": return <ThumbsDown className="h-3 w-3" />;
      default: return <MessageSquare className="h-3 w-3" />;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case "call": return "Call";
      case "email": return "Email";
      case "quote": return "Quote";
      case "follow_up": return "Follow-up";
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

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/companies")}
            className="mb-4"
            data-testid="button-back-to-companies"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold" data-testid="text-company-detail-name">
                {company.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                {company.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {company.location}
                  </span>
                )}
                {company.academyTrustName && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    {company.academyTrustName}
                  </span>
                )}
                {company.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" />
                    {company.phone}
                    {company.ext && ` ext. ${company.ext}`}
                  </span>
                )}
                {company.website && (
                  <a 
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline"
                    data-testid="link-company-website"
                  >
                    <Globe className="h-4 w-4" />
                    {company.website.replace(/^https?:\/\//, '')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={company.stageId || ""}
                onValueChange={(value) => updateCompanyMutation.mutate({ stageId: value || null })}
              >
                <SelectTrigger className="w-[200px]" data-testid="select-company-stage-detail">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
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
            </div>
          </div>

          {company.notes && (
            <p className="mt-4 text-sm text-muted-foreground border-l-2 border-muted pl-3">
              {company.notes}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <CardTitle className="text-lg font-semibold">
                  Contacts ({company.contacts?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Form {...contactForm}>
                  <form
                    onSubmit={contactForm.handleSubmit((data) => addContactMutation.mutate(data))}
                    className="space-y-3 p-4 bg-muted/30 rounded-lg"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={contactForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Contact name"
                                data-testid="input-contact-name"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Role</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. IT Manager"
                                data-testid="input-contact-role"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={contactForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Email *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="email@school.edu"
                                data-testid="input-contact-email"
                                {...field}
                              />
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
                            <FormLabel className="text-xs">Phone</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Phone number"
                                data-testid="input-contact-phone"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={addContactMutation.isPending}
                      data-testid="button-add-contact"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Contact
                    </Button>
                  </form>
                </Form>

                {company.contacts?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No contacts yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {company.contacts?.map((contact) => (
                      <div 
                        key={contact.id} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        data-testid={`card-contact-${contact.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {contact.name || contact.email}
                              </span>
                              {contact.role && (
                                <Badge variant="secondary" className="text-xs">
                                  {contact.role}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {contact.email}
                              </span>
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {contact.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteContactMutation.mutate(contact.id)}
                          data-testid={`button-delete-contact-${contact.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Next Action</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="e.g. Follow up on Monday, Send proposal..."
                  defaultValue={company.nextAction || ""}
                  onBlur={(e) => {
                    if (e.target.value !== (company.nextAction || "")) {
                      updateCompanyMutation.mutate({ nextAction: e.target.value });
                      toast({ title: "Next action updated" });
                    }
                  }}
                  data-testid="input-next-action"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <CardTitle className="text-lg font-semibold">
                  Tasks ({company.tasks?.filter(t => t.status !== "completed").length || 0})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-completed-tasks"
                    checked={showCompletedTasks}
                    onCheckedChange={(checked) => setShowCompletedTasks(checked === true)}
                  />
                  <label htmlFor="show-completed-tasks" className="text-sm text-muted-foreground cursor-pointer">
                    Show completed
                  </label>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Form {...taskForm}>
                  <form
                    onSubmit={taskForm.handleSubmit((data) => addTaskMutation.mutate(data))}
                    className="space-y-3 p-4 bg-muted/30 rounded-lg"
                  >
                    <FormField
                      control={taskForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Task Description</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="What needs to be done?"
                              data-testid="input-task-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={taskForm.control}
                        name="dueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Due Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                data-testid="input-task-due-date"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={taskForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Priority</FormLabel>
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
                    <Button
                      type="submit"
                      size="sm"
                      disabled={addTaskMutation.isPending}
                      data-testid="button-add-task"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Task
                    </Button>
                  </form>
                </Form>

                {(() => {
                  const filteredTasks = company.tasks?.filter(t => 
                    showCompletedTasks ? true : t.status !== "completed"
                  ) || [];
                  const sortedTasks = [...filteredTasks].sort((a, b) => {
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                  });

                  if (sortedTasks.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <ListTodo className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>No tasks yet</p>
                      </div>
                    );
                  }

                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  return (
                    <div className="space-y-2">
                      {sortedTasks.map((task) => {
                        const isOverdue = task.dueDate && 
                          new Date(task.dueDate) < today && 
                          task.status !== "completed";
                        
                        return (
                          <div 
                            key={task.id}
                            className={`flex items-center justify-between p-3 rounded-lg border bg-card ${
                              task.status === "completed" ? "opacity-60" : ""
                            }`}
                            data-testid={`card-task-${task.id}`}
                          >
                            <div className="flex items-center gap-3">
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
                              <div>
                                <span className={`font-medium text-sm ${
                                  task.status === "completed" ? "line-through text-muted-foreground" : ""
                                }`}>
                                  {task.name}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  {task.dueDate && (
                                    <span className={isOverdue ? "text-red-600 dark:text-red-400 font-medium flex items-center gap-1" : ""}>
                                      {isOverdue && <AlertTriangle className="h-3 w-3" />}
                                      {format(new Date(task.dueDate), "MMM d, yyyy")}
                                    </span>
                                  )}
                                  <Badge 
                                    variant={task.priority === "high" ? "destructive" : task.priority === "low" ? "outline" : "secondary"}
                                    className="text-xs"
                                  >
                                    {task.priority}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteTaskMutation.mutate(task.id)}
                              data-testid={`button-delete-task-${task.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Company Info Card - Wave Systems specific */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Deal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">Budget Status</span>
                    <span className="font-medium">{company.budgetStatus || "Unknown"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Decision Timeline</span>
                    <span className="font-medium">{company.decisionTimeline || "Not set"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Decision Maker</span>
                    <span className="font-medium">{company.decisionMakerName || "Unknown"}</span>
                    {company.decisionMakerRole && (
                      <span className="text-muted-foreground text-xs ml-1">({company.decisionMakerRole})</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Trade-in Interest</span>
                    <span className="font-medium">{company.tradeInInterest ? "Yes" : "No"}</span>
                  </div>
                  {company.lastQuoteDate && (
                    <div>
                      <span className="text-muted-foreground block text-xs">Last Quote</span>
                      <span className="font-medium">
                        {format(new Date(company.lastQuoteDate), "MMM d, yyyy")}
                        {company.lastQuoteValue && (
                          <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                            (£{parseFloat(company.lastQuoteValue).toLocaleString()})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {company.grossProfit && (
                    <div>
                      <span className="text-muted-foreground block text-xs">Total GP</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        £{parseFloat(company.grossProfit).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {company.buyerHonestyScore && (
                    <div>
                      <span className="text-muted-foreground block text-xs">Buyer Honesty Score</span>
                      <span className="font-medium">{company.buyerHonestyScore}/10</span>
                    </div>
                  )}
                  {company.nextBudgetCycle && (
                    <div>
                      <span className="text-muted-foreground block text-xs">Next Budget Cycle</span>
                      <span className="font-medium">{company.nextBudgetCycle}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <CardTitle className="text-lg font-semibold">
                  Activity Timeline
                </CardTitle>
                <Badge variant="secondary">
                  {sortedActivities.length + sortedNotes.length} activities
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <Form {...activityForm}>
                  <form
                    onSubmit={activityForm.handleSubmit((data) => addActivityMutation.mutate(data))}
                    className="space-y-3 p-4 bg-muted/30 rounded-lg"
                  >
                    <FormField
                      control={activityForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Activity Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-activity-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="call">Call</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="quote">Quote Sent</SelectItem>
                              <SelectItem value="follow_up">Follow-up</SelectItem>
                              <SelectItem value="deal_won">Deal Won</SelectItem>
                              <SelectItem value="deal_lost">Deal Lost</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    {(activityType === "call" || activityType === "email") && (
                      <FormField
                        control={activityForm.control}
                        name="outcome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Outcome</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-activity-outcome">
                                  <SelectValue placeholder="Select outcome" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="answered">Answered</SelectItem>
                                <SelectItem value="voicemail">Voicemail</SelectItem>
                                <SelectItem value="no_answer">No Answer</SelectItem>
                                <SelectItem value="busy">Busy</SelectItem>
                                <SelectItem value="wrong_number">Wrong Number</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="replied">Replied</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    )}

                    {activityType === "quote" && (
                      <FormField
                        control={activityForm.control}
                        name="quoteValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Quote Value (£)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="e.g. 15000"
                                data-testid="input-quote-value"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}

                    {(activityType === "deal_won" || activityType === "deal_lost") && (
                      <FormField
                        control={activityForm.control}
                        name="grossProfit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              {activityType === "deal_won" ? "Gross Profit (£)" : "Lost Value (£)"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="e.g. 2500"
                                data-testid="input-gross-profit"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={activityForm.control}
                      name="note"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Add any notes or details..."
                              className="min-h-[60px] resize-none"
                              data-testid="input-activity-note"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={addActivityMutation.isPending}
                      data-testid="button-add-activity"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Log Activity
                    </Button>
                  </form>
                </Form>

                {sortedActivities.length === 0 && sortedNotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No activity yet</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-4">
                      {/* New activities */}
                      {sortedActivities.map((activity) => (
                        <div 
                          key={`activity-${activity.id}`} 
                          className="relative pl-10"
                          data-testid={`card-activity-${activity.id}`}
                        >
                          <div className={`absolute left-2.5 top-1.5 h-3 w-3 rounded-full ${getActivityColor(activity.type)} flex items-center justify-center`}>
                            <span className="text-white">{getActivityIcon(activity.type)}</span>
                          </div>
                          <div className="p-3 rounded-lg border bg-card">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {getActivityLabel(activity.type)}
                                  </Badge>
                                  {activity.outcome && (
                                    <Badge variant="outline" className="text-xs">
                                      {activity.outcome}
                                    </Badge>
                                  )}
                                  {activity.quoteValue && (
                                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                      £{parseFloat(activity.quoteValue).toLocaleString()}
                                    </span>
                                  )}
                                  {activity.grossProfit && (
                                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                      GP: £{parseFloat(activity.grossProfit).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                {activity.note && (
                                  <p className="text-sm whitespace-pre-wrap">{activity.note}</p>
                                )}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={() => deleteActivityMutation.mutate(activity.id)}
                                data-testid={`button-delete-activity-${activity.id}`}
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(activity.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}
                      {/* Legacy call notes */}
                      {sortedNotes.map((note) => (
                        <div 
                          key={`note-${note.id}`} 
                          className="relative pl-10"
                          data-testid={`card-note-${note.id}`}
                        >
                          <div className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full bg-blue-500" />
                          <div className="p-3 rounded-lg border bg-card">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <Badge variant="secondary" className="text-xs mb-1">Call</Badge>
                                <p className="text-sm whitespace-pre-wrap" data-testid={`text-note-content-${note.id}`}>
                                  {note.note}
                                </p>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={() => deleteNoteMutation.mutate(note.id)}
                                data-testid={`button-delete-note-${note.id}`}
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
