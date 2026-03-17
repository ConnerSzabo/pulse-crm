import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Tso } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Plus, Search, Building2, MoreHorizontal, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, MapPin,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

/* ─── Constants ──────────────────────────────────────────── */

const RELATIONSHIP_STATUSES = [
  "Not Contacted",
  "Attempt 1: Initial Comms Sent", "Attempt 2: Follow-up Sent", "Attempt 3: Final Follow-up",
  "Initial Response", "Info Requested", "Details Received",
  "Proposal Sent", "Negotiating", "Needs Promo Codes",
  "Confirmed", "Not Interested", "Ghosted / Disqualified",
];

const PRIORITIES = ["P1", "P2", "P3", "DIR"];

const PRIORITY_ORDER: Record<string, number> = { P1: 1, P2: 2, P3: 3, DIR: 4 };

const PRIORITY_STYLES: Record<string, string> = {
  P1:  "bg-red-500/20 text-red-300 border border-red-500/30",
  P2:  "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  P3:  "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  DIR: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
};

const STATUS_STYLES: Record<string, string> = {
  "Not Contacted":                  "bg-slate-500/20 text-slate-300 border border-slate-500/30",
  "Attempt 1: Initial Comms Sent":  "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  "Attempt 2: Follow-up Sent":      "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  "Attempt 3: Final Follow-up":     "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  "Initial Response":               "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
  "Info Requested":                 "bg-pink-500/20 text-pink-300 border border-pink-500/30",
  "Details Received":               "bg-violet-500/20 text-violet-300 border border-violet-500/30",
  "Proposal Sent":                  "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  "Negotiating":                    "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  "Needs Promo Codes":              "bg-slate-500/20 text-slate-300 border border-slate-500/30",
  "Confirmed":                      "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  "Not Interested":                 "bg-red-500/20 text-red-300 border border-red-500/30",
  "Ghosted / Disqualified":         "bg-slate-500/20 text-slate-400 border border-slate-500/30",
};

type SortField = "name" | "priority" | "status" | "city";
type SortDir = "asc" | "desc";

const addSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().optional(),
  city: z.string().optional(),
  mainContactName: z.string().optional(),
  relationshipStatus: z.string().optional(),
  priority: z.string().optional(),
});

type AddForm = z.infer<typeof addSchema>;

/* ─── Sort icon helper ───────────────────────────────────── */
function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="h-3.5 w-3.5 text-[#64748b]" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 text-[#6366f1]" />
    : <ChevronDown className="h-3.5 w-3.5 text-[#6366f1]" />;
}

