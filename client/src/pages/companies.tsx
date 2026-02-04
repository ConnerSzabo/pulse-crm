import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Company, PipelineStage } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  Building2,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
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

type SortField = "name" | "createdAt" | "lastContactDate" | "location";
type SortDirection = "asc" | "desc";

export default function Companies() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
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

  // Filter and sort companies
  const filteredCompanies = companies
    ?.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.location?.toLowerCase().includes(search.toLowerCase()) ||
        c.academyTrustName?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
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
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  // Pagination
  const totalCompanies = filteredCompanies?.length || 0;
  const totalPages = Math.ceil(totalCompanies / perPage);
  const paginatedCompanies = filteredCompanies?.slice(
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
    if (selectedIds.size === paginatedCompanies?.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedCompanies?.map((c) => c.id)));
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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-cyan-600" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-cyan-600" />
    );
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "--";
    return format(new Date(date), "MMM d, yyyy h:mm a") + " GMT";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 text-xl font-semibold text-gray-800 hover:text-gray-600">
                  Companies
                  <ChevronDown className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem>All companies</DropdownMenuItem>
                <DropdownMenuItem>My companies</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-sm text-gray-500">({totalCompanies})</span>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
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
                    className="w-full bg-cyan-600 hover:bg-cyan-700"
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
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-10 pr-4 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              data-testid="input-search-companies"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Company owner</DropdownMenuItem>
              <DropdownMenuItem>Create date</DropdownMenuItem>
              <DropdownMenuItem>Last activity</DropdownMenuItem>
              <DropdownMenuItem>Pipeline stage</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        {loadingCompanies ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : paginatedCompanies?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-800 mb-2">No companies yet</h3>
            <p className="text-gray-500 mb-4">Add your first company to get started</p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-cyan-600 hover:bg-cyan-700"
              data-testid="button-add-first-company"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add company
            </Button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    checked={selectedIds.size === paginatedCompanies?.length && paginatedCompanies.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
                  >
                    Company Name
                    <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Company Owner
                  </span>
                </th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => handleSort("createdAt")}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
                  >
                    Create Date
                    <SortIcon field="createdAt" />
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Phone
                  </span>
                </th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => handleSort("lastContactDate")}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
                  >
                    Last Activity
                    <SortIcon field="lastContactDate" />
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => handleSort("location")}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
                  >
                    City
                    <SortIcon field="location" />
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Stage
                  </span>
                </th>
                <th className="w-12 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedCompanies?.map((company, index) => (
                <tr
                  key={company.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    index % 2 === 1 ? "bg-gray-50/50" : ""
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
                      <div className="w-8 h-8 rounded bg-cyan-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-cyan-600" />
                      </div>
                      <span
                        className="font-medium text-cyan-600 group-hover:underline"
                        data-testid={`text-company-name-${company.id}`}
                      >
                        {company.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-white">CS</span>
                      </div>
                      <span className="text-sm text-gray-700">Conner Szabo</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{formatDate(company.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {company.phone ? (
                      <a
                        href={`tel:${company.phone}`}
                        className="text-sm text-cyan-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {company.phone}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">
                      {formatDate(company.lastContactDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{company.location || "--"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {company.stage ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                        style={{
                          backgroundColor: company.stage.color + "15",
                          color: company.stage.color,
                        }}
                      >
                        {company.stage.name}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
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
        )}
      </div>

      {/* Pagination */}
      {totalCompanies > 0 && (
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{totalCompanies} companies</span>
            <span className="text-gray-300">|</span>
            <Select
              value={perPage.toString()}
              onValueChange={(v) => {
                setPerPage(parseInt(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[100px] h-8">
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
            >
              <ChevronLeft className="h-4 w-4" />
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
                    className={`w-8 h-8 text-sm rounded ${
                      currentPage === page
                        ? "bg-cyan-600 text-white"
                        : "hover:bg-gray-100 text-gray-700"
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
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
