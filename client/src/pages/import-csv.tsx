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
import { Upload, Download, FileText, CheckCircle2, AlertCircle, ArrowRight, X, RefreshCw, Trash2, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { PipelineStage, CsvImport, Company } from "@shared/schema";

type ParsedRow = {
  name: string;
  website: string;
  phone: string;
  location: string;
  academyTrustName: string;
  industry: string;
  ext: string;
  notes: string;
  itManagerName: string;
  itManagerEmail: string;
  budgetStatus: string;
  // New school-specific fields
  urn: string;
  street: string;
  postcode: string;
  county: string;
  schoolType: string;
  schoolCapacity: string;
  pupilHeadcount: string;
  // Headteacher fields
  headFirstName: string;
  headLastName: string;
  headJobTitle: string;
};

type ImportResult = {
  imported: number;
  skipped: number;
  updated: number;
  duplicates: { name: string; location?: string; existingId: string; hasNewInfo: boolean; reason?: string }[];
  importBatchId?: string;
  contactsCreated?: number;
  contactsSkipped?: number;
  phonesFormatted?: number;
};

type UpdateMode = "skip" | "merge" | "overwrite";

export default function ImportCSV() {
  const [, navigate] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
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

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await apiRequest("GET", "/api/companies");
      const companies: Company[] = await response.json();

      const headers = [
        "EstablishmentName",
        "Website",
        "Phone",
        "Location",
        "AcademyTrustName",
        "EXT",
        "Notes",
        "IT Manager Name",
        "IT Manager Email",
      ];

      const escapeCSV = (value: string | null | undefined): string => {
        if (!value) return "";
        const str = String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      const rows = companies.map((c) => [
        escapeCSV(c.name),
        escapeCSV(c.website),
        escapeCSV(c.phone),
        escapeCSV(c.location),
        escapeCSV(c.academyTrustName),
        escapeCSV(c.ext),
        escapeCSV(c.notes),
        escapeCSV(c.itManagerName),
        escapeCSV(c.itManagerEmail),
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const today = format(new Date(), "yyyy-MM-dd");
      link.href = url;
      link.download = `wave_crm_export_${today}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `Exported ${companies.length} companies to CSV`,
      });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

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
        h.includes("establishmentname") || h.includes("company name") || h.includes("company") || h.includes("school name") || h === "name" || h === "school"
      );
      const websiteIndex = header.findIndex((h) => h.includes("website"));
      const phoneIndex = header.findIndex((h) => h.includes("phone") || h.includes("telephone") || h.includes("tel") || h.includes("mobile") || h.includes("cell"));
      const locationIndex = header.findIndex((h) => h.includes("town") || h.includes("location") || h.includes("city"));
      const trustIndex = header.findIndex((h) => h.includes("trust") || h.includes("academytrustname"));
      const extIndex = header.findIndex((h) => h === "ext" || h.includes("extension"));
      const notesIndex = header.findIndex((h) => h === "notes" || h.includes("note"));
      const itManagerNameIndex = header.findIndex((h) =>
        h.includes("it manager name") || h.includes("itmanagername") || h === "it manager name"
      );
      const itManagerEmailIndex = header.findIndex((h) =>
        h.includes("it manager email") || h.includes("itmanageremail") || h === "it manager email"
      );
      const industryIndex = header.findIndex((h) =>
        h === "industry" || h === "phase"
      );
      const leadStatusIndex = header.findIndex((h) =>
        h.includes("lead status") || h.includes("leadstatus") || h.includes("budget status") || h.includes("budgetstatus") || h === "lead_status" || h === "budget_status"
      );
      // New school-specific fields
      const urnIndex = header.findIndex((h) => h === "urn" || h.includes("unique reference"));
      const streetIndex = header.findIndex((h) => h === "street" || h.includes("street address") || h.includes("address1"));
      const postcodeIndex = header.findIndex((h) => h === "postcode" || h.includes("postal code") || h.includes("zip"));
      const countyIndex = header.findIndex((h) => h === "county" || h === "la" || h === "la (name)" || h.includes("la name") || h.includes("local authority"));
      const schoolTypeIndex = header.findIndex((h) => h === "type" || h === "typeofe" || h.includes("type of e") || h.includes("school type") || h.includes("schooltype"));
      const capacityIndex = header.findIndex((h) => h.includes("school capacity") || h.includes("schoolcapacity") || h === "capacity");
      const headcountIndex = header.findIndex((h) => h.includes("pupil headcount") || h.includes("pupilheadcount") || h === "headcount" || h.includes("number of pupils"));
      // Headteacher fields
      const headFirstNameIndex = header.findIndex((h) => h.includes("head first") || h.includes("headfirst") || h === "head first name");
      const headLastNameIndex = header.findIndex((h) => h.includes("head last") || h.includes("headlast") || h === "head last name");
      const headJobTitleIndex = header.findIndex((h) => h.includes("head job") || h.includes("headjob") || h.includes("head title") || h === "head job title");

      if (nameIndex === -1) {
        toast({ title: "CSV must have a column with company/school name (e.g., 'EstablishmentName', 'Company Name')", variant: "destructive" });
        return;
      }

      const rows: ParsedRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], delimiter);
        const name = values[nameIndex]?.trim();

        if (name) {
          // Use county field, fall back to LA field if county not found
          const county = countyIndex !== -1 ? values[countyIndex]?.trim() || "" : "";

          rows.push({
            name,
            website: websiteIndex !== -1 ? values[websiteIndex]?.trim() || "" : "",
            phone: phoneIndex !== -1 ? normalizePhone(values[phoneIndex] || "") : "",
            location: locationIndex !== -1 ? values[locationIndex]?.trim() || "" : "",
            academyTrustName: trustIndex !== -1 ? values[trustIndex]?.trim() || "" : "",
            industry: industryIndex !== -1 ? values[industryIndex]?.trim() || "Secondary School" : "Secondary School",
            ext: extIndex !== -1 ? values[extIndex]?.trim() || "" : "",
            notes: notesIndex !== -1 ? values[notesIndex]?.trim() || "" : "",
            itManagerName: itManagerNameIndex !== -1 ? values[itManagerNameIndex]?.trim() || "" : "",
            itManagerEmail: itManagerEmailIndex !== -1 ? values[itManagerEmailIndex]?.trim() || "" : "",
            budgetStatus: leadStatusIndex !== -1 ? values[leadStatusIndex]?.trim() || "0-unqualified" : "0-unqualified",
            urn: urnIndex !== -1 ? values[urnIndex]?.trim() || "" : "",
            street: streetIndex !== -1 ? values[streetIndex]?.trim() || "" : "",
            postcode: postcodeIndex !== -1 ? values[postcodeIndex]?.trim() || "" : "",
            county,
            schoolType: schoolTypeIndex !== -1 ? values[schoolTypeIndex]?.trim() || "" : "",
            schoolCapacity: capacityIndex !== -1 ? values[capacityIndex]?.trim() || "" : "",
            pupilHeadcount: headcountIndex !== -1 ? values[headcountIndex]?.trim() || "" : "",
            headFirstName: headFirstNameIndex !== -1 ? values[headFirstNameIndex]?.trim() || "" : "",
            headLastName: headLastNameIndex !== -1 ? values[headLastNameIndex]?.trim() || "" : "",
            headJobTitle: headJobTitleIndex !== -1 ? values[headJobTitleIndex]?.trim() || "" : "",
          });
        }
      }

      setParsedData(rows);
      toast({ title: `Found ${rows.length} schools/companies in CSV` });
    };

    reader.readAsText(selectedFile);
  };

  const BATCH_SIZE = 50;

  const performImport = async (mode: UpdateMode) => {
    const dataToImport = pendingImport.length > 0 ? pendingImport : parsedData;
    if (dataToImport.length === 0) return;

    setImporting(true);
    setShowUpdateDialog(false);
    setImportProgress({ current: 0, total: dataToImport.length });

    const combinedResult: ImportResult = {
      imported: 0,
      skipped: 0,
      updated: 0,
      duplicates: [],
      contactsCreated: 0,
      contactsSkipped: 0,
      phonesFormatted: 0,
    };

    try {
      // Process in batches to avoid timeouts and body size limits
      for (let i = 0; i < dataToImport.length; i += BATCH_SIZE) {
        const batch = dataToImport.slice(i, i + BATCH_SIZE);
        setImportProgress({ current: i, total: dataToImport.length });

        const response = await fetch("/api/companies/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companies: batch,
            stageId: selectedStage || null,
            updateMode: mode,
            fileName: file?.name || "import.csv",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || `Server error (${response.status})`;
          console.error("Import batch error:", errorData);
          toast({
            title: `Import failed at rows ${i + 1}-${i + batch.length}`,
            description: errorMsg,
            variant: "destructive",
          });
          // Keep partial results visible
          if (combinedResult.imported > 0 || combinedResult.updated > 0) {
            setImportResult({ ...combinedResult });
          }
          return;
        }

        const batchResult: ImportResult = await response.json();
        combinedResult.imported += batchResult.imported;
        combinedResult.skipped += batchResult.skipped;
        combinedResult.updated += batchResult.updated;
        combinedResult.contactsCreated = (combinedResult.contactsCreated || 0) + (batchResult.contactsCreated || 0);
        combinedResult.contactsSkipped = (combinedResult.contactsSkipped || 0) + (batchResult.contactsSkipped || 0);
        combinedResult.phonesFormatted = (combinedResult.phonesFormatted || 0) + (batchResult.phonesFormatted || 0);
        if (batchResult.duplicates) {
          combinedResult.duplicates.push(...batchResult.duplicates);
        }
        if (batchResult.importBatchId) {
          combinedResult.importBatchId = batchResult.importBatchId;
        }
      }

      setImportProgress({ current: dataToImport.length, total: dataToImport.length });
      setImportResult(combinedResult);
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/csv-imports"] });

      const messages: string[] = [];
      if (combinedResult.imported > 0) messages.push(`Imported ${combinedResult.imported} new schools`);
      if (combinedResult.updated > 0) messages.push(`Updated ${combinedResult.updated} existing records`);
      if (combinedResult.skipped > 0) messages.push(`Skipped ${combinedResult.skipped} duplicates`);

      toast({
        title: "Import Complete",
        description: messages.join(", ") || "No changes made"
      });
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error?.message || "Network error - check your connection",
        variant: "destructive",
      });
      if (combinedResult.imported > 0 || combinedResult.updated > 0) {
        setImportResult({ ...combinedResult });
      }
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
    setImportProgress({ current: 0, total: parsedData.length });

    const combinedResult: ImportResult = {
      imported: 0,
      skipped: 0,
      updated: 0,
      duplicates: [],
      contactsCreated: 0,
      contactsSkipped: 0,
      phonesFormatted: 0,
    };

    try {
      // Process in batches
      for (let i = 0; i < parsedData.length; i += BATCH_SIZE) {
        const batch = parsedData.slice(i, i + BATCH_SIZE);
        setImportProgress({ current: i, total: parsedData.length });

        const response = await fetch("/api/companies/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companies: batch,
            stageId: selectedStage || null,
            updateMode: "skip",
            fileName: file?.name || "import.csv",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || `Server error (${response.status})`;
          console.error("Import batch error:", errorData);
          toast({
            title: `Import failed at rows ${i + 1}-${i + batch.length}`,
            description: errorMsg,
            variant: "destructive",
          });
          if (combinedResult.imported > 0) {
            setImportResult({ ...combinedResult });
          }
          return;
        }

        const batchResult: ImportResult = await response.json();
        combinedResult.imported += batchResult.imported;
        combinedResult.skipped += batchResult.skipped;
        combinedResult.updated += batchResult.updated;
        combinedResult.contactsCreated = (combinedResult.contactsCreated || 0) + (batchResult.contactsCreated || 0);
        combinedResult.contactsSkipped = (combinedResult.contactsSkipped || 0) + (batchResult.contactsSkipped || 0);
        combinedResult.phonesFormatted = (combinedResult.phonesFormatted || 0) + (batchResult.phonesFormatted || 0);
        if (batchResult.duplicates) {
          combinedResult.duplicates.push(...batchResult.duplicates);
        }
        if (batchResult.importBatchId) {
          combinedResult.importBatchId = batchResult.importBatchId;
        }
      }

      setImportProgress({ current: parsedData.length, total: parsedData.length });

      const dupsWithNewInfo = combinedResult.duplicates.filter(d => d.hasNewInfo).length;

      if (dupsWithNewInfo > 0) {
        setPendingImport(parsedData);
        setDuplicatesWithNewInfo(dupsWithNewInfo);
        setImportResult(combinedResult);
        setShowUpdateDialog(true);
        setImporting(false);
        return;
      }

      setImportResult(combinedResult);
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/csv-imports"] });

      const messages: string[] = [];
      if (combinedResult.imported > 0) messages.push(`Imported ${combinedResult.imported} new schools`);
      if (combinedResult.skipped > 0) messages.push(`Skipped ${combinedResult.skipped} duplicates`);

      toast({
        title: "Import Complete",
        description: messages.join(", ") || "No changes made"
      });
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error?.message || "Network error - check your connection",
        variant: "destructive",
      });
      if (combinedResult.imported > 0) {
        setImportResult({ ...combinedResult });
      }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold dark:text-white">Import Data</h1>
          <p className="text-muted-foreground dark:text-[#94a3b8]">
            Import schools and companies from a CSV file, or export your current data
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exporting}
          data-testid="button-export-csv"
          className="dark:border-[#3d4254] dark:text-white dark:hover:bg-[#2d3142]"
        >
          {exporting ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export Companies
            </>
          )}
        </Button>
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
                      Importing... {importProgress.total > 0 ? `${Math.min(importProgress.current + BATCH_SIZE, importProgress.total)}/${importProgress.total}` : ""}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import {parsedData.length} Schools
                      {parsedData.some(r => r.headFirstName || r.headLastName) && " + Contacts"}
                    </>
                  )}
                </Button>
              </div>

              {importing && importProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground dark:text-[#94a3b8]">Import Progress</span>
                    <span className="font-medium dark:text-white">
                      {Math.min(importProgress.current + BATCH_SIZE, importProgress.total)}/{importProgress.total}
                      {" "}({Math.round(Math.min(importProgress.current + BATCH_SIZE, importProgress.total) / importProgress.total * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-[#1a1d29] rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-[#0091AE] h-3 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round(Math.min(importProgress.current + BATCH_SIZE, importProgress.total) / importProgress.total * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {importResult && (
                <div className="p-4 rounded-lg bg-muted dark:bg-[#2d3142] space-y-3">
                  <h4 className="font-medium dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Import Complete!
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-md bg-background dark:bg-[#1a1d29] border dark:border-[#3d4254]">
                      <p className="text-xs text-muted-foreground dark:text-[#94a3b8]">Processed</p>
                      <p className="text-lg font-semibold dark:text-white">{parsedData.length}</p>
                    </div>
                    <div className="p-3 rounded-md bg-background dark:bg-[#1a1d29] border dark:border-[#3d4254]">
                      <p className="text-xs text-green-600 dark:text-[#10b981]">New companies created</p>
                      <p className="text-lg font-semibold text-green-600 dark:text-[#10b981]">{importResult.imported}</p>
                    </div>
                    <div className="p-3 rounded-md bg-background dark:bg-[#1a1d29] border dark:border-[#3d4254]">
                      <p className="text-xs text-blue-600 dark:text-[#0091AE]">Existing merged/updated</p>
                      <p className="text-lg font-semibold text-blue-600 dark:text-[#0091AE]">{importResult.updated}</p>
                    </div>
                    <div className="p-3 rounded-md bg-background dark:bg-[#1a1d29] border dark:border-[#3d4254]">
                      <p className="text-xs text-amber-600 dark:text-[#f59e0b]">Skipped (duplicates)</p>
                      <p className="text-lg font-semibold text-amber-600 dark:text-[#f59e0b]">{importResult.skipped}</p>
                    </div>
                  </div>

                  {/* Contacts and phone stats */}
                  {((importResult.contactsCreated || 0) > 0 || (importResult.contactsSkipped || 0) > 0 || (importResult.phonesFormatted || 0) > 0) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(importResult.contactsCreated || 0) > 0 && (
                        <div className="p-3 rounded-md bg-background dark:bg-[#1a1d29] border dark:border-[#3d4254]">
                          <p className="text-xs text-green-600 dark:text-[#10b981]">Headteacher contacts added</p>
                          <p className="text-lg font-semibold text-green-600 dark:text-[#10b981]">{importResult.contactsCreated}</p>
                        </div>
                      )}
                      {(importResult.contactsSkipped || 0) > 0 && (
                        <div className="p-3 rounded-md bg-background dark:bg-[#1a1d29] border dark:border-[#3d4254]">
                          <p className="text-xs text-gray-500 dark:text-[#64748b]">Contacts skipped (existed)</p>
                          <p className="text-lg font-semibold text-gray-500 dark:text-[#64748b]">{importResult.contactsSkipped}</p>
                        </div>
                      )}
                      {(importResult.phonesFormatted || 0) > 0 && (
                        <div className="p-3 rounded-md bg-background dark:bg-[#1a1d29] border dark:border-[#3d4254]">
                          <p className="text-xs text-gray-500 dark:text-[#64748b]">Phone numbers formatted (+0)</p>
                          <p className="text-lg font-semibold text-gray-500 dark:text-[#64748b]">{importResult.phonesFormatted}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {importResult.duplicates.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-amber-600 dark:text-[#f59e0b]">
                        Duplicates skipped ({importResult.duplicates.length} total):
                      </p>
                      <ul className="text-sm text-muted-foreground dark:text-[#94a3b8] space-y-0.5 pl-1">
                        {importResult.duplicates.slice(0, 10).map((dup, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500 dark:text-[#f59e0b]" />
                            <span>
                              {dup.name}
                              {dup.location ? ` (${dup.location})` : ""}
                              {" "}&mdash;{" "}
                              {dup.reason === "duplicate_in_csv"
                                ? "duplicate within CSV"
                                : dup.reason === "duplicate_phone"
                                ? "matching phone number in database"
                                : dup.reason === "duplicate_website"
                                ? "matching website in database"
                                : "matching name in database"}
                            </span>
                          </li>
                        ))}
                        {importResult.duplicates.length > 10 && (
                          <li className="text-xs italic dark:text-[#64748b]">
                            ... and {importResult.duplicates.length - 10} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {importResult.imported > 0 && (
                    <p className="text-sm text-muted-foreground dark:text-[#94a3b8]">
                      {importResult.imported} companies imported with Lead Status: 0 - Unqualified (default)
                    </p>
                  )}
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
                        <TableHead className="min-w-[200px] dark:text-[#94a3b8]">School Name</TableHead>
                        <TableHead className="min-w-[120px] dark:text-[#94a3b8]">Phone</TableHead>
                        <TableHead className="min-w-[150px] dark:text-[#94a3b8]">Website</TableHead>
                        <TableHead className="min-w-[100px] dark:text-[#94a3b8]">Town</TableHead>
                        <TableHead className="min-w-[80px] dark:text-[#94a3b8]">Postcode</TableHead>
                        <TableHead className="min-w-[100px] dark:text-[#94a3b8]">Type</TableHead>
                        <TableHead className="min-w-[150px] dark:text-[#94a3b8]">Academy Trust</TableHead>
                        <TableHead className="min-w-[120px] dark:text-[#94a3b8]">Headteacher</TableHead>
                        <TableHead className="min-w-[80px] dark:text-[#94a3b8]">URN</TableHead>
                        <TableHead className="min-w-[80px] dark:text-[#94a3b8]">Capacity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 10).map((row, index) => (
                        <TableRow key={index} className="dark:border-[#3d4254] dark:hover:bg-[#2d3142]">
                          <TableCell className="font-medium dark:text-white">{row.name}</TableCell>
                          <TableCell className="text-muted-foreground dark:text-[#64748b]">
                            {row.phone || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[150px] dark:text-[#64748b]">
                            {row.website || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground dark:text-[#64748b]">
                            {row.location || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground dark:text-[#64748b]">
                            {row.postcode || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground dark:text-[#64748b]">
                            {row.schoolType || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[150px] dark:text-[#64748b]">
                            {row.academyTrustName || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground dark:text-[#64748b]">
                            {[row.headFirstName, row.headLastName].filter(Boolean).join(" ") || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground dark:text-[#64748b]">
                            {row.urn || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground dark:text-[#64748b]">
                            {row.schoolCapacity || "\u2014"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {parsedData.length > 10 && (
                        <TableRow className="dark:border-[#3d4254]">
                          <TableCell colSpan={10} className="text-center text-muted-foreground dark:text-[#64748b]">
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
            Your CSV should have headers that match these fields (case insensitive). Phone numbers with 10 digits will automatically get a leading 0 added.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">School Name / EstablishmentName</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Telephone / Phone</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Website</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Town / Location</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Street</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Postcode</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">County / LA</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Type (school type)</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">URN</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">School Capacity</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Pupil Headcount</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Trust / AcademyTrustName</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Head First Name</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Head Last Name</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Head Job Title</div>
            <div className="bg-muted p-2 rounded dark:bg-[#2d3142] dark:text-[#94a3b8]">Phase / Industry</div>
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