/* ─── Page ───────────────────────────────────────────────── */
export default function TsosPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("priority");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [addOpen, setAddOpen] = useState(false);
  const { toast } = useToast();

  const { data: tsosData, isLoading } = useQuery<Tso[]>({ queryKey: ["/api/tsos"] });

  const createMutation = useMutation({
    mutationFn: (data: AddForm) => apiRequest("POST", "/api/tsos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tsos"] });
      setAddOpen(false);
      form.reset();
      toast({ title: "TSO created" });
    },
    onError: () => toast({ title: "Failed to create TSO", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/tsos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tsos"] });
      toast({ title: "TSO deleted" });
    },
  });

  const form = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: { name: "", relationshipStatus: "Not Contacted", priority: "P3" },
  });

  /* ── Filter + sort ── */
  const filtered = (tsosData || []).filter(t => {
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.mainContactName || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.city || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.relationshipStatus === statusFilter;
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === "priority") {
      const pa = PRIORITY_ORDER[a.priority || ""] ?? 99;
      const pb = PRIORITY_ORDER[b.priority || ""] ?? 99;
      cmp = pa - pb;
    } else if (sortField === "name") {
      cmp = a.name.localeCompare(b.name);
    } else if (sortField === "status") {
      cmp = (a.relationshipStatus || "").localeCompare(b.relationshipStatus || "");
    } else if (sortField === "city") {
      cmp = (a.city || "").localeCompare(b.city || "");
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  /* ── Priority counts for filter pills ── */
  const countByPriority = (tsosData || []).reduce<Record<string, number>>((acc, t) => {
    if (t.priority) acc[t.priority] = (acc[t.priority] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">TSOs</h1>
          <p className="text-muted-foreground text-sm">
            {tsosData?.length ?? 0} Tournament &amp; Show Organisers
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#6366f1] hover:bg-[#7c3aed]">
              <Plus className="h-4 w-4 mr-2" /> Add TSO
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add TSO</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-3">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="mainContactName" render={({ field }) => (
                    <FormItem><FormLabel>Main Contact</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="website" render={({ field }) => (
                    <FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="relationshipStatus" render={({ field }) => (
                    <FormItem><FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{RELATIONSHIP_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem><FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full bg-[#6366f1] hover:bg-[#7c3aed]" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create TSO"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Priority filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[#64748b] font-medium mr-1">Priority:</span>
        {(["all", ...PRIORITIES] as const).map(p => {
          const active = priorityFilter === p;
          const count = p === "all" ? (tsosData?.length ?? 0) : (countByPriority[p] ?? 0);
          return (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                active
                  ? p === "all"
                    ? "bg-[#6366f1] text-white border-[#6366f1]"
                    : (PRIORITY_STYLES[p] || "bg-slate-500/20 text-slate-300 border-slate-500/30") + " opacity-100 scale-105"
                  : "bg-transparent text-[#64748b] border-[#2d3548] hover:border-[#6366f1]/40 hover:text-[#94a3b8]"
              }`}>
              {p === "all" ? "All" : p}
              <span className={`text-[10px] ${active ? "opacity-80" : "opacity-50"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search + status filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, contact, city..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {RELATIONSHIP_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Result count */}
      <p className="text-xs text-[#64748b]">
        {sorted.length} of {tsosData?.length ?? 0} TSO{sorted.length !== 1 ? "s" : ""}
      </p>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium">No TSOs found</p>
          <p className="text-sm mt-1">Try adjusting your filters or add a new TSO</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#2d3548] overflow-hidden">
          {/* Table header */}
          <div className="grid text-[11px] font-semibold uppercase tracking-wider text-[#64748b] px-4 py-2.5 border-b border-[#2d3548] bg-[#0f1419]/60"
            style={{ gridTemplateColumns: "2fr 1fr 90px 160px 1fr 40px" }}>
            <button className="flex items-center gap-1 hover:text-[#94a3b8] transition-colors text-left" onClick={() => toggleSort("name")}>
              TSO <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
            </button>
            <button className="flex items-center gap-1 hover:text-[#94a3b8] transition-colors text-left" onClick={() => toggleSort("city")}>
              City <SortIcon field="city" sortField={sortField} sortDir={sortDir} />
            </button>
            <button className="flex items-center gap-1 hover:text-[#94a3b8] transition-colors text-left" onClick={() => toggleSort("priority")}>
              Priority <SortIcon field="priority" sortField={sortField} sortDir={sortDir} />
            </button>
            <button className="flex items-center gap-1 hover:text-[#94a3b8] transition-colors text-left" onClick={() => toggleSort("status")}>
              Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
            </button>
            <span>Next Step</span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#2d3548]">
            {sorted.map(tso => (
              <Link key={tso.id} href={`/tso/${tso.id}`}>
                <div
                  className="grid items-center px-4 py-3 hover:bg-[#6366f1]/5 transition-colors cursor-pointer group"
                  style={{ gridTemplateColumns: "2fr 1fr 90px 160px 1fr 40px" }}>

                  {/* Name + contact */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-sm font-bold"
                      style={{ background: "linear-gradient(135deg, #6366f1, #7c3aed)" }}>
                      {tso.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-[#f1f5f9] truncate group-hover:text-white">{tso.name}</p>
                      {tso.mainContactName && (
                        <p className="text-xs text-[#64748b] truncate">{tso.mainContactName}</p>
                      )}
                    </div>
                  </div>

                  {/* City */}
                  <div className="min-w-0">
                    {tso.city ? (
                      <span className="text-sm text-[#94a3b8] flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />{tso.city}
                      </span>
                    ) : (
                      <span className="text-sm text-[#3d4558]">—</span>
                    )}
                  </div>

                  {/* Priority */}
                  <div>
                    {tso.priority ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_STYLES[tso.priority] || "bg-slate-500/20 text-slate-400 border border-slate-500/30"}`}>
                        {tso.priority}
                      </span>
                    ) : (
                      <span className="text-sm text-[#3d4558]">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[tso.relationshipStatus || ""] || "bg-slate-500/20 text-slate-400 border border-slate-500/30"}`}>
                      {tso.relationshipStatus || "Not Contacted"}
                    </span>
                  </div>

                  {/* Next step */}
                  <div className="min-w-0 pr-2">
                    {tso.nextStep ? (
                      <p className="text-xs text-[#64748b] truncate">{tso.nextStep}</p>
                    ) : (
                      <span className="text-sm text-[#3d4558]">—</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end" onClick={e => e.preventDefault()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-[#64748b] hover:text-[#f1f5f9]">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1a1f2e] border-[#2d3548] text-[#f1f5f9]">
                        <DropdownMenuItem asChild className="hover:bg-[#252b3d] cursor-pointer">
                          <Link href={`/tso/${tso.id}`}>Open</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-400 hover:bg-red-500/10 cursor-pointer"
                          onClick={() => deleteMutation.mutate(tso.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
