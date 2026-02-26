import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { TrustWithStats } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogTrigger,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  Landmark,
  MoreHorizontal,
  Trash2,
  ArrowUpDown,
  Phone,
  Clock,
  Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";

const addTrustSchema = z.object({
  name: z.string().min(1, "Trust name is required"),
  website: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  decisionMakerName: z.string().optional(),
  decisionMakerEmail: z.string().optional(),
  decisionMakerPhone: z.string().optional(),
  notes: z.string().optional(),
});

type AddTrustForm = z.infer<typeof addTrustSchema>;

function getActivityIcon(type: string | null): string {
  switch (type) {
    case "call": return "📞";
    case "email": return "✉️";
    case "quote": return "💰";
    case "deal_won": return "🏆";
    case "deal_lost": return "❌";
    case "follow_up": return "🔄";
    default: return "📝";
  }
}

function getActivityLabel(type: string | null): string {
  switch (type) {
    case "call": return "Call";
    case "email": return "Email";
    case "quote": return "Quote";
    case "deal_won": return "Deal Won";
    case "deal_lost": return "Deal Lost";
    case "follow_up": return "Follow Up";
    default: return "Activity";
  }
}

export default function Trusts() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: trusts, isLoading } = useQuery<TrustWithStats[]>({
    queryKey: ["/api/trusts-with-stats", sortBy],
    queryFn: async () => {
      const res = await fetch(`/api/trusts-with-stats?sortBy=${sortBy}`);
      if (!res.ok) throw new Error("Failed to fetch trusts");
      return res.json();
    },
  });

  const form = useForm<AddTrustForm>({
    resolver: zodResolver(addTrustSchema),
    defaultValues: {
      name: "",
      website: "",
      phone: "",
      email: "",
      decisionMakerName: "",
      decisionMakerEmail: "",
      decisionMakerPhone: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: AddTrustForm) => apiRequest("POST", "/api/trusts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trusts-with-stats"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Trust created successfully" });
    },
    onError: () => toast({ title: "Failed to create trust", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/trusts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trusts-with-stats"] });
      toast({ title: "Trust deleted" });
    },
    onError: () => toast({ title: "Failed to delete trust", variant: "destructive" }),
  });

  const filtered = (trusts || []).filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (date: Date | string | null) => {
    if (!date) return "--";
    return format(new Date(date), "MMM d, yyyy");
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[#1a1d29]">
      {/* Header */}
      <div className="bg-white dark:bg-[#252936] border-b border-gray-200 dark:border-[#3d4254]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#3d4254]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Multi-Academy Trusts
              </h1>
              <Badge variant="secondary" className="text-sm font-medium dark:bg-[#3d4254] dark:text-[#94a3b8]">
                {filtered.length} trusts
              </Badge>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0091AE] hover:bg-[#007a94] text-white font-medium shadow-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Trust
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Trust</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trust Name *</FormLabel>
                        <FormControl><Input placeholder="e.g. Ark Schools" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl><Input placeholder="01234 567890" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl><Input placeholder="info@trust.org" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="website" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl><Input placeholder="https://trust.org" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="decisionMakerName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Decision Maker</FormLabel>
                          <FormControl><Input placeholder="Name" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="decisionMakerPhone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>DM Phone</FormLabel>
                          <FormControl><Input placeholder="Phone" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl><textarea className="w-full px-3 py-2 border border-input rounded-md text-sm min-h-[80px] bg-background" placeholder="Any notes..." {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <div className="flex gap-3 pt-2">
                      <Button type="submit" className="flex-1 bg-[#0091AE] hover:bg-[#007a94]" disabled={createMutation.isPending}>
                        {createMutation.isPending ? "Creating..." : "Create Trust"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search + Sort Bar */}
        <div className="px-6 py-3 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search trusts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#94a3b8]">
            <ArrowUpDown className="h-4 w-4" />
            <span>Sort by:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 w-48 dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="last_activity">Most Recent Activity</SelectItem>
                <SelectItem value="oldest_activity">Least Recent Activity</SelectItem>
                <SelectItem value="schools">Most Schools</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="bg-white dark:bg-[#252936] border-x border-gray-200 dark:border-[#3d4254] p-4 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-[#3d4254]">
                <Skeleton className="h-10 w-10 rounded-lg dark:bg-[#3d4254]" />
                <Skeleton className="h-5 w-48 dark:bg-[#3d4254]" />
                <Skeleton className="h-5 w-24 dark:bg-[#3d4254]" />
                <Skeleton className="h-5 w-32 dark:bg-[#3d4254]" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-[#252936]">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-[#3d4254] flex items-center justify-center mb-6">
              <Landmark className="h-10 w-10 text-gray-400 dark:text-[#64748b]" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              {search ? "No trusts match your search" : "No trusts yet"}
            </h3>
            <p className="text-gray-500 dark:text-[#94a3b8] mb-6 text-center max-w-md">
              {search
                ? "Try adjusting your search"
                : "Add Multi-Academy Trusts to track engagement across their schools"}
            </p>
            {!search && (
              <Button onClick={() => setDialogOpen(true)} className="bg-[#0091AE] hover:bg-[#007a94] text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add your first trust
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#252936] border-x border-gray-200 dark:border-[#3d4254]">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 dark:bg-[#2d3142] sticky top-0 z-10 border-b border-gray-200 dark:border-[#3d4254]">
                <tr>
                  <th className="text-left px-4 py-3 w-[280px] border-r border-gray-100 dark:border-[#3d4254]">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Trust Name</span>
                  </th>
                  <th className="text-left px-4 py-3 w-[90px] border-r border-gray-100 dark:border-[#3d4254]">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Schools</span>
                  </th>
                  <th className="text-left px-4 py-3 w-[140px] border-r border-gray-100 dark:border-[#3d4254]">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Phone</span>
                  </th>
                  <th className="text-left px-4 py-3 border-r border-gray-100 dark:border-[#3d4254]">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Last Activity</span>
                  </th>
                  <th className="text-left px-4 py-3 w-[180px] border-r border-gray-100 dark:border-[#3d4254]">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Decision Maker</span>
                  </th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#3d4254]">
                {filtered.map((trust, index) => (
                  <tr
                    key={trust.id}
                    className={`group transition-colors cursor-pointer ${
                      index % 2 === 0
                        ? "bg-white dark:bg-[#252936]"
                        : "bg-gray-50/70 dark:bg-[#1a1d29]"
                    } hover:bg-blue-50/50 dark:hover:bg-[#2d3142]`}
                  >
                    {/* Name */}
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <Link href={`/trust/${trust.id}`} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/20 dark:from-purple-500/30 dark:to-purple-600/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <Landmark className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="font-semibold text-[#0091AE] hover:text-[#06b6d4] hover:underline truncate">
                          {trust.name}
                        </span>
                      </Link>
                    </td>

                    {/* Schools */}
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-[#94a3b8]">
                          {trust.schoolCount}
                        </span>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      {trust.phone ? (
                        <a
                          href={`tel:${trust.phone}`}
                          className="flex items-center gap-1.5 text-sm text-[#0091AE] hover:underline font-medium"
                          onClick={e => e.stopPropagation()}
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {trust.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-[#64748b]">--</span>
                      )}
                    </td>

                    {/* Last Activity */}
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      {trust.lastActivityDate ? (
                        <div>
                          <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-[#94a3b8]">
                            <span className="text-base">{getActivityIcon(trust.lastActivityType)}</span>
                            <span className="font-medium">{getActivityLabel(trust.lastActivityType)}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-[#64748b]">
                              {formatDistanceToNow(new Date(trust.lastActivityDate), { addSuffix: true })}
                            </span>
                          </div>
                          {trust.lastActivitySchoolName && (
                            <span className="text-xs text-gray-400 dark:text-[#64748b] truncate block max-w-[160px]">
                              via {trust.lastActivitySchoolName}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-[#64748b]">No activity</span>
                      )}
                    </td>

                    {/* Decision Maker */}
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      {trust.decisionMakerName ? (
                        <span className="text-sm text-gray-700 dark:text-[#94a3b8] truncate block">
                          {trust.decisionMakerName}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-[#64748b]">--</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 hover:bg-gray-200 dark:hover:bg-[#3d4254] rounded-md transition-colors opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4 text-gray-500 dark:text-[#94a3b8]" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="dark:bg-[#252936] dark:border-[#3d4254]">
                          <DropdownMenuItem asChild className="dark:text-white dark:focus:bg-[#2d3142]">
                            <Link href={`/trust/${trust.id}`}>View Details</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 dark:text-red-400 dark:focus:bg-[#2d3142]"
                            onClick={() => setDeleteConfirmId(trust.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={open => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Delete Trust?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-[#94a3b8]">
              This will delete the trust and unlink all its schools. The schools will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-[#2d3142] dark:text-white dark:border-[#3d4254]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
