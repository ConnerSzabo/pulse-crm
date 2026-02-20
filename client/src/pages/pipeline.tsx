import { useState, useMemo, DragEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { PipelineStage, DealWithCompanyAndStage, Company } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Search,
  LayoutGrid,
  Filter,
  ArrowUpDown,
  Plus,
  Building2,
  Calendar,
  User,
  GripVertical,
  ChevronDown,
  DollarSign,
  Clock,
  Trash2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const dealSchema = z.object({
  title: z.string().min(1, "Deal title is required"),
  companyId: z.string().min(1, "Please select a company"),
  stageId: z.string().min(1, "Please select a stage"),
  expectedGP: z.string().optional(),
  budgetStatus: z.string().optional(),
  decisionTimeline: z.string().optional(),
  notes: z.string().optional(),
});

// Probability weights for each stage (for weighted amount calculation)
const stageProbabilities: Record<string, number> = {
  "Qualified Opportunity": 0.2,
  "Quote Presented": 0.4,
  "Decision Maker Brought-In": 0.6,
  "Awaiting Order": 0.8,
  "Closed Won": 1.0,
  "Closed Lost": 0,
};

export default function Pipeline() {
  const { toast } = useToast();
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"created" | "amount" | "close">("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showAddDealDialog, setShowAddDealDialog] = useState(false);
  const [selectedStageForNewDeal, setSelectedStageForNewDeal] = useState<string>("");
  const [showDeleteDealDialog, setShowDeleteDealDialog] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<DealWithCompanyAndStage | null>(null);

  const { data: deals, isLoading: loadingDeals } = useQuery<DealWithCompanyAndStage[]>({
    queryKey: ["/api/deals"],
  });

  const { data: stages, isLoading: loadingStages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const dealForm = useForm<z.infer<typeof dealSchema>>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: "",
      companyId: "",
      stageId: "",
      expectedGP: "",
      budgetStatus: "",
      decisionTimeline: "",
      notes: "",
    },
  });

  const updateDealStageMutation = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      return apiRequest("PATCH", `/api/deals/${dealId}`, { stageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });

  const addDealMutation = useMutation({
    mutationFn: async (data: z.infer<typeof dealSchema>) => {
      return apiRequest("POST", `/api/companies/${data.companyId}/deals`, {
        companyId: data.companyId,
        title: data.title,
        stageId: data.stageId,
        expectedGP: data.expectedGP || null,
        budgetStatus: data.budgetStatus || null,
        decisionTimeline: data.decisionTimeline ? new Date(data.decisionTimeline).toISOString() : null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      dealForm.reset();
      setShowAddDealDialog(false);
      toast({ title: "Deal created successfully" });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (dealId: string) => {
      return apiRequest("DELETE", `/api/deals/${dealId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setShowDeleteDealDialog(false);
      setDealToDelete(null);
      toast({ title: "Deal deleted successfully" });
    },
  });

  // Filter and sort deals
  const filteredDeals = useMemo(() => {
    if (!deals) return [];

    let filtered = deals;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (deal) =>
          deal.title.toLowerCase().includes(query) ||
          deal.company?.name?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "amount":
          const amountA = a.expectedGP ? parseFloat(a.expectedGP) : 0;
          const amountB = b.expectedGP ? parseFloat(b.expectedGP) : 0;
          comparison = amountA - amountB;
          break;
        case "close":
          const dateA = a.decisionTimeline ? new Date(a.decisionTimeline).getTime() : 0;
          const dateB = b.decisionTimeline ? new Date(b.decisionTimeline).getTime() : 0;
          comparison = dateA - dateB;
          break;
        case "created":
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [deals, searchQuery, sortBy, sortOrder]);

  const getDealsByStage = (stageId: string) => {
    return filteredDeals.filter((d) => d.stageId === stageId);
  };

  const getStageStats = (stageId: string, stageName: string) => {
    const stageDeals = getDealsByStage(stageId);
    const totalAmount = stageDeals.reduce((sum, deal) => {
      return sum + (deal.expectedGP ? parseFloat(deal.expectedGP) : 0);
    }, 0);
    const probability = stageProbabilities[stageName] ?? 0.5;
    const weightedAmount = totalAmount * probability;

    return { count: stageDeals.length, totalAmount, weightedAmount };
  };

  const handleDragStart = (e: DragEvent, dealId: string) => {
    setDraggedDealId(dealId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dealId);
    // Add a slight delay for visual feedback
    const target = e.currentTarget as HTMLElement;
    setTimeout(() => {
      target.style.opacity = "0.5";
    }, 0);
  };

  const handleDragEnd = (e: DragEvent) => {
    setDraggedDealId(null);
    setDragOverStageId(null);
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = "1";
  };

  const handleDragOver = (e: DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStageId(stageId);
  };

  const handleDragLeave = (e: DragEvent) => {
    // Only reset if we're leaving the column entirely
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      setDragOverStageId(null);
    }
  };

  const handleDrop = (e: DragEvent, stageId: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("text/plain");
    if (dealId && dealId !== "") {
      // Find the deal to check if stage actually changed
      const deal = deals?.find((d) => d.id === dealId);
      if (deal && deal.stageId !== stageId) {
        updateDealStageMutation.mutate({ dealId, stageId });
        toast({ title: "Deal moved to new stage" });
      }
    }
    setDraggedDealId(null);
    setDragOverStageId(null);
  };

  const openAddDealWithStage = (stageId: string) => {
    setSelectedStageForNewDeal(stageId);
    dealForm.setValue("stageId", stageId);
    setShowAddDealDialog(true);
  };

  const handleAddDealSubmit = (data: z.infer<typeof dealSchema>) => {
    addDealMutation.mutate(data);
  };

  if (loadingDeals || loadingStages) {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-[#1a1d29]">
        <div className="p-4 border-b bg-white dark:bg-[#252936] dark:border-[#3d4254]">
          <Skeleton className="h-10 w-full max-w-md dark:bg-[#3d4254]" />
        </div>
        <div className="flex-1 p-4">
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-[500px] w-[300px] flex-shrink-0 dark:bg-[#252936]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Calculate overall pipeline stats
  const totalPipelineValue = deals?.reduce((sum, deal) => {
    return sum + (deal.expectedGP ? parseFloat(deal.expectedGP) : 0);
  }, 0) || 0;

  const totalDeals = deals?.length || 0;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[#1a1d29]">
      {/* Top Controls Bar */}
      <div className="bg-white dark:bg-[#252936] border-b border-gray-200 dark:border-[#3d4254] px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left side controls */}
          <div className="flex items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-[#64748b]" />
              <Input
                placeholder="Search deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white dark:placeholder:text-[#64748b]"
              />
            </div>

            {/* Board View Toggle */}
            <Button variant="outline" size="sm" className="h-9 gap-2 dark:bg-[#252936] dark:border-[#3d4254] dark:text-[#94a3b8] dark:hover:bg-[#2d3142] dark:hover:text-white">
              <LayoutGrid className="h-4 w-4" />
              Board view
              <ChevronDown className="h-3 w-3" />
            </Button>

            {/* Filters */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 dark:bg-[#252936] dark:border-[#3d4254] dark:text-[#94a3b8] dark:hover:bg-[#2d3142] dark:hover:text-white">
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 dark:bg-[#252936] dark:border-[#3d4254]">
                <DropdownMenuLabel className="dark:text-[#94a3b8]">Filter by</DropdownMenuLabel>
                <DropdownMenuSeparator className="dark:bg-[#3d4254]" />
                <DropdownMenuItem className="dark:text-white dark:focus:bg-[#2d3142]">All deals</DropdownMenuItem>
                <DropdownMenuItem className="dark:text-white dark:focus:bg-[#2d3142]">My deals</DropdownMenuItem>
                <DropdownMenuItem className="dark:text-white dark:focus:bg-[#2d3142]">High value (&gt; £10k)</DropdownMenuItem>
                <DropdownMenuItem className="dark:text-white dark:focus:bg-[#2d3142]">Closing this month</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 dark:bg-[#252936] dark:border-[#3d4254] dark:text-[#94a3b8] dark:hover:bg-[#2d3142] dark:hover:text-white">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 dark:bg-[#252936] dark:border-[#3d4254]">
                <DropdownMenuLabel className="dark:text-[#94a3b8]">Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator className="dark:bg-[#3d4254]" />
                <DropdownMenuItem className="dark:text-white dark:focus:bg-[#2d3142]" onClick={() => { setSortBy("created"); setSortOrder("desc"); }}>
                  Newest first
                </DropdownMenuItem>
                <DropdownMenuItem className="dark:text-white dark:focus:bg-[#2d3142]" onClick={() => { setSortBy("created"); setSortOrder("asc"); }}>
                  Oldest first
                </DropdownMenuItem>
                <DropdownMenuItem className="dark:text-white dark:focus:bg-[#2d3142]" onClick={() => { setSortBy("amount"); setSortOrder("desc"); }}>
                  Highest value
                </DropdownMenuItem>
                <DropdownMenuItem className="dark:text-white dark:focus:bg-[#2d3142]" onClick={() => { setSortBy("amount"); setSortOrder("asc"); }}>
                  Lowest value
                </DropdownMenuItem>
                <DropdownMenuItem className="dark:text-white dark:focus:bg-[#2d3142]" onClick={() => { setSortBy("close"); setSortOrder("asc"); }}>
                  Closing soon
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right side - Stats and Add button */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-xs text-muted-foreground dark:text-[#64748b]">{totalDeals} deals</p>
              <p className="text-sm font-semibold text-[#10b981]">
                £{totalPipelineValue.toLocaleString()}
              </p>
            </div>

            <Button
              onClick={() => setShowAddDealDialog(true)}
              className="bg-[#0091AE] hover:bg-[#007a94] text-white h-9"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add deal
            </Button>
          </div>
        </div>
      </div>

      {/* Pipeline Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-3 h-full min-w-max">
          {stages?.map((stage) => {
            const stats = getStageStats(stage.id, stage.name);
            const stageDeals = getDealsByStage(stage.id);
            const isDropTarget = dragOverStageId === stage.id;

            return (
              <div
                key={stage.id}
                className={`w-[300px] flex-shrink-0 flex flex-col bg-white dark:bg-[#252936] rounded-lg shadow-sm dark:border dark:border-[#3d4254] transition-all duration-200 ${
                  isDropTarget ? "ring-2 ring-[#0091AE] ring-offset-2 dark:ring-offset-[#1a1d29]" : ""
                }`}
                data-testid={`pipeline-column-${stage.id}`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Stage Header */}
                <div
                  className="p-3 border-b dark:border-[#3d4254] rounded-t-lg"
                  style={{ borderTopColor: stage.color, borderTopWidth: "3px" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm dark:text-white">{stage.name}</span>
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs dark:bg-[#3d4254] dark:text-[#94a3b8]">
                        {stats.count}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 dark:text-[#94a3b8] dark:hover:bg-[#3d4254] dark:hover:text-white"
                      onClick={() => openAddDealWithStage(stage.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Stage Content - Scrollable */}
                <div
                  className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px] transition-colors duration-200 ${
                    isDropTarget ? "bg-blue-50 dark:bg-[#0091AE]/10" : "bg-gray-50/50 dark:bg-[#1a1d29]/50"
                  }`}
                >
                  {stageDeals.length === 0 ? (
                    <div
                      className={`text-center py-12 text-muted-foreground dark:text-[#64748b] text-xs border-2 border-dashed rounded-lg transition-colors ${
                        isDropTarget
                          ? "border-[#0091AE] bg-[#0091AE]/10"
                          : "border-gray-200 dark:border-[#3d4254]"
                      }`}
                    >
                      {isDropTarget ? "Drop deal here" : "No deals in this stage"}
                    </div>
                  ) : (
                    stageDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        isDragging={draggedDealId === deal.id}
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        onDragEnd={handleDragEnd}
                        onDelete={(d) => {
                          setDealToDelete(d);
                          setShowDeleteDealDialog(true);
                        }}
                      />
                    ))
                  )}
                </div>

                {/* Stage Footer - Totals */}
                <div className="p-3 border-t bg-gray-50 dark:bg-[#2d3142] dark:border-[#3d4254] rounded-b-lg">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground dark:text-[#64748b]">Total</p>
                      <p className="font-semibold text-[#10b981]">
                        £{stats.totalAmount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground dark:text-[#64748b]">Weighted</p>
                      <p className="font-semibold text-[#0091AE]">
                        £{Math.round(stats.weightedAmount).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Deal Dialog */}
      <Dialog open={showAddDealDialog} onOpenChange={(open) => {
        setShowAddDealDialog(open);
        if (!open) {
          dealForm.reset();
          setSelectedStageForNewDeal("");
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Deal</DialogTitle>
          </DialogHeader>
          <Form {...dealForm}>
            <form onSubmit={dealForm.handleSubmit(handleAddDealSubmit)} className="space-y-4">
              <FormField
                control={dealForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Laptop Refresh Project" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={dealForm.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Associated Company *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={dealForm.control}
                name="stageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pipeline Stage *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stages?.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: stage.color }}
                              />
                              {stage.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={dealForm.control}
                  name="expectedGP"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (£)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g. 5000" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={dealForm.control}
                  name="decisionTimeline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Close Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={dealForm.control}
                name="budgetStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="indicative">Indicative</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={dealForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add any notes..." className="min-h-[80px]" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddDealDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#0091AE] hover:bg-[#007a94] text-white"
                  disabled={addDealMutation.isPending}
                >
                  {addDealMutation.isPending ? "Creating..." : "Create Deal"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Deal Confirmation Dialog */}
      <AlertDialog open={showDeleteDealDialog} onOpenChange={(open) => {
        setShowDeleteDealDialog(open);
        if (!open) setDealToDelete(null);
      }}>
        <AlertDialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Delete this deal?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-[#94a3b8]">
              This will permanently remove this deal from the pipeline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteDealMutation.isPending}
              onClick={() => dealToDelete && deleteDealMutation.mutate(dealToDelete.id)}
              className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700"
            >
              {deleteDealMutation.isPending ? "Deleting..." : "Delete Deal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DealCard({
  deal,
  isDragging,
  onDragStart,
  onDragEnd,
  onDelete,
}: {
  deal: DealWithCompanyAndStage;
  isDragging: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
  onDelete: (deal: DealWithCompanyAndStage) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`transition-all duration-200 ${
        isDragging ? "opacity-50 scale-[0.98] rotate-1" : "opacity-100"
      }`}
    >
      <Card
        className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 group relative bg-white dark:bg-[#252936] dark:border-[#3d4254] dark:hover:border-[#4d5264]"
        data-testid={`pipeline-card-${deal.id}`}
      >
        {/* Delete button - visible on hover */}
        <button
          className="absolute top-2 right-2 h-6 w-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600 dark:text-[#64748b] dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-[#2d3142] z-10"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete(deal);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <div className="space-y-2.5">
          {/* Drag handle and Deal title */}
          <div className="flex items-start gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground dark:text-[#64748b] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Link href={`/company/${deal.companyId}`}>
                <h4
                  className="font-semibold text-sm text-[#0091AE] hover:text-[#06b6d4] hover:underline cursor-pointer truncate"
                  data-testid={`text-pipeline-deal-${deal.id}`}
                >
                  {deal.title}
                </h4>
              </Link>
            </div>
          </div>

          {/* Amount */}
          {deal.expectedGP && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-[#10b981]" />
              <span className="text-sm font-bold text-[#10b981]">
                £{parseFloat(deal.expectedGP).toLocaleString()}
              </span>
            </div>
          )}

          {/* Close date */}
          {deal.decisionTimeline && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground dark:text-[#94a3b8]">
              <Calendar className="h-3 w-3" />
              <span>Close: {format(new Date(deal.decisionTimeline), "MMM d, yyyy")}</span>
            </div>
          )}

          {/* Deal owner - placeholder */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground dark:text-[#94a3b8]">
            <User className="h-3 w-3" />
            <span>Unassigned</span>
          </div>

          {/* Create date */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground dark:text-[#64748b]">
            <Clock className="h-3 w-3" />
            <span>Created {formatDistanceToNow(new Date(deal.createdAt), { addSuffix: true })}</span>
          </div>

          {/* Associated company */}
          {deal.company && (
            <div className="pt-2 border-t dark:border-[#3d4254]">
              <Link href={`/company/${deal.companyId}`}>
                <div className="flex items-center gap-1.5 text-xs dark:text-[#94a3b8] hover:text-[#0091AE] cursor-pointer min-w-0">
                  <Building2 className="h-3 w-3 flex-shrink-0" />
                  <span className="font-medium truncate">{deal.company.name}</span>
                </div>
              </Link>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
