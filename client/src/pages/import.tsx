import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Loader2,
  Eye, ArrowRight, Building2, CalendarDays, ListTodo, X, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportResult = {
  success: boolean;
  dryRun?: boolean;
  imported?: number;
  updated?: number;
  created?: number;
  tsoCreated?: number;
  tsoExisted?: number;
  showsCreated?: number;
  tasksCreated?: number;
  skipped?: number;
  total?: number;
  errors?: string[];
  preview?: any[];
};

type PreviewResult = {
  totalRows: number;
  headers: string[];
  preview: Record<string, any>[];
  columnMapping?: Record<string, string>;
};

// ─── Column mapping display ───────────────────────────────────────────────────

const TSO_COLUMN_MAPPING: Record<string, string> = {
  "Vendor Name": "name",
  "Priority": "priority (P1/P2/P3)",
  "Status": "relationship_status",
  "Contact Name / Role": "main_contact_name",
  "Contact Email": "email",
  "Contact Number": "contact_number",
  "IG Handle": "ig_handle",
  "Linkedin": "linkedin",
  "Notes": "notes",
  "Follow up date": "follow_up_date",
  "Agreed / Next Show Date": "next_show_date",
  "Sponsor Info": "sponsor_info",
  "Est. Annual Reach": "est_annual_reach",
  "Profile Link": "profile_link",
  "Existing account or trial": "existing_account (Y→true)",
  "Shows Per Year (2026)": "shows_per_year",
  "TSO Event Codes": "tso_event_codes",
  "Activities": "activities_notes",
};

// ─── File upload zone ─────────────────────────────────────────────────────────

function DropZone({
  accept,
  onFile,
  loading,
  fileName,
  onClear,
}: {
  accept: string;
  onFile: (f: File) => void;
  loading?: boolean;
  fileName?: string;
  onClear?: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`relative rounded-lg border-2 border-dashed transition-colors cursor-pointer
        ${dragOver ? "border-[#e91e8c] bg-pink-50 dark:bg-pink-950/20" : "border-gray-200 hover:border-[#e91e8c]/50"}
        ${fileName ? "border-green-300 bg-green-50 dark:bg-green-950/20" : ""}`}
      onClick={() => !fileName && ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files[0]; if (f) onFile(f);
      }}
    >
      <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
        {loading ? (
          <Loader2 className="h-8 w-8 text-[#e91e8c] animate-spin mb-2" />
        ) : fileName ? (
          <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
        )}
        {fileName ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-green-700 dark:text-green-400 truncate max-w-[200px]">{fileName}</span>
            {onClear && (
              <button className="text-gray-400 hover:text-red-500 transition-colors" onClick={e => { e.stopPropagation(); onClear(); }}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm font-medium">{loading ? "Processing..." : "Click or drag file here"}</p>
            <p className="text-xs text-muted-foreground mt-1">{accept.replace(/\./g, "").toUpperCase()}</p>
          </>
        )}
      </div>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = ""; } }} />
    </div>
  );
}

// ─── Preview table ────────────────────────────────────────────────────────────

