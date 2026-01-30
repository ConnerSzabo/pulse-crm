import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Company, PipelineStage } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, MapPin, Clock, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type CompanyWithStage = Company & { stage?: PipelineStage };

export default function Pipeline() {
  const { data: companies, isLoading: loadingCompanies } = useQuery<CompanyWithStage[]>({
    queryKey: ["/api/companies"],
  });

  const { data: stages, isLoading: loadingStages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ companyId, stageId }: { companyId: string; stageId: string | null }) => {
      return apiRequest("PATCH", `/api/companies/${companyId}`, { stageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });

  const getCompaniesByStage = (stageId: string | null) => {
    return companies?.filter((c) =>
      stageId === null ? !c.stageId : c.stageId === stageId
    ) || [];
  };

  if (loadingCompanies || loadingStages) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[400px] w-[260px] flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  const unassignedCompanies = getCompaniesByStage(null);

  return (
    <div className="p-6 space-y-6 h-full">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-muted-foreground">Drag companies through your sales stages</p>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4">
          {/* Stage columns */}
          {stages?.map((stage) => {
            const stageCompanies = getCompaniesByStage(stage.id);
            return (
              <div
                key={stage.id}
                className="w-[260px] flex-shrink-0 rounded-lg"
                data-testid={`pipeline-column-${stage.id}`}
              >
                <div 
                  className="flex items-center justify-between p-3 rounded-t-lg"
                  style={{ backgroundColor: stage.color + "15" }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="font-medium text-sm">{stage.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {stageCompanies.length}
                  </Badge>
                </div>
                <div className="space-y-2 p-2 bg-muted/20 rounded-b-lg min-h-[200px]">
                  {stageCompanies.map((company) => (
                    <PipelineCard
                      key={company.id}
                      company={company}
                      stages={stages}
                      onStageChange={(stageId) =>
                        updateStageMutation.mutate({ companyId: company.id, stageId })
                      }
                    />
                  ))}
                  {stageCompanies.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground text-xs">
                      No schools
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Unassigned column at end */}
          {unassignedCompanies.length > 0 && (
            <div
              className="w-[260px] flex-shrink-0 rounded-lg"
              data-testid="pipeline-column-unassigned"
            >
              <div className="flex items-center justify-between p-3 rounded-t-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-muted-foreground" />
                  <span className="font-medium text-sm">Unassigned</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {unassignedCompanies.length}
                </Badge>
              </div>
              <div className="space-y-2 p-2 bg-muted/20 rounded-b-lg min-h-[200px]">
                {unassignedCompanies.map((company) => (
                  <PipelineCard
                    key={company.id}
                    company={company}
                    stages={stages || []}
                    onStageChange={(stageId) =>
                      updateStageMutation.mutate({ companyId: company.id, stageId })
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

function PipelineCard({
  company,
  stages,
  onStageChange,
}: {
  company: CompanyWithStage;
  stages: PipelineStage[];
  onStageChange: (stageId: string | null) => void;
}) {
  return (
    <Link href={`/company/${company.id}`} data-testid={`link-pipeline-company-${company.id}`}>
      <Card 
        className="p-3 cursor-pointer hover-elevate" 
        data-testid={`pipeline-card-${company.id}`}
      >
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 flex-shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-sm truncate" data-testid={`text-pipeline-company-${company.id}`}>
                {company.name}
              </h4>
              {company.location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {company.location}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-muted-foreground">
            {company.lastContactDate && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span>
                  Last contact: {formatDistanceToNow(new Date(company.lastContactDate), { addSuffix: true })}
                </span>
              </div>
            )}
            {company.nextAction && (
              <div className="flex items-center gap-1.5">
                <ArrowRight className="h-3 w-3" />
                <span className="truncate">{company.nextAction}</span>
              </div>
            )}
          </div>

          <Select
            value={company.stageId || "unassigned"}
            onValueChange={(value) => {
              onStageChange(value === "unassigned" ? null : value);
            }}
          >
            <SelectTrigger 
              className="h-7 text-xs"
              onClick={(e) => e.preventDefault()}
              data-testid={`select-pipeline-stage-${company.id}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  Unassigned
                </div>
              </SelectItem>
              {stages.map((stage) => (
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
        </div>
      </Card>
    </Link>
  );
}
