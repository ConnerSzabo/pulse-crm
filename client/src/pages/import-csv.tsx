import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowRight, X } from "lucide-react";
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

export default function ImportCSV() {
  const [, navigate] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const detectDelimiter = (headerLine: string): string => {
    // Check if tabs are present and more common than commas
    const tabCount = (headerLine.match(/\t/g) || []).length;
    const commaCount = (headerLine.match(/,/g) || []).length;
    return tabCount > commaCount ? "\t" : ",";
  };

  const parseCSVLine = (line: string, delimiter: string): string[] => {
    if (delimiter === "\t") {
      // Tab-delimited is simpler - just split by tab
      return line.split("\t");
    }
    
    // For comma-delimited, handle quoted fields
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

      // Detect delimiter from header line
      const delimiter = detectDelimiter(lines[0]);
      const header = parseCSVLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());
      
      // Find column indices - support various header names
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

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setImporting(true);
    let success = 0;
    let failed = 0;

    for (const row of parsedData) {
      try {
        const response = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name,
            website: row.website || null,
            phone: row.phone || null,
            location: row.location || null,
            academyTrustName: row.academyTrustName || null,
            ext: row.ext || null,
            notes: row.notes || null,
            itManagerName: row.itManagerName || null,
            itManagerEmail: row.itManagerEmail || null,
            stageId: selectedStage || null,
          }),
        });

        if (response.ok) {
          const company = await response.json();
          success++;
          
          // Auto-create IT Manager as first contact if they exist
          if (row.itManagerName && row.itManagerEmail) {
            try {
              await fetch(`/api/companies/${company.id}/contacts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  companyId: company.id,
                  name: row.itManagerName,
                  email: row.itManagerEmail,
                  role: "IT Manager",
                  phone: null,
                }),
              });
            } catch {
              // Ignore contact creation errors
            }
          }
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    setImporting(false);
    setImportResult({ success, failed });
    queryClient.invalidateQueries({ queryKey: ["/api/companies"] });

    if (success > 0) {
      toast({ title: `Successfully imported ${success} schools/companies` });
    }
  };

  const clearFile = () => {
    setFile(null);
    setParsedData([]);
    setImportResult(null);
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
                  <Select value={selectedStage} onValueChange={setSelectedStage}>
                    <SelectTrigger className="w-[200px]" data-testid="select-import-stage">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No stage</SelectItem>
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
                    "Importing..."
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import {parsedData.length} Schools
                    </>
                  )}
                </Button>
              </div>

              {importResult && (
                <div className="flex items-center gap-4">
                  {importResult.success > 0 && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{importResult.success} imported successfully</span>
                    </div>
                  )}
                  {importResult.failed > 0 && (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>{importResult.failed} failed</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/companies")}
                    data-testid="button-view-companies"
                  >
                    View Companies
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
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
    </div>
  );
}
