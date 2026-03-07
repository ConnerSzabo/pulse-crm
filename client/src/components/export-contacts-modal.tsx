import { useState } from "react";
import type { ContactWithCompany, Company } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type ContactFilter = "all" | "with-email" | "with-phone";

interface ExportContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactWithCompany[];
  companies: Company[];
}

const escapeCSV = (value: string | null | undefined): string => {
  if (!value) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
};

const leadStatusLabels: Record<string, string> = {
  "0-unqualified": "0 - Unqualified",
  "0.5-dm-details": "0.5 - Decision Maker Details",
  "1-qualified": "1 - Qualified",
  "2-intent": "2 - Intent",
  "3-quote-presented": "3 - Quote Presented",
  "3b-quoted-lost": "3b - Quoted Lost",
  "4-account-active": "4 - Account Active",
  "5-outsourced": "5 - Outsourced",
  "6-time-waste": "6 - Time Waste",
};

export function ExportContactsModal({
  open,
  onOpenChange,
  contacts,
  companies,
}: ExportContactsModalProps) {
  const { toast } = useToast();

  // Contact field checkboxes
  const [includeContactName, setIncludeContactName] = useState(true);
  const [includeJobTitle, setIncludeJobTitle] = useState(true);
  const [includeEmail, setIncludeEmail] = useState(true);
  const [includePhone, setIncludePhone] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);

  // Company field checkboxes
  const [includeSchoolName, setIncludeSchoolName] = useState(true);
  const [includeSchoolPhone, setIncludeSchoolPhone] = useState(true);
  const [includeSchoolWebsite, setIncludeSchoolWebsite] = useState(true);
  const [includeLocation, setIncludeLocation] = useState(true);
  const [includeAcademyTrust, setIncludeAcademyTrust] = useState(true);
  const [includeLeadStatus, setIncludeLeadStatus] = useState(false);
  const [includeLastActivity, setIncludeLastActivity] = useState(false);

  // Filter
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");

  const companyMap = new Map(companies.map((c) => [c.id, c]));

  const handleExport = () => {
    try {
      // Apply filter
      let filtered = [...contacts];
      if (contactFilter === "with-email") {
        filtered = filtered.filter((c) => c.email && c.email.trim() !== "");
      } else if (contactFilter === "with-phone") {
        filtered = filtered.filter((c) => c.phone && c.phone.trim() !== "");
      }

      // Sort by company name then contact name
      filtered.sort((a, b) => {
        const compA = a.companyName || "";
        const compB = b.companyName || "";
        const cmp = compA.localeCompare(compB);
        if (cmp !== 0) return cmp;
        return (a.name || "").localeCompare(b.name || "");
      });

      // Build headers
      const headers: string[] = [];
      if (includeContactName) headers.push("Contact Name");
      if (includeJobTitle) headers.push("Job Title");
      if (includeEmail) headers.push("Email");
      if (includePhone) headers.push("Phone");
      if (includeNotes) headers.push("Notes");
      if (includeSchoolName) headers.push("School Name");
      if (includeSchoolPhone) headers.push("School Phone");
      if (includeSchoolWebsite) headers.push("School Website");
      if (includeLocation) headers.push("Location");
      if (includeAcademyTrust) headers.push("Academy Trust");
      if (includeLeadStatus) headers.push("Lead Status");
      if (includeLastActivity) headers.push("Last Activity Date");

      if (headers.length === 0) {
        toast({ title: "Select at least one field to export", variant: "destructive" });
        return;
      }

      // Build rows
      const rows = filtered.map((contact) => {
        const company = contact.companyId ? companyMap.get(contact.companyId) : undefined;
        const row: string[] = [];

        if (includeContactName) row.push(escapeCSV(contact.name));
        if (includeJobTitle) row.push(escapeCSV(contact.role));
        if (includeEmail) row.push(escapeCSV(contact.email));
        if (includePhone) row.push(escapeCSV(contact.phone));
        if (includeNotes) row.push(""); // contacts schema has no notes field
        if (includeSchoolName) row.push(escapeCSV(company?.name || contact.companyName));
        if (includeSchoolPhone) row.push(escapeCSV(company?.phone));
        if (includeSchoolWebsite) row.push(escapeCSV(company?.website));
        if (includeLocation) row.push(escapeCSV(company?.location));
        if (includeAcademyTrust) row.push(escapeCSV(company?.academyTrustName || "--"));
        if (includeLeadStatus) {
          const status = company?.budgetStatus || "0-unqualified";
          row.push(escapeCSV(leadStatusLabels[status] || status));
        }
        if (includeLastActivity) {
          row.push(
            company?.lastContactDate
              ? format(new Date(company.lastContactDate), "yyyy-MM-dd")
              : "--"
          );
        }

        return row;
      });

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const today = format(new Date(), "yyyy-MM-dd");
      link.href = url;
      link.download = `contacts-export-${today}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: `Exported ${filtered.length} contacts` });
      onOpenChange(false);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto dark:bg-[#252936] dark:border-[#3d4254]">
        <DialogHeader>
          <DialogTitle className="dark:text-white">Export Contacts</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Contact Fields */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#64748b] mb-3">
              Contact Fields
            </h4>
            <div className="space-y-2.5">
              {[
                { label: "Contact Name", checked: includeContactName, onChange: setIncludeContactName },
                { label: "Job Title", checked: includeJobTitle, onChange: setIncludeJobTitle },
                { label: "Email", checked: includeEmail, onChange: setIncludeEmail },
                { label: "Phone Number", checked: includePhone, onChange: setIncludePhone },
                { label: "Notes", checked: includeNotes, onChange: setIncludeNotes },
              ].map((field) => (
                <label key={field.label} className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={field.checked}
                    onCheckedChange={(checked) => field.onChange(!!checked)}
                  />
                  <span className="text-sm text-gray-700 dark:text-[#94a3b8]">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Company Fields */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#64748b] mb-3">
              School / Company Fields
            </h4>
            <div className="space-y-2.5">
              {[
                { label: "School Name", checked: includeSchoolName, onChange: setIncludeSchoolName },
                { label: "School Phone", checked: includeSchoolPhone, onChange: setIncludeSchoolPhone },
                { label: "School Website", checked: includeSchoolWebsite, onChange: setIncludeSchoolWebsite },
                { label: "Location", checked: includeLocation, onChange: setIncludeLocation },
                { label: "Academy Trust", checked: includeAcademyTrust, onChange: setIncludeAcademyTrust },
                { label: "Lead Status", checked: includeLeadStatus, onChange: setIncludeLeadStatus },
                { label: "Last Activity Date", checked: includeLastActivity, onChange: setIncludeLastActivity },
              ].map((field) => (
                <label key={field.label} className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={field.checked}
                    onCheckedChange={(checked) => field.onChange(!!checked)}
                  />
                  <span className="text-sm text-gray-700 dark:text-[#94a3b8]">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#64748b] mb-3">
              Filters
            </h4>
            <div className="space-y-2.5">
              {[
                { value: "all" as const, label: "All contacts" },
                { value: "with-email" as const, label: "Only contacts with email" },
                { value: "with-phone" as const, label: "Only contacts with phone" },
              ].map((option) => (
                <label key={option.value} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="contactFilter"
                    value={option.value}
                    checked={contactFilter === option.value}
                    onChange={() => setContactFilter(option.value)}
                    className="h-4 w-4 text-[#0091AE] border-gray-300 focus:ring-[#0091AE]"
                  />
                  <span className="text-sm text-gray-700 dark:text-[#94a3b8]">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="dark:bg-[#2d3142] dark:border-[#3d4254] dark:text-white dark:hover:bg-[#3d4254]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            className="bg-[#0091AE] hover:bg-[#007a94] text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Export as CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
