import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useSearch } from "wouter";
import type { Company, PipelineStage, Trust } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Calendar,
  Landmark,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const addCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  website: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  academyTrustName: z.string().optional(),
  industry: z.string().default("Secondary School"),
  ext: z.string().optional(),
  notes: z.string().optional(),
  itManagerName: z.string().optional(),
  itManagerEmail: z.string().optional(),
  stageId: z.string().optional(),
  budgetStatus: z.string().default("0-unqualified"),
  isTrust: z.boolean().default(false),
  parentCompanyId: z.string().optional(),
});

const industryOptions = [
  "Secondary School",
  "Primary School",
  "Primary/Secondary Education",
  "Further Education",
  "Special Educational Needs",
];

type AddCompanyForm = z.infer<typeof addCompanySchema>;

type CompanyWithStage = Company & { stage?: PipelineStage; trust?: Trust; parentCompany?: Company };

type SortField = "name" | "createdAt" | "lastContactDate" | "location" | "budgetStatus" | "phone" | "owner" | "country" | "industry" | "trust";
type SortDirection = "asc" | "desc";

// Lead Status options with colors - dark mode uses solid colored backgrounds with white text
const leadStatusOptions = [
  { value: "0-unqualified", label: "0 - Unqualified", color: "bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-600 dark:text-white dark:border-gray-500", dotColor: "bg-gray-500 dark:bg-gray-300" },
  { value: "1-qualified", label: "1 - Qualified", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-[#0091AE] dark:text-white dark:border-[#0091AE]", dotColor: "bg-blue-500 dark:bg-white" },
  { value: "2-intent", label: "2 - Intent", color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-[#f59e0b] dark:text-white dark:border-[#f59e0b]", dotColor: "bg-orange-500 dark:bg-white" },
  { value: "3-quote-presented", label: "3 - Quote Presented", color: "bg-green-100 text-green-800 border-green-200 dark:bg-[#10b981] dark:text-white dark:border-[#10b981]", dotColor: "bg-green-500 dark:bg-white" },
  { value: "3b-quoted-lost", label: "3b - Quoted Lost", color: "bg-red-100 text-red-800 border-red-200 dark:bg-[#ef4444] dark:text-white dark:border-[#ef4444]", dotColor: "bg-red-500 dark:bg-white" },
  { value: "4-account-active", label: "4 - Account Active", color: "bg-emerald-200 text-emerald-900 border-emerald-300 dark:bg-emerald-700 dark:text-white dark:border-emerald-600", dotColor: "bg-emerald-600 dark:bg-white" },
];

export default function Companies() {
  const searchParams = useSearch();
  const urlType = new URLSearchParams(searchParams).get("type");

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // Filters
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>(urlType === "trusts" ? "trusts" : "all");
  const [groupByTrust, setGroupByTrust] = useState(false);

  const { toast } = useToast();

  const { data: companies, isLoading: loadingCompanies } = useQuery<CompanyWithStage[]>({
    queryKey: ["/api/companies"],
  });

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const form = useForm<AddCompanyForm>({
    resolver: zodResolver(addCompanySchema),
    defaultValues: {
      name: "",
      website: "",
      phone: "",
      location: "",
      academyTrustName: "",
      industry: "Secondary School",
      ext: "",
      notes: "",
      itManagerName: "",
      itManagerEmail: "",
      stageId: "",
      budgetStatus: "0-unqualified",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AddCompanyForm) => {
      const checkRes = await fetch(`/api/companies/check-duplicate?name=${encodeURIComponent(data.name)}`);
      if (checkRes.ok) {
        const { exists } = await checkRes.json();
        if (exists) {
          throw new Error("DUPLICATE");
        }
      }

      return apiRequest("POST", "/api/companies", {
        name: data.name,
        website: data.website || null,
        phone: data.phone || null,
        location: data.location || null,
        academyTrustName: data.academyTrustName || null,
        industry: data.isTrust ? "Academy Trust" : (data.industry || "Secondary School"),
        ext: data.ext || null,
        notes: data.notes || null,
        itManagerName: data.itManagerName || null,
        itManagerEmail: data.itManagerEmail || null,
        stageId: data.stageId || null,
        isTrust: data.isTrust || false,
        parentCompanyId: data.parentCompanyId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Company added successfully" });
    },
    onError: (error: Error) => {
      if (error.message === "DUPLICATE") {
        toast({
          title: "Duplicate Company",
          description: "This company already exists in the database",
          variant: "destructive",
        });
      } else {
        toast({ title: "Failed to add company", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company deleted" });
    },
  });

  const getLeadStatusBadge = (status: string | null | undefined) => {
    const effectiveStatus = status || "0-unqualified";
    const option = leadStatusOptions.find(opt => opt.value === effectiveStatus);
    if (option) {
      return (
        <Badge
          className={`${option.color} border text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-sm`}
        >
          <span className={`inline-block w-2 h-2 rounded-full ${option.dotColor} mr-1.5`} />
          {option.label}
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs">{status}</Badge>;
  };

  // Filter and sort companies
  const filteredCompanies = useMemo(() => {
    if (!companies) return [];

    let filtered = companies;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.location?.toLowerCase().includes(searchLower) ||
          c.academyTrustName?.toLowerCase().includes(searchLower) ||
          c.phone?.includes(search)
      );
    }

    // Type filter
    if (typeFilter === "trusts") {
      filtered = filtered.filter((c) => c.isTrust);
    } else if (typeFilter === "schools") {
      filtered = filtered.filter((c) => !c.isTrust);
    }

    // Lead status filter
    if (leadStatusFilter !== "all") {
      filtered = filtered.filter((c) => {
        const status = c.budgetStatus || "0-unqualified";
        return status === leadStatusFilter;
      });
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      filtered = filtered.filter((c) => {
        const created = new Date(c.createdAt);
        switch (dateFilter) {
          case "today":
            return created >= today;
          case "week":
            return created >= weekAgo;
          case "month":
            return created >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "lastContactDate":
          const aDate = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
          const bDate = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
          comparison = aDate - bDate;
          break;
        case "location":
          comparison = (a.location || "").localeCompare(b.location || "");
          break;
        case "budgetStatus":
          comparison = (a.budgetStatus || "0-unqualified").localeCompare(b.budgetStatus || "0-unqualified");
          break;
        case "phone":
          comparison = (a.phone || "").localeCompare(b.phone || "");
          break;
        case "owner":
          // Currently static owner, but ready for future implementation
          comparison = 0;
          break;
        case "country":
          // Currently static country, but ready for future implementation
          comparison = 0;
          break;
        case "industry":
          comparison = (a.industry || "").localeCompare(b.industry || "");
          break;
        case "trust":
          comparison = (a.parentCompany?.name || a.trust?.name || a.academyTrustName || "").localeCompare(b.parentCompany?.name || b.trust?.name || b.academyTrustName || "");
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [companies, search, leadStatusFilter, dateFilter, typeFilter, sortField, sortDirection]);

  // Pagination
  const totalCompanies = filteredCompanies.length;
  const totalPages = Math.ceil(totalCompanies / perPage);
  const paginatedCompanies = filteredCompanies.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  // Group by trust
  const groupedByTrust = useMemo(() => {
    if (!groupByTrust) return null;
    const groups = new Map<string, { trustName: string; trustId: string | null; companies: CompanyWithStage[] }>();
    for (const c of filteredCompanies) {
      const key = c.parentCompany?.name || c.trust?.name || c.academyTrustName || "__independent__";
      if (!groups.has(key)) {
        groups.set(key, {
          trustName: key === "__independent__" ? "Independent Schools" : key,
          trustId: c.parentCompany?.id || c.trust?.id || null,
          companies: [],
        });
      }
      groups.get(key)!.companies.push(c);
    }
    // Sort: trusts alphabetically, independent last
    return Array.from(groups.values()).sort((a, b) => {
      if (a.trustName === "Independent Schools") return 1;
      if (b.trustName === "Independent Schools") return -1;
      return a.trustName.localeCompare(b.trustName);
    });
  }, [filteredCompanies, groupByTrust]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (name: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedCompanies.length && paginatedCompanies.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedCompanies.map((c) => c.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const onSubmit = (data: AddCompanyForm) => {
    createMutation.mutate(data);
  };

  const clearFilters = () => {
    setLeadStatusFilter("all");
    setOwnerFilter("all");
    setDateFilter("all");
    setTypeFilter("all");
    setSearch("");
  };

  const hasActiveFilters = leadStatusFilter !== "all" || ownerFilter !== "all" || dateFilter !== "all" || typeFilter !== "all" || search !== "";

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
        sortField === field
          ? "text-blue-600 dark:text-blue-400"
          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      }`}
    >
      {children}
      {sortField === field ? (
        sortDirection === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </button>
  );

  const formatDate = (date: string | Date | null) => {
    if (!date) return "--";
    return format(new Date(date), "MMM d, yyyy");
  };

  const formatDateTime = (date: string | Date | null) => {
    if (!date) return "--";
    return format(new Date(date), "MMM d, yyyy h:mm a");
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[#1a1d29]">
      {/* Top Bar - HubSpot Style */}
      <div className="bg-white dark:bg-[#252936] border-b border-gray-200 dark:border-[#3d4254]">
        {/* Header Row */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#3d4254]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Companies
              </h1>
              <Badge variant="secondary" className="text-sm font-medium dark:bg-[#3d4254] dark:text-[#94a3b8]">
                {totalCompanies} records
              </Badge>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-[#0091AE] hover:bg-[#007a94] text-white font-medium shadow-sm"
                  data-testid="button-add-company"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Company
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Company</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter company name"
                                data-testid="input-company-name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website</FormLabel>
                            <FormControl>
                              <Input placeholder="https://example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter phone number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City / Location</FormLabel>
                            <FormControl>
                              <Input placeholder="City or address" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="academyTrustName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Academy Trust</FormLabel>
                            <FormControl>
                              <Input placeholder="Trust name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="industry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Industry</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "Secondary School"}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select industry" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {industryOptions.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="stageId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pipeline Stage</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a stage" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {stages?.map((stage) => (
                                  <SelectItem key={stage.id} value={stage.id}>
                                    {stage.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="budgetStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lead Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "0-unqualified"}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select lead status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {leadStatusOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-[#0091AE] hover:bg-[#007a94] text-white"
                      disabled={createMutation.isPending}
                      data-testid="button-submit-company"
                    >
                      {createMutation.isPending ? "Adding..." : "Add Company"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search and Filters Row */}
        <div className="px-6 py-3 flex items-center gap-4">
          {/* Full-width Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#64748b]" />
            <Input
              type="search"
              placeholder="Search companies by name, location, phone, or industry..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 h-10 w-full border-gray-300 dark:border-[#3d4254] dark:bg-[#1a1d29] dark:text-white dark:placeholder:text-[#64748b] focus:border-[#0091AE] focus:ring-[#0091AE]"
              data-testid="input-search-companies"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Owner Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-2 border-gray-300 dark:border-[#3d4254] dark:bg-[#252936] dark:text-[#94a3b8] dark:hover:bg-[#2d3142] dark:hover:text-white hover:border-gray-400">
                  <User className="h-4 w-4" />
                  Owner
                  {ownerFilter !== "all" && (
                    <Badge className="ml-1 h-5 px-1.5 bg-[#0091AE] text-white text-[10px]">1</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by Owner</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setOwnerFilter("all")}>
                  All owners
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setOwnerFilter("me")}>
                  My companies
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setOwnerFilter("unassigned")}>
                  Unassigned
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Lead Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-2 border-gray-300 dark:border-[#3d4254] dark:bg-[#252936] dark:text-[#94a3b8] dark:hover:bg-[#2d3142] dark:hover:text-white hover:border-gray-400">
                  <Filter className="h-4 w-4" />
                  Lead Status
                  {leadStatusFilter !== "all" && (
                    <Badge className="ml-1 h-5 px-1.5 bg-[#0091AE] text-white text-[10px]">1</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filter by Lead Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setLeadStatusFilter("all"); setCurrentPage(1); }}>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                    All statuses
                  </span>
                </DropdownMenuItem>
                {leadStatusOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => { setLeadStatusFilter(option.value); setCurrentPage(1); }}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${option.dotColor}`} />
                      {option.label}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Date Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-2 border-gray-300 dark:border-[#3d4254] dark:bg-[#252936] dark:text-[#94a3b8] dark:hover:bg-[#2d3142] dark:hover:text-white hover:border-gray-400">
                  <Calendar className="h-4 w-4" />
                  Create Date
                  {dateFilter !== "all" && (
                    <Badge className="ml-1 h-5 px-1.5 bg-[#0091AE] text-white text-[10px]">1</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by Create Date</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setDateFilter("all"); setCurrentPage(1); }}>
                  All time
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDateFilter("today"); setCurrentPage(1); }}>
                  Today
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDateFilter("week"); setCurrentPage(1); }}>
                  Last 7 days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDateFilter("month"); setCurrentPage(1); }}>
                  Last 30 days
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-2 border-gray-300 dark:border-[#3d4254] dark:bg-[#252936] dark:text-[#94a3b8] dark:hover:bg-[#2d3142] dark:hover:text-white hover:border-gray-400">
                  <Building2 className="h-4 w-4" />
                  Type
                  {typeFilter !== "all" && (
                    <Badge className="ml-1 h-5 px-1.5 bg-[#0091AE] text-white text-[10px]">1</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setTypeFilter("all"); setCurrentPage(1); }}>
                  All types
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setTypeFilter("schools"); setCurrentPage(1); }}>
                  Schools Only
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setTypeFilter("trusts"); setCurrentPage(1); }}>
                  Trusts Only
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Group by Trust Toggle */}
            <button
              onClick={() => setGroupByTrust(!groupByTrust)}
              className={`h-10 px-3 rounded-md border text-sm font-medium transition-colors ${
                groupByTrust
                  ? "bg-[#0091AE]/10 border-[#0091AE] text-[#0091AE] dark:bg-[#0091AE]/20"
                  : "border-gray-300 dark:border-[#3d4254] text-gray-600 dark:text-[#94a3b8] hover:border-gray-400 dark:hover:bg-[#2d3142] dark:hover:text-white"
              }`}
            >
              Group by Trust
            </button>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-10 text-[#0091AE] hover:text-[#06b6d4] hover:bg-[#0091AE]/10 dark:hover:bg-[#0091AE]/20"
              >
                <X className="h-4 w-4 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loadingCompanies ? (
          <div className="p-6 space-y-2 bg-white dark:bg-[#252936]">
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-5 w-5 rounded dark:bg-[#3d4254]" />
              <Skeleton className="h-5 w-[200px] dark:bg-[#3d4254]" />
              <Skeleton className="h-5 w-[150px] dark:bg-[#3d4254]" />
              <Skeleton className="h-5 w-[100px] dark:bg-[#3d4254]" />
              <Skeleton className="h-5 w-[120px] dark:bg-[#3d4254]" />
            </div>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-[#3d4254]">
                <Skeleton className="h-5 w-5 rounded dark:bg-[#3d4254]" />
                <Skeleton className="h-8 w-8 rounded-md dark:bg-[#3d4254]" />
                <Skeleton className="h-5 w-[180px] dark:bg-[#3d4254]" />
                <Skeleton className="h-6 w-6 rounded-full dark:bg-[#3d4254]" />
                <Skeleton className="h-4 w-[100px] dark:bg-[#3d4254]" />
                <Skeleton className="h-4 w-[90px] dark:bg-[#3d4254]" />
                <Skeleton className="h-4 w-[100px] dark:bg-[#3d4254]" />
                <Skeleton className="h-4 w-[80px] dark:bg-[#3d4254]" />
                <Skeleton className="h-6 w-[120px] rounded-full dark:bg-[#3d4254]" />
              </div>
            ))}
          </div>
        ) : paginatedCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#252936]">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-[#3d4254] flex items-center justify-center mb-6">
              <Building2 className="h-10 w-10 text-gray-400 dark:text-[#64748b]" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              {hasActiveFilters ? "No companies match your filters" : "No companies yet"}
            </h3>
            <p className="text-gray-500 dark:text-[#94a3b8] mb-6 text-center max-w-md">
              {hasActiveFilters
                ? "Try adjusting or clearing your filters to see more results"
                : "Get started by adding your first company to the CRM"}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters} className="border-gray-300 dark:border-[#3d4254] dark:bg-[#252936] dark:text-white dark:hover:bg-[#2d3142]">
                Clear all filters
              </Button>
            ) : (
              <Button
                onClick={() => setDialogOpen(true)}
                className="bg-[#0091AE] hover:bg-[#007a94] text-white shadow-sm"
                data-testid="button-add-first-company"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add your first company
              </Button>
            )}
          </div>
        ) : groupByTrust && groupedByTrust ? (
          <div className="bg-white dark:bg-[#252936] border-x border-gray-200 dark:border-[#3d4254]">
            {groupedByTrust.map((group) => (
              <div key={group.trustName} className="border-b border-gray-200 dark:border-[#3d4254]">
                <button
                  onClick={() => toggleGroup(group.trustName)}
                  className="w-full px-6 py-3 flex items-center gap-3 bg-gray-50 dark:bg-[#2d3142] hover:bg-gray-100 dark:hover:bg-[#3d4254] transition-colors text-left"
                >
                  <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${collapsedGroups.has(group.trustName) ? "-rotate-90" : ""}`} />
                  <Landmark className="h-4 w-4 text-purple-500" />
                  <span className="font-semibold text-gray-900 dark:text-white">{group.trustName}</span>
                  <Badge variant="secondary" className="ml-1 dark:bg-[#3d4254] dark:text-[#94a3b8]">
                    {group.companies.length} {group.companies.length === 1 ? "school" : "schools"}
                  </Badge>
                  {group.trustId && (
                    <Link
                      href={`/company/${group.trustId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="ml-auto text-xs text-[#0091AE] hover:underline"
                    >
                      View Trust
                    </Link>
                  )}
                </button>
                {!collapsedGroups.has(group.trustName) && (
                  <div className="divide-y divide-gray-100 dark:divide-[#3d4254]">
                    {group.companies.map((company) => (
                      <div key={company.id} className="px-6 py-2.5 flex items-center gap-4 hover:bg-blue-50/50 dark:hover:bg-[#2d3142] pl-14">
                        <Link href={`/company/${company.id}`} className="flex items-center gap-2 flex-1 min-w-0">
                          <Building2 className="h-3.5 w-3.5 text-[#0091AE] flex-shrink-0" />
                          <span className="text-sm font-medium text-[#0091AE] hover:underline truncate">{company.name}</span>
                        </Link>
                        <span className="text-xs text-gray-500 dark:text-[#64748b] w-24 truncate">{company.location || "--"}</span>
                        <span className="text-xs w-28">{getLeadStatusBadge(company.budgetStatus)}</span>
                        <span className="text-xs text-gray-500 dark:text-[#64748b] w-24">
                          {company.lastContactDate ? format(new Date(company.lastContactDate), "MMM d, yyyy") : "--"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#252936] border-x border-gray-200 dark:border-[#3d4254]">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 dark:bg-[#2d3142] sticky top-0 z-10 border-b border-gray-200 dark:border-[#3d4254]">
                <tr>
                  <th className="w-12 px-4 py-3 border-r border-gray-100 dark:border-[#3d4254]">
                    <Checkbox
                      checked={selectedIds.size === paginatedCompanies.length && paginatedCompanies.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="text-left px-4 py-3 w-[220px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="name">Company Name</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[160px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="owner">Company Owner</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[120px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="createdAt">Create Date</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[140px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="phone">Phone Number</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[150px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="lastContactDate">Last Activity Date</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[100px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="location">City</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[130px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="country">Country/Region</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[170px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="budgetStatus">Lead Status</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[140px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="industry">Industry</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[160px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="trust">Academy Trust</SortableHeader>
                  </th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#3d4254]">
                {paginatedCompanies.map((company, index) => (
                  <tr
                    key={company.id}
                    className={`group transition-colors cursor-pointer ${
                      index % 2 === 0
                        ? "bg-white dark:bg-[#252936]"
                        : "bg-gray-50/70 dark:bg-[#1a1d29]"
                    } hover:bg-blue-50/50 dark:hover:bg-[#2d3142]`}
                    data-testid={`row-company-${company.id}`}
                  >
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <Checkbox
                        checked={selectedIds.has(company.id)}
                        onCheckedChange={() => handleSelectOne(company.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <Link
                        href={`/company/${company.id}`}
                        className="flex items-center gap-3"
                        data-testid={`link-company-${company.id}`}
                      >
                        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#0091AE]/20 to-[#06b6d4]/20 dark:from-[#0091AE]/30 dark:to-[#06b6d4]/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <Building2 className="h-4 w-4 text-[#0091AE]" />
                        </div>
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="font-semibold text-[#0091AE] hover:text-[#06b6d4] hover:underline truncate"
                            data-testid={`text-company-name-${company.id}`}
                          >
                            {company.name}
                          </span>
                          {company.isTrust && (
                            <Badge className="bg-purple-600 hover:bg-purple-600 text-white text-[9px] px-1.5 py-0 flex-shrink-0">
                              Trust
                            </Badge>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0091AE] to-[#06b6d4] flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-[10px] font-bold text-white">CS</span>
                        </div>
                        <span className="text-sm text-gray-700 dark:text-[#94a3b8] truncate">
                          Conner Szabo
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <span className="text-sm text-gray-600 dark:text-[#94a3b8]">
                        {formatDate(company.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      {company.phone ? (
                        <a
                          href={`tel:${company.phone}`}
                          className="text-sm text-[#0091AE] hover:text-[#06b6d4] hover:underline font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-[#64748b]">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <span className="text-sm text-gray-600 dark:text-[#94a3b8]">
                        {formatDate(company.lastContactDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <span className="text-sm text-gray-600 dark:text-[#94a3b8] truncate block">
                        {company.location || "--"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <span className="text-sm text-gray-600 dark:text-[#94a3b8]">
                        United Kingdom
                      </span>
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      {getLeadStatusBadge(company.budgetStatus)}
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <span className="text-sm text-gray-600 dark:text-[#94a3b8] truncate block">
                        {company.industry || "--"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      {company.parentCompany ? (
                        <Link href={`/company/${company.parentCompany.id}`} className="text-sm text-[#0091AE] hover:underline truncate block" onClick={(e) => e.stopPropagation()}>
                          {company.parentCompany.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-600 dark:text-[#94a3b8] truncate block">
                          {company.trust?.name || company.academyTrustName || "--"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 hover:bg-gray-200 dark:hover:bg-[#3d4254] rounded-md transition-colors opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4 text-gray-500 dark:text-[#94a3b8]" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/company/${company.id}`} className="flex items-center gap-2">
                              <ExternalLink className="h-4 w-4" />
                              View details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => {
                              if (confirm("Delete this company?")) {
                                deleteMutation.mutate(company.id);
                              }
                            }}
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

      {/* Pagination - HubSpot Style */}
      {totalCompanies > 0 && (
        <div className="bg-white dark:bg-[#252936] border-t border-gray-200 dark:border-[#3d4254] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#94a3b8]">
            <Select
              value={perPage.toString()}
              onValueChange={(v) => {
                setPerPage(parseInt(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[130px] h-9 border-gray-300 dark:border-[#3d4254] dark:bg-[#1a1d29] dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="25">25 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-gray-500 dark:text-[#64748b] ml-2">
              {(currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, totalCompanies)} of {totalCompanies}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-9 px-3 border-gray-300 dark:border-[#3d4254] dark:bg-[#252936] dark:text-white dark:hover:bg-[#2d3142] disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <div className="flex items-center">
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) {
                  page = i + 1;
                } else if (currentPage <= 4) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  page = totalPages - 6 + i;
                } else {
                  page = currentPage - 3 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[36px] h-9 px-3 text-sm font-medium rounded-md transition-colors mx-0.5 ${
                      currentPage === page
                        ? "bg-[#0091AE] text-white shadow-sm"
                        : "text-gray-700 dark:text-[#94a3b8] hover:bg-gray-100 dark:hover:bg-[#2d3142]"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-9 px-3 border-gray-300 dark:border-[#3d4254] dark:bg-[#252936] dark:text-white dark:hover:bg-[#2d3142] disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
