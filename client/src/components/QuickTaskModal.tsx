import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Calendar, CheckSquare, AlarmClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Company } from "@shared/schema";

const TASK_TEMPLATES = [
  { name: "Follow up call", taskType: "follow_up", daysFromNow: 7 },
  { name: "Send quote", taskType: "follow_up_quote", daysFromNow: 1 },
  { name: "Send trade-in calculator", taskType: "general", daysFromNow: 0 },
  { name: "Schedule meeting", taskType: "general", daysFromNow: 3 },
];

type Props = {
  company: Company;
  onClose: () => void;
};

export default function QuickTaskModal({ company, onClose }: Props) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    taskType: "general",
    dueDate: new Date().toISOString().split("T")[0],
    priority: "medium",
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/companies/${company.id}/tasks`, {
        name: formData.name,
        taskType: formData.taskType,
        dueDate: formData.dueDate || null,
        priority: formData.priority,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", company.id] });
      toast({ title: "Task created", description: `"${formData.name}" added successfully` });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to create task", variant: "destructive" });
    },
  });

  const applyTemplate = (template: (typeof TASK_TEMPLATES)[0]) => {
    const dueDate = new Date();
    if (template.daysFromNow > 0) {
      dueDate.setDate(dueDate.getDate() + template.daysFromNow);
    }
    setFormData({
      name: template.name,
      taskType: template.taskType,
      dueDate: dueDate.toISOString().split("T")[0],
      priority: "medium",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    createTaskMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#252936] dark:border dark:border-[#3d4254] rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-[#3d4254]">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Task</h2>
            <p className="text-sm text-gray-500 dark:text-[#94a3b8] mt-0.5">{company.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Templates */}
        <div className="p-6 border-b border-gray-200 dark:border-[#3d4254]">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[#94a3b8] mb-3">
            Quick Templates
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TASK_TEMPLATES.map((template) => (
              <button
                key={template.name}
                onClick={() => applyTemplate(template)}
                className="p-3 bg-gray-50 dark:bg-[#1a1d29] hover:bg-gray-100 dark:hover:bg-[#2d3142] rounded-lg text-left transition-colors border-2 border-transparent hover:border-[#0091AE]/50"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">{template.name}</p>
                <p className="text-xs text-gray-500 dark:text-[#64748b] mt-0.5">
                  {template.daysFromNow === 0
                    ? "Due today"
                    : `Due in ${template.daysFromNow} day${template.daysFromNow > 1 ? "s" : ""}`}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-[#94a3b8] block mb-1.5">
              Task Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Follow up on quote request"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1d29] border border-gray-200 dark:border-[#3d4254] rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#64748b] focus:border-[#0091AE] focus:outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-[#94a3b8] block mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1d29] border border-gray-200 dark:border-[#3d4254] rounded-lg text-gray-900 dark:text-white focus:border-[#0091AE] focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-[#94a3b8] block mb-1.5">
                <AlarmClock className="w-3.5 h-3.5 inline mr-1" />
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1d29] border border-gray-200 dark:border-[#3d4254] rounded-lg text-gray-900 dark:text-white focus:border-[#0091AE] focus:outline-none text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-[#94a3b8] block mb-1.5">
              Task Type
            </label>
            <select
              value={formData.taskType}
              onChange={(e) => setFormData({ ...formData, taskType: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1d29] border border-gray-200 dark:border-[#3d4254] rounded-lg text-gray-900 dark:text-white focus:border-[#0091AE] focus:outline-none text-sm"
            >
              <option value="general">General</option>
              <option value="follow_up">Follow up call</option>
              <option value="follow_up_quote">Send quote</option>
              <option value="check_budget">Check budget</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={!formData.name.trim() || createTaskMutation.isPending}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              {createTaskMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="dark:border-[#3d4254] dark:text-[#94a3b8]"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
