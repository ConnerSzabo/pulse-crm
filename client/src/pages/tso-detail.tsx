import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoute, Link } from "wouter";
import type { TsoWithRelations, Show, Task, Activity } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import {
  ArrowLeft, Phone, Mail, Globe, Edit2, Check, X, Plus,
  CalendarDays, ListTodo, Activity as ActivityIcon,
  Copy, ExternalLink, Instagram, Linkedin, User, MapPin,
  Zap, Calendar, Trash2, UserPlus,
} from "lucide-react";
import type { Contact } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

/* ─── Constants ─────────────────────────────────────────── */
const RELATIONSHIP_STATUSES = [
  "Not Contacted",
  "Attempt 1: Initial Comms Sent", "Attempt 2: Follow-up Sent", "Attempt 3: Final Follow-up",
  "Initial Response", "Info Requested", "Details Received",
  "Proposal Sent", "Negotiating", "Needs Promo Codes",
  "Confirmed", "Not Interested", "Ghosted / Disqualified",
];

const PRIORITIES = ["Urgent", "High", "Medium", "Low"];

const STATUS_COLORS: Record<string, string> = {
  "Not Contacted":                  "bg-slate-500/20 text-slate-300 border-slate-500/30",
  "Attempt 1: Initial Comms Sent":  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Attempt 2: Follow-up Sent":      "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Attempt 3: Final Follow-up":     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Initial Response":               "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "Info Requested":                 "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Details Received":               "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "Proposal Sent":                  "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Negotiating":                    "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Needs Promo Codes":              "bg-slate-500/20 text-slate-300 border-slate-500/30",
  "Confirmed":                      "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Not Interested":                 "bg-red-500/20 text-red-300 border-red-500/30",
  "Ghosted / Disqualified":         "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  "Urgent": "bg-red-500/20 text-red-300 border-red-500/30",
  "High":   "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Medium": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Low":    "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const SHOW_STATUS_COLORS: Record<string, string> = {
  "Contacted":       "bg-blue-500/20 text-blue-300",
  "In Conversation": "bg-amber-500/20 text-amber-300",
  "Sponsoring":      "bg-emerald-500/20 text-emerald-300",
  "Confirmed":       "bg-purple-500/20 text-purple-300",
  "Completed":       "bg-slate-500/20 text-slate-400",
};

/* ─── Sub-components ─────────────────────────────────────── */

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#2d3548] bg-[rgba(51,65,85,0.25)] backdrop-blur-sm p-5">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-[#6366f1] mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${className}`}>
      {children}
    </span>
  );
}

