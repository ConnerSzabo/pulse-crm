import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { ShowWithTso } from "@shared/schema";
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
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Plus, Search, CalendarDays, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isAfter, isBefore, startOfToday } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const SHOW_STATUSES = ["Contacted", "In Conversation", "Sponsoring", "Confirmed", "Completed"];

const statusColor: Record<string, string> = {
  "Contacted": "bg-blue-100 text-blue-700",
  "In Conversation": "bg-yellow-100 text-yellow-800",
  "Sponsoring": "bg-green-100 text-green-700",
  "Confirmed": "bg-purple-100 text-purple-700",
  "Completed": "bg-gray-100 text-gray-600",
};

const addSchema = z.object({
  showName: z.string().min(1, "Show name is required"),
  tsoId: z.string().optional(),
  showDate: z.string().optional(),
  city: z.string().optional(),
  venue: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

type AddForm = z.infer<typeof addSchema>;

export default function ShowsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("upcoming");
  const [addOpen, setAddOpen] = useState(false);
  const { toast } = useToast();

  const { data: showsData, isLoading } = useQuery<ShowWithTso[]>({ queryKey: ["/api/shows"] });
  const { data: tsos } = useQuery<any[]>({ queryKey: ["/api/tsos"] });

  const createMutation = useMutation({
    mutationFn: (data: AddForm) => apiRequest("POST", "/api/shows", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shows"] });
      setAddOpen(false);
      form.reset();
      toast({ title: "Show created" });
    },
    onError: () => toast({ title: "Failed to create show", variant: "destructive" }),
  });

  const form = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: { showName: "", status: "Contacted" },
  });

  const today = startOfToday();
  const filtered = (showsData || []).filter(s => {
    const matchSearch = !search || s.showName.toLowerCase().includes(search.toLowerCase()) ||
      (s.tso?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.city || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const showDate = s.showDate ? new Date(s.showDate) : null;
    const matchTime = timeFilter === "all" ||
      (timeFilter === "upcoming" && (!showDate || !isBefore(showDate, today))) ||
      (timeFilter === "past" && showDate && isBefore(showDate, today));
    return matchSearch && matchStatus && matchTime;
  });

  // Sort by date
  const sorted = [...filtered].sort((a, b) => {
    if (!a.showDate) return 1;
    if (!b.showDate) return -1;
    return new Date(a.showDate).getTime() - new Date(b.showDate).getTime();
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shows</h1>
          <p className="text-muted-foreground text-sm">All Pokémon events and tournaments</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#e91e8c] hover:bg-[#c0166e]">
              <Plus className="h-4 w-4 mr-2" /> Add Show
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Show</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-3">
                <FormField control={form.control} name="showName" render={({ field }) => (
                  <FormItem><FormLabel>Show Name *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
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
                  <FormField control={form.control} name="showDate" render={({ field }) => (
                    <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{SHOW_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="venue" render={({ field }) => (
                    <FormItem><FormLabel>Venue</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full bg-[#e91e8c] hover:bg-[#c0166e]" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Show"}
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
          <Input placeholder="Search shows..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Past</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {SHOW_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{sorted.length} show{sorted.length !== 1 ? "s" : ""}</p>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No shows found</p>
          <p className="text-sm mt-1">Add a show or import from CSV</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(show => {
            const showDate = show.showDate ? new Date(show.showDate) : null;
            const isPast = showDate && isBefore(showDate, today);
            return (
              <Link key={show.id} href={`/show/${show.id}`}>
                <div className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-[#1e1e2e] ${isPast ? "opacity-70" : ""}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Date block */}
                      <div className="shrink-0 text-center w-14">
                        {showDate ? (
                          <>
                            <p className="text-xs text-muted-foreground uppercase">{format(showDate, "MMM")}</p>
                            <p className="text-2xl font-bold leading-none">{format(showDate, "d")}</p>
                            <p className="text-xs text-muted-foreground">{format(showDate, "yyyy")}</p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">TBD</p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold">{show.showName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {show.tso && <span>{show.tso.name}</span>}
                          {show.city && <><span>·</span><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{show.city}</span></>}
                          {show.venue && <><span>·</span><span>{show.venue}</span></>}
                        </div>
                        {show.attendingTso && (
                          <p className="text-xs text-muted-foreground mt-0.5">Attending: {show.attendingTso}</p>
                        )}
                      </div>
                    </div>
                    <Badge className={`text-xs shrink-0 ${statusColor[show.status || ""] || "bg-gray-100 text-gray-600"}`}>
                      {show.status}
                    </Badge>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
