import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowRight, X, RefreshCw, Trash2, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { PipelineStage, CsvImport } from "@shared/schema";

type ParsedRow = {
  name: string;
  website: string;
  phone: string;
  location: string;
  academyTrustName: string;
  ext: string;
  notes: string;
  itManagerName: string;
  itManagerEmail: string;
};

type ImportResult = {
  imported: number;
  skipped: number;
  updated: number;
  duplicates: { name: string; existingId: string; hasNewInfo: boolean }[];
  importBatchId?: string;
};

type UpdateMode = "skip" | "merge" | "overwrite";

export default function ImportCSV() {
  const [, navigate] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [pendingImport, setPendingImport] = useState<ParsedRow[]>([]);
  const [duplicatesWithNewInfo, setDuplicatesWithNewInfo] = useState<number>(0);
  const [updateMode, setUpdateMode] = useState<UpdateMode>("skip");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [importToDelete, setImportToDelete] = useState<CsvImport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const { data: csvImports, isLoading: importsLoading } = useQuery<CsvImport[]>({
    queryKey: ["/api/csv-imports"],
  });

  const deleteImportMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/csv-imports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/csv-imports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Import deleted", description: "All companies from this import have been removed." });
      setShowDeleteDialog(false);
      setImportToDelete(null);
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  const normalizePhone = (phone: string): string => {
    if (!phone) return "";
    // Remove common formatting characters but preserve the core number
    return phone.replace(/[\s\-\(\)\.]/g, "").trim();
  };

  const detectDelimiter = (headerLine: string): string => {
    const tabCount = (headerLine.match(/\t/g) || []).length;
    const commaCount = (headerLine.match(/,/g) || []).length;
    return tabCount > commaCount ? "\t" : ",";
  };

  const parseCSVLine = (line: string, delimiter: string): string[] => {
    if (delimiter === "\t") {
      return line.split("\t");
    }

    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast({ title: "Please select a CSV file", variant: "destructive" });
      return;
    }

    setFile(selectedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        toast({ title: "CSV file must have a header row and at least one data row", variant: "destructive" });
        return;
      }

      const delimiter = detectDelimiter(lines[0]);
      const header = parseCSVLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());

      const nameIndex = header.findIndex((h) =>
        h.includes("establishmentname") || h.includes("company name") || h.includes("company") || h.includes("school") || h === "name"
      );
      const websiteIndex = header.findIndex((h) => h.includes("website"));
      const phoneIndex = header.findIndex((h) => h.includes("phone") || h.includes("tel") || h.includes("mobile") || h.includes("cell"));
      const locationIndex = header.findIndex((h) => h.includes("location") || h.includes("city") || h.includes("address"));
      const trustIndex = header.findIndex((h) => h.includes("trust") || h.includes("academytrustname"));
      const extIndex = header.findIndex((h) => h === "ext" || h.includes("extension"));
      const notesIndex = header.findIndex((h) => h === "notes" || h.includes("note"));
      const itManagerNameIndex = header.findIndex((h) =>
        h.includes("it manager name") || h.includes("itmanagername") || h === "it manager name"
      );
      const itManagerEmailIndex = header.findIndex((h) =>
        h.includes("it manager email") || h.includes("itmanageremail") || h === "it manager email"
      );

      if (nameIndex === -1) {
        toast({ title: "CSV must have a column with company/school name (e.g., 'EstablishmentName', 'Company Name')", variant: "destructive" });
        return;
      }

      const rows: ParsedRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], delimiter);
        const name = values[nameIndex]?.trim();

        if (name) {
          rows.push({
            name,
            website: websiteIndex !== -1 ? values[websiteIndex]?.trim() || "" : "",
            phone: phoneIndex !== -1 ? normalizePhone(values[phoneIndex] || "") : "",
            location: locationIndex !== -1 ? values[locationIndex]?.trim() || "" : "",
            academyTrustName: trustIndex !== -1 ? values[trustIndex]?.trim() || "" : "",
            ext: extIndex !== -1 ? values[extIndex]?.trim() || "" : "",
            notes: notesIndex !== -1 ? values[notesIndex]?.trim() || "" : "",
            itManagerName: itManagerNameIndex !== -1 ? values[itManagerNameIndex]?.trim() || "" : "",
            itManagerEmail: itManagerEmailIndex !== -1 ? values[itManagerEmailIndex]?.trim() || "" : "",
          });
        }
      }

      setParsedData(rows);
      toast({ title: `Found ${rows.length} schools/companies in CSV` });
    };

    reader.readAsText(selectedFile);
  };

  const performImport = async (mode: UpdateMode) => {
    const dataToImport = pendingImport.length > 0 ? pendingImport : parsedData;
    if (dataToImport.length === 0) return;

    setImporting(true);
    setShowUpdateDialog(false);

    try {
      const response = await fetch("/api/companies/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies: dataToImport,
          stageId: selectedStage || null,
          updateMode: mode,
          fileName: file?.name || "import.csv",
        }),
      });

      if (response.ok) {
        const result: ImportResult = await response.json();
        setImportResult(result);
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
        queryClient.invalidateQueries({ queryKey: ["/api/csv-imports"] });

        const messages: string[] = [];
        if (result.imported > 0) messages.push(`Imported ${result.imported} new schools`);
        if (result.updated > 0) messages.push(`Updated ${result.updated} existing records`);
        if (result.skipped > 0) messages.push(`Skipped ${result.skipped} duplicates`);

        toast({
          title: "Import Complete",
          description: messages.join(", ") || "No changes made"
        });
      } else {
        toast({ title: "Import failed", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Import failed", description: "An error occurred", variant: "destructive" });
    } finally {
      setImporting(false);
      setPendingImport([]);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    // If user selected overwrite or merge mode, go directly with that mode
    if (updateMode === "overwrite" || updateMode === "merge") {
      return performImport(updateMode);
    }

    setImporting(true);

    try {
      const response = await fetch("/api/companies/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies: parsedData,
          stageId: selectedStage || null,
          updateMode: "skip",
          fileName: file?.name || "import.csv",
        }),
      });

      if (response.ok) {
        const result: ImportResult = await response.json();

        const dupsWithNewInfo = result.duplicates.filter(d => d.hasNewInfo).length;

        if (dupsWithNewInfo > 0) {
          setPendingImport(parsedData);
          setDuplicatesWithNewInfo(dupsWithNewInfo);
          setImportResult(result);
          setShowUpdateDialog(true);
          setImporting(false);
          return;
        }

        setImportResult(result);
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
        queryClient.invalidateQueries({ queryKey: ["/api/csv-imports"] });

        const messages: string[] = [];
        if (result.imported > 0) messages.push(`Imported ${result.imported} new schools`);
        if (result.skipped > 0) messages.push(`Skipped ${result.skipped} duplicates`);

        toast({
          title: "Import Complete",
          description: messages.join(", ") || "No changes made"
        });
      } else {
        toast({ title: "Import failed", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Import failed", description: "An error occurred", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setParsedData([]);
    setImportResult(null);
    setPendingImport([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-6 space-y-6 dark:bg-[#1a1d29] min-h-screen">
      <div>
        <h1 className="text-2xl font-semibold dark:text-white">Import CSV</h1>
        <p className="text-muted-foreground dark:text-[#94a3b8]">
          Import schools and companies from a CSV file
        </p>
      </div>

      <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
        <CardHeader>
          <CardTitle className="dark:text-white">Upload CSV File</CardTitle>
          <CardDescription className="dark:text-[#94a3b8]">
            Your CSV should have columns for: Company Name, Website, Phone Number, Location,
            Academy Trust Name, Ext, Notes, IT Manager Name, IT Manager Email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="csv-file" className="sr-only">
                CSV File
              </Label>
              <Input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                data-testid="input-csv-file"
                className="dark:bg-[#252936] dark:border-[#3d4254] dark:text-white file:dark:text-[#94a3b8]"
              />
            </div>
            {file && (
              <Button variant="ghost" size="icon" onClick={clearFile} data-testid="button-clear-file" className="dark:text-[#94a3b8] dark:hover:bg-[#2d3142]">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {file && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-[#94a3b8]">
              <FileText className="h-4 w-4" />
              <span>{file.name}</span>
              <Badge variant="secondary" className="dark:bg-[#2d3142] dark:text-[#94a3b8] dark:border-[#3d4254]">{parsedData.length} rows</Badge>
            </div>
          )}

          {parsedData.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-[#94a3b8]">Assign to Pipeline Stage (optional)</Label>
                  <Select value={selectedStage || "none"} onValueChange={(val) => setSelectedStage(val === "none" ? "" : val)}>
                    <SelectTrigger className="w-[200px] dark:bg-[#252936] dark:border-[#3d4254] dark:text-white" data-testid="select-import-stage">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                      <SelectItem value="none" className="dark:text-[#94a3b8] dark:focus:bg-[#2d3142]">No stage</SelectItem>
                      {stages?.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id} className="dark:text-white dark:focus:bg-[#2d3142]">
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-[#94a3b8]">Duplicate Handling</Label>
                  <Select value={updateMode} onValueChange={(val) => setUpdateMode(val as UpdateMode)}>
                    <SelectTrigger className="w-[200px] dark:bg-[#252936] dark:border-[#3d4254] dark:text-white" data-testid="select-update-mode">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#252936] dark:border-[#3d4254]">
                      <SelectItem value="skip" className="dark:text-white dark:focus:bg-[#2d3142]">Skip duplicates</SelectItem>
                      <SelectItem value="merge" className="dark:text-white dark:focus:bg-[#2d3142]">Merge (fill empty fields)</SelectItem>
                      <SelectItem value="overwrite" className="dark:text-white dark:focus:bg-[#2d3142]">Overwrite existing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  data-testid="button-import-csv"
                  className="bg-[#0091AE] hover:bg-[#007a94] text-white dark:bg-[#0091AE] dark:hover:bg-[#007a94]"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import {parsedData.length} Schools
                    </>
                  )}
                </Button>
              </div>

              {importResult && (
                <div className="p-4 rounded-lg bg-muted dark:bg-[#2d3142] space-y-2">
                  <h4 className="font-medium dark:text-white">Import Summary</h4>
                  <div className="flex flex-wrap items-center gap-4">
                    {importResult.imported > 0 && (
                      <div className="flex items-center gap-2 text-green-600 dark:text-[#10b981]">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{importResult.imported} new schools imported</span>
                      </div>
                    )}
                    {importResult.updated > 0 && (
                      <div className="flex items-center gap-2 text-blue-600 dark:text-[#0091AE]">
                        <RefreshCw className="h-4 w-4" />
                        <span>{importResult.updated} records updated</span>
                      </div>
                    )}
                    {importResult.skipped > 0 && (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-[#f59e0b]">
                        <AlertCircle className="h-4 w-4" />
                        <span>{importResult.skipped} duplicates skipped</span>
                      </div>
                    )}
                  </div>
                  {(importResult.imported > 0 || importResult.updated > 0) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/companies")}
                      className="mt-2 dark:border-[#3d4254] dark:text-white dark:hover:bg-[#2d3142]"
                      data-testid="button-view-companies"
                    >
                      View Companies
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              )}

              <ScrollArea className="w-full">
                <div className="border rounded-lg dark:border-[#3d4254]">
                  <Table>
                    <TableHeader>
                      <TableRow className="dark:border-[#3d4254]">
                        <TableHead className="min-w-[200px] dark:text-[#94a3b8]">Company Name</TableHead>
                        <TableHead className="min-w-[150px] dark:text-[#94a3b8]">Website</TableHead>
                        <TableHead className="min-w-[120px] dark:text-[#94a3b8]">Phone</TableHead>
                        <TableHead className="min-w-[100px] dark:text-[#94a3b8]">Location</TableHead>
                        <TableHead className="min-w-[150px] dark:text-[#94a3b8]">Academy Trust</TableHead>
                        <TableHead className="min-w-[60px] dark:text-[#94a3b8]">Ext</TableHead>
                        <TableHead className="min-w-[150px] dark:text-[#94a3b8]">Notes</TableHead>
                        <TableHead className="min-w-[120px] dark:text-[#94a3b8]">IT Manager</TableHead>
                        <TableHead className="min-w-[150px] dark:text-[#94a3b8]">IT Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 10).map((row, index) => (
                        <TableRow key={index} className="dark:border-[#3d4254] dark:hover:bg-[#2d3142]">
                          <TableCell className="font-medium dark:text-white">{row.name}</TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[150px] dark:text-[#64748b]">
                            {row.website || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground dark:text-[#64748b]">
                            {row.phone || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground dark:text-[#64748b]">
                            {row.location || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[150px] dark:text-[#64748b]">
                            {row.academyTrustName || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground dark:text-[#64748b]">
                            {row.ext || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[150px] dark:text-[#64748b]">
                            {row.notes || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground dark:text-[#64748b]">
                            {row.itManagerName || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground dark:text-[#64748b]">
                            {row.itManagerEmail || "\u2014"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {parsedData.length > 10 && (
                        <TableRow className="dark:border-[#3d4254]">
                          <TableCell colSpan={9} className="text-center text-muted-foreground dark:text-[#64748b]">
                            ... and {parsedData.length - 10} more rows
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
        <CardHeader>
          <CardTitle className="dark:text-white">Expected CSV Format</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3 dark:text-[#94a3b8]">
            Your CSV should have headers that match these fields (case insensitive):
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">EstablishmentName / Company Name</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">SchoolWebsite / Website</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">SchoolPhoneNumber / Phone</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Location</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">AcademyTrustName</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Ext</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Notes</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">IT Manager Name</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">IT Manager Email</div>
          </div>
        </CardContent>
      </Card>

      {/* Import History */}
      <Card className="dark:bg-[#252936] dark:border-[#3d4254]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-white">
            <History className="h-5 w-5" />
            Import History
          </CardTitle>
          <CardDescription className="dark:text-[#94a3b8]">
            View and manage past CSV imports. Deleting an import will remove all companies from that batch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {importsLoading ? (
            <p className="text-muted-foreground dark:text-[#94a3b8]">Loading...</p>
          ) : csvImports && csvImports.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="dark:border-[#3d4254]">
                  <TableHead className="dark:text-[#94a3b8]">File Name</TableHead>
                  <TableHead className="dark:text-[#94a3b8]">Date</TableHead>
                  <TableHead className="dark:text-[#94a3b8]">Imported</TableHead>
                  <TableHead className="dark:text-[#94a3b8]">Updated</TableHead>
                  <TableHead className="dark:text-[#94a3b8]">Skipped</TableHead>
                  <TableHead className="w-[100px] dark:text-[#94a3b8]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvImports.map((imp) => (
                  <TableRow key={imp.id} className="dark:border-[#3d4254] dark:hover:bg-[#2d3142]">
                    <TableCell className="font-medium dark:text-white">{imp.fileName}</TableCell>
                    <TableCell className="dark:text-[#94a3b8]">{format(new Date(imp.importedAt), "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-[#10b981]">
                        {imp.importedCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-[#0091AE]">
                        {imp.updatedCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="dark:border-[#3d4254] dark:text-[#94a3b8]">{imp.skippedCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setImportToDelete(imp);
                          setShowDeleteDialog(true);
                        }}
                        disabled={imp.importedCount === 0}
                        data-testid={`button-delete-import-${imp.id}`}
                        className="dark:hover:bg-[#2d3142]"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground dark:text-[#64748b]" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8 dark:text-[#64748b]">No import history yet</p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Update Existing Records?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-[#94a3b8]">
              Found {duplicatesWithNewInfo} duplicate school(s) with new information
              (like IT Manager details) that the existing records don't have.
              <br /><br />
              Would you like to update these existing records with the new information?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowUpdateDialog(false);
                toast({
                  title: "Import Complete",
                  description: `Imported ${importResult?.imported || 0} new schools, skipped ${importResult?.skipped || 0} duplicates`
                });
              }}
              className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]"
            >
              Skip Updates
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => performImport("merge")}
              data-testid="button-update-existing"
              className="bg-[#0091AE] hover:bg-[#007a94] text-white dark:bg-[#0091AE] dark:hover:bg-[#007a94]"
            >
              Update Existing Records
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="dark:bg-[#252936] dark:border-[#3d4254]">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Delete Import?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-[#94a3b8]">
              This will permanently delete all {importToDelete?.importedCount || 0} companies
              that were imported from "{importToDelete?.fileName}".
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteDialog(false);
                setImportToDelete(null);
              }}
              className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => importToDelete && deleteImportMutation.mutate(importToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-[#ef4444] dark:text-white dark:hover:bg-[#dc2626]"
              data-testid="button-confirm-delete-import"
            >
              Delete Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