function StatCard({
  title, value, subtitle, gradient = "from-indigo-500 to-purple-600",
}: { title: string; value: string | number; subtitle?: string; gradient?: string }) {
  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${gradient} border border-white/10 shadow-lg`}>
      <div className="text-white/70 text-xs mb-1 font-medium">{title}</div>
      <div className="text-white text-2xl font-bold">{value || "—"}</div>
      {subtitle && <div className="text-white/50 text-xs mt-1">{subtitle}</div>}
    </div>
  );
}

function EditableField({
  label, value, field, icon, onSave, type = "text", href, onCopy,
}: {
  label: string;
  value: string | null | undefined;
  field?: string;
  icon?: React.ReactNode;
  onSave: (v: string) => void;
  type?: string;
  href?: string;
  onCopy?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");

  const handleSave = () => { onSave(val); setEditing(false); };
  const handleCancel = () => { setVal(value || ""); setEditing(false); };

  return (
    <div className="group">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748b] mb-1.5 flex items-center gap-1.5">
        {icon && <span className="text-[#6366f1]">{icon}</span>}
        {label}
      </p>
      {editing ? (
        <div className="flex gap-1.5">
          <input
            type={type}
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
            autoFocus
            className="flex-1 h-8 px-3 text-sm rounded-lg border border-[#6366f1]/50 bg-[#0f1419] text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/30"
          />
          <button onClick={handleSave}
            className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 flex items-center justify-center transition-colors">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleCancel}
            className="h-8 w-8 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 flex items-center justify-center transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-black/20 cursor-pointer hover:bg-black/30 transition-colors"
          onClick={() => { setEditing(true); setVal(value || ""); }}>
          {value ? (
            href ? (
              <a href={href} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex-1 text-sm text-[#6366f1] hover:text-[#818cf8] truncate flex items-center gap-1">
                {value}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : (
              <span className="flex-1 text-sm text-[#f1f5f9] truncate">{value}</span>
            )
          ) : (
            <span className="flex-1 text-sm text-[#64748b] italic">Not set</span>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            {onCopy && value && (
              <button onClick={e => { e.stopPropagation(); onCopy(); }}
                className="opacity-0 group-hover:opacity-100 text-[#64748b] hover:text-[#f1f5f9] transition-all">
                <Copy className="h-3 w-3" />
              </button>
            )}
            <Edit2 className="h-3 w-3 text-[#64748b] opacity-0 group-hover:opacity-100 transition-all" />
          </div>
        </div>
      )}
    </div>
  );
}

function EditableTextarea({
  label, value, onSave,
}: { label: string; value: string | null | undefined; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");

  const handleSave = () => { onSave(val); setEditing(false); };
  const handleCancel = () => { setVal(value || ""); setEditing(false); };

  return (
    <div className="group">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748b] mb-1.5">{label}</p>
      {editing ? (
        <div className="space-y-1.5">
          <textarea
            value={val}
            onChange={e => setVal(e.target.value)}
            autoFocus
            rows={4}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#6366f1]/50 bg-[#0f1419] text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/30 resize-none"
          />
          <div className="flex gap-1.5">
            <button onClick={handleSave}
              className="h-7 px-3 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium flex items-center gap-1 transition-colors">
              <Check className="h-3 w-3" /> Save
            </button>
            <button onClick={handleCancel}
              className="h-7 px-3 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 text-xs font-medium flex items-center gap-1 transition-colors">
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg px-3 py-2 bg-black/20 cursor-pointer hover:bg-black/30 transition-colors min-h-[60px] relative"
          onClick={() => { setEditing(true); setVal(value || ""); }}>
          {value ? (
            <p className="text-sm text-[#f1f5f9] whitespace-pre-wrap pr-5">{value}</p>
          ) : (
            <p className="text-sm text-[#64748b] italic">Not set</p>
          )}
          <Edit2 className="h-3 w-3 text-[#64748b] opacity-0 group-hover:opacity-100 transition-all absolute top-2.5 right-2.5" />
        </div>
      )}
    </div>
  );
}

function EditableSelect({
  label, value, options, onSave, colorMap = {},
}: {
  label: string;
  value: string | null | undefined;
  options: string[];
  onSave: (v: string) => void;
  colorMap?: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="group">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748b] mb-1.5">{label}</p>
        <div className="flex gap-1.5 items-center">
          <Select value={value || ""} onValueChange={v => { onSave(v); setEditing(false); }}>
            <SelectTrigger className="flex-1 h-8 text-sm border-[#6366f1]/50 bg-[#0f1419] text-[#f1f5f9] focus:ring-[#6366f1]/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1f2e] border-[#2d3548] text-[#f1f5f9]">
              {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={() => setEditing(false)}
            className="h-8 w-8 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 flex items-center justify-center transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748b] mb-1.5">{label}</p>
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setEditing(true)}>
        {value ? (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorMap[value] || "bg-slate-500/20 text-slate-300 border-slate-500/30"}`}>
            {value}
          </span>
        ) : (
          <span className="text-sm text-[#64748b] italic">Not set</span>
        )}
        <Edit2 className="h-3 w-3 text-[#64748b] opacity-0 group-hover:opacity-100 transition-all" />
      </div>
    </div>
  );
}

