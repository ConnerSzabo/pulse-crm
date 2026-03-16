import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ImportResult = {
  message: string;
  tsoCreated?: number;
  tsoExisted?: number;
  showsCreated?: number;
  tasksCreated?: number;
  errors?: string[];
};

function ImportCard({
  title,
  description,
  accept,
  endpoint,
  icon: Icon,
  fieldName = "file",
}: {
  title: string;
  description: string;
  accept: string;
  endpoint: string;
  icon: any;
  fieldName?: string;
}) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append(fieldName, file);
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      toast({ title: "Import complete!" });
    },
    onError: (e: Error) => {
      setError(e.message);
      setResult(null);
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    },
  });

  const handleFile = (file: File) => {
    setResult(null);
    setError(null);
    importMutation.mutate(file);
  };

  return (
    <Card className={`border-2 transition-colors ${dragOver ? "border-[#e91e8c] bg-pink-50 dark:bg-pink-950/20" : "border-dashed"}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-[#e91e8c]" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex flex-col items-center justify-center p-8 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {importMutation.isPending ? (
            <Loader2 className="h-10 w-10 text-[#e91e8c] animate-spin mb-2" />
          ) : (
            <Upload className="h-10 w-10 text-muted-foreground mb-2" />
          )}
          <p className="text-sm font-medium">
            {importMutation.isPending ? "Importing..." : "Click or drag file here"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{accept.replace(/\./g, "").toUpperCase()} files</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />

        {result && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm">
              <p className="font-medium text-green-700">{result.message}</p>
              <ul className="mt-1 space-y-0.5 text-green-600">
                {result.tsoCreated !== undefined && <li>TSOs created: {result.tsoCreated}</li>}
                {result.tsoExisted !== undefined && <li>TSOs already existed: {result.tsoExisted}</li>}
                {result.showsCreated !== undefined && <li>Shows created: {result.showsCreated}</li>}
                {result.tasksCreated !== undefined && <li>Tasks created: {result.tasksCreated}</li>}
              </ul>
              {result.errors && result.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="text-orange-600 cursor-pointer">{result.errors.length} warning(s)</summary>
                  <ul className="mt-1 space-y-0.5 text-xs text-orange-500">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              )}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default function ImportPage() {
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground text-sm">Import TSOs, shows, and tasks from your Notion exports</p>
      </div>

      {/* CSV Format Guide */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-blue-700 mb-2">Expected CSV columns (TSO Shows Master):</p>
          <p className="text-xs text-blue-600 font-mono">
            Show Name, TSO, Date, City, Venue, Status, Next Follow-Up, TSO ON MAIN CRM, Attending TSO, Notes
          </p>
          <p className="text-sm font-medium text-blue-700 mt-3 mb-1">TSO format:</p>
          <p className="text-xs text-blue-600 font-mono">Syre UK (Shanky) → TSO name: "Syre UK", Contact: "Shanky"</p>
          <p className="text-sm font-medium text-blue-700 mt-3 mb-1">Expected Excel columns (Condensed_info.xlsx):</p>
          <p className="text-xs text-blue-600 font-mono">#, Action, TSO, Deadline, Owner, Status, Notes</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ImportCard
          title="Import Shows + TSOs"
          description="Upload TSO Shows Master CSV — creates TSOs and shows together"
          accept=".csv"
          endpoint="/api/import/shows-csv"
          icon={FileText}
        />
        <ImportCard
          title="Import TSOs Only"
          description="Upload CSV to extract and create unique TSO records only"
          accept=".csv"
          endpoint="/api/import/tsos-from-shows-csv"
          icon={Upload}
        />
        <ImportCard
          title="Import Tasks"
          description="Upload Condensed_info.xlsx to import action items"
          accept=".xlsx,.xls"
          endpoint="/api/import/tasks-excel"
          icon={FileText}
        />
      </div>
    </div>
  );
}
