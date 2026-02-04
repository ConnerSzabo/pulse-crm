import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Company, PipelineStage } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, MapPin, Clock, ArrowRight, GripVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState, DragEvent } from "react";

type CompanyWithStage = Company & { stage?: PipelineStage };

export default function Pipeline() {
  const [draggedCompanyId, setDraggedCompanyId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

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

  // Only show companies that have been explicitly added to the pipeline (have a stageId)
  const getCompaniesByStage = (stageId: string) => {
    return companies?.filter((c) => c.stageId === stageId) || [];
  };

  const handleDragStart = (e: DragEvent, companyId: string) => {
    setDraggedCompanyId(companyId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", companyId);
  };

  const handleDragEnd = () => {
    setDraggedCompanyId(null);
    setDragOverStageId(null);
  };

  const handleDragOver = (e: DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStageId(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStageId(null);
  };

  const handleDrop = (e: DragEvent, stageId: string) => {
    e.preventDefault();
    const companyId = e.dataTransfer.getData("text/plain");
    if (companyId && companyId !== "") {
      updateStageMutation.mutate({ companyId, stageId });
    }
    setDraggedCompanyId(null);
    setDragOverStageId(null);
  };

  if (loadingCompanies || loadingStages) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-[400px] w-[260px] flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-muted-foreground">Drag deals between stages to update their status</p>
      </div>

      {/* Horizontal scrolling container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 pb-4 min-w-max">
          {/* Stage columns */}
          {stages?.map((stage) => {
            const stageCompanies = getCompaniesByStage(stage.id);
            const isDropTarget = dragOverStageId === stage.id;

            return (
              <div
                key={stage.id}
                className={`w-[280px] flex-shrink-0 rounded-lg transition-all duration-200 ${
                  isDropTarget ? "ring-2 ring-primary ring-offset-2" : ""
                }`}
                data-testid={`pipeline-column-${stage.id}`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
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
                {/* Vertically scrollable column content */}
                <div
                  className={`space-y-2 p-2 bg-muted/20 rounded-b-lg min-h-[200px] max-h-[calc(100vh-220px)] overflow-y-auto transition-colors duration-200 ${
                    isDropTarget ? "bg-primary/5" : ""
                  }`}
                >
                  {stageCompanies.map((company) => (
                    <PipelineCard
                      key={company.id}
                      company={company}
                      isDragging={draggedCompanyId === company.id}
                      onDragStart={(e) => handleDragStart(e, company.id)}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                  {stageCompanies.length === 0 && (
                    <div className={`text-center py-12 text-muted-foreground text-xs border-2 border-dashed rounded-lg ${
                      isDropTarget ? "border-primary bg-primary/5" : "border-transparent"
                    }`}>
                      {isDropTarget ? "Drop here" : "No deals"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PipelineCard({
  company,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  company: CompanyWithStage;
  isDragging: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`transition-all duration-200 ${
        isDragging ? "opacity-50 scale-95" : "opacity-100"
      }`}
    >
      <Link href={`/company/${company.id}`} data-testid={`link-pipeline-company-${company.id}`}>
        <Card
          className="p-3 cursor-grab active:cursor-grabbing hover-elevate group"
          data-testid={`pipeline-card-${company.id}`}
        >
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 flex-shrink-0">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  <h4 className="font-medium text-sm truncate" data-testid={`text-pipeline-company-${company.id}`}>
                    {company.name}
                  </h4>
                </div>
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

            {company.lastQuoteValue && (
              <div className="text-xs font-medium text-green-600">
                Quote: ${parseFloat(company.lastQuoteValue).toLocaleString()}
              </div>
            )}
          </div>
        </Card>
      </Link>
    </div>
  );
}
