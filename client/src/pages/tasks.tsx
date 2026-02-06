import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { TaskWithCompany, Company } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, isAfter, isBefore, startOfToday } from "date-fns";
import { Search, CheckCircle2, Clock, AlertTriangle, ChevronRight, ListTodo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type CompanyWithStage = Company & { stage?: { id: string; name: string; color: string } };

export default function TasksPage() {
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [showCompleted, setShowCompleted] = useState(() => {
    // Load preference from localStorage, default to false (hide completed)
    const saved = localStorage.getItem("tasks_show_completed");
    return saved === "true";
  });
  const { toast } = useToast();

  // Save preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("tasks_show_completed", showCompleted.toString());
  }, [showCompleted]);

  const { data: tasks, isLoading } = useQuery<TaskWithCompany[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: companies } = useQuery<CompanyWithStage[]>({
    queryKey: ["/api/companies"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status?: string; priority?: string }) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task updated" });
    },
  });

  const today = startOfToday();

  const isOverdue = (dueDate: Date | null): boolean => {
    if (!dueDate) return false;
    return isBefore(new Date(dueDate), today);
  };

  const filteredTasks = tasks?.filter((task) => {
    if (search && !task.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (schoolFilter !== "all" && task.companyId !== schoolFilter) {
      return false;
    }
    if (statusFilter !== "all" && task.status !== statusFilter) {
      return false;
    }
    if (priorityFilter !== "all" && task.priority !== priorityFilter) {
      return false;
    }
    if (showOverdueOnly && (!task.dueDate || !isOverdue(task.dueDate) || task.status === "completed")) {
      return false;
    }
    // HIDE COMPLETED TASKS BY DEFAULT (unless toggle is on or status filter is "completed")
    if (!showCompleted && statusFilter !== "completed" && task.status === "completed") {
      return false;
    }
    return true;
  });

  const sortedTasks = filteredTasks?.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const toggleComplete = (task: TaskWithCompany) => {
    const newStatus = task.status === "completed" ? "todo" : "completed";
    updateMutation.mutate({ id: task.id, status: newStatus });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600 dark:text-[#ef4444]";
      case "medium":
        return "text-amber-600 dark:text-[#f59e0b]";
      case "low":
        return "text-green-600 dark:text-[#10b981]";
      default:
        return "text-muted-foreground dark:text-[#64748b]";
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive" as const;
      case "medium":
        return "secondary" as const;
      case "low":
        return "outline" as const;
      default:
        return "secondary" as const;
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case "high":
        return "dark:bg-[#ef4444]/20 dark:text-[#ef4444] dark:border-[#ef4444]/30";
      case "medium":
        return "dark:bg-[#f59e0b]/20 dark:text-[#f59e0b] dark:border-[#f59e0b]/30";
      case "low":
        return "dark:bg-[#10b981]/20 dark:text-[#10b981] dark:border-[#10b981]/30";
      default:
        return "dark:bg-[#252936] dark:text-[#94a3b8] dark:border-[#3d4254]";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-[#10b981]/20 dark:text-[#10b981] dark:border-[#10b981]/30">Completed</Badge>;
      case "in_progress":
        return <Badge variant="secondary" className="dark:bg-[#0091AE]/20 dark:text-[#06b6d4] dark:border-[#0091AE]/30">In Progress</Badge>;
      case "todo":
      default:
        return <Badge variant="outline" className="dark:bg-[#252936] dark:text-[#94a3b8] dark:border-[#3d4254]">To Do</Badge>;
    }
  };

  // Calculate task counts
  const activeTasks = tasks?.filter(t => t.status !== "completed").length || 0;
  const completedTasks = tasks?.filter(t => t.status === "completed").length || 0;
  const visibleTasks = filteredTasks?.length || 0;

  return (
    <div className="p-6 space-y-6 dark:bg-[#1a1d29] min-h-screen">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold dark:text-white">Tasks</h1>
          <Badge variant="secondary" className="dark:bg-[#3d4254] dark:text-[#94a3b8]">
            {showCompleted ? `${activeTasks} active, ${completedTasks} completed` : `${activeTasks} active`}
          </Badge>
        </div>
        <p className="text-muted-foreground dark:text-[#94a3b8] mt-1">
          Manage tasks across all schools {visibleTasks < (tasks?.length || 0) ? `(${visibleTasks} shown)` : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-[#64748b]" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 dark:bg-[#252936] dark:border-[#3d4254] dark:text-white dark:placeholder-[#64748b]"
            data-testid="input-search-tasks"
          />
        </div>
        <Select value={schoolFilter} onValueChange={setSchoolFilter}>
          <SelectTrigger className="w-[180px] dark:bg-[#252936] dark:border-[#3d4254] dark:text-white" data-testid="select-school-filter">
            <SelectValue placeholder="Filter by school" />
          </SelectTrigger>
          <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
            <SelectItem value="all" className="dark:text-white dark:focus:bg-[#2d3142]">All Schools</SelectItem>
            {companies?.map((company) => (
              <SelectItem key={company.id} value={company.id} className="dark:text-white dark:focus:bg-[#2d3142]">
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] dark:bg-[#252936] dark:border-[#3d4254] dark:text-white" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
            <SelectItem value="all" className="dark:text-white dark:focus:bg-[#2d3142]">All Status</SelectItem>
            <SelectItem value="todo" className="dark:text-white dark:focus:bg-[#2d3142]">To Do</SelectItem>
            <SelectItem value="in_progress" className="dark:text-white dark:focus:bg-[#2d3142]">In Progress</SelectItem>
            <SelectItem value="completed" className="dark:text-white dark:focus:bg-[#2d3142]">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px] dark:bg-[#252936] dark:border-[#3d4254] dark:text-white" data-testid="select-priority-filter">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
            <SelectItem value="all" className="dark:text-white dark:focus:bg-[#2d3142]">All Priority</SelectItem>
            <SelectItem value="high" className="dark:text-white dark:focus:bg-[#2d3142]">High</SelectItem>
            <SelectItem value="medium" className="dark:text-white dark:focus:bg-[#2d3142]">Medium</SelectItem>
            <SelectItem value="low" className="dark:text-white dark:focus:bg-[#2d3142]">Low</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="overdue-only"
            checked={showOverdueOnly}
            onCheckedChange={(checked) => setShowOverdueOnly(checked === true)}
            data-testid="checkbox-overdue-only"
            className="dark:border-[#3d4254] dark:data-[state=checked]:bg-[#0091AE] dark:data-[state=checked]:border-[#0091AE]"
          />
          <label htmlFor="overdue-only" className="text-sm cursor-pointer dark:text-[#94a3b8]">
            Overdue only
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-completed"
            checked={showCompleted}
            onCheckedChange={(checked) => setShowCompleted(checked === true)}
            data-testid="checkbox-show-completed"
            className="dark:border-[#3d4254] dark:data-[state=checked]:bg-[#0091AE] dark:data-[state=checked]:border-[#0091AE]"
          />
          <label htmlFor="show-completed" className="text-sm cursor-pointer dark:text-[#94a3b8]">
            Show completed tasks
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full dark:bg-[#3d4254]" />
          ))}
        </div>
      ) : sortedTasks?.length === 0 ? (
        <Card className="p-8 text-center dark:bg-[#252936] dark:border-[#3d4254]">
          <ListTodo className="h-12 w-12 mx-auto text-muted-foreground dark:text-[#64748b] mb-4" />
          <h3 className="text-lg font-medium mb-2 dark:text-white">No tasks found</h3>
          <p className="text-muted-foreground dark:text-[#94a3b8]">
            {tasks?.length === 0
              ? "Create tasks from individual school records"
              : "Try adjusting your filters"}
          </p>
        </Card>
      ) : (
        <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
          <Table>
            <TableHeader>
              <TableRow className="dark:border-[#3d4254] dark:hover:bg-[#2d3142]">
                <TableHead className="w-12 dark:text-[#94a3b8]"></TableHead>
                <TableHead className="dark:text-[#94a3b8]">Task</TableHead>
                <TableHead className="dark:text-[#94a3b8]">School</TableHead>
                <TableHead className="dark:text-[#94a3b8]">Due Date</TableHead>
                <TableHead className="dark:text-[#94a3b8]">Priority</TableHead>
                <TableHead className="dark:text-[#94a3b8]">Status</TableHead>
                <TableHead className="w-12 dark:text-[#94a3b8]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTasks?.map((task, index) => {
                const overdue = task.status !== "completed" && isOverdue(task.dueDate);
                return (
                  <TableRow
                    key={task.id}
                    className={`${task.status === "completed" ? "opacity-60" : ""} ${index % 2 === 0 ? "dark:bg-[#252936]" : "dark:bg-[#1a1d29]"} dark:border-[#3d4254] dark:hover:bg-[#2d3142]`}
                    data-testid={`row-task-${task.id}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={task.status === "completed"}
                        onCheckedChange={() => toggleComplete(task)}
                        data-testid={`checkbox-complete-${task.id}`}
                        className="dark:border-[#3d4254] dark:data-[state=checked]:bg-[#0091AE] dark:data-[state=checked]:border-[#0091AE]"
                      />
                    </TableCell>
                    <TableCell>
                      <span className={`${task.status === "completed" ? "line-through text-muted-foreground dark:text-[#64748b]" : "dark:text-white"}`}>
                        {task.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/company/${task.companyId}`}
                        className="text-[#0091AE] hover:underline"
                        data-testid={`link-school-${task.companyId}`}
                      >
                        {task.company?.name || "Unknown"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {task.dueDate ? (
                        <span className={overdue ? "text-[#ef4444] font-medium" : "dark:text-[#94a3b8]"}>
                          {overdue && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                          {format(new Date(task.dueDate), "MMM d, yyyy")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground dark:text-[#64748b]">No due date</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPriorityBadgeVariant(task.priority)} className={getPriorityBadgeClass(task.priority)}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(task.status)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/company/${task.companyId}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground dark:text-[#64748b]" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
