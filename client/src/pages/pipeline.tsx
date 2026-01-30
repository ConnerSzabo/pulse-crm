import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Company, PipelineStage } from "@shared/schema";
import { Button } from "@/components/ui/button";
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
import { Building2, Phone, GripVertical } from "lucide-react";

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
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[400px] w-[280px] flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  const unassignedCompanies = getCompaniesByStage(null);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-muted-foreground">Manage your sales pipeline stages</p>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {/* Unassigned column */}
          <div
            className="w-[280px] flex-shrink-0 bg-muted/30 rounded-lg p-3"
            data-testid="pipeline-column-unassigned"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                <span className="font-medium text-sm">Unassigned</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {unassignedCompanies.length}
              </Badge>
            </div>
            <div className="space-y-2">
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
              {unassignedCompanies.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No unassigned companies
                </div>
              )}
            </div>
          </div>

          {/* Stage columns */}
          {stages?.map((stage) => {
            const stageCompanies = getCompaniesByStage(stage.id);
            return (
              <div
                key={stage.id}
                className="w-[280px] flex-shrink-0 bg-muted/30 rounded-lg p-3"
                data-testid={`pipeline-column-${stage.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="font-medium text-sm">{stage.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {stageCompanies.length}
                  </Badge>
                </div>
                <div className="space-y-2">
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
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No companies
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
    <Card className="p-3" data-testid={`pipeline-card-${company.id}`}>
      <Link href={`/company/${company.id}`} data-testid={`link-pipeline-company-${company.id}`}>
        <div className="flex items-start gap-2 cursor-pointer hover-elevate rounded-md p-1 -m-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 flex-shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-sm truncate" data-testid={`text-pipeline-company-${company.id}`}>
              {company.name}
            </h4>
            {company.phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {company.phone}
              </p>
            )}
          </div>
        </div>
      </Link>
      <div className="mt-2">
        <Select
          value={company.stageId || "unassigned"}
          onValueChange={(value) => onStageChange(value === "unassigned" ? null : value)}
        >
          <SelectTrigger className="h-8 text-xs" data-testid={`select-pipeline-stage-${company.id}`}>
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
  );
}
