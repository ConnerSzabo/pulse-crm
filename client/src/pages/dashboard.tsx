import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Company, PipelineStage } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ArrowUpDown, Building2, ExternalLink, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type CompanyWithStage = Company & { stage?: PipelineStage };

type SortField = "name" | "location" | "lastContactDate" | "academyTrustName";
type SortDirection = "asc" | "desc";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [trustFilter, setTrustFilter] = useState<string>("all");
  const [hasITManagerFilter, setHasITManagerFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const { data: companies, isLoading: loadingCompanies } = useQuery<CompanyWithStage[]>({
    queryKey: ["/api/companies"],
  });

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const uniqueLocations = useMemo(() => {
    if (!companies) return [];
    const locations = companies
      .map((c) => c.location)
      .filter((l): l is string => !!l);
    return Array.from(new Set(locations)).sort();
  }, [companies]);

  const uniqueTrusts = useMemo(() => {
    if (!companies) return [];
    const trusts = companies
      .map((c) => c.academyTrustName)
      .filter((t): t is string => !!t);
    return Array.from(new Set(trusts)).sort();
  }, [companies]);

  const filteredAndSortedCompanies = useMemo(() => {
    if (!companies) return [];

    let filtered = companies.filter((company) => {
      const matchesSearch =
        company.name.toLowerCase().includes(search.toLowerCase()) ||
        company.location?.toLowerCase().includes(search.toLowerCase()) ||
        company.academyTrustName?.toLowerCase().includes(search.toLowerCase()) ||
        company.itManagerName?.toLowerCase().includes(search.toLowerCase());

      const matchesLocation = locationFilter === "all" || company.location === locationFilter;
      const matchesStage = stageFilter === "all" || company.stageId === stageFilter;
      const matchesTrust = trustFilter === "all" || company.academyTrustName === trustFilter;
      const matchesITManager =
        hasITManagerFilter === "all" ||
        (hasITManagerFilter === "yes" && company.itManagerName) ||
        (hasITManagerFilter === "no" && !company.itManagerName);

      return matchesSearch && matchesLocation && matchesStage && matchesTrust && matchesITManager;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "location":
          comparison = (a.location || "").localeCompare(b.location || "");
          break;
        case "academyTrustName":
          comparison = (a.academyTrustName || "").localeCompare(b.academyTrustName || "");
          break;
        case "lastContactDate":
          const dateA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
          const dateB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [companies, search, locationFilter, stageFilter, trustFilter, hasITManagerFilter, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  if (loadingCompanies) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of all {companies?.length || 0} schools in your CRM
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search schools, locations, trusts, IT managers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-dashboard-search"
          />
        </div>

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-location">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {uniqueLocations.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {loc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-stage">
            <SelectValue placeholder="Pipeline Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
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

        <Select value={trustFilter} onValueChange={setTrustFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-trust">
            <SelectValue placeholder="Academy Trust" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trusts</SelectItem>
            {uniqueTrusts.map((trust) => (
              <SelectItem key={trust} value={trust}>
                {trust}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={hasITManagerFilter} onValueChange={setHasITManagerFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-it-manager">
            <SelectValue placeholder="IT Manager" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Has IT Manager</SelectItem>
            <SelectItem value="no">No IT Manager</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSortedCompanies.length} of {companies?.length || 0} schools
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort("name")}
              >
                <div className="flex items-center gap-1">
                  School Name
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort("location")}
              >
                <div className="flex items-center gap-1">
                  Location
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort("academyTrustName")}
              >
                <div className="flex items-center gap-1">
                  Academy Trust
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>IT Manager</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort("lastContactDate")}
              >
                <div className="flex items-center gap-1">
                  Last Contact
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead>Next Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedCompanies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Building2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No schools match your filters</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedCompanies.map((company) => (
                <TableRow
                  key={company.id}
                  className="cursor-pointer hover:bg-muted/30"
                  data-testid={`row-company-${company.id}`}
                >
                  <TableCell>
                    <Link href={`/company/${company.id}`}>
                      <div className="flex items-center gap-2 font-medium text-primary hover:underline">
                        {company.name}
                        <ExternalLink className="h-3 w-3" />
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.location || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.academyTrustName || "—"}
                  </TableCell>
                  <TableCell>
                    {company.stage ? (
                      <Badge
                        variant="secondary"
                        style={{ 
                          backgroundColor: company.stage.color + "20", 
                          color: company.stage.color,
                          borderColor: company.stage.color + "40"
                        }}
                      >
                        {company.stage.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {company.itManagerName ? (
                      <div className="flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-green-500" />
                        <span className="text-sm">{company.itManagerName}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <X className="h-3 w-3" />
                        <span className="text-sm">No</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {company.lastContactDate
                      ? formatDistanceToNow(new Date(company.lastContactDate), { addSuffix: true })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">
                    {company.nextAction || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
