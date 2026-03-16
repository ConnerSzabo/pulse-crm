import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoute, Link } from "wouter";
import type { TsoWithRelations, Show, Task, Activity } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import {
  ArrowLeft, Phone, Mail, Globe, MapPin, Edit2, Check, X,
  Plus, CalendarDays, ListTodo, Activity as ActivityIcon, MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RELATIONSHIP_STATUSES = [
  "Cold Outreach", "Initial Contact", "In Conversation",
  "Contacted", "Sponsoring", "Active Partner", "Deal Closed",
];

const statusColor: Record<string, string> = {
  "Cold Outreach": "bg-gray-100 text-gray-700",
  "Initial Contact": "bg-blue-100 text-blue-700",
  "In Conversation": "bg-yellow-100 text-yellow-800",
  "Contacted": "bg-cyan-100 text-cyan-800",
  "Sponsoring": "bg-green-100 text-green-700",
  "Active Partner": "bg-purple-100 text-purple-700",
  "Deal Closed": "bg-pink-100 text-pink-700",
};

const showStatusColor: Record<string, string> = {
  "Contacted": "bg-blue-100 text-blue-700",
  "In Conversation": "bg-yellow-100 text-yellow-800",
  "Sponsoring": "bg-green-100 text-green-700",
  "Confirmed": "bg-purple-100 text-purple-700",
  "Completed": "bg-gray-100 text-gray-600",
};

function EditableField({ label, value, onSave }: { label: string; value: string | null | undefined; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {editing ? (
        <div className="flex gap-1">
          <Input value={val} onChange={e => setVal(e.target.value)} className="h-7 text-sm" autoFocus />
          <Button size="icon" className="h-7 w-7 bg-green-500 hover:bg-green-600" onClick={() => { onSave(val); setEditing(false); }}>
            <Check className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setVal(value || ""); setEditing(false); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1 group cursor-pointer" onClick={() => setEditing(true)}>
          <p className="text-sm">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
          <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
    </div>
  );
}

export default function TsoDetail() {
  const [, params] = useRoute("/tso/:id");
  const id = params?.id || "";
  const { toast } = useToast();
  const [newNote, setNewNote] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const { data: tso, isLoading } = useQuery<TsoWithRelations>({
    queryKey: [`/api/tsos/${id}`],
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, any>) => apiRequest("PATCH", `/api/tsos/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/tsos/${id}`] }),
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const addActivityMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/tsos/${id}/activities`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tsos/${id}`] });
      setNewNote("");
    },
    onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
  });

  const addTaskMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tasks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tsos/${id}`] });
      setNewTaskTitle("");
    },
    onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, ...data }: { taskId: string; [k: string]: any }) =>
      apiRequest("PATCH", `/api/tasks/${taskId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/tsos/${id}`] }),
  });

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
    </div>
  );

  if (!tso) return (
    <div className="p-6">
      <p>TSO not found</p>
      <Link href="/tsos"><Button variant="ghost" className="mt-2"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Link href="/tsos">
          <Button variant="ghost" size="sm" className="mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> TSOs
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#e91e8c] to-[#9b59b6] flex items-center justify-center shrink-0">
              <span className="text-white text-xl font-bold">{tso.name.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">{tso.name}</h1>
              {tso.mainContactName && <p className="text-muted-foreground">Contact: {tso.mainContactName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Select value={tso.relationshipStatus || "Cold Outreach"}
              onValueChange={v => updateMutation.mutate({ relationshipStatus: v })}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>
                    <Badge className={`${statusColor[s] || ""} text-xs`}>{s}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tso.isRecurring && <Badge className="bg-purple-100 text-purple-700">Recurring</Badge>}
            {tso.tsoOnMainCrm && <Badge className="bg-blue-100 text-blue-700">On Main CRM</Badge>}
          </div>
        </div>
      </div>

      {/* Next step banner */}
      {tso.nextStep && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
          <span className="text-yellow-600 font-medium text-sm">Next step:</span>
          <span className="text-sm">{tso.nextStep}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Contact Info</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <EditableField label="Main Contact" value={tso.mainContactName} onSave={v => updateMutation.mutate({ mainContactName: v })} />
              {(tso as any).contactRole && <div><p className="text-xs text-muted-foreground mb-0.5">Role</p><p className="text-sm">{(tso as any).contactRole}</p></div>}
              <EditableField label="Phone" value={tso.phone} onSave={v => updateMutation.mutate({ phone: v })} />
              {(tso as any).contactNumber && <div><p className="text-xs text-muted-foreground mb-0.5">Contact Number</p><p className="text-sm">{(tso as any).contactNumber}</p></div>}
              <EditableField label="Email" value={tso.email} onSave={v => updateMutation.mutate({ email: v })} />
              <EditableField label="Website" value={tso.website} onSave={v => updateMutation.mutate({ website: v })} />
              <EditableField label="City" value={tso.city} onSave={v => updateMutation.mutate({ city: v })} />
              {(tso as any).igHandle && (
                <div><p className="text-xs text-muted-foreground mb-0.5">Instagram</p>
                  <a href={`https://instagram.com/${(tso as any).igHandle?.replace("@","")}`} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-[#e91e8c] hover:underline">{(tso as any).igHandle}</a>
                </div>
              )}
              {(tso as any).linkedin && (
                <div><p className="text-xs text-muted-foreground mb-0.5">LinkedIn</p>
                  <a href={(tso as any).linkedin} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate block">{(tso as any).linkedin}</a>
                </div>
              )}
              {(tso as any).profileLink && (
                <div><p className="text-xs text-muted-foreground mb-0.5">Profile / Website</p>
                  <a href={(tso as any).profileLink} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate block">{(tso as any).profileLink}</a>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Partnership Info</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(tso as any).sponsorInfo && <div><p className="text-xs text-muted-foreground mb-0.5">Sponsor Pricing</p><p className="text-sm">{(tso as any).sponsorInfo}</p></div>}
              <EditableField label="Promo Options" value={tso.promoOptions} onSave={v => updateMutation.mutate({ promoOptions: v })} />
              <EditableField label="Pricing Notes" value={tso.pricingNotes} onSave={v => updateMutation.mutate({ pricingNotes: v })} />
              <EditableField label="Next Step" value={tso.nextStep} onSave={v => updateMutation.mutate({ nextStep: v })} />
              {(tso as any).estAnnualReach && <div><p className="text-xs text-muted-foreground mb-0.5">Est. Annual Reach</p><p className="text-sm font-medium">{(tso as any).estAnnualReach}</p></div>}
              {(tso as any).showsPerYear && <div><p className="text-xs text-muted-foreground mb-0.5">Shows Per Year (2026)</p><p className="text-sm">{(tso as any).showsPerYear}</p></div>}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Existing Account:</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${(tso as any).existingAccount ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {(tso as any).existingAccount ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Vendor Access:</span>
                  <button onClick={() => updateMutation.mutate({ vendorAccess: !tso.vendorAccess })}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${tso.vendorAccess ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                    {tso.vendorAccess ? "Yes" : "No"}
                  </button>
                </div>
              </div>
              {(tso as any).tsoEventCodes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Event Codes</p>
                  <pre className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap font-mono">{(tso as any).tsoEventCodes}</pre>
                </div>
              )}
              {(tso as any).activitiesNotes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Activities / Deliverables</p>
                  <p className="text-sm">{(tso as any).activitiesNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {((tso as any).followUpDate || (tso as any).nextShowDate) && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Dates</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(tso as any).followUpDate && <div><p className="text-xs text-muted-foreground">Follow-up Date</p><p className="text-sm font-medium">{(tso as any).followUpDate}</p></div>}
                {(tso as any).nextShowDate && <div><p className="text-xs text-muted-foreground">Next Show Date</p><p className="text-sm font-medium">{(tso as any).nextShowDate}</p></div>}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Tabs */}
        <div className="md:col-span-2">
          <Tabs defaultValue="shows">
            <TabsList>
              <TabsTrigger value="shows">
                <CalendarDays className="h-3.5 w-3.5 mr-1.5" />Shows ({tso.shows?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="tasks">
                <ListTodo className="h-3.5 w-3.5 mr-1.5" />Tasks ({tso.tasks?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="activity">
                <ActivityIcon className="h-3.5 w-3.5 mr-1.5" />Activity ({tso.activities?.length || 0})
              </TabsTrigger>
            </TabsList>

            {/* Shows Tab */}
            <TabsContent value="shows" className="mt-4 space-y-3">
              {(tso.shows || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No shows linked</p>
              ) : (
                (tso.shows || []).map((show: Show) => (
                  <Link key={show.id} href={`/show/${show.id}`}>
                    <div className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{show.showName}</p>
                          <p className="text-xs text-muted-foreground">
                            {[show.city, show.venue].filter(Boolean).join(" · ")}
                            {show.showDate ? ` · ${format(new Date(show.showDate), "d MMM yyyy")}` : ""}
                          </p>
                        </div>
                        <Badge className={`text-xs ${showStatusColor[show.status || ""] || "bg-gray-100 text-gray-600"}`}>
                          {show.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a task..."
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newTaskTitle.trim()) {
                      addTaskMutation.mutate({ title: newTaskTitle.trim(), tsoId: id, status: "To Do", priority: "medium" });
                    }
                  }}
                />
                <Button size="sm" onClick={() => {
                  if (newTaskTitle.trim()) addTaskMutation.mutate({ title: newTaskTitle.trim(), tsoId: id, status: "To Do", priority: "medium" });
                }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {(tso.tasks || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks</p>
              ) : (
                (tso.tasks || []).map((task: Task) => (
                  <div key={task.id} className="border rounded-lg p-3 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={task.status === "Done"}
                      onChange={() => updateTaskMutation.mutate({
                        taskId: task.id,
                        status: task.status === "Done" ? "To Do" : "Done",
                      })}
                      className="mt-0.5 h-4 w-4 rounded cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${task.status === "Done" ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {task.dueDate && (
                          <span className="text-xs text-muted-foreground">
                            Due {format(new Date(task.dueDate), "d MMM")}
                          </span>
                        )}
                        {task.owner && <Badge className="text-xs bg-gray-100 text-gray-600">{task.owner}</Badge>}
                        <Badge className={`text-xs ${task.priority === "high" ? "bg-red-100 text-red-700" : task.priority === "low" ? "bg-gray-100 text-gray-500" : "bg-yellow-100 text-yellow-700"}`}>
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="min-h-[60px] text-sm resize-none"
                />
                <Button size="sm" className="self-end" onClick={() => {
                  if (newNote.trim()) addActivityMutation.mutate({ type: "note", note: newNote.trim() });
                }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {(tso.activities || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet</p>
              ) : (
                (tso.activities || []).map((act: Activity) => (
                  <div key={act.id} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="text-xs capitalize bg-gray-100 text-gray-600">{act.type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(act.createdAt), "d MMM yyyy, HH:mm")}
                      </span>
                      {act.loggedBy && <span className="text-xs text-muted-foreground">· {act.loggedBy}</span>}
                    </div>
                    <p className="text-sm">{act.note}</p>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
