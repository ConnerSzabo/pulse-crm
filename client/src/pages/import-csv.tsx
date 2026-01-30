import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowRight, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PipelineStage } from "@shared/schema";

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
};

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

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
      const phoneIndex = header.findIndex((h) => h.includes("phone") || h.includes("tel"));
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
            phone: phoneIndex !== -1 ? values[phoneIndex]?.trim() || "" : "",
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

  const performImport = async (updateExisting: boolean) => {
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
          updateExisting,
        }),
      });

      if (response.ok) {
        const result: ImportResult = await response.json();
        setImportResult(result);
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });

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

    setImporting(true);

    try {
      const response = await fetch("/api/companies/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies: parsedData,
          stageId: selectedStage || null,
          updateExisting: false,
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import CSV</h1>
        <p className="text-muted-foreground">
          Import schools and companies from a CSV file
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>
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
              />
            </div>
            {file && (
              <Button variant="ghost" size="icon" onClick={clearFile} data-testid="button-clear-file">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {file && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{file.name}</span>
              <Badge variant="secondary">{parsedData.length} rows</Badge>
            </div>
          )}

          {parsedData.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>Assign to Pipeline Stage (optional)</Label>
                  <Select value={selectedStage || "none"} onValueChange={(val) => setSelectedStage(val === "none" ? "" : val)}>
                    <SelectTrigger className="w-[200px]" data-testid="select-import-stage">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No stage</SelectItem>
                      {stages?.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  data-testid="button-import-csv"
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
                <div className="p-4 rounded-lg bg-muted space-y-2">
                  <h4 className="font-medium">Import Summary</h4>
                  <div className="flex flex-wrap items-center gap-4">
                    {importResult.imported > 0 && (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{importResult.imported} new schools imported</span>
                      </div>
                    )}
                    {importResult.updated > 0 && (
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <RefreshCw className="h-4 w-4" />
                        <span>{importResult.updated} records updated</span>
                      </div>
                    )}
                    {importResult.skipped > 0 && (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
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
                      className="mt-2"
                      data-testid="button-view-companies"
                    >
                      View Companies
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              )}

              <ScrollArea className="w-full">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Company Name</TableHead>
                        <TableHead className="min-w-[150px]">Website</TableHead>
                        <TableHead className="min-w-[120px]">Phone</TableHead>
                        <TableHead className="min-w-[100px]">Location</TableHead>
                        <TableHead className="min-w-[150px]">Academy Trust</TableHead>
                        <TableHead className="min-w-[60px]">Ext</TableHead>
                        <TableHead className="min-w-[150px]">Notes</TableHead>
                        <TableHead className="min-w-[120px]">IT Manager</TableHead>
                        <TableHead className="min-w-[150px]">IT Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 10).map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[150px]">
                            {row.website || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.phone || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.location || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[150px]">
                            {row.academyTrustName || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.ext || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[150px]">
                            {row.notes || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.itManagerName || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.itManagerEmail || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {parsedData.length > 10 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground">
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

      <Card>
        <CardHeader>
          <CardTitle>Expected CSV Format</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Your CSV should have headers that match these fields (case insensitive):
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div className="bg-muted p-2 rounded">EstablishmentName / Company Name</div>
            <div className="bg-muted p-2 rounded">SchoolWebsite / Website</div>
            <div className="bg-muted p-2 rounded">SchoolPhoneNumber / Phone</div>
            <div className="bg-muted p-2 rounded">Location</div>
            <div className="bg-muted p-2 rounded">AcademyTrustName</div>
            <div className="bg-muted p-2 rounded">Ext</div>
            <div className="bg-muted p-2 rounded">Notes</div>
            <div className="bg-muted p-2 rounded">IT Manager Name</div>
            <div className="bg-muted p-2 rounded">IT Manager Email</div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Existing Records?</AlertDialogTitle>
            <AlertDialogDescription>
              Found {duplicatesWithNewInfo} duplicate school(s) with new information 
              (like IT Manager details) that the existing records don't have.
              <br /><br />
              Would you like to update these existing records with the new information?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowUpdateDialog(false);
              toast({ 
                title: "Import Complete", 
                description: `Imported ${importResult?.imported || 0} new schools, skipped ${importResult?.skipped || 0} duplicates`
              });
            }}>
              Skip Updates
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => performImport(true)} data-testid="button-update-existing">
              Update Existing Records
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
