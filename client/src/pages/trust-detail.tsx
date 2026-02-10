import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation, Link } from "wouter";
import type { Trust, Company, PipelineStage, DealWithStage, Activity } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ArrowLeft,
  Building2,
  Landmark,
  Globe,
  Phone,
  Mail,
  User,
  Pencil,
  Trash2,
  Save,
  X,
  StickyNote,
  ExternalLink,
  Unlink,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

type CompanyWithDeals = Company & { stage?: PipelineStage; deals: DealWithStage[] };
type PipelineSummaryItem = { stageId: string; stageName: string; stageColor: string; dealCount: number; totalValue: number };
type ActivityWithCompany = Activity & { companyName?: string };

export default function TrustDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddSchoolDialog, setShowAddSchoolDialog] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [activityOffset, setActivityOffset] = useState(0);
  const [allActivities, setAllActivities] = useState<ActivityWithCompany[]>([]);

  const [editForm, setEditForm] = useState({
    name: "",
    website: "",
    phone: "",
    email: "",
    decisionMakerName: "",
    decisionMakerEmail: "",
    decisionMakerPhone: "",
    notes: "",
  });

  const { data: trust, isLoading } = useQuery<Trust>({
    queryKey: [`/api/trusts/${id}`],
    enabled: !!id,
  });

  const { data: companies } = useQuery<CompanyWithDeals[]>({
    queryKey: [`/api/trusts/${id}/companies`],
    enabled: !!id,
  });

  const { data: pipelineSummary } = useQuery<PipelineSummaryItem[]>({
    queryKey: [`/api/trusts/${id}/pipeline-summary`],
    enabled: !!id,
  });

  const { data: activitiesData } = useQuery<ActivityWithCompany[]>({
    queryKey: [`/api/trusts/${id}/activities`, activityOffset],
    queryFn: async () => {
      const res = await fetch(`/api/trusts/${id}/activities?limit=20&offset=${activityOffset}`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!id,
  });

  // All companies for "Add School" dialog
  const { data: allCompanies } = useQuery<(Company & { stage?: PipelineStage })[]>({
    queryKey: ["/api/companies"],
    enabled: showAddSchoolDialog,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, string | null>) => {
      return apiRequest("PATCH", `/api/trusts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trusts/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/trusts-with-stats"] });
      setIsEditing(false);
      toast({ title: "Trust updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/trusts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trusts-with-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trusts"] });
      toast({ title: "Trust deleted. Schools have been unlinked." });
      navigate("/trusts");
    },
  });

  const linkSchoolMutation = useMutation({
    mutationFn: async (companyId: string) => {
      return apiRequest("PATCH", `/api/companies/${companyId}`, { trustId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trusts/${id}/companies`] });
      queryClient.invalidateQueries({ queryKey: [`/api/trusts/${id}/pipeline-summary`] });
      queryClient.invalidateQueries({ queryKey: ["/api/trusts-with-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "School linked to trust" });
    },
  });

  const unlinkSchoolMutation = useMutation({
    mutationFn: async (companyId: string) => {
      return apiRequest("PATCH", `/api/companies/${companyId}`, { trustId: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trusts/${id}/companies`] });
      queryClient.invalidateQueries({ queryKey: [`/api/trusts/${id}/pipeline-summary`] });
      queryClient.invalidateQueries({ queryKey: ["/api/trusts-with-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "School unlinked from trust" });
    },
  });

  // Merge activities across paginated loads
  const displayActivities = activityOffset === 0
    ? (activitiesData || [])
    : [...allActivities, ...(activitiesData || [])];

  const startEditing = () => {
    if (!trust) return;
    setEditForm({
      name: trust.name || "",
      website: trust.website || "",
      phone: trust.phone || "",
      email: trust.email || "",
      decisionMakerName: trust.decisionMakerName || "",
      decisionMakerEmail: trust.decisionMakerEmail || "",
      decisionMakerPhone: trust.decisionMakerPhone || "",
      notes: trust.notes || "",
    });
    setIsEditing(true);
  };

  const saveEdits = () => {
    updateMutation.mutate({
      name: editForm.name || null,
      website: editForm.website || null,
      phone: editForm.phone || null,
      email: editForm.email || null,
      decisionMakerName: editForm.decisionMakerName || null,
      decisionMakerEmail: editForm.decisionMakerEmail || null,
      decisionMakerPhone: editForm.decisionMakerPhone || null,
      notes: editForm.notes || null,
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call": return <Phone className="h-3.5 w-3.5" />;
      case "email": return <Mail className="h-3.5 w-3.5" />;
      case "quote": return <StickyNote className="h-3.5 w-3.5" />;
      default: return <StickyNote className="h-3.5 w-3.5" />;
    }
  };

  const availableSchools = allCompanies
    ? allCompanies
        .filter(c => !c.trustId || c.trustId !== id)
        .filter(c => !schoolSearch || c.name.toLowerCase().includes(schoolSearch.toLowerCase()))
        .slice(0, 20)
    : [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!trust) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 dark:text-[#94a3b8]">Trust not found</p>
        <Button variant="outline" onClick={() => navigate("/trusts")} className="mt-4">
          Back to Trusts
        </Button>
      </div>
    );
  }

  const totalPipelineValue = pipelineSummary?.reduce((sum, s) => sum + s.totalValue, 0) || 0;

  return (
    <div className="h-full overflow-auto bg-gray-50 dark:bg-[#1a1d29]">
      {/* Header */}
      <div className="bg-white dark:bg-[#252936] border-b border-gray-200 dark:border-[#3d4254] px-6 py-4">
        <div className="flex items-center gap-4 mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/trusts")}
            className="text-gray-500 dark:text-[#94a3b8] hover:text-gray-700 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Trusts
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center">
              <Landmark className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{trust.name}</h1>
              <p className="text-sm text-gray-500 dark:text-[#94a3b8]">
                {companies?.length || 0} schools &middot; £{totalPipelineValue.toLocaleString()} pipeline
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={startEditing} className="dark:border-[#3d4254] dark:text-white dark:hover:bg-[#2d3142]">
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Trust Info */}
        <div className="space-y-4">
          <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base dark:text-white">Trust Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-[#64748b]">Name</label>
                    <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-[#64748b]">Website</label>
                    <Input value={editForm.website} onChange={(e) => setEditForm(f => ({ ...f, website: e.target.value }))} className="mt-1" placeholder="https://" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-[#64748b]">Phone</label>
                    <Input value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-[#64748b]">Email</label>
                    <Input value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} className="mt-1" />
                  </div>
                  <div className="border-t border-gray-200 dark:border-[#3d4254] pt-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-[#64748b] uppercase mb-2">Decision Maker</p>
                    <div className="space-y-2">
                      <Input value={editForm.decisionMakerName} onChange={(e) => setEditForm(f => ({ ...f, decisionMakerName: e.target.value }))} placeholder="Name" />
                      <Input value={editForm.decisionMakerEmail} onChange={(e) => setEditForm(f => ({ ...f, decisionMakerEmail: e.target.value }))} placeholder="Email" />
                      <Input value={editForm.decisionMakerPhone} onChange={(e) => setEditForm(f => ({ ...f, decisionMakerPhone: e.target.value }))} placeholder="Phone" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-[#64748b]">Notes</label>
                    <Textarea value={editForm.notes} onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" rows={3} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdits} disabled={updateMutation.isPending} className="bg-[#0091AE] hover:bg-[#007a94] text-white">
                      <Save className="h-3.5 w-3.5 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="dark:border-[#3d4254] dark:text-white">
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Website" value={trust.website} />
                  <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={trust.phone} />
                  <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={trust.email} />
                  {(trust.decisionMakerName || trust.decisionMakerEmail) && (
                    <div className="border-t border-gray-200 dark:border-[#3d4254] pt-3">
                      <p className="text-xs font-semibold text-gray-500 dark:text-[#64748b] uppercase mb-2">Decision Maker</p>
                      <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Name" value={trust.decisionMakerName} />
                      <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={trust.decisionMakerEmail} />
                      <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={trust.decisionMakerPhone} />
                    </div>
                  )}
                  {trust.notes && (
                    <div className="border-t border-gray-200 dark:border-[#3d4254] pt-3">
                      <p className="text-xs font-semibold text-gray-500 dark:text-[#64748b] uppercase mb-1">Notes</p>
                      <p className="text-gray-700 dark:text-[#94a3b8] whitespace-pre-wrap">{trust.notes}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Pipeline Summary */}
          {pipelineSummary && pipelineSummary.length > 0 && (
            <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base dark:text-white">Pipeline Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pipelineSummary.map((stage) => (
                  <div key={stage.stageId} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.stageColor }} />
                      <span className="text-sm text-gray-700 dark:text-[#94a3b8]">{stage.stageName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        £{stage.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-[#64748b] ml-2">
                        ({stage.dealCount} {stage.dealCount === 1 ? "deal" : "deals"})
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Schools + Activities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Schools Table */}
          <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base dark:text-white">
                Schools ({companies?.length || 0})
              </CardTitle>
              <Button
                size="sm"
                onClick={() => setShowAddSchoolDialog(true)}
                className="bg-[#0091AE] hover:bg-[#007a94] text-white"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add School
              </Button>
            </CardHeader>
            <CardContent>
              {companies && companies.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-[#3d4254]">
                        <th className="text-left py-2 pr-4 text-xs font-semibold uppercase text-gray-500 dark:text-[#64748b]">School Name</th>
                        <th className="text-left py-2 pr-4 text-xs font-semibold uppercase text-gray-500 dark:text-[#64748b]">Location</th>
                        <th className="text-left py-2 pr-4 text-xs font-semibold uppercase text-gray-500 dark:text-[#64748b]">Lead Status</th>
                        <th className="text-left py-2 pr-4 text-xs font-semibold uppercase text-gray-500 dark:text-[#64748b]">Pipeline</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#3d4254]">
                      {companies.map((company) => {
                        const companyPipelineValue = company.deals?.reduce(
                          (sum, d) => sum + (d.expectedGP ? parseFloat(d.expectedGP) : 0),
                          0
                        ) || 0;
                        return (
                          <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-[#2d3142]">
                            <td className="py-2.5 pr-4">
                              <Link href={`/company/${company.id}`} className="text-[#0091AE] hover:underline font-medium flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5" />
                                {company.name}
                              </Link>
                            </td>
                            <td className="py-2.5 pr-4 text-gray-600 dark:text-[#94a3b8]">{company.location || "--"}</td>
                            <td className="py-2.5 pr-4">
                              <Badge variant="outline" className="text-xs dark:border-[#3d4254] dark:text-[#94a3b8]">
                                {company.budgetStatus || "0-unqualified"}
                              </Badge>
                            </td>
                            <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white">
                              {companyPipelineValue > 0
                                ? `£${companyPipelineValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                : "--"}
                            </td>
                            <td className="py-2.5">
                              <button
                                onClick={() => {
                                  if (confirm(`Unlink "${company.name}" from this trust?`)) {
                                    unlinkSchoolMutation.mutate(company.id);
                                  }
                                }}
                                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                                title="Unlink school"
                              >
                                <Unlink className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-gray-500 dark:text-[#94a3b8]">No schools linked to this trust yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base dark:text-white">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {displayActivities.length > 0 ? (
                <div className="space-y-3">
                  {displayActivities.map((activity) => (
                    <div key={activity.id} className="flex gap-3 py-2 border-b border-gray-100 dark:border-[#3d4254] last:border-0">
                      <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#3d4254] flex items-center justify-center flex-shrink-0 mt-0.5 text-gray-500 dark:text-[#94a3b8]">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] capitalize dark:bg-[#3d4254] dark:text-[#94a3b8]">
                            {activity.type.replace("_", " ")}
                          </Badge>
                          {activity.companyName && (
                            <span className="text-xs text-[#0091AE] font-medium">{activity.companyName}</span>
                          )}
                          <span className="text-xs text-gray-400 dark:text-[#64748b] ml-auto">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        {activity.note && (
                          <p className="text-sm text-gray-600 dark:text-[#94a3b8] mt-1 line-clamp-2">{activity.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {activitiesData && activitiesData.length === 20 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full dark:border-[#3d4254] dark:text-[#94a3b8] dark:hover:bg-[#2d3142]"
                      onClick={() => {
                        setAllActivities(displayActivities);
                        setActivityOffset(prev => prev + 20);
                      }}
                    >
                      Load More
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-center py-8 text-gray-500 dark:text-[#94a3b8]">No activities yet across trust schools.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Trust</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete "{trust.name}" and unlink {companies?.length || 0} schools. Schools will not be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Trust
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add School Dialog */}
      <Dialog open={showAddSchoolDialog} onOpenChange={setShowAddSchoolDialog}>
        <DialogContent className="max-w-md max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>Add Existing School</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search schools..."
            value={schoolSearch}
            onChange={(e) => setSchoolSearch(e.target.value)}
            className="mb-3"
          />
          <div className="overflow-y-auto max-h-[300px] space-y-1">
            {availableSchools.map((company) => (
              <button
                key={company.id}
                onClick={() => {
                  linkSchoolMutation.mutate(company.id);
                  setShowAddSchoolDialog(false);
                  setSchoolSearch("");
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#2d3142] text-left transition-colors"
              >
                <Building2 className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{company.name}</p>
                  <p className="text-xs text-gray-500 dark:text-[#64748b]">{company.location || "No location"}</p>
                </div>
              </button>
            ))}
            {availableSchools.length === 0 && (
              <p className="text-center py-4 text-gray-500 dark:text-[#94a3b8] text-sm">
                {schoolSearch ? "No matching schools found" : "No available schools"}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <span className="text-[#64748b] mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-[#64748b]">{label}</p>
        <p className="text-gray-900 dark:text-white truncate">{value || "--"}</p>
      </div>
    </div>
  );
}