function ToggleField({
  label, value, onToggle,
}: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#94a3b8]">{label}</span>
      <button onClick={onToggle}
        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
          value
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30"
            : "bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/30"
        }`}>
        {value ? "Yes" : "No"}
      </button>
    </div>
  );
}

/* ─── Contact Card ───────────────────────────────────────── */
function ContactCard({
  contact,
  onUpdate,
  onDelete,
}: {
  contact: Contact & { igHandle?: string | null };
  onUpdate: (id: string, data: Record<string, any>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: contact.name || "",
    email: contact.email || "",
    phone: contact.phone || "",
    role: contact.role || "",
    igHandle: contact.igHandle || "",
  });

  const handleSave = () => {
    onUpdate(contact.id, form);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-[#6366f1]/40 bg-[#6366f1]/5 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["name", "role", "email", "phone", "igHandle"] as const).map(field => (
            <div key={field} className={field === "email" ? "col-span-2" : ""}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748b] mb-1">
                {field === "igHandle" ? "Instagram" : field.charAt(0).toUpperCase() + field.slice(1)}
              </p>
              <input
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full h-7 px-2 text-xs rounded-lg border border-[#2d3548] bg-[#0f1419] text-[#f1f5f9] focus:outline-none focus:border-[#6366f1]/50"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave}
            className="flex-1 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors">
            <Check className="h-3 w-3" /> Save
          </button>
          <button onClick={() => setEditing(false)}
            className="flex-1 h-7 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors">
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#2d3548] bg-black/20 p-4 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ background: "linear-gradient(135deg, #6366f1, #7c3aed)" }}>
            {(contact.name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f1f5f9]">{contact.name || "Unknown"}</p>
            {contact.role && <p className="text-[10px] text-[#64748b]">{contact.role}</p>}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)}
            className="h-6 w-6 rounded-md bg-[#6366f1]/20 text-[#818cf8] hover:bg-[#6366f1]/30 flex items-center justify-center transition-colors">
            <Edit2 className="h-3 w-3" />
          </button>
          <button onClick={() => onDelete(contact.id)}
            className="h-6 w-6 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        {contact.email && (
          <a href={`mailto:${contact.email}`}
            className="flex items-center gap-2 text-xs text-[#94a3b8] hover:text-[#6366f1] transition-colors group/item">
            <Mail className="h-3 w-3 shrink-0 text-[#6366f1]" />
            <span className="truncate">{contact.email}</span>
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`}
            className="flex items-center gap-2 text-xs text-[#94a3b8] hover:text-[#f1f5f9] transition-colors">
            <Phone className="h-3 w-3 shrink-0 text-[#64748b]" />
            <span>{contact.phone}</span>
          </a>
        )}
        {contact.igHandle && (
          <a href={`https://instagram.com/${contact.igHandle.replace("@", "")}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#94a3b8] hover:text-[#e879f9] transition-colors">
            <Instagram className="h-3 w-3 shrink-0 text-[#64748b]" />
            <span>{contact.igHandle}</span>
          </a>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export default function TsoDetail() {
  const [, params] = useRoute("/tso/:id");
  const id = params?.id || "";
  const { toast } = useToast();
  const [newNote, setNewNote] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeTab, setActiveTab] = useState<"about" | "shows" | "tasks" | "activity">("about");

  const { data: tso, isLoading } = useQuery<TsoWithRelations>({
    queryKey: [`/api/tsos/${id}`],
    enabled: !!id,
  });

  const update = useMutation({
    mutationFn: (data: Record<string, any>) => apiRequest("PATCH", `/api/tsos/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/tsos/${id}`] }),
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const addActivity = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/tsos/${id}/activities`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/tsos/${id}`] }); setNewNote(""); },
    onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
  });

  const addTask = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tasks", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/tsos/${id}`] }); setNewTaskTitle(""); },
    onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, ...data }: { taskId: string; [k: string]: any }) =>
      apiRequest("PATCH", `/api/tasks/${taskId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/tsos/${id}`] }),
  });

  const addContact = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/tsos/${id}/contacts`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/tsos/${id}`] }),
    onError: () => toast({ title: "Failed to add contact", variant: "destructive" }),
  });

  const updateContact = useMutation({
    mutationFn: ({ contactId, ...data }: { contactId: string; [k: string]: any }) =>
      apiRequest("PATCH", `/api/contacts/${contactId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/tsos/${id}`] }),
    onError: () => toast({ title: "Failed to update contact", variant: "destructive" }),
  });

  const deleteContact = useMutation({
    mutationFn: (contactId: string) => apiRequest("DELETE", `/api/contacts/${contactId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/tsos/${id}`] }),
    onError: () => toast({ title: "Failed to delete contact", variant: "destructive" }),
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: `${label} copied` }));
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#0f1419] p-8 space-y-4">
      <Skeleton className="h-8 w-48 bg-[#1a1f2e]" />
      <Skeleton className="h-24 w-full bg-[#1a1f2e]" />
      <div className="grid gap-6" style={{ gridTemplateColumns: "320px 1fr 340px" }}>
        <Skeleton className="h-64 bg-[#1a1f2e] rounded-xl" />
        <Skeleton className="h-96 bg-[#1a1f2e] rounded-xl" />
        <Skeleton className="h-64 bg-[#1a1f2e] rounded-xl" />
      </div>
    </div>
  );

  if (!tso) return (
    <div className="min-h-screen bg-[#0f1419] p-8">
      <p className="text-[#94a3b8]">TSO not found</p>
      <Link href="/tsos">
        <button className="mt-3 flex items-center gap-2 text-[#6366f1] hover:text-[#818cf8] text-sm transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to TSOs
        </button>
      </Link>
    </div>
  );

  const t = tso as any;
  const shows = tso.shows || [];
  const tasks = tso.tasks || [];
  const activities = tso.activities || [];

  const tabs: Array<{ key: "about" | "shows" | "tasks" | "activity"; label: string; icon?: React.ReactNode }> = [
    { key: "about", label: "About" },
    { key: "shows", label: `Shows (${shows.length})`, icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { key: "tasks", label: `Tasks (${tasks.length})`, icon: <ListTodo className="h-3.5 w-3.5" /> },
    { key: "activity", label: `Activity (${activities.length})`, icon: <ActivityIcon className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0f1419 0%, #1a1f2e 100%)" }}>

      {/* ── Header ── */}
      <div className="border-b border-[#2d3548] px-8 py-5"
        style={{ background: "rgba(26,31,46,0.85)", backdropFilter: "blur(12px)" }}>
        <Link href="/tsos">
          <button className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#94a3b8] mb-4 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to TSOs
          </button>
        </Link>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg text-white text-xl font-bold"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)" }}>
              {tso.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#f1f5f9]">{tso.name}</h1>
              {tso.city && (
                <p className="text-sm text-[#94a3b8] flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" /> {tso.city}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {tso.isRecurring && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-purple-500/20 text-purple-300 border-purple-500/30">
                Recurring
              </span>
            )}
            {tso.tsoOnMainCrm && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-500/20 text-blue-300 border-blue-500/30">
                On Main CRM
              </span>
            )}
            <Select value={tso.relationshipStatus || "Not Contacted"}
              onValueChange={v => update.mutate({ relationshipStatus: v })}>
              <SelectTrigger className="w-44 h-9 border-[#2d3548] bg-[#252b3d] text-[#f1f5f9] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1f2e] border-[#2d3548] text-[#f1f5f9]">
                {RELATIONSHIP_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[s] || ""}`}>{s}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {tso.nextStep && (
          <div className="mt-4 flex items-center gap-2 rounded-lg px-4 py-2.5 bg-amber-500/10 border border-amber-500/20">
            <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-400 font-medium">Next Step:</span>
            <span className="text-xs text-amber-200">{tso.nextStep}</span>
          </div>
        )}
      </div>

      {/* ── Three-column layout ── */}
      <div className="p-6 gap-6 max-w-screen-2xl mx-auto"
        style={{ display: "grid", gridTemplateColumns: "320px 1fr 340px", alignItems: "start" }}>

        {/* ═══ LEFT SIDEBAR ═══ */}
        <div className="space-y-4" style={{ position: "sticky", top: "1.5rem" }}>

          <InfoCard title="Contact Info">
            <div className="space-y-4">
              <EditableField label="Email" value={tso.email}
                icon={<Mail className="h-3 w-3" />}
                onSave={v => update.mutate({ email: v })}
                onCopy={() => tso.email && copyToClipboard(tso.email, "Email")} />

              <EditableField label="Phone" value={tso.phone}
                icon={<Phone className="h-3 w-3" />}
                onSave={v => update.mutate({ phone: v })}
                href={tso.phone ? `tel:${tso.phone}` : undefined} />

              <EditableField label="Instagram" value={t.igHandle}
                icon={<Instagram className="h-3 w-3" />}
                onSave={v => update.mutate({ igHandle: v })}
                href={t.igHandle ? `https://instagram.com/${t.igHandle.replace("@", "")}` : undefined} />

              <EditableField label="LinkedIn" value={t.linkedin}
                icon={<Linkedin className="h-3 w-3" />}
                onSave={v => update.mutate({ linkedin: v })}
                href={t.linkedin || undefined} />

              <EditableField label="Main Contact" value={tso.mainContactName}
                icon={<User className="h-3 w-3" />}
                onSave={v => update.mutate({ mainContactName: v })} />

              <EditableField label="Website" value={tso.website}
                icon={<Globe className="h-3 w-3" />}
                onSave={v => update.mutate({ website: v })}
                href={tso.website || undefined} />

              <EditableField label="City" value={tso.city}
                icon={<MapPin className="h-3 w-3" />}
                onSave={v => update.mutate({ city: v })} />
            </div>
          </InfoCard>

          {/* ── Contacts ── */}
          <InfoCard title={`Contacts (${(tso.contacts || []).length})`}>
            <div className="space-y-3">
              {(tso.contacts || []).map((c: any) => (
                <ContactCard
                  key={c.id}
                  contact={c}
                  onUpdate={(contactId, data) => updateContact.mutate({ contactId, ...data })}
                  onDelete={(contactId) => deleteContact.mutate(contactId)}
                />
              ))}
              <button
                onClick={() => addContact.mutate({ name: "New Contact", email: "", igHandle: tso.igHandle || "" })}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#2d3548] px-3 py-2.5 text-xs text-[#64748b] hover:border-[#6366f1]/50 hover:text-[#6366f1] transition-all">
                <UserPlus className="h-3.5 w-3.5" /> Add Contact
              </button>
            </div>
          </InfoCard>

          <InfoCard title="Key Information">
            <div className="space-y-4">
              <EditableSelect label="Priority" value={tso.priority}
                options={PRIORITIES}
                onSave={v => update.mutate({ priority: v })}
                colorMap={PRIORITY_COLORS} />

              <EditableSelect label="Relationship Status" value={tso.relationshipStatus}
                options={RELATIONSHIP_STATUSES}
                onSave={v => update.mutate({ relationshipStatus: v })}
                colorMap={STATUS_COLORS} />

              <EditableField label="Follow-up Date" value={t.followUpDate}
                icon={<Calendar className="h-3 w-3" />}
                onSave={v => update.mutate({ followUpDate: v })}
                type="date" />

              <EditableField label="Next Show Date" value={t.nextShowDate}
                icon={<CalendarDays className="h-3 w-3" />}
                onSave={v => update.mutate({ nextShowDate: v })}
                type="date" />

              <div className="space-y-2 pt-1">
                <ToggleField label="Existing Account"
                  value={!!t.existingAccount}
                  onToggle={() => update.mutate({ existingAccount: !t.existingAccount })} />
                <ToggleField label="Vendor Access"
                  value={!!tso.vendorAccess}
                  onToggle={() => update.mutate({ vendorAccess: !tso.vendorAccess })} />
                <ToggleField label="Recurring"
                  value={!!tso.isRecurring}
                  onToggle={() => update.mutate({ isRecurring: !tso.isRecurring })} />
              </div>
            </div>
          </InfoCard>
        </div>

        {/* ═══ MIDDLE CONTENT ═══ */}
        <div className="rounded-xl overflow-hidden border border-[#2d3548] bg-[#1a1f2e] min-h-[600px]">
          {/* Tabs */}
          <div className="flex border-b border-[#2d3548]" style={{ background: "rgba(15,20,25,0.5)" }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab.key
                    ? "text-[#6366f1] border-[#6366f1] bg-[#6366f1]/10"
                    : "text-[#64748b] border-transparent hover:text-[#94a3b8] hover:bg-[#6366f1]/5"
                }`}>
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">

            {/* About */}
            {activeTab === "about" && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-[#6366f1] mb-3">Notes</h4>
                  <EditableTextarea label="General Notes"
                    value={tso.notes}
                    onSave={v => update.mutate({ notes: v })} />
                </div>
                <div>
                  <EditableField label="Next Step" value={tso.nextStep}
                    icon={<Zap className="h-3 w-3" />}
                    onSave={v => update.mutate({ nextStep: v })} />
                </div>
                {(t.profileLink) && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748b] mb-1.5">Profile Link</p>
                    <a href={t.profileLink} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-[#6366f1] hover:text-[#818cf8] flex items-center gap-1 transition-colors">
                      {t.profileLink} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Shows */}
            {activeTab === "shows" && (
              <div className="space-y-3">
                {shows.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarDays className="h-10 w-10 text-[#2d3548] mx-auto mb-3" />
                    <p className="text-sm text-[#64748b]">No shows linked yet</p>
                  </div>
                ) : (
                  shows.map((show: Show) => (
                    <Link key={show.id} href={`/show/${show.id}`}>
                      <div className="rounded-xl border border-[#2d3548] p-4 hover:border-[#6366f1]/40 hover:bg-[#6366f1]/5 cursor-pointer transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-sm text-[#f1f5f9]">{show.showName}</p>
                            <p className="text-xs text-[#64748b] mt-0.5">
                              {[show.city, show.venue].filter(Boolean).join(" · ")}
                              {show.showDate ? ` · ${format(new Date(show.showDate), "d MMM yyyy")}` : ""}
                            </p>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SHOW_STATUS_COLORS[show.status || ""] || "bg-slate-500/20 text-slate-400"}`}>
                            {show.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}

            {/* Tasks */}
            {activeTab === "tasks" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    placeholder="Add a task and press Enter..."
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newTaskTitle.trim()) {
                        addTask.mutate({ title: newTaskTitle.trim(), tsoId: id, status: "To Do", priority: "medium" });
                      }
                    }}
                    className="flex-1 h-9 px-3 text-sm rounded-lg border border-[#2d3548] bg-black/20 text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#6366f1]/50 focus:ring-1 focus:ring-[#6366f1]/20"
                  />
                  <button
                    onClick={() => { if (newTaskTitle.trim()) addTask.mutate({ title: newTaskTitle.trim(), tsoId: id, status: "To Do", priority: "medium" }); }}
                    className="h-9 w-9 rounded-lg bg-[#6366f1] hover:bg-[#7c3aed] text-white flex items-center justify-center transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {tasks.length === 0 ? (
                  <div className="text-center py-12">
                    <ListTodo className="h-10 w-10 text-[#2d3548] mx-auto mb-3" />
                    <p className="text-sm text-[#64748b]">No tasks yet</p>
                  </div>
                ) : (
                  tasks.map((task: Task) => (
                    <div key={task.id} className="rounded-xl border border-[#2d3548] p-4 flex items-start gap-3 hover:border-[#3d4558] transition-colors">
                      <input
                        type="checkbox"
                        checked={task.status === "Done"}
                        onChange={() => updateTask.mutate({ taskId: task.id, status: task.status === "Done" ? "To Do" : "Done" })}
                        className="mt-0.5 h-4 w-4 rounded cursor-pointer accent-[#6366f1]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${task.status === "Done" ? "line-through text-[#64748b]" : "text-[#f1f5f9]"}`}>
                          {task.title}
                        </p>
                        <div className="flex gap-2 mt-1.5 flex-wrap items-center">
                          {task.dueDate && (
                            <span className="text-xs text-[#64748b] flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(task.dueDate), "d MMM")}
                            </span>
                          )}
                          {task.priority && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              task.priority === "high" ? "bg-red-500/20 text-red-300"
                              : task.priority === "low" ? "bg-slate-500/20 text-slate-400"
                              : "bg-amber-500/20 text-amber-300"
                            }`}>{task.priority}</span>
                          )}
                          {task.owner && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400">{task.owner}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Activity */}
            {activeTab === "activity" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-[#2d3548] bg-black/20 text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#6366f1]/50 focus:ring-1 focus:ring-[#6366f1]/20 resize-none"
                  />
                  <button
                    onClick={() => { if (newNote.trim()) addActivity.mutate({ type: "note", note: newNote.trim() }); }}
                    className="h-9 w-9 rounded-lg bg-[#6366f1] hover:bg-[#7c3aed] text-white flex items-center justify-center self-end transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {activities.length === 0 ? (
                  <div className="text-center py-12">
                    <ActivityIcon className="h-10 w-10 text-[#2d3548] mx-auto mb-3" />
                    <p className="text-sm text-[#64748b]">No activity yet</p>
                  </div>
                ) : (
                  activities.map((act: Activity) => (
                    <div key={act.id} className="rounded-xl border border-[#2d3548] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 capitalize">{act.type}</span>
                        <span className="text-xs text-[#64748b]">
                          {format(new Date(act.createdAt), "d MMM yyyy, HH:mm")}
                        </span>
                        {act.loggedBy && <span className="text-xs text-[#64748b]">· {act.loggedBy}</span>}
                      </div>
                      <p className="text-sm text-[#f1f5f9]">{act.note}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT SIDEBAR ═══ */}
        <div className="space-y-4" style={{ position: "sticky", top: "1.5rem" }}>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Annual Reach"
              value={t.estAnnualReach || "—"}
              gradient="from-indigo-500 to-purple-600" />
            <StatCard
              title="Shows / Year"
              value={t.showsPerYear || shows.length || "—"}
              subtitle="2026"
              gradient="from-blue-500 to-cyan-600" />
            <StatCard
              title="Priority"
              value={tso.priority || "Medium"}
              gradient={
                tso.priority === "Urgent" ? "from-red-500 to-rose-600"
                : tso.priority === "High" ? "from-orange-500 to-amber-600"
                : "from-slate-600 to-slate-700"
              } />
            <StatCard
              title="Active Shows"
              value={shows.filter((s: Show) => s.status !== "Completed").length}
              subtitle={`${shows.length} total`}
              gradient="from-emerald-500 to-green-600" />
          </div>

          {/* Pricing & Promo */}
          <InfoCard title="Pricing & Partnership">
            <div className="space-y-4">
              <EditableTextarea label="Sponsor Info"
                value={t.sponsorInfo}
                onSave={v => update.mutate({ sponsorInfo: v })} />
              <EditableTextarea label="Promo Options"
                value={tso.promoOptions}
                onSave={v => update.mutate({ promoOptions: v })} />
              <EditableTextarea label="Pricing Notes"
                value={tso.pricingNotes}
                onSave={v => update.mutate({ pricingNotes: v })} />
              <EditableTextarea label="Activities / Deliverables"
                value={t.activitiesNotes}
                onSave={v => update.mutate({ activitiesNotes: v })} />
              <EditableTextarea label="Event Codes"
                value={t.tsoEventCodes}
                onSave={v => update.mutate({ tsoEventCodes: v })} />
            </div>
          </InfoCard>

          {/* Shows mini list */}
          <InfoCard title={`Shows (${shows.length})`}>
            <div className="space-y-2">
              {shows.length === 0 ? (
                <p className="text-xs text-[#64748b] italic">No shows linked</p>
              ) : (
                shows.slice(0, 5).map((show: Show) => (
                  <Link key={show.id} href={`/show/${show.id}`}>
                    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-[#6366f1]/10 cursor-pointer transition-colors">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        show.status === "Sponsoring" || show.status === "Confirmed" ? "bg-emerald-400"
                        : show.status === "Completed" ? "bg-slate-500"
                        : "bg-amber-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#f1f5f9] truncate">{show.showName}</p>
                        {show.showDate && (
                          <p className="text-[10px] text-[#64748b]">{format(new Date(show.showDate), "d MMM yyyy")}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
              {shows.length > 5 && (
                <button onClick={() => setActiveTab("shows")}
                  className="w-full text-xs text-[#6366f1] hover:text-[#818cf8] text-center py-1 transition-colors">
                  View all {shows.length} shows →
                </button>
              )}
            </div>
          </InfoCard>

          {/* Tasks mini list */}
          <InfoCard title={`Tasks (${tasks.length})`}>
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-xs text-[#64748b] italic">No tasks</p>
              ) : (
                tasks.slice(0, 5).map((task: Task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-black/20 transition-colors">
                    <input
                      type="checkbox"
                      checked={task.status === "Done"}
                      onChange={() => updateTask.mutate({ taskId: task.id, status: task.status === "Done" ? "To Do" : "Done" })}
                      className="h-3.5 w-3.5 rounded cursor-pointer accent-[#6366f1] shrink-0"
                    />
                    <p className={`text-xs flex-1 truncate ${task.status === "Done" ? "line-through text-[#64748b]" : "text-[#f1f5f9]"}`}>
                      {task.title}
                    </p>
                    {task.dueDate && (
                      <span className="text-[10px] text-[#64748b] shrink-0">
                        {format(new Date(task.dueDate), "d MMM")}
                      </span>
                    )}
                  </div>
                ))
              )}
              <button
                onClick={() => setActiveTab("tasks")}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#2d3548] px-3 py-2 text-xs text-[#64748b] hover:border-[#6366f1]/50 hover:text-[#6366f1] transition-all mt-1">
                <Plus className="h-3 w-3" /> Add task
              </button>
            </div>
          </InfoCard>

        </div>
      </div>
    </div>
  );
}
