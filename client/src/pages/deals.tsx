import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Tso } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, CalendarDays, Kanban } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

/* ─── Stage definitions ───────────────────────────────────── */
type Stage = {
  key: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  activeBorder: string;
};

const OUTREACH_STAGES: Stage[] = [
  {
    key: "Not Contacted",
    label: "Not Contacted",
    color: "#94a3b8",
    bg: "rgba(100,116,139,0.07)",
    border: "rgba(100,116,139,0.18)",
    activeBorder: "rgba(100,116,139,0.6)",
  },
  {
    key: "Attempt 1: Initial Comms Sent",
    label: "Attempt 1",
    color: "#60a5fa",
    bg: "rgba(59,130,246,0.07)",
    border: "rgba(59,130,246,0.18)",
    activeBorder: "rgba(59,130,246,0.6)",
  },
  {
    key: "Attempt 2: Follow-up Sent",
    label: "Attempt 2",
    color: "#60a5fa",
    bg: "rgba(59,130,246,0.07)",
    border: "rgba(59,130,246,0.18)",
    activeBorder: "rgba(59,130,246,0.6)",
  },
  {
    key: "Attempt 3: Final Follow-up",
    label: "Attempt 3",
    color: "#60a5fa",
    bg: "rgba(59,130,246,0.07)",
    border: "rgba(59,130,246,0.18)",
    activeBorder: "rgba(59,130,246,0.6)",
  },
  {
    key: "Initial Response",
    label: "Initial Response",
    color: "#fbbf24",
    bg: "rgba(245,158,11,0.07)",
    border: "rgba(245,158,11,0.18)",
    activeBorder: "rgba(245,158,11,0.6)",
  },
  {
    key: "Info Requested",
    label: "Info Requested",
    color: "#f472b6",
    bg: "rgba(236,72,153,0.07)",
    border: "rgba(236,72,153,0.18)",
    activeBorder: "rgba(236,72,153,0.6)",
  },
];

const PIPELINE_STAGES: Stage[] = [
  {
    key: "Info Requested",
    label: "Info Requested",
    color: "#f472b6",
    bg: "rgba(236,72,153,0.07)",
    border: "rgba(236,72,153,0.18)",
    activeBorder: "rgba(236,72,153,0.6)",
  },
  {
    key: "Details Received",
    label: "Details Received",
    color: "#a78bfa",
    bg: "rgba(139,92,246,0.07)",
    border: "rgba(139,92,246,0.18)",
    activeBorder: "rgba(139,92,246,0.6)",
  },
  {
    key: "Proposal Sent",
    label: "Proposal Sent",
    color: "#fb923c",
    bg: "rgba(251,146,60,0.07)",
    border: "rgba(251,146,60,0.18)",
    activeBorder: "rgba(251,146,60,0.6)",
  },
  {
    key: "Negotiating",
    label: "Negotiating",
    color: "#fbbf24",
    bg: "rgba(245,158,11,0.07)",
    border: "rgba(245,158,11,0.18)",
    activeBorder: "rgba(245,158,11,0.6)",
  },
  {
    key: "Needs Promo Codes",
    label: "Needs Promo Codes",
    color: "#94a3b8",
    bg: "rgba(100,116,139,0.07)",
    border: "rgba(100,116,139,0.18)",
    activeBorder: "rgba(100,116,139,0.6)",
  },
  {
    key: "Confirmed",
    label: "Confirmed",
    color: "#34d399",
    bg: "rgba(16,185,129,0.07)",
    border: "rgba(16,185,129,0.18)",
    activeBorder: "rgba(16,185,129,0.6)",
  },
  {
    key: "Not Interested",
    label: "Not Interested",
    color: "#f87171",
    bg: "rgba(239,68,68,0.07)",
    border: "rgba(239,68,68,0.18)",
    activeBorder: "rgba(239,68,68,0.6)",
  },
  {
    key: "Ghosted / Disqualified",
    label: "Ghosted / Disqualified",
    color: "#64748b",
    bg: "rgba(100,116,139,0.07)",
    border: "rgba(100,116,139,0.18)",
    activeBorder: "rgba(100,116,139,0.6)",
  },
];

const PRIORITY_CHIP: Record<string, { bg: string; text: string }> = {
  P1:  { bg: "rgba(239,68,68,0.18)",   text: "#fca5a5" },
  P2:  { bg: "rgba(245,158,11,0.18)",  text: "#fcd34d" },
  P3:  { bg: "rgba(99,102,241,0.18)",  text: "#a5b4fc" },
  DIR: { bg: "rgba(16,185,129,0.18)",  text: "#6ee7b7" },
};

