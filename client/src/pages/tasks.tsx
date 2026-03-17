import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { TaskWithTso } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Plus, Search, ListTodo, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isBefore, startOfToday } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const STATUSES = ["To Do","Waiting","Scheduled","Done","Codes not sent","Awaiting reply","Awaiting approval","Negotiating"];
const TASK_TYPES = ["Follow-up","Send Proposal","Send Codes","Create Banner","Book Call","Get Approval","Reply to Email","General"];
const OWNERS = ["Conner","Jim/Alice","Conner/Jim/Alice"];

const PRIORITY_STYLES: Record<string, string> = {
  high:   "bg-red-500/20 text-red-300 border border-red-500/30",
  medium: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  low:    "bg-slate-500/20 text-slate-400 border border-slate-500/30",
};

const STATUS_STYLES: Record<string, string> = {
  "To Do":             "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  "Waiting":           "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  "Scheduled":         "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  "Done":              "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  "Codes not sent":    "bg-red-500/20 text-red-300 border border-red-500/30",
  "Awaiting reply":    "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  "Awaiting approval": "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
  "Negotiating":       "bg-pink-500/20 text-pink-300 border border-pink-500/30",
};

const addSchema = z.object({
  title: z.string().min(1, "Title is required"),
  tsoId: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  dueDate: z.string().optional(),
  taskType: z.string().optional(),
  owner: z.string().optional(),
  notes: z.string().optional(),
});
type AddForm = z.infer<typeof addSchema>;

export default function TasksPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const { toast } = useToast();
  const today = startOfToday();

  const { data: tasksData, isLoading } = useQuery<TaskWithTso[]>({ queryKey: ["/api/tasks"] });
  const { data: tsos } = useQuery<any[]>({ queryKey: ["/api/tsos"] });

  const createMutation = useMutation({
    mutationFn: (data: AddForm) => apiRequest("POST", "/api/tasks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setAddOpen(false); form.reset();
      toast({ title: "Task created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; [k: string]: any }) => apiRequest("PATCH", `/api/tasks/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/tasks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const form = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: { title: "", priority: "medium", status: "To Do" },
  });

  const filtered = (tasksData || []).filter(t => {
    const matchSearch = !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.tso?.name || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" ||
      (statusFilter === "active" && t.status !== "Done") ||
      t.status === statusFilter;
    const matchOwner = ownerFilter === "all" || t.owner === ownerFilter;
    return matchSearch && matchStatus && matchOwner;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f5f9]">Tasks</h1>
          <p className="text-[#64748b] text-sm">Action items and follow-ups</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#6366f1] hover:bg-[#7c3aed]">
              <Plus className="h-4 w-4 mr-2" /> Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-3">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Title *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="tsoId" render={({ field }) => (
                  <FormItem><FormLabel>TSO</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select TSO..." /></SelectTrigger></FormControl>
                      <SelectContent>{(tsos || []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem><FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="dueDate" render={({ field }) => (
                    <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="owner" render={({ field }) => (
                    <FormItem><FormLabel>Owner</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Assign..." /></SelectTrigger></FormControl>
                        <SelectContent>{OWNERS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="taskType" render={({ field }) => (
                  <FormItem><FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger></FormControl>
                      <SelectContent>{TASK_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notes</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <Button type="submit" className="w-full bg-[#6366f1] hover:bg-[#7c3aed]" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Task"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b]" />
          <Input placeholder="Search tasks or TSO..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="all">All</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All owners" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {OWNERS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-[#64748b]">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</p>

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <ListTodo className="h-12 w-12 mx-auto mb-4 text-[#2d3548]" />
          <p className="text-[#64748b]">No tasks found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#2d3548] overflow-hidden">
          {/* Header */}
          <div className="grid text-[11px] font-semibold uppercase tracking-wider text-[#64748b] px-4 py-2.5 border-b border-[#2d3548] bg-[#0f1419]/60"
            style={{ gridTemplateColumns: "24px 2.5fr 1.5fr 1fr 90px 110px 80px 160px" }}>
            <span />
            <span>Task</span>
            <span>TSO</span>
            <span>Type</span>
            <span>Due</span>
            <span>Owner</span>
            <span>Priority</span>
            <span>Status</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#2d3548]">
            {filtered.map(task => {
              const isOverdue = task.dueDate && isBefore(new Date(task.dueDate), today) && task.status !== "Done";
              const isDone = task.status === "Done";
              return (
                <div key={task.id}
                  className={`grid items-center px-4 py-3 transition-colors hover:bg-[#6366f1]/5 ${isDone ? "opacity-50" : ""}`}
                  style={{ gridTemplateColumns: "24px 2.5fr 1.5fr 1fr 90px 110px 80px 160px" }}>

                  {/* Checkbox */}
                  <input type="checkbox" checked={isDone}
                    onChange={e => updateMutation.mutate({ id: task.id, status: e.target.checked ? "Done" : "To Do" })}
                    className="h-4 w-4 rounded cursor-pointer accent-[#6366f1]" />

                  {/* Title */}
                  <div className="min-w-0 pr-3">
                    <p className={`text-sm font-medium ${isDone ? "line-through text-[#64748b]" : "text-[#f1f5f9]"} truncate`}>
                      {task.title}
                    </p>
                    {task.notes && <p className="text-xs text-[#64748b] truncate mt-0.5">{task.notes}</p>}
                  </div>

                  {/* TSO */}
                  <div className="min-w-0 pr-2">
                    {task.tso ? (
                      <Link href={`/tso/${task.tso.id}`}>
                        <span className="text-xs text-[#6366f1] hover:text-[#818cf8] cursor-pointer truncate block transition-colors">
                          {task.tso.name}
                        </span>
                      </Link>
                    ) : <span className="text-[#3d4558]">—</span>}
                  </div>

                  {/* Type */}
                  <div>
                    {task.taskType ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/30">
                        {task.taskType}
                      </span>
                    ) : <span className="text-[#3d4558]">—</span>}
                  </div>

                  {/* Due */}
                  <div>
                    {task.dueDate ? (
                      <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-400 font-medium" : "text-[#64748b]"}`}>
                        {isOverdue && <AlertCircle className="h-3 w-3" />}
                        {format(new Date(task.dueDate), "d MMM")}
                      </span>
                    ) : <span className="text-[#3d4558]">—</span>}
                  </div>

                  {/* Owner */}
                  <div>
                    {task.owner ? (
                      <span className="text-xs text-[#94a3b8]">{task.owner}</span>
                    ) : <span className="text-[#3d4558]">—</span>}
                  </div>

                  {/* Priority */}
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[task.priority] || "bg-slate-500/20 text-slate-400 border border-slate-500/30"}`}>
                      {task.priority}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <Select value={task.status} onValueChange={v => updateMutation.mutate({ id: task.id, status: v })}>
                      <SelectTrigger className="h-7 text-xs border-[#2d3548] bg-transparent" style={{ width: "150px" }}>
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                            task.status === "Done" ? "bg-emerald-400" :
                            task.status === "To Do" ? "bg-blue-400" :
                            task.status === "Codes not sent" ? "bg-red-400" :
                            "bg-amber-400"
                          }`} />
                          <span className="truncate text-[#f1f5f9]">{task.status}</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1f2e] border-[#2d3548]">
                        {STATUSES.map(s => (
                          <SelectItem key={s} value={s} className="text-xs text-[#f1f5f9] hover:bg-[#252b3d]">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
