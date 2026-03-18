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
  // Flat fields (legacy endpoints)
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
  // Structured fields (TSO import)
  csv_import?: { imported: number; updated: number; skipped: number; total: number; errors: string[] };
  markdown_import?: { processed: number; matched: number; unmatched: number; errors: string[] } | null;
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
  const csv = result.csv_import;
  const md = result.markdown_import;
  const totalImported = csv?.imported ?? result.imported ?? result.tsoCreated ?? 0;
  const totalUpdated = csv?.updated ?? result.updated ?? result.tsoExisted ?? 0;
  const totalSkipped = csv?.skipped ?? result.skipped ?? 0;
  const totalRows = csv?.total ?? result.total;
  const allErrors = [...(csv?.errors ?? result.errors ?? [])];
  return (
    <Alert className={`${result.dryRun ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20" : "border-green-200 bg-green-50 dark:bg-green-950/20"}`}>
      <CheckCircle2 className={`h-4 w-4 ${result.dryRun ? "text-blue-600" : "text-green-600"}`} />
      <AlertDescription>
        <p className={`font-semibold ${result.dryRun ? "text-blue-700" : "text-green-700"}`}>
          {result.dryRun ? "Dry run complete — nothing saved" : "Import complete!"}
        </p>
        <div className="flex flex-wrap gap-3 mt-1.5 text-sm">
          {totalImported > 0 && <span className="text-green-600">✓ {totalImported} new</span>}
          {totalUpdated > 0 && <span className="text-blue-600">↺ {totalUpdated} updated</span>}
          {(result.showsCreated ?? 0) > 0 && <span className="text-green-600">✓ {result.showsCreated} shows</span>}
          {(result.tasksCreated ?? 0) > 0 && <span className="text-green-600">✓ {result.tasksCreated} tasks</span>}
          {totalSkipped > 0 && <span className="text-orange-500">⚠ {totalSkipped} skipped</span>}
          {totalRows != null && <span className="text-muted-foreground">of {totalRows} rows</span>}
        </div>
        {md != null && (
          <div className="flex flex-wrap gap-3 mt-1 text-sm border-t border-current/10 pt-1">
            <span className="text-muted-foreground text-xs font-medium">Markdown enrichment:</span>
            <span className="text-green-600 text-xs">✓ {md.matched} enriched</span>
            {md.unmatched > 0 && <span className="text-orange-500 text-xs">⚠ {md.unmatched} unmatched</span>}
            <span className="text-muted-foreground text-xs">({md.processed} files)</span>
          </div>
        )}
        {allErrors.length > 0 && (
          <details className="mt-2">
            <summary className="text-orange-600 cursor-pointer text-sm">{allErrors.length} error(s)</summary>
            <ul className="mt-1 space-y-0.5 text-xs text-orange-500 max-h-32 overflow-y-auto">
              {allErrors.map((e, i) => <li key={i}>{e}</li>)}
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
        accept=".csv,.zip"
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

type ShowZipPreview = {
  csvFiles: number;
  csvRows: number;
  mdFiles: number;
  tsoCount: number;
};

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
  csvRows?: number;
  mdFiles?: number;
  total?: number;
  imported?: number;
  updated?: number;
};

function ShowsImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ totalRows: number; preview: any[] } | null>(null);
  const [result, setResult] = useState<ShowImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const previewMutation = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/import/shows/preview", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data) => { setPreview(data); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const importMutation = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/import/shows", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json() as Promise<ShowImportResult>;
    },
    onSuccess: (data) => { setResult(data); setError(null); toast({ title: "Shows imported!" }); },
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
        accept=".csv,.zip"
        onFile={handleFile}
        loading={previewMutation.isPending}
        fileName={file?.name}
        onClear={() => { setFile(null); setPreview(null); setResult(null); setError(null); }}
      />

      {preview && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{preview.totalRows} shows detected</p>
          {preview.preview.length > 0 && (
            <div className="rounded-lg border overflow-x-auto text-xs">
              <table className="w-full">
                <thead><tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left">Show</th>
                  <th className="px-3 py-2 text-left">TSO</th>
                  <th className="px-3 py-2 text-left">Matched TSO</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">City</th>
                </tr></thead>
                <tbody>
                  {preview.preview.slice(0, 8).map((r: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-1.5 max-w-[160px] truncate">{r.showName}</td>
                      <td className="px-3 py-1.5 text-muted-foreground truncate">{r.csvTso}</td>
                      <td className="px-3 py-1.5">
                        {r.matchedTsoId
                          ? <span className="text-green-600">{r.matchedTsoName}</span>
                          : <span className="text-orange-500">No match</span>}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.date}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.city}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Button
            size="sm"
            className="bg-[#e91e8c] hover:bg-[#c0166e]"
            onClick={() => file && importMutation.mutate(file)}
            disabled={loading}
          >
            {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            Import {preview.totalRows} Shows
          </Button>
        </div>
      )}

      {result && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <p className="font-semibold text-green-700">Import complete!</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm">
              {(result.imported ?? 0) > 0 && <span className="text-green-600">✓ {result.imported} shows</span>}
              {(result.linked ?? 0) > 0 && <span className="text-purple-600">{result.linked} linked to TSOs</span>}
              {(result.unlinked ?? 0) > 0 && <span className="text-orange-500">⚠ {result.unlinked} without TSO</span>}
            </div>
            {result.unlinkedShows && result.unlinkedShows.length > 0 && (
              <details className="mt-2">
                <summary className="text-orange-600 cursor-pointer text-xs">Unlinked shows ({result.unlinkedShows.length})</summary>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground ml-3 max-h-32 overflow-y-auto">
                  {result.unlinkedShows.map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              </details>
            )}
          </AlertDescription>
        </Alert>
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

// ─── Full Migration Section ───────────────────────────────────────────────────

function FullMigrationSection() {
  const { toast } = useToast();
  const [result, setResult] = useState<any>(null);
  const [tsoZip, setTsoZip]     = useState<File | null>(null);
  const [showsZip, setShowsZip] = useState<File | null>(null);
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!tsoZip || !showsZip || !xlsxFile) throw new Error("All 3 files required");
      const fd = new FormData();
      fd.append("tsoZip",   tsoZip);
      fd.append("showsZip", showsZip);
      fd.append("xlsx",     xlsxFile);
      const res = await fetch("/api/import/full-migration", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || "Migration failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: data.success ? "Migration complete" : "Migration complete with errors", description: data.message });
    },
    onError: (e: any) => {
      toast({ title: "Migration failed", description: e.message, variant: "destructive" });
    },
  });

  const ready = tsoZip && showsZip && xlsxFile;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">1. TSO Outbound ZIP</p>
          <DropZone accept=".zip" onFile={setTsoZip} fileName={tsoZip?.name} onClear={() => setTsoZip(null)} loading={mutation.isPending} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">2. Shows ZIP</p>
          <DropZone accept=".zip" onFile={setShowsZip} fileName={showsZip?.name} onClear={() => setShowsZip(null)} loading={mutation.isPending} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">3. Condensed info.xlsx</p>
          <DropZone accept=".xlsx" onFile={setXlsxFile} fileName={xlsxFile?.name} onClear={() => setXlsxFile(null)} loading={mutation.isPending} />
        </div>
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !ready}
        className="bg-[#e91e8c] hover:bg-[#c4176f] text-white gap-2"
        size="lg"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {mutation.isPending ? "Running migration..." : "Run Full Migration"}
      </Button>
      {!ready && !mutation.isPending && (
        <p className="text-xs text-muted-foreground">Drop all 3 files above to enable migration.</p>
      )}

      {result && (
        <div className="space-y-3">
          <Alert className={result.success ? "border-green-300 bg-green-50" : "border-yellow-300 bg-yellow-50"}>
            <AlertDescription className="font-medium text-sm">{result.message}</AlertDescription>
          </Alert>

          {/* TSO CSV */}
          {result.report?.tso_csv && !result.report.tso_csv.error && (
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p className="font-semibold text-[#e91e8c]">TSOs (CSV)</p>
              <p>Total rows: {result.report.tso_csv.total} &nbsp;|&nbsp; Created: {result.report.tso_csv.imported} &nbsp;|&nbsp; Updated: {result.report.tso_csv.updated} &nbsp;|&nbsp; Skipped (no changes): {result.report.tso_csv.skipped}</p>
            </div>
          )}

          {/* TSO MD */}
          {result.report?.tso_md && result.report.tso_md.processed > 0 && (
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p className="font-semibold text-purple-600">TSO Notes (Markdown)</p>
              <p>MD files: {result.report.tso_md.processed} &nbsp;|&nbsp; Matched to TSO: {result.report.tso_md.matched} &nbsp;|&nbsp; Unmatched: {result.report.tso_md.unmatched}</p>
            </div>
          )}

          {/* Shows */}
          {result.report?.shows && !result.report.shows.error && (
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p className="font-semibold text-blue-600">Shows</p>
              <p>CSV rows: {result.report.shows.csvRows} &nbsp;|&nbsp; MD files: {result.report.shows.mdFiles} &nbsp;|&nbsp; Created: {result.report.shows.imported} &nbsp;|&nbsp; Updated: {result.report.shows.updated}</p>
              <p>Linked to TSO: {result.report.shows.linked} &nbsp;|&nbsp; Unlinked: {result.report.shows.unlinked}</p>
            </div>
          )}

          {/* Excel */}
          {result.report?.excel && !result.report.excel.error && (
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p className="font-semibold text-orange-600">Excel (Condensed info.xlsx)</p>
              <p>Tasks created: {result.report.excel.tasks_created} &nbsp;|&nbsp; Skipped (duplicate): {result.report.excel.tasks_skipped}</p>
              <p>TSO records enriched: {result.report.excel.tso_records_enriched}</p>
            </div>
          )}

          {/* DB totals */}
          {result.report?.validation && (
            <div className="rounded-lg border p-3 text-sm space-y-1 bg-gray-50 dark:bg-gray-900">
              <p className="font-semibold">Database totals after migration</p>
              <p>TSOs: {result.report.validation.total_tsos_in_db} &nbsp;|&nbsp; Shows: {result.report.validation.total_shows_in_db} &nbsp;|&nbsp; Tasks: {result.report.validation.total_tasks_in_db}</p>
            </div>
          )}

          {/* Errors */}
          {result.errors?.length > 0 && (
            <div className="rounded-lg border border-red-200 p-3 text-sm space-y-1">
              <p className="font-semibold text-red-600">Errors ({result.errors.length})</p>
              {result.errors.map((e: string, i: number) => (
                <p key={i} className="text-red-700 text-xs font-mono">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ImportPage() {
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground text-sm">Import TSOs, shows, and tasks from your Notion exports</p>
      </div>

      {/* Full Migration — reads files already on Railway */}
      <Card className="border-[#e91e8c]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRight className="h-5 w-5 text-[#e91e8c]" />
            Full Migration (Railway)
          </CardTitle>
          <CardDescription>
            Drop all 3 files, then click Run. Merges everything into the CRM without overwriting existing data — only fills gaps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FullMigrationSection />
        </CardContent>
      </Card>

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
        </TabsList>

        <TabsContent value="tsos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-5 w-5 text-[#e91e8c]" />
                Import TSOs
              </CardTitle>
              <CardDescription>
                Upload any CSV or ZIP containing TSO data. Columns are auto-detected — just make sure there's a name column.
                Existing TSOs are updated by name match; new ones are created.
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
                Upload any CSV or ZIP containing show data. TSOs are auto-linked by name. Columns are auto-detected.
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
      </Tabs>
    </div>
  );
}
