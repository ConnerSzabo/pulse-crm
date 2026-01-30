import { useState } from "react";
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
  const { toast } = useToast();

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
        return "text-red-600 dark:text-red-400";
      case "medium":
        return "text-amber-600 dark:text-amber-400";
      case "low":
        return "text-green-600 dark:text-green-400";
      default:
        return "text-muted-foreground";
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">Completed</Badge>;
      case "in_progress":
        return <Badge variant="secondary">In Progress</Badge>;
      case "todo":
      default:
        return <Badge variant="outline">To Do</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="text-muted-foreground">Manage tasks across all schools</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-tasks"
          />
        </div>
        <Select value={schoolFilter} onValueChange={setSchoolFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-school-filter">
            <SelectValue placeholder="Filter by school" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {companies?.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-priority-filter">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="overdue-only"
            checked={showOverdueOnly}
            onCheckedChange={(checked) => setShowOverdueOnly(checked === true)}
            data-testid="checkbox-overdue-only"
          />
          <label htmlFor="overdue-only" className="text-sm cursor-pointer">
            Overdue only
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : sortedTasks?.length === 0 ? (
        <Card className="p-8 text-center">
          <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No tasks found</h3>
          <p className="text-muted-foreground">
            {tasks?.length === 0 
              ? "Create tasks from individual school records" 
              : "Try adjusting your filters"}
          </p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Task</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTasks?.map((task) => {
                const overdue = task.status !== "completed" && isOverdue(task.dueDate);
                return (
                  <TableRow
                    key={task.id}
                    className={task.status === "completed" ? "opacity-60" : ""}
                    data-testid={`row-task-${task.id}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={task.status === "completed"}
                        onCheckedChange={() => toggleComplete(task)}
                        data-testid={`checkbox-complete-${task.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <span className={task.status === "completed" ? "line-through text-muted-foreground" : ""}>
                        {task.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/company/${task.companyId}`}
                        className="text-primary hover:underline"
                        data-testid={`link-school-${task.companyId}`}
                      >
                        {task.company?.name || "Unknown"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {task.dueDate ? (
                        <span className={overdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                          {overdue && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                          {format(new Date(task.dueDate), "MMM d, yyyy")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No due date</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPriorityBadgeVariant(task.priority)}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(task.status)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/company/${task.companyId}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
