import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Company, PipelineStage } from "@shared/schema";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const addCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  website: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  academyTrustName: z.string().optional(),
  ext: z.string().optional(),
  notes: z.string().optional(),
  itManagerName: z.string().optional(),
  itManagerEmail: z.string().optional(),
  stageId: z.string().optional(),
});

type AddCompanyForm = z.infer<typeof addCompanySchema>;

type CompanyWithStage = Company & { stage?: PipelineStage };

type SortField = "name" | "createdAt" | "lastContactDate" | "location" | "budgetStatus" | "phone";
type SortDirection = "asc" | "desc";

// Lead Status options with colors
const leadStatusOptions = [
  { value: "0-unqualified", label: "0 - Unqualified", color: "bg-gray-100 text-gray-700", dotColor: "bg-gray-400" },
  { value: "1-qualified", label: "1 - Qualified", color: "bg-blue-100 text-blue-700", dotColor: "bg-blue-500" },
  { value: "2-intent", label: "2 - Intent", color: "bg-orange-100 text-orange-700", dotColor: "bg-orange-500" },
  { value: "3-quote-presented", label: "3 - Quote Presented", color: "bg-green-100 text-green-700", dotColor: "bg-green-500" },
  { value: "3b-quoted-lost", label: "3b - Quoted Lost", color: "bg-red-100 text-red-700", dotColor: "bg-red-500" },
  { value: "4-account-active", label: "4 - Account Active", color: "bg-emerald-100 text-emerald-800", dotColor: "bg-emerald-600" },
];

export default function Companies() {
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
      ext: "",
      notes: "",
      itManagerName: "",
      itManagerEmail: "",
      stageId: "",
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
        ext: data.ext || null,
        notes: data.notes || null,
        itManagerName: data.itManagerName || null,
        itManagerEmail: data.itManagerEmail || null,
        stageId: data.stageId || null,
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
        <Badge className={`${option.color} hover:${option.color} text-xs font-medium`}>
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
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [companies, search, leadStatusFilter, dateFilter, sortField, sortDirection]);

  // Pagination
  const totalCompanies = filteredCompanies.length;
  const totalPages = Math.ceil(totalCompanies / perPage);
  const paginatedCompanies = filteredCompanies.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

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
    setSearch("");
  };

  const hasActiveFilters = leadStatusFilter !== "all" || ownerFilter !== "all" || dateFilter !== "all" || search !== "";

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 transition-colors"
    >
      {children}
      {sortField === field ? (
        sortDirection === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
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
    <div className="h-full flex flex-col bg-gray-50 dark:bg-background">
      {/* Top Bar */}
      <div className="bg-white dark:bg-card border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-foreground">
              Companies
            </h1>
            <Badge variant="secondary" className="text-xs">
              {totalCompanies}
            </Badge>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-add-company"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add company
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
                          <FormLabel>Academy Trust / Industry</FormLabel>
                          <FormControl>
                            <Input placeholder="Trust name or industry" {...field} />
                          </FormControl>
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
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
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

        {/* Search and Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 h-9"
              data-testid="input-search-companies"
            />
          </div>

          {/* Owner Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <User className="h-4 w-4" />
                Owner
                {ownerFilter !== "all" && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">1</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
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
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Filter className="h-4 w-4" />
                Lead Status
                {leadStatusFilter !== "all" && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">1</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Filter by Lead Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setLeadStatusFilter("all"); setCurrentPage(1); }}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-gray-300" />
                  All statuses
                </span>
              </DropdownMenuItem>
              {leadStatusOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => { setLeadStatusFilter(option.value); setCurrentPage(1); }}
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${option.dotColor}`} />
                    {option.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Calendar className="h-4 w-4" />
                Date
                {dateFilter !== "all" && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">1</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
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

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loadingCompanies ? (
          <div className="p-6 space-y-3 bg-white dark:bg-card">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : paginatedCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-card">
            <Building2 className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-800 dark:text-foreground mb-2">
              {hasActiveFilters ? "No companies match your filters" : "No companies yet"}
            </h3>
            <p className="text-gray-500 mb-4">
              {hasActiveFilters ? "Try adjusting your filters" : "Add your first company to get started"}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button
                onClick={() => setDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-add-first-company"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add company
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-card">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-muted/50 sticky top-0 z-10">
                <tr className="border-b">
                  <th className="w-12 px-4 py-3">
                    <Checkbox
                      checked={selectedIds.size === paginatedCompanies.length && paginatedCompanies.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="text-left px-4 py-3 min-w-[200px]">
                    <SortableHeader field="name">Company Name</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 min-w-[150px]">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Company Owner
                    </span>
                  </th>
                  <th className="text-left px-4 py-3 min-w-[120px]">
                    <SortableHeader field="createdAt">Create Date</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 min-w-[130px]">
                    <SortableHeader field="phone">Phone Number</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 min-w-[140px]">
                    <SortableHeader field="lastContactDate">Last Activity</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 min-w-[100px]">
                    <SortableHeader field="location">City</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 min-w-[120px]">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Country/Region
                    </span>
                  </th>
                  <th className="text-left px-4 py-3 min-w-[160px]">
                    <SortableHeader field="budgetStatus">Lead Status</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 min-w-[120px]">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Industry
                    </span>
                  </th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedCompanies.map((company, index) => (
                  <tr
                    key={company.id}
                    className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors ${
                      index % 2 === 1 ? "bg-gray-50/50 dark:bg-muted/20" : "bg-white dark:bg-card"
                    }`}
                    data-testid={`row-company-${company.id}`}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(company.id)}
                        onCheckedChange={() => handleSelectOne(company.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/company/${company.id}`}
                        className="flex items-center gap-3 group"
                        data-testid={`link-company-${company.id}`}
                      >
                        <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <span
                          className="font-semibold text-blue-600 group-hover:underline truncate"
                          data-testid={`text-company-name-${company.id}`}
                        >
                          {company.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-semibold text-white">CS</span>
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          Conner Szabo
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(company.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {company.phone ? (
                        <a
                          href={`tel:${company.phone}`}
                          className="text-sm text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDateTime(company.lastContactDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {company.location || "--"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        United Kingdom
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getLeadStatusBadge(company.budgetStatus)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {company.academyTrustName || "--"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-muted rounded transition-colors">
                            <MoreHorizontal className="h-4 w-4 text-gray-500" />
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

      {/* Pagination */}
      {totalCompanies > 0 && (
        <div className="bg-white dark:bg-card border-t px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>
              Showing {(currentPage - 1) * perPage + 1} - {Math.min(currentPage * perPage, totalCompanies)} of {totalCompanies}
            </span>
            <Select
              value={perPage.toString()}
              onValueChange={(v) => {
                setPerPage(parseInt(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="25">25 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[32px] h-8 px-2 text-sm rounded transition-colors ${
                      currentPage === page
                        ? "bg-blue-600 text-white"
                        : "hover:bg-gray-100 dark:hover:bg-muted text-gray-700 dark:text-gray-300"
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
              className="h-8"
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