/* ─── TsoCard ─────────────────────────────────────────────── */
function TsoCard({
  tso,
  stageColor,
  onDragStart,
}: {
  tso: Tso;
  stageColor: string;
  onDragStart: (id: string) => void;
}) {
  const chip = PRIORITY_CHIP[tso.priority ?? ""];

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(tso.id);
      }}
      className="rounded-xl border cursor-grab active:cursor-grabbing select-none transition-all duration-150 hover:translate-y-[-1px] hover:shadow-lg"
      style={{ background: "#1a1f2e", borderColor: "#2d3548", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
    >
      <div className="h-0.5 rounded-t-xl" style={{ background: stageColor }} />
      <div className="px-3 pt-2.5 pb-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/tso/${tso.id}`}>
            <span
              className="text-sm font-semibold leading-snug transition-colors"
              style={{ color: "#e2e8f0" }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#a5b4fc")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#e2e8f0")}
            >
              {tso.name}
            </span>
          </Link>
          {chip && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
              style={{ background: chip.bg, color: chip.text }}>
              {tso.priority}
            </span>
          )}
        </div>
        <div className="space-y-1">
          {tso.city && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 shrink-0" style={{ color: "#475569" }} />
              <span className="text-[11px]" style={{ color: "#64748b" }}>{tso.city}</span>
            </div>
          )}
          {tso.nextShowDate && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3 shrink-0" style={{ color: "#475569" }} />
              <span className="text-[11px]" style={{ color: "#64748b" }}>
                {format(new Date(tso.nextShowDate), "d MMM yyyy")}
              </span>
            </div>
          )}
        </div>
        {tso.nextStep && (
          <p className="text-[11px] truncate rounded-md px-2 py-1"
            style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
            {tso.nextStep}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── KanbanColumn ─────────────────────────────────────────── */
function KanbanColumn({
  stage,
  cards,
  isOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
}: {
  stage: Stage;
  cards: Tso[];
  isOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (stageKey: string) => void;
  onDragStart: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-col rounded-2xl h-full transition-all duration-150"
      style={{
        width: 224,
        minWidth: 224,
        background: isOver ? stage.bg : "rgba(15,20,25,0.6)",
        border: `1.5px solid ${isOver ? stage.activeBorder : stage.border}`,
        boxShadow: isOver ? `0 0 0 3px ${stage.activeBorder}` : "none",
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={() => onDrop(stage.key)}
    >
      <div className="px-3 py-2.5 flex items-center justify-between rounded-t-2xl border-b"
        style={{ borderColor: stage.border }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: stage.color }} />
          <span className="text-xs font-semibold" style={{ color: stage.color }}>{stage.label}</span>
        </div>
        <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
          style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}>
          {cards.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
        {cards.map(tso => (
          <TsoCard key={tso.id} tso={tso} stageColor={stage.color} onDragStart={onDragStart} />
        ))}
        {isOver && cards.length === 0 && (
          <div className="rounded-xl border-2 border-dashed h-16 flex items-center justify-center"
            style={{ borderColor: stage.activeBorder }}>
            <span className="text-xs" style={{ color: stage.color }}>Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Board ───────────────────────────────────────────────── */
function Board({
  stages,
  tsos,
  draggedId,
  overColumn,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  stages: Stage[];
  tsos: Tso[];
  draggedId: string | null;
  overColumn: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, key: string) => void;
  onDragLeave: (key: string) => void;
  onDrop: (key: string) => void;
}) {
  const byStage = (key: string) =>
    tsos.filter(t => (t.relationshipStatus ?? "Not Contacted") === key);

  return (
    <div className="flex gap-3 px-6 pb-6 overflow-x-auto flex-1" style={{ alignItems: "flex-start" }}>
      {stages.map(stage => (
        <KanbanColumn
          key={stage.key}
          stage={stage}
          cards={byStage(stage.key)}
          isOver={overColumn === stage.key}
          onDragOver={e => onDragOver(e, stage.key)}
          onDragLeave={() => onDragLeave(stage.key)}
          onDrop={onDrop}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  );
}

/* ─── DealsPage ────────────────────────────────────────────── */
type View = "outreach" | "pipeline";

export default function DealsPage() {
  const { toast } = useToast();
  const [view, setView] = useState<View>("outreach");
  const [localTsos, setLocalTsos] = useState<Tso[] | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  const { data: fetchedTsos, isLoading } = useQuery<Tso[]>({ queryKey: ["/api/tsos"] });

  const tsos = localTsos ?? fetchedTsos ?? [];

  if (fetchedTsos && !draggedId && localTsos === null) {
    setLocalTsos(fetchedTsos);
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, relationshipStatus }: { id: string; relationshipStatus: string }) =>
      apiRequest("PATCH", `/api/tsos/${id}`, { relationshipStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tsos"] }),
    onError: () => {
      if (prevStatusRef.current !== null && draggedId) {
        setLocalTsos(prev =>
          (prev ?? []).map(t =>
            t.id === draggedId ? { ...t, relationshipStatus: prevStatusRef.current! } : t,
          ),
        );
      }
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const handleDragStart = (id: string) => {
    setDraggedId(id);
    const tso = tsos.find(t => t.id === id);
    prevStatusRef.current = tso?.relationshipStatus ?? null;
  };

  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverColumn(stageKey);
  };

  const handleDragLeave = (stageKey: string) => {
    setOverColumn(prev => (prev === stageKey ? null : prev));
  };

  const handleDrop = (stageKey: string) => {
    if (!draggedId) return;
    const tso = tsos.find(t => t.id === draggedId);
    if (!tso || tso.relationshipStatus === stageKey) {
      setDraggedId(null);
      setOverColumn(null);
      return;
    }
    setLocalTsos(prev =>
      (prev ?? []).map(t =>
        t.id === draggedId ? { ...t, relationshipStatus: stageKey } : t,
      ),
    );
    updateMutation.mutate({ id: draggedId, relationshipStatus: stageKey });
    setDraggedId(null);
    setOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setOverColumn(null);
  };

  const activeStages = view === "outreach" ? OUTREACH_STAGES : PIPELINE_STAGES;
  const activeKeys = new Set(activeStages.map(s => s.key));
  const visibleTsos = tsos.filter(t => activeKeys.has(t.relationshipStatus ?? "Not Contacted"));

  const outreachCount = tsos.filter(t => OUTREACH_STAGES.some(s => s.key === (t.relationshipStatus ?? "Not Contacted"))).length;
  const pipelineCount = tsos.filter(t => PIPELINE_STAGES.some(s => s.key === t.relationshipStatus)).length;

  return (
    <div className="flex flex-col h-full" onDragEnd={handleDragEnd}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Kanban className="h-5 w-5" style={{ color: "#6366f1" }} />
              <h1 className="text-2xl font-bold" style={{ color: "#f1f5f9" }}>Deals</h1>
            </div>
            <p className="text-sm" style={{ color: "#64748b" }}>
              {tsos.length} TSO{tsos.length !== 1 ? "s" : ""} · drag cards to update relationship status
            </p>
          </div>

          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "#2d3548" }}>
            <button
              onClick={() => setView("outreach")}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={view === "outreach"
                ? { background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }
                : { background: "transparent", color: "#64748b" }}
            >
              Outreach
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded-md"
                style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}>
                {outreachCount}
              </span>
            </button>
            <div className="w-px" style={{ background: "#2d3548" }} />
            <button
              onClick={() => setView("pipeline")}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={view === "pipeline"
                ? { background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }
                : { background: "transparent", color: "#64748b" }}
            >
              Pipeline
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded-md"
                style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}>
                {pipelineCount}
              </span>
            </button>
          </div>
        </div>

        {/* Stage sub-labels for outreach */}
        {view === "outreach" && (
          <div className="flex gap-4 mt-3">
            <span className="text-[11px] px-2 py-0.5 rounded-md"
              style={{ background: "rgba(100,116,139,0.12)", color: "#64748b" }}>
              To-do: Not Contacted
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md"
              style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd" }}>
              In progress: Attempts 1–3 + Initial Response
            </span>
          </div>
        )}
        {view === "pipeline" && (
          <div className="flex gap-4 mt-3">
            <span className="text-[11px] px-2 py-0.5 rounded-md"
              style={{ background: "rgba(236,72,153,0.1)", color: "#f9a8d4" }}>
              Active: Info → Proposal → Negotiating
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md"
              style={{ background: "rgba(16,185,129,0.1)", color: "#6ee7b7" }}>
              Complete: Confirmed / Not Interested / Ghosted
            </span>
          </div>
        )}
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex gap-3 px-6 pb-6 overflow-x-auto">
          {activeStages.map(s => (
            <div key={s.key} className="rounded-2xl border p-3 space-y-2 flex-shrink-0"
              style={{ width: 224, borderColor: s.border }}>
              <Skeleton className="h-6 w-3/4 rounded-lg" />
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ))}
        </div>
      ) : (
        <Board
          stages={activeStages}
          tsos={visibleTsos}
          draggedId={draggedId}
          overColumn={overColumn}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
      )}
    </div>
  );
}
