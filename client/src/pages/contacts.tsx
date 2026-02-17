import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import type { Company, ContactWithCompany } from "@shared/schema";
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
  Users,
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
  Building2,
  Mail,
  Phone,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ExportContactsModal } from "@/components/export-contacts-modal";

const addContactSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  role: z.string().optional(),
  companyId: z.string().optional(),
  leadStatus: z.string().default("0-unqualified"),
});

type AddContactForm = z.infer<typeof addContactSchema>;

type SortField = "name" | "email" | "phone" | "companyName" | "role" | "leadStatus" | "lastContactDate" | "createdAt";
type SortDirection = "asc" | "desc";

const leadStatusOptions = [
  { value: "0-unqualified", label: "0 - Unqualified", color: "bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-600 dark:text-white dark:border-gray-500", dotColor: "bg-gray-500 dark:bg-gray-300" },
  { value: "1-qualified", label: "1 - Qualified", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-[#0091AE] dark:text-white dark:border-[#0091AE]", dotColor: "bg-blue-500 dark:bg-white" },
  { value: "2-intent", label: "2 - Intent", color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-[#f59e0b] dark:text-white dark:border-[#f59e0b]", dotColor: "bg-orange-500 dark:bg-white" },
  { value: "3-quote-presented", label: "3 - Quote Presented", color: "bg-green-100 text-green-800 border-green-200 dark:bg-[#10b981] dark:text-white dark:border-[#10b981]", dotColor: "bg-green-500 dark:bg-white" },
  { value: "3b-quoted-lost", label: "3b - Quoted Lost", color: "bg-red-100 text-red-800 border-red-200 dark:bg-[#ef4444] dark:text-white dark:border-[#ef4444]", dotColor: "bg-red-500 dark:bg-white" },
  { value: "4-account-active", label: "4 - Account Active", color: "bg-emerald-200 text-emerald-900 border-emerald-300 dark:bg-emerald-700 dark:text-white dark:border-emerald-600", dotColor: "bg-emerald-600 dark:bg-white" },
];

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Contacts() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const { toast } = useToast();

  const { data: contacts, isLoading } = useQuery<ContactWithCompany[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const form = useForm<AddContactForm>({
    resolver: zodResolver(addContactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role: "",
      companyId: "",
      leadStatus: "0-unqualified",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AddContactForm) => {
      const res = await apiRequest("POST", "/api/contacts", {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        role: data.role || null,
        companyId: data.companyId || null,
        leadStatus: data.leadStatus || "0-unqualified",
      });
      return res.json();
    },
    onSuccess: (newContact) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Contact created successfully" });
      navigate(`/contact/${newContact.id}`);
    },
    onError: () => {
      toast({ title: "Failed to create contact", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Contact deleted" });
    },
  });

  const getLeadStatusBadge = (status: string | null | undefined) => {
    const effectiveStatus = status || "0-unqualified";
    const option = leadStatusOptions.find((opt) => opt.value === effectiveStatus);
    if (option) {
      return (
        <Badge className={`${option.color} border text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-sm`}>
          <span className={`inline-block w-2 h-2 rounded-full ${option.dotColor} mr-1.5`} />
          {option.label}
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs">{status}</Badge>;
  };

  const filteredContacts = useMemo(() => {
    if (!contacts) return [];

    let filtered = contacts;

    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name?.toLowerCase().includes(s) ||
          c.email?.toLowerCase().includes(s) ||
          c.phone?.includes(search) ||
          c.companyName?.toLowerCase().includes(s) ||
          c.role?.toLowerCase().includes(s)
      );
    }

    if (leadStatusFilter !== "all") {
      filtered = filtered.filter((c) => (c.leadStatus || "0-unqualified") === leadStatusFilter);
    }

    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((c) => {
        const created = new Date(c.createdAt);
        switch (dateFilter) {
          case "today": return created >= today;
          case "week": return created >= weekAgo;
          case "month": return created >= monthAgo;
          default: return true;
        }
      });
    }

    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "email":
          comparison = a.email.localeCompare(b.email);
          break;
        case "phone":
          comparison = (a.phone || "").localeCompare(b.phone || "");
          break;
        case "companyName":
          comparison = (a.companyName || "").localeCompare(b.companyName || "");
          break;
        case "role":
          comparison = (a.role || "").localeCompare(b.role || "");
          break;
        case "leadStatus":
          comparison = (a.leadStatus || "0-unqualified").localeCompare(b.leadStatus || "0-unqualified");
          break;
        case "lastContactDate": {
          const aD = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
          const bD = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
          comparison = aD - bD;
          break;
        }
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [contacts, search, leadStatusFilter, dateFilter, sortField, sortDirection]);

  const totalContacts = filteredContacts.length;
  const totalPages = Math.ceil(totalContacts / perPage);
  const paginatedContacts = filteredContacts.slice(
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
    if (selectedIds.size === paginatedContacts.length && paginatedContacts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedContacts.map((c) => c.id)));
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

  const onSubmit = (data: AddContactForm) => {
    createMutation.mutate(data);
  };

  const clearFilters = () => {
    setLeadStatusFilter("all");
    setDateFilter("all");
    setSearch("");
  };

  const hasActiveFilters = leadStatusFilter !== "all" || dateFilter !== "all" || search !== "";

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
        sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </button>
  );

  const formatDate = (date: string | Date | null) => {
    if (!date) return "--";
    return format(new Date(date), "MMM d, yyyy");
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[#1a1d29]">
      {/* Top Bar */}
      <div className="bg-white dark:bg-[#252936] border-b border-gray-200 dark:border-[#3d4254]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#3d4254]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Contacts</h1>
              <Badge variant="secondary" className="text-sm font-medium dark:bg-[#3d4254] dark:text-[#94a3b8]">
                {totalContacts} contacts
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setExportOpen(true)}
                className="font-medium border-gray-300 dark:border-[#3d4254] dark:bg-[#252936] dark:text-[#94a3b8] dark:hover:bg-[#2d3142] dark:hover:text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Contacts
              </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0091AE] hover:bg-[#007a94] text-white font-medium shadow-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto dark:bg-[#252936] dark:border-[#3d4254]">
                <DialogHeader>
                  <DialogTitle className="dark:text-white">Add New Contact</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-[#94a3b8]">Contact Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Full name" className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-[#94a3b8]">Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="email@example.com" className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="dark:text-[#94a3b8]">Phone</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="Phone number" className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="dark:text-[#94a3b8]">Job Title</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. IT Manager" className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="companyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-[#94a3b8]">Company</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                                <SelectValue placeholder="Select a company (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-60 dark:bg-[#252936] dark:border-[#3d4254]">
                              <SelectItem value="none" className="dark:text-[#94a3b8] dark:focus:bg-[#2d3142]">No company</SelectItem>
                              {companies?.map((company) => (
                                <SelectItem key={company.id} value={company.id} className="dark:text-white dark:focus:bg-[#2d3142]">
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
                      control={form.control}
                      name="leadStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-[#94a3b8]">Lead Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "0-unqualified"}>
                            <FormControl>
                              <SelectTrigger className="dark:bg-[#1a1d29] dark:border-[#3d4254] dark:text-white">
                                <SelectValue placeholder="Select lead status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                              {leadStatusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value} className="dark:text-white dark:focus:bg-[#2d3142]">
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-3 pt-2">
                      <Button
                        type="submit"
                        className="flex-1 bg-[#0091AE] hover:bg-[#007a94] text-white"
                        disabled={createMutation.isPending}
                      >
                        {createMutation.isPending ? "Saving..." : "Save Contact"}
                      </Button>
                      <Button type="button" variant="outline" className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="px-6 py-3 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#64748b]" />
            <Input
              type="search"
              placeholder="Search contacts by name, email, phone, company, or job title..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pl-10 h-10 w-full border-gray-300 dark:border-[#3d4254] dark:bg-[#1a1d29] dark:text-white dark:placeholder:text-[#64748b] focus:border-[#0091AE] focus:ring-[#0091AE]"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-2 border-gray-300 dark:border-[#3d4254] dark:bg-[#252936] dark:text-[#94a3b8] dark:hover:bg-[#2d3142] dark:hover:text-white hover:border-gray-400">
                  <Filter className="h-4 w-4" />
                  Lead Status
                  {leadStatusFilter !== "all" && <Badge className="ml-1 h-5 px-1.5 bg-[#0091AE] text-white text-[10px]">1</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filter by Lead Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setLeadStatusFilter("all"); setCurrentPage(1); }}>
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-gray-300" />All statuses</span>
                </DropdownMenuItem>
                {leadStatusOptions.map((option) => (
                  <DropdownMenuItem key={option.value} onClick={() => { setLeadStatusFilter(option.value); setCurrentPage(1); }}>
                    <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${option.dotColor}`} />{option.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-2 border-gray-300 dark:border-[#3d4254] dark:bg-[#252936] dark:text-[#94a3b8] dark:hover:bg-[#2d3142] dark:hover:text-white hover:border-gray-400">
                  <Calendar className="h-4 w-4" />
                  Create Date
                  {dateFilter !== "all" && <Badge className="ml-1 h-5 px-1.5 bg-[#0091AE] text-white text-[10px]">1</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by Create Date</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setDateFilter("all"); setCurrentPage(1); }}>All time</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDateFilter("today"); setCurrentPage(1); }}>Today</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDateFilter("week"); setCurrentPage(1); }}>Last 7 days</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDateFilter("month"); setCurrentPage(1); }}>Last 30 days</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 text-[#0091AE] hover:text-[#06b6d4] hover:bg-[#0091AE]/10 dark:hover:bg-[#0091AE]/20">
                <X className="h-4 w-4 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-2 bg-white dark:bg-[#252936]">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-[#3d4254]">
                <Skeleton className="h-5 w-5 rounded dark:bg-[#3d4254]" />
                <Skeleton className="h-8 w-8 rounded-full dark:bg-[#3d4254]" />
                <Skeleton className="h-5 w-[150px] dark:bg-[#3d4254]" />
                <Skeleton className="h-4 w-[180px] dark:bg-[#3d4254]" />
                <Skeleton className="h-4 w-[100px] dark:bg-[#3d4254]" />
                <Skeleton className="h-4 w-[120px] dark:bg-[#3d4254]" />
                <Skeleton className="h-6 w-[120px] rounded-full dark:bg-[#3d4254]" />
              </div>
            ))}
          </div>
        ) : paginatedContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#252936]">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-[#3d4254] flex items-center justify-center mb-6">
              <Users className="h-10 w-10 text-gray-400 dark:text-[#64748b]" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              {hasActiveFilters ? "No contacts match your filters" : "No contacts yet"}
            </h3>
            <p className="text-gray-500 dark:text-[#94a3b8] mb-6 text-center max-w-md">
              {hasActiveFilters
                ? "Try adjusting or clearing your filters to see more results"
                : "Get started by adding your first contact to the CRM"}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters} className="border-gray-300 dark:border-[#3d4254] dark:bg-[#252936] dark:text-white dark:hover:bg-[#2d3142]">
                Clear all filters
              </Button>
            ) : (
              <Button onClick={() => setDialogOpen(true)} className="bg-[#0091AE] hover:bg-[#007a94] text-white shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Add your first contact
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#252936] border-x border-gray-200 dark:border-[#3d4254]">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 dark:bg-[#2d3142] sticky top-0 z-10 border-b border-gray-200 dark:border-[#3d4254]">
                <tr>
                  <th className="w-12 px-4 py-3 border-r border-gray-100 dark:border-[#3d4254]">
                    <Checkbox
                      checked={selectedIds.size === paginatedContacts.length && paginatedContacts.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="text-left px-4 py-3 w-[200px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="name">Contact Name</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[220px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="email">Email</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[130px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="phone">Phone</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[180px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="companyName">Company</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[130px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="role">Job Title</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[170px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="leadStatus">Lead Status</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[130px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="lastContactDate">Last Activity</SortableHeader>
                  </th>
                  <th className="text-left px-4 py-3 w-[120px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="createdAt">Create Date</SortableHeader>
                  </th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#3d4254]">
                {paginatedContacts.map((contact, index) => (
                  <tr
                    key={contact.id}
                    className={`group transition-colors cursor-pointer ${
                      index % 2 === 0
                        ? "bg-white dark:bg-[#252936]"
                        : "bg-gray-50/70 dark:bg-[#1a1d29]"
                    } hover:bg-blue-50/50 dark:hover:bg-[#2d3142]`}
                  >
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onCheckedChange={() => handleSelectOne(contact.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <Link href={`/contact/${contact.id}`} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0091AE]/80 to-[#06b6d4]/80 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-[10px] font-bold text-white">{getInitials(contact.name)}</span>
                        </div>
                        <span className="font-semibold text-[#0091AE] hover:text-[#06b6d4] hover:underline truncate">
                          {contact.name || "Unnamed"}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-sm text-[#0091AE] hover:text-[#06b6d4] hover:underline font-medium truncate block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contact.email}
                      </a>
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-sm text-[#0091AE] hover:text-[#06b6d4] hover:underline font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {contact.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-[#64748b]">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      {contact.companyId && contact.companyName ? (
                        <Link
                          href={`/company/${contact.companyId}`}
                          className="text-sm text-[#0091AE] hover:text-[#06b6d4] hover:underline font-medium truncate block"
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                          {contact.companyName}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-[#64748b]">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <span className="text-sm text-gray-600 dark:text-[#94a3b8] truncate block">
                        {contact.role || "--"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      {getLeadStatusBadge(contact.leadStatus)}
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <span className="text-sm text-gray-600 dark:text-[#94a3b8]">
                        {formatDate(contact.lastContactDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <span className="text-sm text-gray-600 dark:text-[#94a3b8]">
                        {formatDate(contact.createdAt)}
                      </span>
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
                            <Link href={`/contact/${contact.id}`} className="flex items-center gap-2">
                              <ExternalLink className="h-4 w-4" />
                              View details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => {
                              if (confirm("Delete this contact?")) {
                                deleteMutation.mutate(contact.id);
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
      {totalContacts > 0 && (
        <div className="bg-white dark:bg-[#252936] border-t border-gray-200 dark:border-[#3d4254] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#94a3b8]">
            <Select value={perPage.toString()} onValueChange={(v) => { setPerPage(parseInt(v)); setCurrentPage(1); }}>
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
              {(currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, totalContacts)} of {totalContacts}
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

      <ExportContactsModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        contacts={filteredContacts}
        companies={companies || []}
      />
    </div>
  );
}
