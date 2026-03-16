import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Tso } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Search, Building2, MoreHorizontal, Trash2, ExternalLink } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const RELATIONSHIP_STATUSES = [
  "Cold Outreach", "Initial Contact", "In Conversation",
  "Contacted", "Sponsoring", "Active Partner", "Deal Closed",
];

const PRIORITIES = ["🔴 URGENT", "🟠 HIGH", "🟡 MEDIUM", "⚪ LOW"];

const statusColor: Record<string, string> = {
  "Cold Outreach": "bg-gray-100 text-gray-700",
  "Initial Contact": "bg-blue-100 text-blue-700",
  "In Conversation": "bg-yellow-100 text-yellow-800",
  "Contacted": "bg-cyan-100 text-cyan-800",
  "Sponsoring": "bg-green-100 text-green-700",
  "Active Partner": "bg-purple-100 text-purple-700",
  "Deal Closed": "bg-pink-100 text-pink-700",
};

const priorityColor: Record<string, string> = {
  "🔴 URGENT": "bg-red-100 text-red-700",
  "🟠 HIGH": "bg-orange-100 text-orange-700",
  "🟡 MEDIUM": "bg-yellow-100 text-yellow-700",
  "⚪ LOW": "bg-gray-100 text-gray-500",
  "high": "bg-red-100 text-red-700",
  "medium": "bg-yellow-100 text-yellow-700",
  "low": "bg-gray-100 text-gray-500",
  "P1": "bg-red-100 text-red-700",
  "P2": "bg-orange-100 text-orange-700",
  "P3": "bg-yellow-100 text-yellow-700",
  "DIR": "bg-purple-100 text-purple-700",
};

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

export default function TsosPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
    defaultValues: { name: "", relationshipStatus: "Cold Outreach", priority: "🟡 MEDIUM" },
  });

  const filtered = (tsosData || []).filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.mainContactName || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.relationshipStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">TSOs</h1>
          <p className="text-muted-foreground text-sm">Tournament & Show Organisers</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#e91e8c] hover:bg-[#c0166e]">
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
                <Button type="submit" className="w-full bg-[#e91e8c] hover:bg-[#c0166e]" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create TSO"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search TSOs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {RELATIONSHIP_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* TSO count */}
      <p className="text-sm text-muted-foreground">{filtered.length} TSO{filtered.length !== 1 ? "s" : ""}</p>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No TSOs found</p>
          <p className="text-sm mt-1">Add your first TSO or import from CSV</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(tso => (
            <div key={tso.id} className="border rounded-lg p-4 bg-white dark:bg-[#1e1e2e] hover:shadow-md transition-shadow relative group">
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem asChild>
                      <Link href={`/tso/${tso.id}`}><ExternalLink className="h-4 w-4 mr-2" />Open</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600" onClick={() => deleteMutation.mutate(tso.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Link href={`/tso/${tso.id}`}>
                <div className="cursor-pointer">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e91e8c] to-[#9b59b6] flex items-center justify-center shrink-0">
                      <span className="text-white text-sm font-bold">{tso.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{tso.name}</h3>
                      {tso.mainContactName && (
                        <p className="text-xs text-muted-foreground truncate">{tso.mainContactName}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge className={`text-xs ${statusColor[tso.relationshipStatus || ""] || "bg-gray-100 text-gray-600"}`}>
                      {tso.relationshipStatus || "Cold Outreach"}
                    </Badge>
                    {tso.priority && (
                      <Badge className={`text-xs ${priorityColor[tso.priority] || "bg-gray-100"}`}>
                        {tso.priority}
                      </Badge>
                    )}
                  </div>

                  {tso.city && <p className="text-xs text-muted-foreground">📍 {tso.city}</p>}
                  {tso.nextStep && <p className="text-xs text-muted-foreground mt-1 truncate">→ {tso.nextStep}</p>}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
