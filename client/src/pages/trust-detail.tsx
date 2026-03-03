import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useParams, useLocation } from "wouter";
import type { Trust, Company, PipelineStage, Activity, DealWithStage, Contact } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Landmark,
  Building2,
  Phone,
  Mail,
  Globe,
  Clock,
  User,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  MapPin,
  Activity as ActivityIcon,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { formatPhone } from "@/lib/utils";

type SchoolWithContacts = Company & {
  stage?: PipelineStage;
  deals: DealWithStage[];
  lastActivityType?: string | null;
  contacts: Contact[];
};

type ActivityWithSchool = Activity & { companyName?: string };

function getActivityIcon(type: string | null | undefined): string {
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

function getActivityLabel(type: string | null | undefined): string {
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

// Copy-to-clipboard button with visual feedback
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title={`Copy ${label}`}
      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#3d4254] transition-colors flex-shrink-0"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
      )}
    </button>
  );
}

// A single contact detail row: icon + label + value + copy
function ContactRow({
  icon: Icon,
  label,
  value,
  href,
  isEmail,
  isPhone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string;
  isEmail?: boolean;
  isPhone?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 group">
      <Icon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
      <span className="text-xs text-gray-500 dark:text-[#64748b] w-16 flex-shrink-0">{label}</span>
      {href ? (
        <a
          href={href}
          className="text-sm text-[#0091AE] hover:underline truncate flex-1"
          onClick={e => e.stopPropagation()}
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-gray-800 dark:text-[#cbd5e1] truncate flex-1">{value}</span>
      )}
      <CopyButton value={value} label={label} />
      {isPhone && (
        <a
          href={`tel:${value}`}
          onClick={e => e.stopPropagation()}
          title="Call"
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#3d4254] transition-colors"
        >
          <Phone className="h-3.5 w-3.5 text-[#0091AE]" />
        </a>
      )}
      {isEmail && (
        <a
          href={`mailto:${value}`}
          onClick={e => e.stopPropagation()}
          title="Email"
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#3d4254] transition-colors"
        >
          <Mail className="h-3.5 w-3.5 text-[#0091AE]" />
        </a>
      )}
    </div>
  );
}

const editTrustSchema = z.object({
  name: z.string().min(1, "Trust name is required"),
  website: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  decisionMakerName: z.string().optional(),
  decisionMakerEmail: z.string().optional(),
  decisionMakerPhone: z.string().optional(),
  notes: z.string().optional(),
});

type EditTrustForm = z.infer<typeof editTrustSchema>;

export default function TrustDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [activityPage, setActivityPage] = useState(0);
  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"schools" | "activity">("schools");
  const ACTIVITY_PAGE_SIZE = 20;

  const { data: trust, isLoading: loadingTrust } = useQuery<Trust>({
    queryKey: [`/api/trusts/${params.id}`],
  });

  const { data: schools, isLoading: loadingSchools } = useQuery<SchoolWithContacts[]>({
    queryKey: [`/api/trusts/${params.id}/companies`],
    enabled: !!params.id,
  });

  const { data: activities, isLoading: loadingActivities } = useQuery<ActivityWithSchool[]>({
    queryKey: [`/api/trusts/${params.id}/activities`, activityPage],
    queryFn: async () => {
      const offset = activityPage * ACTIVITY_PAGE_SIZE;
      const res = await fetch(`/api/trusts/${params.id}/activities?limit=${ACTIVITY_PAGE_SIZE}&offset=${offset}`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!params.id,
  });

  const form = useForm<EditTrustForm>({
    resolver: zodResolver(editTrustSchema),
    values: trust ? {
      name: trust.name,
      website: trust.website || "",
      phone: trust.phone || "",
      email: trust.email || "",
      decisionMakerName: trust.decisionMakerName || "",
      decisionMakerEmail: trust.decisionMakerEmail || "",
      decisionMakerPhone: trust.decisionMakerPhone || "",
      notes: trust.notes || "",
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: EditTrustForm) =>
      apiRequest("PATCH", `/api/trusts/${params.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trusts/${params.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/trusts-with-stats"] });
      setEditOpen(false);
      toast({ title: "Trust updated" });
    },
    onError: () => toast({ title: "Failed to update trust", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/trusts/${params.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trusts-with-stats"] });
      navigate("/trusts");
      toast({ title: "Trust deleted" });
    },
    onError: () => toast({ title: "Failed to delete trust", variant: "destructive" }),
  });

  const lastActivity = activities?.[0];
  const totalPipelineGP = schools?.reduce((sum, s) =>
    sum + (s.deals || []).reduce((d, deal) => d + parseFloat(deal.expectedGP || "0"), 0), 0) || 0;

  const toggleSchool = (id: string) => {
    setExpandedSchools(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedSchools(new Set(schools?.map(s => s.id) || []));
  const collapseAll = () => setExpandedSchools(new Set());

  const copyAllContacts = async () => {
    if (!schools) return;
    const text = schools.map(s => {
      let out = `${s.name}\n`;
      if (s.phone) out += `  Phone: ${s.phone}\n`;
      if (s.itManagerName) {
        out += `  IT Manager: ${s.itManagerName}`;
        if (s.itManagerEmail) out += ` <${s.itManagerEmail}>`;
        out += "\n";
      }
      s.contacts.forEach(c => {
        out += `  ${c.role || "Contact"}: ${c.name || ""}`;
        if (c.phone) out += ` — ${c.phone}`;
        if (c.email) out += ` — ${c.email}`;
        out += "\n";
      });
      return out;
    }).join("\n");
    await navigator.clipboard.writeText(text);
    toast({ title: "All contacts copied to clipboard" });
  };

  if (loadingTrust) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64 dark:bg-[#3d4254]" />
        <Skeleton className="h-32 w-full dark:bg-[#3d4254]" />
        <Skeleton className="h-64 w-full dark:bg-[#3d4254]" />
      </div>
    );
  }

  if (!trust) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Trust not found</h3>
        <Button onClick={() => navigate("/trusts")} variant="outline" className="mt-4">
          Back to Trusts
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-[#1a1d29] p-6 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#64748b]">
        <Link href="/trusts" className="hover:text-[#0091AE] transition-colors">Trusts</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 dark:text-white font-medium">{trust.name}</span>
      </div>

      {/* Trust Header */}
      <div className="bg-white dark:bg-[#252936] rounded-xl border border-gray-200 dark:border-[#3d4254] p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 dark:from-purple-500/30 dark:to-purple-600/30 flex items-center justify-center flex-shrink-0">
              <Landmark className="h-7 w-7 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{trust.name}</h1>
                <Badge className="bg-purple-600 hover:bg-purple-600 text-white text-xs">MAT</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-[#94a3b8] mt-2">
                {trust.phone && (
                  <a href={`tel:${formatPhone(trust.phone)}`} className="flex items-center gap-1.5 hover:text-[#0091AE]">
                    <Phone className="h-3.5 w-3.5" />{formatPhone(trust.phone)}
                  </a>
                )}
                {trust.email && (
                  <a href={`mailto:${trust.email}`} className="flex items-center gap-1.5 hover:text-[#0091AE]">
                    <Mail className="h-3.5 w-3.5" />{trust.email}
                  </a>
                )}
                {trust.website && (
                  <a href={trust.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-[#0091AE]">
                    <Globe className="h-3.5 w-3.5" />{trust.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {trust.decisionMakerName && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />{trust.decisionMakerName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}
              className="dark:border-[#3d4254] dark:bg-[#2d3142] dark:text-white dark:hover:bg-[#3d4254]">
              <Edit className="h-4 w-4 mr-1.5" />Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(true)}
              className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20">
              <Trash2 className="h-4 w-4 mr-1.5" />Delete
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-[#3d4254]">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{schools?.length || 0}</div>
            <div className="text-sm text-gray-500 dark:text-[#64748b] mt-0.5">Schools</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              £{totalPipelineGP.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-sm text-gray-500 dark:text-[#64748b] mt-0.5">Pipeline GP</div>
          </div>
          <div className="text-center">
            {lastActivity ? (
              <>
                <div className="text-lg font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
                  <span>{getActivityIcon(lastActivity.type)}</span>
                  <span>{getActivityLabel(lastActivity.type)}</span>
                </div>
                <div className="text-sm text-gray-500 dark:text-[#64748b] mt-0.5">
                  {formatDistanceToNow(new Date(lastActivity.createdAt), { addSuffix: true })}
                </div>
                {lastActivity.companyName && (
                  <div className="text-xs text-gray-400 dark:text-[#64748b] mt-0.5">
                    via {lastActivity.companyName}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-gray-400 dark:text-[#64748b]">—</div>
                <div className="text-sm text-gray-500 dark:text-[#64748b] mt-0.5">No Activity</div>
              </>
            )}
          </div>
        </div>

        {trust.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#3d4254]">
            <p className="text-sm text-gray-600 dark:text-[#94a3b8]">{trust.notes}</p>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white dark:bg-[#252936] rounded-xl border border-gray-200 dark:border-[#3d4254] p-1">
        <button
          onClick={() => setActiveTab("schools")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "schools"
              ? "bg-[#0091AE] text-white shadow-sm"
              : "text-gray-600 dark:text-[#94a3b8] hover:bg-gray-100 dark:hover:bg-[#2d3142]"
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <Building2 className="h-4 w-4" />
            Schools & Contacts
            {schools && schools.length > 0 && (
              <Badge variant="secondary" className={`text-xs ${activeTab === "schools" ? "bg-white/20 text-white" : "dark:bg-[#3d4254] dark:text-[#94a3b8]"}`}>
                {schools.length}
              </Badge>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("activity")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "activity"
              ? "bg-[#0091AE] text-white shadow-sm"
              : "text-gray-600 dark:text-[#94a3b8] hover:bg-gray-100 dark:hover:bg-[#2d3142]"
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <ActivityIcon className="h-4 w-4" />
            Activity Timeline
          </span>
        </button>
      </div>

      {/* Schools & Contacts Tab */}
      {activeTab === "schools" && (
        <div className="space-y-3">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              All School Contacts
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-[#64748b]">Click any value to copy</span>
              <Button variant="outline" size="sm" onClick={expandAll}
                className="h-8 dark:border-[#3d4254] dark:bg-[#2d3142] dark:text-white dark:hover:bg-[#3d4254]">
                <ChevronDown className="h-3.5 w-3.5 mr-1" />Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}
                className="h-8 dark:border-[#3d4254] dark:bg-[#2d3142] dark:text-white dark:hover:bg-[#3d4254]">
                <ChevronUp className="h-3.5 w-3.5 mr-1" />Collapse All
              </Button>
              <Button variant="outline" size="sm" onClick={copyAllContacts}
                className="h-8 dark:border-[#3d4254] dark:bg-[#2d3142] dark:text-white dark:hover:bg-[#3d4254]">
                <Copy className="h-3.5 w-3.5 mr-1" />Copy All
              </Button>
            </div>
          </div>

          {loadingSchools ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white dark:bg-[#252936] rounded-xl border border-gray-200 dark:border-[#3d4254] p-5">
                  <Skeleton className="h-5 w-48 dark:bg-[#3d4254]" />
                  <Skeleton className="h-4 w-32 mt-2 dark:bg-[#3d4254]" />
                </div>
              ))}
            </div>
          ) : !schools || schools.length === 0 ? (
            <div className="bg-white dark:bg-[#252936] rounded-xl border border-gray-200 dark:border-[#3d4254] py-14 text-center">
              <Building2 className="h-10 w-10 text-gray-300 dark:text-[#3d4254] mx-auto mb-3" />
              <p className="text-gray-500 dark:text-[#64748b]">No schools linked to this trust</p>
            </div>
          ) : (
            schools.map(school => {
              const isExpanded = expandedSchools.has(school.id);
              const hasContacts = school.contacts.length > 0 || school.itManagerName || school.decisionMakerName;

              return (
                <div
                  key={school.id}
                  className="bg-white dark:bg-[#252936] rounded-xl border border-gray-200 dark:border-[#3d4254] overflow-hidden"
                >
                  {/* School header — always visible, click to expand */}
                  <button
                    onClick={() => toggleSchool(school.id)}
                    className="w-full px-5 py-4 flex items-start justify-between hover:bg-gray-50 dark:hover:bg-[#2d3142] transition-colors text-left"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {school.name}
                          </span>
                          {school.lastContactDate && (
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(school.lastContactDate), { addSuffix: true })}
                            </span>
                          )}
                          {!school.lastContactDate && (
                            <span className="text-xs bg-gray-100 dark:bg-[#3d4254] text-gray-500 dark:text-[#64748b] px-2 py-0.5 rounded-full">
                              No activity
                            </span>
                          )}
                        </div>
                        {/* Quick preview: phone + location */}
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          {school.phone && (
                            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-[#64748b]">
                              <Phone className="h-3 w-3" />{formatPhone(school.phone)}
                            </span>
                          )}
                          {school.location && (
                            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-[#64748b]">
                              <MapPin className="h-3 w-3" />{school.location}
                            </span>
                          )}
                          {hasContacts && !isExpanded && (
                            <span className="flex items-center gap-1 text-xs text-[#0091AE]">
                              <Users className="h-3 w-3" />
                              {school.contacts.length + (school.itManagerName ? 1 : 0) + (school.decisionMakerName ? 1 : 0)} contacts
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <Link
                        href={`/company/${school.id}`}
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-[#0091AE] hover:underline hidden sm:block"
                      >
                        View school
                      </Link>
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 text-gray-400" />
                        : <ChevronDown className="h-4 w-4 text-gray-400" />
                      }
                    </div>
                  </button>

                  {/* Expanded contact details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-[#3d4254] px-5 pb-5 pt-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Left: School details */}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-[#64748b] mb-3 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" />School Details
                          </p>
                          <div className="space-y-2">
                            {school.phone && (
                              <ContactRow icon={Phone} label="Phone" value={formatPhone(school.phone)} href={`tel:${formatPhone(school.phone)}`} isPhone />
                            )}
                            {school.website && (
                              <div className="flex items-center gap-2 group">
                                <Globe className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-xs text-gray-500 dark:text-[#64748b] w-16 flex-shrink-0">Website</span>
                                <a
                                  href={school.website.startsWith("http") ? school.website : `https://${school.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="text-sm text-[#0091AE] hover:underline truncate flex-1 flex items-center gap-1"
                                >
                                  {school.website.replace(/^https?:\/\//, "")}
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                                <CopyButton value={school.website} label="website" />
                              </div>
                            )}
                            {(school.location || school.postcode) && (
                              <div className="flex items-start gap-2">
                                <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-gray-500 dark:text-[#64748b] w-16 flex-shrink-0">Location</span>
                                <span className="text-sm text-gray-800 dark:text-[#cbd5e1] flex-1">
                                  {[school.location, school.county, school.postcode].filter(Boolean).join(", ")}
                                </span>
                              </div>
                            )}
                            {school.urn && (
                              <div className="flex items-center gap-2">
                                <span className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="text-xs text-gray-500 dark:text-[#64748b] w-16 flex-shrink-0">URN</span>
                                <span className="text-sm text-gray-700 dark:text-[#94a3b8]">{school.urn}</span>
                              </div>
                            )}
                          </div>

                          {school.notes && (
                            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#3d4254]">
                              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-[#64748b] mb-1.5">Notes</p>
                              <p className="text-sm text-gray-600 dark:text-[#94a3b8] leading-relaxed line-clamp-3">
                                {school.notes}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Right: Key contacts */}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-[#64748b] mb-3 flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />Key Contacts
                          </p>
                          <div className="space-y-3">

                            {/* Decision Maker from company fields */}
                            {school.decisionMakerName && (
                              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-lg">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5">
                                  Decision Maker
                                </p>
                                <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                                  {school.decisionMakerName}
                                  {school.decisionMakerRole && (
                                    <span className="text-xs text-gray-500 dark:text-[#64748b] ml-1.5">— {school.decisionMakerRole}</span>
                                  )}
                                </p>
                              </div>
                            )}

                            {/* IT Manager from company fields */}
                            {(school.itManagerName || school.itManagerEmail) && (
                              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/40 rounded-lg">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400 mb-1.5">
                                  IT Manager
                                </p>
                                {school.itManagerName && (
                                  <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1.5">{school.itManagerName}</p>
                                )}
                                <div className="space-y-1">
                                  {school.itManagerEmail && (
                                    <ContactRow icon={Mail} label="Email" value={school.itManagerEmail} href={`mailto:${school.itManagerEmail}`} isEmail />
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Contacts from contacts table, grouped by role */}
                            {school.contacts.length > 0 && (() => {
                              const roleGroups = new Map<string, Contact[]>();
                              for (const c of school.contacts) {
                                const role = c.role || "Contact";
                                const group = roleGroups.get(role) || [];
                                group.push(c);
                                roleGroups.set(role, group);
                              }

                              const roleColors: Record<string, string> = {
                                "IT Manager": "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/40 text-green-600 dark:text-green-400",
                                "Finance Manager": "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/40 text-purple-600 dark:text-purple-400",
                                "Headteacher": "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/40 text-blue-600 dark:text-blue-400",
                                "Business Manager": "bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/40 text-orange-600 dark:text-orange-400",
                              };
                              const defaultColor = "bg-gray-50 dark:bg-[#2d3142] border-gray-100 dark:border-[#3d4254] text-gray-500 dark:text-[#64748b]";

                              return Array.from(roleGroups.entries()).map(([role, roleContacts]) => (
                                <div
                                  key={role}
                                  className={`p-3 border rounded-lg ${roleColors[role] || defaultColor}`}
                                >
                                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${(roleColors[role] || defaultColor).split(" ").slice(2).join(" ")}`}>
                                    {role}
                                  </p>
                                  <div className="space-y-2">
                                    {roleContacts.map(contact => (
                                      <div key={contact.id}>
                                        {contact.name && (
                                          <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                                            {contact.title ? `${contact.title} ` : ""}{contact.name}
                                          </p>
                                        )}
                                        <div className="space-y-1">
                                          {contact.phone && (
                                            <ContactRow icon={Phone} label="Phone" value={formatPhone(contact.phone)} isPhone />
                                          )}
                                          {contact.email && (
                                            <ContactRow icon={Mail} label="Email" value={contact.email} href={`mailto:${contact.email}`} isEmail />
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ));
                            })()}

                            {!school.decisionMakerName && !school.itManagerName && !school.itManagerEmail && school.contacts.length === 0 && (
                              <p className="text-sm text-gray-400 dark:text-[#64748b] italic py-2">
                                No contacts recorded yet
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer actions */}
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#3d4254] flex items-center gap-3">
                        <Link href={`/company/${school.id}`}>
                          <Button variant="outline" size="sm"
                            className="dark:border-[#3d4254] dark:bg-[#2d3142] dark:text-white dark:hover:bg-[#3d4254]">
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            View Full School
                          </Button>
                        </Link>
                        {school.phone && (
                          <a href={`tel:${formatPhone(school.phone)}`}>
                            <Button variant="ghost" size="sm" className="dark:text-[#94a3b8] dark:hover:bg-[#2d3142]">
                              <Phone className="h-3.5 w-3.5 mr-1.5" />
                              Call School
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Activity Timeline Tab */}
      {activeTab === "activity" && (
        <div className="bg-white dark:bg-[#252936] rounded-xl border border-gray-200 dark:border-[#3d4254] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-[#3d4254] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Timeline</h2>
              <span className="text-sm text-gray-500 dark:text-[#64748b]">Across all schools</span>
            </div>
            {activityPage > 0 && (
              <Button variant="outline" size="sm" onClick={() => setActivityPage(0)}
                className="dark:border-[#3d4254] dark:bg-[#2d3142] dark:text-white">
                Latest
              </Button>
            )}
          </div>

          {loadingActivities ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0 dark:bg-[#3d4254]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32 dark:bg-[#3d4254]" />
                    <Skeleton className="h-3 w-48 dark:bg-[#3d4254]" />
                  </div>
                </div>
              ))}
            </div>
          ) : !activities || activities.length === 0 ? (
            <div className="py-12 text-center">
              <ActivityIcon className="h-10 w-10 text-gray-300 dark:text-[#3d4254] mx-auto mb-3" />
              <p className="text-gray-500 dark:text-[#64748b]">No activities logged yet</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-0">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="flex gap-4 pb-0">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#2d3142] border-2 border-white dark:border-[#252936] flex items-center justify-center text-lg shadow-sm z-10">
                        {getActivityIcon(activity.type)}
                      </div>
                      {index < activities.length - 1 && (
                        <div className="w-px flex-1 bg-gray-200 dark:bg-[#3d4254] min-h-[24px] my-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 dark:text-white text-sm">
                              {getActivityLabel(activity.type)}
                            </span>
                            {activity.companyName && (
                              <Link href={`/company/${activity.companyId}`}
                                className="text-xs text-[#0091AE] hover:underline">
                                {activity.companyName}
                              </Link>
                            )}
                            {activity.outcome && (
                              <Badge variant="outline" className="text-xs dark:border-[#3d4254] dark:text-[#94a3b8]">
                                {activity.outcome}
                              </Badge>
                            )}
                          </div>
                          {activity.note && (
                            <p className="text-sm text-gray-600 dark:text-[#94a3b8] mt-1 line-clamp-2">
                              {activity.note}
                            </p>
                          )}
                          {activity.quoteValue && (
                            <p className="text-sm font-medium text-green-600 dark:text-green-400 mt-1">
                              Quote: £{parseFloat(activity.quoteValue).toLocaleString("en-GB")}
                            </p>
                          )}
                        </div>
                        <time className="text-xs text-gray-500 dark:text-[#64748b] whitespace-nowrap flex-shrink-0">
                          {format(new Date(activity.createdAt), "dd MMM yyyy, HH:mm")}
                        </time>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-[#3d4254]">
                <Button variant="outline" size="sm"
                  onClick={() => setActivityPage(p => Math.max(0, p - 1))}
                  disabled={activityPage === 0}
                  className="dark:border-[#3d4254] dark:bg-[#2d3142] dark:text-white">
                  Newer
                </Button>
                <span className="text-sm text-gray-500 dark:text-[#64748b]">Page {activityPage + 1}</span>
                <Button variant="outline" size="sm"
                  onClick={() => setActivityPage(p => p + 1)}
                  disabled={!activities || activities.length < ACTIVITY_PAGE_SIZE}
                  className="dark:border-[#3d4254] dark:bg-[#2d3142] dark:text-white">
                  Older
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto dark:bg-[#252936] dark:border-[#3d4254]">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Edit Trust</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => updateMutation.mutate(d))} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-white">Trust Name *</FormLabel>
                  <FormControl><Input {...field} className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white" /></FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-white">Phone</FormLabel>
                    <FormControl><Input {...field} className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-white">Email</FormLabel>
                    <FormControl><Input {...field} className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white" /></FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="website" render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-white">Website</FormLabel>
                  <FormControl><Input {...field} className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white" /></FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="decisionMakerName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-white">Decision Maker</FormLabel>
                    <FormControl><Input {...field} className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="decisionMakerPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-white">DM Phone</FormLabel>
                    <FormControl><Input {...field} className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white" /></FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="decisionMakerEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-white">DM Email</FormLabel>
                  <FormControl><Input {...field} className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-white">Notes</FormLabel>
                  <FormControl>
                    <textarea
                      className="w-full px-3 py-2 border border-input rounded-md text-sm min-h-[80px] bg-background dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )} />
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1 bg-[#0091AE] hover:bg-[#007a94]" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}
                  className="dark:border-[#3d4254] dark:bg-[#2d3142] dark:text-white">
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Delete {trust.name}?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-[#94a3b8]">
              This will delete the trust and unlink all {schools?.length || 0} connected schools. The schools themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-[#2d3142] dark:text-white dark:border-[#3d4254]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate()}>
              Delete Trust
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
