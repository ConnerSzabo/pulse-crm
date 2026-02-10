import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { TrustWithStats } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Landmark,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type SortField = "name" | "schoolCount" | "totalPipelineValue" | "lastActivityDate";
type SortDirection = "asc" | "desc";

export default function Trusts() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTrustName, setNewTrustName] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 25;

  const { toast } = useToast();

  const { data: trusts, isLoading } = useQuery<TrustWithStats[]>({
    queryKey: ["/api/trusts-with-stats"],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/trusts", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trusts-with-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trusts"] });
      setDialogOpen(false);
      setNewTrustName("");
      toast({ title: "Trust created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create trust", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/trusts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trusts-with-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trusts"] });
      toast({ title: "Trust deleted. Schools have been unlinked." });
    },
  });

  const filteredTrusts = useMemo(() => {
    if (!trusts) return [];
    let filtered = trusts;

    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((t) => t.name.toLowerCase().includes(s));
    }

    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "schoolCount":
          cmp = a.schoolCount - b.schoolCount;
          break;
        case "totalPipelineValue":
          cmp = a.totalPipelineValue - b.totalPipelineValue;
          break;
        case "lastActivityDate":
          cmp = (a.lastActivityDate ? new Date(a.lastActivityDate).getTime() : 0) -
                (b.lastActivityDate ? new Date(b.lastActivityDate).getTime() : 0);
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [trusts, search, sortField, sortDirection]);

  const totalTrusts = filteredTrusts.length;
  const totalPages = Math.ceil(totalTrusts / perPage);
  const paginatedTrusts = filteredTrusts.slice(
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

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[#1a1d29]">
      <div className="bg-white dark:bg-[#252936] border-b border-gray-200 dark:border-[#3d4254]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#3d4254]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Trusts / MATs</h1>
              <Badge variant="secondary" className="text-sm font-medium dark:bg-[#3d4254] dark:text-[#94a3b8]">
                {totalTrusts} records
              </Badge>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0091AE] hover:bg-[#007a94] text-white font-medium shadow-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Trust
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Trust</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newTrustName.trim()) {
                      createMutation.mutate(newTrustName.trim());
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Trust Name *</label>
                    <Input
                      value={newTrustName}
                      onChange={(e) => setNewTrustName(e.target.value)}
                      placeholder="e.g. Academies Enterprise Trust"
                      className="mt-1"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#0091AE] hover:bg-[#007a94] text-white"
                    disabled={createMutation.isPending || !newTrustName.trim()}
                  >
                    {createMutation.isPending ? "Creating..." : "Create Trust"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="px-6 py-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#64748b]" />
            <Input
              type="search"
              placeholder="Search trusts..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 h-10 border-gray-300 dark:border-[#3d4254] dark:bg-[#1a1d29] dark:text-white dark:placeholder:text-[#64748b]"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-2 bg-white dark:bg-[#252936]">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-[#3d4254]">
                <Skeleton className="h-8 w-8 rounded-md dark:bg-[#3d4254]" />
                <Skeleton className="h-5 w-[200px] dark:bg-[#3d4254]" />
                <Skeleton className="h-5 w-[80px] dark:bg-[#3d4254]" />
                <Skeleton className="h-5 w-[120px] dark:bg-[#3d4254]" />
                <Skeleton className="h-5 w-[100px] dark:bg-[#3d4254]" />
              </div>
            ))}
          </div>
        ) : paginatedTrusts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#252936]">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-[#3d4254] flex items-center justify-center mb-6">
              <Landmark className="h-10 w-10 text-gray-400 dark:text-[#64748b]" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              {search ? "No trusts match your search" : "No trusts yet"}
            </h3>
            <p className="text-gray-500 dark:text-[#94a3b8] mb-6 text-center max-w-md">
              {search
                ? "Try a different search term"
                : "Create your first trust to group schools together"}
            </p>
            {!search && (
              <Button
                onClick={() => setDialogOpen(true)}
                className="bg-[#0091AE] hover:bg-[#007a94] text-white shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add your first trust
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#252936] border-x border-gray-200 dark:border-[#3d4254]">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#2d3142] sticky top-0 z-10 border-b border-gray-200 dark:border-[#3d4254]">
                <tr>
                  <th className="text-left px-6 py-3 w-[300px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="name">Trust Name</SortableHeader>
                  </th>
                  <th className="text-left px-6 py-3 w-[140px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="schoolCount">Schools</SortableHeader>
                  </th>
                  <th className="text-left px-6 py-3 w-[200px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="totalPipelineValue">Pipeline Value</SortableHeader>
                  </th>
                  <th className="text-left px-6 py-3 w-[180px] border-r border-gray-100 dark:border-[#3d4254]">
                    <SortableHeader field="lastActivityDate">Last Activity</SortableHeader>
                  </th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#3d4254]">
                {paginatedTrusts.map((trust, index) => (
                  <tr
                    key={trust.id}
                    className={`group transition-colors ${
                      index % 2 === 0
                        ? "bg-white dark:bg-[#252936]"
                        : "bg-gray-50/70 dark:bg-[#1a1d29]"
                    } hover:bg-blue-50/50 dark:hover:bg-[#2d3142]`}
                  >
                    <td className="px-6 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <Link
                        href={`/trusts/${trust.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-purple-500/20 to-purple-600/20 dark:from-purple-500/30 dark:to-purple-600/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <Landmark className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="font-semibold text-[#0091AE] hover:text-[#06b6d4] hover:underline truncate">
                          {trust.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <Badge variant="secondary" className="dark:bg-[#3d4254] dark:text-[#94a3b8]">
                        {trust.schoolCount} {trust.schoolCount === 1 ? "school" : "schools"}
                      </Badge>
                    </td>
                    <td className="px-6 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <span className="text-sm font-medium text-gray-700 dark:text-white">
                        {trust.totalPipelineValue > 0
                          ? `£${trust.totalPipelineValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                          : "--"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 border-r border-gray-100 dark:border-[#3d4254]">
                      <span className="text-sm text-gray-600 dark:text-[#94a3b8]">
                        {trust.lastActivityDate
                          ? format(new Date(trust.lastActivityDate), "MMM d, yyyy")
                          : "--"}
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
                            <Link href={`/trusts/${trust.id}`} className="flex items-center gap-2">
                              <ExternalLink className="h-4 w-4" />
                              View details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => {
                              if (confirm(`Delete "${trust.name}"? ${trust.schoolCount} schools will be unlinked.`)) {
                                deleteMutation.mutate(trust.id);
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

      {totalTrusts > perPage && (
        <div className="bg-white dark:bg-[#252936] border-t border-gray-200 dark:border-[#3d4254] px-6 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-[#64748b]">
            {(currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, totalTrusts)} of {totalTrusts}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-9 px-3 border-gray-300 dark:border-[#3d4254] dark:bg-[#252936] dark:text-white dark:hover:bg-[#2d3142]"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-9 px-3 border-gray-300 dark:border-[#3d4254] dark:bg-[#252936] dark:text-white dark:hover:bg-[#2d3142]"
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
