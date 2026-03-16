import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoute, Link } from "wouter";
import type { ShowWithTso } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit2, Check, X, CalendarDays, MapPin } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const SHOW_STATUSES = ["Contacted", "In Conversation", "Sponsoring", "Confirmed", "Completed"];

const statusColor: Record<string, string> = {
  "Contacted": "bg-blue-100 text-blue-700",
  "In Conversation": "bg-yellow-100 text-yellow-800",
  "Sponsoring": "bg-green-100 text-green-700",
  "Confirmed": "bg-purple-100 text-purple-700",
  "Completed": "bg-gray-100 text-gray-600",
};

function EditableField({ label, value, onSave, type = "text" }: { label: string; value: string | null | undefined; onSave: (v: string) => void; type?: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {editing ? (
        <div className="flex gap-1">
          <Input type={type} value={val} onChange={e => setVal(e.target.value)} className="h-7 text-sm" autoFocus />
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

export default function ShowDetail() {
  const [, params] = useRoute("/show/:id");
  const id = params?.id || "";
  const { toast } = useToast();

  const { data: show, isLoading } = useQuery<ShowWithTso>({
    queryKey: [`/api/shows/${id}`],
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, any>) => apiRequest("PATCH", `/api/shows/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/shows/${id}`] }),
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  if (!show) return (
    <div className="p-6">
      <p>Show not found</p>
      <Link href="/shows"><Button variant="ghost" className="mt-2"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/shows">
          <Button variant="ghost" size="sm" className="mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Shows
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-[#e91e8c] flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{show.showName}</h1>
              {show.tso && (
                <Link href={`/tso/${show.tso.id}`}>
                  <p className="text-muted-foreground text-sm hover:text-[#e91e8c] cursor-pointer">{show.tso.name}</p>
                </Link>
              )}
            </div>
          </div>
          <Select value={show.status || "Contacted"} onValueChange={v => updateMutation.mutate({ status: v })}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHOW_STATUSES.map(s => (
                <SelectItem key={s} value={s}>
                  <Badge className={`${statusColor[s] || ""} text-xs`}>{s}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Event Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <EditableField label="Show Name" value={show.showName} onSave={v => updateMutation.mutate({ showName: v })} />
            <EditableField label="Date" value={show.showDate} onSave={v => updateMutation.mutate({ showDate: v })} type="date" />
            <EditableField label="City" value={show.city} onSave={v => updateMutation.mutate({ city: v })} />
            <EditableField label="Venue" value={show.venue} onSave={v => updateMutation.mutate({ venue: v })} />
            <EditableField label="Attending TSO" value={show.attendingTso} onSave={v => updateMutation.mutate({ attendingTso: v })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Follow-up</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <EditableField label="Next Follow-up" value={show.nextFollowupDate} onSave={v => updateMutation.mutate({ nextFollowupDate: v })} type="date" />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <Textarea
                defaultValue={show.notes || ""}
                className="text-sm min-h-[100px]"
                onBlur={e => {
                  if (e.target.value !== (show.notes || "")) {
                    updateMutation.mutate({ notes: e.target.value });
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {show.showDate && (
        <div className="text-sm text-muted-foreground">
          Created {format(new Date(show.createdAt || new Date()), "d MMM yyyy")}
        </div>
      )}
    </div>
  );
}