function PreviewTable({ data, headers, maxCols = 6 }: { data: Record<string, any>[]; headers: string[]; maxCols?: number }) {
  const visibleHeaders = headers.filter(h => !h.startsWith("_")).slice(0, maxCols);
  return (
    <div className="overflow-x-auto rounded-lg border text-xs">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 text-xs">#</TableHead>
            {visibleHeaders.map(h => <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>)}
            {data[0]?._exists !== undefined && <TableHead className="text-xs">Status</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              {visibleHeaders.map(h => (
                <TableCell key={h} className="max-w-[150px] truncate" title={String(row[h] || "")}>
                  {String(row[h] || "") || <span className="text-muted-foreground italic">—</span>}
                </TableCell>
              ))}
              {row._exists !== undefined && (
                <TableCell>
                  <Badge className={row._exists ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}>
                    {row._exists ? "Update" : "New"}
                  </Badge>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Import result banner ─────────────────────────────────────────────────────

function ResultBanner({ result }: { result: ImportResult }) {
  const totalImported = result.imported ?? result.tsoCreated ?? 0;
  const totalUpdated = result.updated ?? result.tsoExisted ?? 0;
  return (
    <Alert className={`${result.dryRun ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20" : "border-green-200 bg-green-50 dark:bg-green-950/20"}`}>
      <CheckCircle2 className={`h-4 w-4 ${result.dryRun ? "text-blue-600" : "text-green-600"}`} />
      <AlertDescription>
        <p className={`font-semibold ${result.dryRun ? "text-blue-700" : "text-green-700"}`}>
          {result.dryRun ? "Dry run complete — nothing saved" : "Import complete!"}
        </p>
        <div className="flex flex-wrap gap-3 mt-1.5 text-sm">
          {totalImported > 0 && <span className="text-green-600">✓ {totalImported} new</span>}
          {totalUpdated > 0 && <span className="text-blue-600">↺ {totalUpdated} updated/existed</span>}
          {(result.updated ?? 0) > 0 && result.updated !== totalUpdated && <span className="text-blue-600">↺ {result.updated} updated</span>}
          {(result.showsCreated ?? 0) > 0 && <span className="text-green-600">✓ {result.showsCreated} shows</span>}
          {(result.tasksCreated ?? 0) > 0 && <span className="text-green-600">✓ {result.tasksCreated} tasks</span>}
          {(result.skipped ?? 0) > 0 && <span className="text-orange-500">⚠ {result.skipped} skipped</span>}
          {result.total && <span className="text-muted-foreground">of {result.total} rows</span>}
        </div>
        {result.errors && result.errors.length > 0 && (
          <details className="mt-2">
            <summary className="text-orange-600 cursor-pointer text-sm">{result.errors.length} error(s)</summary>
            <ul className="mt-1 space-y-0.5 text-xs text-orange-500 max-h-32 overflow-y-auto">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </details>
        )}
      </AlertDescription>
    </Alert>
  );
}

// ─── TSO Import Section ───────────────────────────────────────────────────────

function TsoImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const { toast } = useToast();

  const previewMutation = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/import/tsos/preview", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json() as Promise<PreviewResult>;
    },
    onSuccess: (data) => { setPreview(data); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const importMutation = useMutation({
    mutationFn: async ({ f, dryRun }: { f: File; dryRun: boolean }) => {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch(`/api/import/tsos${dryRun ? "?dryRun=true" : ""}`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => { setResult(data); setError(null); toast({ title: data.dryRun ? "Dry run complete" : "Import complete!" }); },
    onError: (e: Error) => { setError(e.message); toast({ title: "Import failed", description: e.message, variant: "destructive" }); },
  });

  const handleFile = (f: File) => {
    setFile(f); setPreview(null); setResult(null); setError(null);
    previewMutation.mutate(f);
  };

  const loading = previewMutation.isPending || importMutation.isPending;

  return (
    <div className="space-y-4">
      <DropZone
        accept=".csv"
        onFile={handleFile}
        loading={loading}
        fileName={file?.name}
        onClear={() => { setFile(null); setPreview(null); setResult(null); setError(null); }}
      />

      {/* Column mapping toggle */}
      <button
        className="flex items-center gap-1.5 text-xs text-[#e91e8c] hover:underline"
        onClick={() => setShowMapping(!showMapping)}
      >
        <Info className="h-3.5 w-3.5" />
        {showMapping ? "Hide" : "Show"} column mapping
      </button>

      {showMapping && (
        <div className="rounded-lg border bg-muted/30 p-3 text-xs">
          <p className="font-medium mb-2">CSV Column → Database Field</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(TSO_COLUMN_MAPPING).map(([csv, db]) => (
              <div key={csv} className="flex items-center gap-1.5">
                <span className="text-muted-foreground truncate">{csv}</span>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="font-mono text-[#e91e8c] truncate">{db}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Preview: {preview.totalRows} rows found
              {preview.preview.filter(r => r._exists).length > 0 && (
                <span className="text-yellow-600 ml-2">
                  ({preview.preview.filter(r => r._exists).length} of first {preview.preview.length} already exist)
                </span>
              )}
            </p>
          </div>
          <PreviewTable
            data={preview.preview}
            headers={["Vendor Name", "Priority", "Status", "Contact Email", "IG Handle", "Shows Per Year (2026)"]}
          />
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => file && importMutation.mutate({ f: file, dryRun: true })}
              disabled={loading}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Dry Run (preview all {preview.totalRows})
            </Button>
            <Button
              size="sm"
              className="bg-[#e91e8c] hover:bg-[#c0166e]"
              onClick={() => file && importMutation.mutate({ f: file, dryRun: false })}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              Import {preview.totalRows} TSOs
            </Button>
          </div>
        </div>
      )}

      {result && <ResultBanner result={result} />}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ─── Shows Import Section ─────────────────────────────────────────────────────

type ShowMatchPreview = {
  totalRows: number;
  preview: Array<{
    showName: string;
    csvTso: string;
    matchedTsoName: string;
    matchedTsoId: string | null;
    matchType: "exact" | "partial" | "none";
    date: string;
    city: string;
    status: string;
  }>;
};

type ShowImportResult = ImportResult & {
  linked?: number;
  unlinked?: number;
  unlinkedShows?: string[];
};

function ShowsImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ShowMatchPreview | null>(null);
  const [result, setResult] = useState<ShowImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const previewMutation = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/import/shows/preview", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json() as Promise<ShowMatchPreview>;
    },
    onSuccess: (data) => { setPreview(data); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const importMutation = useMutation({
    mutationFn: async ({ f, dryRun }: { f: File; dryRun: boolean }) => {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch(`/api/import/shows${dryRun ? "?dryRun=true" : ""}`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json() as Promise<ShowImportResult>;
    },
    onSuccess: (data) => { setResult(data); setError(null); toast({ title: data.dryRun ? "Dry run complete" : "Shows imported!" }); },
    onError: (e: Error) => { setError(e.message); toast({ title: "Import failed", description: e.message, variant: "destructive" }); },
  });

  const handleFile = (f: File) => {
    setFile(f); setPreview(null); setResult(null); setError(null);
    previewMutation.mutate(f);
  };

  const loading = previewMutation.isPending || importMutation.isPending;

  const matchBadge = (type: "exact" | "partial" | "none") => {
    if (type === "exact") return <Badge className="bg-green-100 text-green-700 text-[10px]">Exact</Badge>;
    if (type === "partial") return <Badge className="bg-yellow-100 text-yellow-700 text-[10px]">Partial</Badge>;
    return <Badge className="bg-red-100 text-red-700 text-[10px]">No match</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 p-3 text-xs text-blue-700">
        <p className="font-medium mb-1">Expected CSV columns:</p>
        <p className="font-mono">Show Name, TSO, Date, City, Venue, Status, Next Follow-Up, Attending TSO, Notes</p>
        <p className="mt-1.5">TSO column is matched against existing TSOs in the database.</p>
      </div>

      <DropZone
        accept=".csv"
        onFile={handleFile}
        loading={loading}
        fileName={file?.name}
        onClear={() => { setFile(null); setPreview(null); setResult(null); setError(null); }}
      />

      {/* TSO matching preview table */}
      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {preview.totalRows} shows found
              {preview.preview.filter(r => r.matchType === "none").length > 0 && (
                <span className="text-red-600 ml-2">
                  · {preview.preview.filter(r => r.matchType === "none").length} unmatched TSOs (will import without link)
                </span>
              )}
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border text-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Show Name</TableHead>
                  <TableHead className="text-xs">TSO (CSV)</TableHead>
                  <TableHead className="text-xs">Matched TSO</TableHead>
                  <TableHead className="text-xs">Match</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">City</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.preview.map((row, i) => (
                  <TableRow key={i} className={row.matchType === "none" ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                    <TableCell className="max-w-[140px] truncate font-medium" title={row.showName}>{row.showName}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-muted-foreground" title={row.csvTso}>{row.csvTso}</TableCell>
                    <TableCell className="max-w-[120px] truncate" title={row.matchedTsoName}>{row.matchedTsoName}</TableCell>
                    <TableCell>{matchBadge(row.matchType)}</TableCell>
                    <TableCell className="text-muted-foreground">{row.date || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.city || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {preview.totalRows > preview.preview.length && (
            <p className="text-xs text-muted-foreground">Showing first {preview.preview.length} of {preview.totalRows} rows</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => file && importMutation.mutate({ f: file, dryRun: true })}
              disabled={loading}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Dry Run
            </Button>
            <Button
              size="sm"
              className="bg-[#e91e8c] hover:bg-[#c0166e]"
              onClick={() => file && importMutation.mutate({ f: file, dryRun: false })}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              Import {preview.totalRows} Shows
            </Button>
          </div>
        </div>
      )}

      {/* Result with unlinked list */}
      {result && (
        <div className="space-y-2">
          <ResultBanner result={result} />
          {(result.linked !== undefined || result.unlinked !== undefined) && (
            <div className="flex gap-4 text-xs">
              {(result.linked ?? 0) > 0 && <span className="text-green-600">✓ {result.linked} linked to TSOs</span>}
              {(result.unlinked ?? 0) > 0 && <span className="text-orange-500">⚠ {result.unlinked} imported without TSO link</span>}
            </div>
          )}
          {result.unlinkedShows && result.unlinkedShows.length > 0 && (
            <details className="text-xs">
              <summary className="text-orange-600 cursor-pointer">Unlinked shows</summary>
              <ul className="mt-1 space-y-0.5 text-muted-foreground ml-3">
                {result.unlinkedShows.map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  );
}

// ─── Tasks Import Section ─────────────────────────────────────────────────────

function TasksImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/import/tasks-excel", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => { setResult(data); setError(null); toast({ title: "Tasks imported!" }); },
    onError: (e: Error) => { setError(e.message); toast({ title: "Import failed", description: e.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 p-3 text-xs text-blue-700">
        <p className="font-medium mb-1">Expected Excel columns:</p>
        <p className="font-mono">#, Action, TSO, Deadline, Owner, Status, Notes</p>
        <p className="mt-1.5">Priority emojis: 🔴→High, 🟠→High, 🟡→Medium, ⚪→Low</p>
        <p>Deadline: <span className="font-mono">"TODAY"</span> or date string</p>
      </div>
      <DropZone
        accept=".xlsx,.xls"
        onFile={f => { setFile(f); setResult(null); setError(null); }}
        loading={importMutation.isPending}
        fileName={file?.name}
        onClear={() => { setFile(null); setResult(null); setError(null); }}
      />
      {file && !result && (
        <Button
          size="sm"
          className="bg-[#e91e8c] hover:bg-[#c0166e]"
          onClick={() => importMutation.mutate(file)}
          disabled={importMutation.isPending}
        >
          {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
          Import Tasks
        </Button>
      )}
      {result && <ResultBanner result={result} />}
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  );
}

// ─── Auto-import section ──────────────────────────────────────────────────────

function AutoImportSection() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/import/tsos/auto", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => { setResult(data); toast({ title: "Auto-import complete!" }); },
    onError: (e: Error) => { setError(e.message); toast({ title: "Auto-import failed", description: e.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Imports the bundled <span className="font-mono text-xs">TSOMASTEROUTBOUND.zip</span> directly from the server.
        Only imports if TSO table is currently empty, or force-imports all.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => importMutation.mutate()}
        disabled={importMutation.isPending}
        className="border-[#e91e8c] text-[#e91e8c] hover:bg-[#e91e8c] hover:text-white"
      >
        {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
        Auto-Import TSOMASTEROUTBOUND
      </Button>
      {result && <ResultBanner result={result} />}
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImportPage() {
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground text-sm">Import TSOs, shows, and tasks from your Notion exports</p>
      </div>

      <Tabs defaultValue="tsos">
        <TabsList className="mb-4">
          <TabsTrigger value="tsos" className="gap-2">
            <Building2 className="h-4 w-4" /> TSOs
          </TabsTrigger>
          <TabsTrigger value="shows" className="gap-2">
            <CalendarDays className="h-4 w-4" /> Shows
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ListTodo className="h-4 w-4" /> Tasks
          </TabsTrigger>
          <TabsTrigger value="auto" className="gap-2">
            <Upload className="h-4 w-4" /> Auto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tsos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-5 w-5 text-[#e91e8c]" />
                Import TSOs — Outbound CRM
              </CardTitle>
              <CardDescription>
                Upload your <strong>TSOMASTEROUTBOUND CSV</strong>. Supports preview, dry run, and duplicate detection.
                Existing TSOs will be updated; new ones will be created.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TsoImportSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shows">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-5 w-5 text-purple-600" />
                Import Shows
              </CardTitle>
              <CardDescription>
                Upload a Shows CSV. TSOs will be auto-linked by name from the "TSO" column.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShowsImportSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListTodo className="h-5 w-5 text-orange-500" />
                Import Tasks
              </CardTitle>
              <CardDescription>
                Upload your <strong>Condensed_info.xlsx</strong>. Tasks will be linked to TSOs by name.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TasksImportSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-5 w-5 text-blue-500" />
                Auto-Import from Bundled File
              </CardTitle>
              <CardDescription>
                Imports the TSOMASTEROUTBOUND data directly from the zip file already on the server.
                No file upload needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AutoImportSection />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
