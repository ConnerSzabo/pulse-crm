import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { TaskWithTso } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ListTodo } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isBefore, startOfToday } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const STATUSES = ["To Do", "Waiting", "Scheduled", "Done", "Codes not sent", "Awaiting reply", "Awaiting approval", "Negotiating"];
const TASK_TYPES = ["Follow-up", "Send Proposal", "Send Codes", "Create Banner", "Book Call", "Get Approval", "Reply to Email", "General"];
const OWNERS = ["Conner", "Jim/Alice", "Conner/Jim/Alice"];

const priorityBadge: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-500",
};

const statusBadge: Record<string, string> = {
  "To Do": "bg-blue-100 text-blue-700",
  "Waiting": "bg-orange-100 text-orange-700",
  "Scheduled": "bg-purple-100 text-purple-700",
  "Done": "bg-green-100 text-green-700",
  "Codes not sent": "bg-red-100 text-red-700",
  "Awaiting reply": "bg-yellow-100 text-yellow-800",
  "Awaiting approval": "bg-cyan-100 text-cyan-700",
  "Negotiating": "bg-pink-100 text-pink-700",
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
      setAddOpen(false);
      form.reset();
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
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.tso?.name || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || (statusFilter === "active" && t.status !== "Done") ||
      t.status === statusFilter;
    const matchOwner = ownerFilter === "all" || t.owner === ownerFilter;
    return matchSearch && matchStatus && matchOwner;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground text-sm">Action items and follow-ups</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#e91e8c] hover:bg-[#c0166e]">
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
                      <SelectContent>
                        {(tsos || []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
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
                <Button type="submit" className="w-full bg-[#e91e8c] hover:bg-[#c0166e]" disabled={createMutation.isPending}>
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
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

      <p className="text-sm text-muted-foreground">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ListTodo className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No tasks found</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Task</TableHead>
                <TableHead>TSO</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(task => {
                const isOverdue = task.dueDate && isBefore(new Date(task.dueDate), today) && task.status !== "Done";
                return (
                  <TableRow key={task.id} className={task.status === "Done" ? "opacity-50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={task.status === "Done"}
                        onCheckedChange={checked => updateMutation.mutate({ id: task.id, status: checked ? "Done" : "To Do" })}
                      />
                    </TableCell>
                    <TableCell>
                      <p className={`text-sm font-medium ${task.status === "Done" ? "line-through" : ""}`}>{task.title}</p>
                      {task.notes && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{task.notes}</p>}
                    </TableCell>
                    <TableCell>
                      {task.tso && (
                        <Link href={`/tso/${task.tso.id}`}>
                          <span className="text-sm text-[#e91e8c] hover:underline cursor-pointer">{task.tso.name}</span>
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.taskType && <Badge className="text-xs bg-gray-100 text-gray-600">{task.taskType}</Badge>}
                    </TableCell>
                    <TableCell>
                      {task.dueDate && (
                        <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                          {format(new Date(task.dueDate), "d MMM")}
                          {isOverdue && " ⚠"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.owner && <span className="text-xs text-muted-foreground">{task.owner}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${priorityBadge[task.priority] || "bg-gray-100"}`}>
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={task.status} onValueChange={v => updateMutation.mutate({ id: task.id, status: v })}>
                        <SelectTrigger className="h-7 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
