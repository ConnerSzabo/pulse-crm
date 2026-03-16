import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import {
  insertTsoSchema,
  insertShowSchema,
  insertContactSchema,
  insertActivitySchema,
  insertCallNoteSchema,
  insertTaskSchema,
} from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";
import { loginLimiter } from "./index";
import multer from "multer";
import * as XLSX from "xlsx";
import { parse as csvParse } from "csv-parse/sync";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTsoName(raw: string): { name: string; contact: string } {
  const match = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) return { name: match[1].trim(), contact: match[2].trim() };
  return { name: raw.trim(), contact: "" };
}

function parseFlexibleDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const s = raw.toString().trim();
  if (!s || s === "-" || s === "") return null;
  if (s.toUpperCase() === "TODAY") return new Date();
  // Try direct parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // "Wed 18 Mar" or "18 Mar"
  const shortMonth: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const m = s.match(/(?:\w{3}\s+)?(\d{1,2})\s+(\w{3})/i);
  if (m) {
    const day = parseInt(m[1]);
    const month = shortMonth[m[2].toLowerCase()];
    if (month !== undefined) {
      const year = new Date().getFullYear();
      return new Date(year, month, day);
    }
  }
  return null;
}

function mapRelationshipStatus(raw: string | undefined): string {
  if (!raw) return "Cold Outreach";
  const s = raw.trim();
  const map: Record<string, string> = {
    "contacted": "Contacted",
    "in conversation": "In Conversation",
    "sponsoring": "Sponsoring",
    "cold outreach": "Cold Outreach",
    "initial contact": "Initial Contact",
    "active partner": "Active Partner",
    "deal closed": "Deal Closed",
  };
  return map[s.toLowerCase()] || s || "Cold Outreach";
}

function mapPriority(raw: string | undefined): string {
  if (!raw) return "medium";
  const s = raw.toString().trim();
  if (s.includes("🔴") || s.toUpperCase().includes("URGENT")) return "high";
  if (s.includes("🟠") || s.toUpperCase() === "HIGH") return "high";
  if (s.includes("🟡") || s.toUpperCase() === "MEDIUM") return "medium";
  if (s.includes("⚪") || s.toUpperCase() === "LOW") return "low";
  return "medium";
}

// ─── Auth middleware ───────────────────────────────────────────────────────────

const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.userId) return next();
  return res.status(401).json({ message: "Unauthorized" });
};

export function registerRoutes(httpServer: Server, app: Express): Server {

  // ─── Auth ─────────────────────────────────────────────────────────────────

  app.post("/api/login", loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Username and password are required" });
      const [user] = await db.select().from(users).where(eq(users.username, username));
      if (!user) return res.status(401).json({ message: "Invalid username or password" });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid username or password" });
      req.session.userId = user.id;
      req.session.username = user.username;
      res.json({ message: "Login successful", username: user.username });
    } catch (e) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.clearCookie("pokepulse.sid"));
    res.json({ message: "Logged out successfully" });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.session.userId) res.json({ authenticated: true, username: req.session.username });
    else res.json({ authenticated: false });
  });

  // ─── TSOs ─────────────────────────────────────────────────────────────────

  app.get("/api/tsos", isAuthenticated, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const result = await storage.getTsos(search, status);
      res.json(result);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch TSOs" });
    }
  });

  app.get("/api/tsos/:id", isAuthenticated, async (req, res) => {
    try {
      const tso = await storage.getTsoById((req.params.id as string));
      if (!tso) return res.status(404).json({ message: "TSO not found" });
      res.json(tso);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch TSO" });
    }
  });

  app.post("/api/tsos", isAuthenticated, async (req, res) => {
    try {
      const data = insertTsoSchema.parse(req.body);
      const tso = await storage.createTso(data);
      res.status(201).json(tso);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      res.status(500).json({ message: "Failed to create TSO" });
    }
  });

  app.patch("/api/tsos/:id", isAuthenticated, async (req, res) => {
    try {
      const tso = await storage.updateTso((req.params.id as string), req.body);
      if (!tso) return res.status(404).json({ message: "TSO not found" });
      res.json(tso);
    } catch (e) {
      res.status(500).json({ message: "Failed to update TSO" });
    }
  });

  app.delete("/api/tsos/:id", isAuthenticated, async (req, res) => {
    try {
      const ok = await storage.deleteTso((req.params.id as string));
      if (!ok) return res.status(404).json({ message: "TSO not found" });
      res.json({ message: "TSO deleted" });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete TSO" });
    }
  });

  // ─── TSO Activities ───────────────────────────────────────────────────────

  app.get("/api/tsos/:id/activities", isAuthenticated, async (req, res) => {
    try {
      const acts = await storage.getActivities((req.params.id as string));
      res.json(acts);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post("/api/tsos/:id/activities", isAuthenticated, async (req, res) => {
    try {
      const data = insertActivitySchema.parse({ ...req.body, tsoId: (req.params.id as string) });
      const activity = await storage.createActivity(data);
      res.status(201).json(activity);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  app.patch("/api/activities/:id", isAuthenticated, async (req, res) => {
    try {
      const act = await storage.updateActivity((req.params.id as string), req.body);
      if (!act) return res.status(404).json({ message: "Activity not found" });
      res.json(act);
    } catch (e) {
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  app.delete("/api/activities/:id", isAuthenticated, async (req, res) => {
    try {
      const ok = await storage.deleteActivity((req.params.id as string));
      if (!ok) return res.status(404).json({ message: "Activity not found" });
      res.json({ message: "Activity deleted" });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete activity" });
    }
  });

  // ─── TSO Contacts ─────────────────────────────────────────────────────────

  app.get("/api/tsos/:id/contacts", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.getContacts((req.params.id as string));
      res.json(result);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post("/api/tsos/:id/contacts", isAuthenticated, async (req, res) => {
    try {
      const data = insertContactSchema.parse({ ...req.body, tsoId: (req.params.id as string) });
      const contact = await storage.createContact(data);
      res.status(201).json(contact);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  // ─── Contacts (global) ────────────────────────────────────────────────────

  app.get("/api/contacts", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.getContacts();
      res.json(result);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.patch("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const contact = await storage.updateContact((req.params.id as string), req.body);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      res.json(contact);
    } catch (e) {
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const ok = await storage.deleteContact((req.params.id as string));
      if (!ok) return res.status(404).json({ message: "Contact not found" });
      res.json({ message: "Contact deleted" });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // ─── Shows ────────────────────────────────────────────────────────────────

  app.get("/api/shows", isAuthenticated, async (req, res) => {
    try {
      const tsoId = req.query.tsoId as string | undefined;
      const status = req.query.status as string | undefined;
      const result = await storage.getShows(tsoId, status);
      res.json(result);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch shows" });
    }
  });

  app.get("/api/shows/:id", isAuthenticated, async (req, res) => {
    try {
      const show = await storage.getShowById((req.params.id as string));
      if (!show) return res.status(404).json({ message: "Show not found" });
      res.json(show);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch show" });
    }
  });

  app.post("/api/shows", isAuthenticated, async (req, res) => {
    try {
      const data = insertShowSchema.parse(req.body);
      const show = await storage.createShow(data);
      res.status(201).json(show);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      res.status(500).json({ message: "Failed to create show" });
    }
  });

  app.patch("/api/shows/:id", isAuthenticated, async (req, res) => {
    try {
      const show = await storage.updateShow((req.params.id as string), req.body);
      if (!show) return res.status(404).json({ message: "Show not found" });
      res.json(show);
    } catch (e) {
      res.status(500).json({ message: "Failed to update show" });
    }
  });

  app.delete("/api/shows/:id", isAuthenticated, async (req, res) => {
    try {
      const ok = await storage.deleteShow((req.params.id as string));
      if (!ok) return res.status(404).json({ message: "Show not found" });
      res.json({ message: "Show deleted" });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete show" });
    }
  });

  // ─── Tasks ────────────────────────────────────────────────────────────────

  app.get("/api/tasks", isAuthenticated, async (req, res) => {
    try {
      const tsoId = req.query.tsoId as string | undefined;
      const showId = req.query.showId as string | undefined;
      const result = await storage.getTasks(tsoId, showId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", isAuthenticated, async (req, res) => {
    try {
      const data = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(data);
      res.status(201).json(task);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const task = await storage.updateTask((req.params.id as string), req.body);
      if (!task) return res.status(404).json({ message: "Task not found" });
      res.json(task);
    } catch (e) {
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const ok = await storage.deleteTask((req.params.id as string));
      if (!ok) return res.status(404).json({ message: "Task not found" });
      res.json({ message: "Task deleted" });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // ─── Dashboard ────────────────────────────────────────────────────────────

  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // ─── Import: Shows CSV ────────────────────────────────────────────────────

  app.post("/api/import/shows-csv", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      let rows: Record<string, string>[];
      try {
        rows = csvParse(req.file.buffer, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }) as Record<string, string>[];
      } catch (e) {
        return res.status(400).json({ message: "Invalid CSV file" });
      }

      let tsoCreated = 0, tsoExisted = 0, showsCreated = 0, errors: string[] = [];

      for (const row of rows) {
        try {
          const rawTso = row["TSO"] || row["tso"] || "";
          const showName = row["Show Name"] || row["show_name"] || row["Show"] || "";
          if (!showName && !rawTso) continue;

          // Parse TSO name and contact
          const { name: tsoName, contact } = parseTsoName(rawTso);
          if (!tsoName) continue;

          // Find or create TSO
          let tso = await storage.findTsoByName(tsoName);
          if (!tso) {
            const rawStatus = row["Status"] || row["status"] || "";
            const tsoOnMainCrm = (row["TSO ON MAIN CRM"] || row["tso_on_main_crm"] || "").toLowerCase();
            tso = await storage.createTso({
              name: tsoName,
              mainContactName: contact || undefined,
              relationshipStatus: mapRelationshipStatus(rawStatus),
              tsoOnMainCrm: tsoOnMainCrm === "yes" || tsoOnMainCrm === "true" || tsoOnMainCrm === "✓",
            });
            tsoCreated++;
          } else {
            tsoExisted++;
          }

          // Create show
          if (showName) {
            const showDate = parseFlexibleDate(row["Date"] || row["date"]);
            const nextFollowup = parseFlexibleDate(row["Next Follow-Up"] || row["next_followup"] || row["Next Followup"]);
            await storage.createShow({
              showName,
              tsoId: tso.id,
              showDate: showDate ? showDate.toISOString().split("T")[0] : undefined,
              city: row["City"] || row["city"] || undefined,
              venue: row["Venue"] || row["venue"] || undefined,
              status: mapRelationshipStatus(row["Status"] || row["status"]) || "Contacted",
              nextFollowupDate: nextFollowup ? nextFollowup.toISOString().split("T")[0] : undefined,
              attendingTso: row["Attending TSO"] || row["attending_tso"] || undefined,
              notes: row["Notes"] || row["notes"] || undefined,
            });
            showsCreated++;
          }
        } catch (rowErr: any) {
          errors.push(`Row error: ${rowErr.message}`);
        }
      }

      await storage.createCsvImport({
        fileName: req.file.originalname,
        importedCount: showsCreated,
        updatedCount: tsoExisted,
        skippedCount: errors.length,
      });

      res.json({
        message: "Import complete",
        tsoCreated,
        tsoExisted,
        showsCreated,
        errors: errors.slice(0, 20),
      });
    } catch (e: any) {
      res.status(500).json({ message: `Import failed: ${e.message}` });
    }
  });

  // ─── Import: Tasks Excel ──────────────────────────────────────────────────

  app.post("/api/import/tasks-excel", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      let rows: Record<string, any>[];
      try {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      } catch (e) {
        return res.status(400).json({ message: "Invalid Excel file" });
      }

      let tasksCreated = 0, errors: string[] = [];

      for (const row of rows) {
        try {
          const action = (row["Action"] || row["action"] || "").toString().trim();
          if (!action) continue;

          const rawTso = (row["TSO"] || row["tso"] || "").toString().trim();
          const rawPriority = (row["#"] || row["Priority"] || row["priority"] || "").toString().trim();
          const rawDeadline = (row["Deadline"] || row["deadline"] || row["Due Date"] || "").toString().trim();
          const rawStatus = (row["Status"] || row["status"] || "To Do").toString().trim();
          const rawOwner = (row["Owner"] || row["owner"] || "").toString().trim();
          const rawNotes = (row["Notes"] || row["notes"] || "").toString().trim();

          // Link to TSO
          let tsoId: string | undefined;
          if (rawTso) {
            const { name: tsoName } = parseTsoName(rawTso);
            const tso = await storage.findTsoByName(tsoName);
            if (tso) tsoId = tso.id;
          }

          const dueDate = parseFlexibleDate(rawDeadline);

          await storage.createTask({
            title: action,
            tsoId: tsoId || undefined,
            priority: mapPriority(rawPriority),
            dueDate: dueDate || undefined,
            status: rawStatus || "To Do",
            owner: rawOwner || undefined,
            notes: rawNotes || undefined,
          });
          tasksCreated++;
        } catch (rowErr: any) {
          errors.push(`Row error: ${rowErr.message}`);
        }
      }

      await storage.createCsvImport({
        fileName: req.file.originalname,
        importedCount: tasksCreated,
        updatedCount: 0,
        skippedCount: errors.length,
      });

      res.json({
        message: "Import complete",
        tasksCreated,
        errors: errors.slice(0, 20),
      });
    } catch (e: any) {
      res.status(500).json({ message: `Import failed: ${e.message}` });
    }
  });

  // ─── Import: TSOs only CSV ────────────────────────────────────────────────

  app.post("/api/import/tsos-from-shows-csv", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      let rows: Record<string, string>[];
      try {
        rows = csvParse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
      } catch (e) {
        return res.status(400).json({ message: "Invalid CSV file" });
      }

      // Deduplicate TSOs from all rows
      const tsoMap = new Map<string, { name: string; contact: string; status: string; onMainCrm: boolean }>();
      for (const row of rows) {
        const rawTso = row["TSO"] || row["tso"] || "";
        const { name, contact } = parseTsoName(rawTso);
        if (!name) continue;
        const key = name.toLowerCase();
        if (!tsoMap.has(key)) {
          const onMainCrm = (row["TSO ON MAIN CRM"] || "").toLowerCase();
          tsoMap.set(key, {
            name,
            contact,
            status: row["Status"] || "",
            onMainCrm: onMainCrm === "yes" || onMainCrm === "true" || onMainCrm === "✓",
          });
        }
      }

      let created = 0, existed = 0;
      for (const tsoData of Array.from(tsoMap.values())) {
        const existing = await storage.findTsoByName(tsoData.name);
        if (!existing) {
          await storage.createTso({
            name: tsoData.name,
            mainContactName: tsoData.contact || undefined,
            relationshipStatus: mapRelationshipStatus(tsoData.status),
            tsoOnMainCrm: tsoData.onMainCrm,
          });
          created++;
        } else {
          existed++;
        }
      }

      res.json({ message: "TSO import complete", created, existed });
    } catch (e: any) {
      res.status(500).json({ message: `Import failed: ${e.message}` });
    }
  });

  // ─── Import: TSOs from Outbound CRM CSV ──────────────────────────────────────

  app.post("/api/import/tsos", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      let rows: Record<string, string>[];
      try {
        rows = csvParse(req.file.buffer, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true,
        }) as Record<string, string>[];
      } catch (e: any) {
        return res.status(400).json({ message: `Invalid CSV: ${e.message}` });
      }

      // Filter out blank rows
      rows = rows.filter(r => (r["Vendor Name"] || "").trim());

      const dryRun = req.body.dryRun === "true" || req.query.dryRun === "true";
      const results: any[] = [];
      let imported = 0, skipped = 0, updated = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const vendorName = (row["Vendor Name"] || "").trim();
        if (!vendorName) continue;

        try {
          // Parse dates
          const followUpDate = parseFlexibleDate(row["Follow up date"]);
          const nextShowDate = parseFlexibleDate(row["Agreed / Next Show Date"]);

          // Parse contact name/role — may be "Name — Role" or "Name" or "Name, Role"
          const contactRaw = (row["Contact Name / Role"] || "").trim();

          // Parse existing account boolean
          const existingAccount = (row["Existing account or trial"] || "").trim().toUpperCase() === "Y";

          // Parse shows per year — keep as text (has descriptive values like "4 (Feb, Apr XL, May, Nov)")
          const showsPerYear = (row["Shows Per Year (2026)"] || "").trim() || undefined;

          // Priority — keep P1/P2/P3 as-is
          const priority = (row["Priority"] || "").trim() || undefined;

          // Status — map to our relationship_status values
          const statusRaw = (row["Status"] || "").trim();
          const relationshipStatus = mapCsvStatus(statusRaw);

          const tsoData = {
            name: vendorName,
            priority,
            relationshipStatus,
            notes: (row["Notes"] || "").trim() || undefined,
            email: (row["Contact Email"] || "").trim() || undefined,
            contactNumber: (row["Contact Number"] || "").trim() || undefined,
            igHandle: (row["IG Handle"] || "").trim() || undefined,
            linkedin: (row["Linkedin"] || "").trim() || undefined,
            mainContactName: contactRaw || undefined,
            sponsorInfo: (row["Sponsor Info"] || "").trim() || undefined,
            estAnnualReach: (row["Est. Annual Reach"] || "").trim() || undefined,
            profileLink: (row["Profile Link"] || "").trim() || undefined,
            existingAccount,
            showsPerYear,
            tsoEventCodes: (row["TSO Event Codes"] || "").trim() || undefined,
            activitiesNotes: (row["Activities"] || "").trim() || undefined,
            followUpDate: followUpDate ? followUpDate.toISOString().split("T")[0] : undefined,
            nextShowDate: nextShowDate ? nextShowDate.toISOString().split("T")[0] : undefined,
          };

          const existing = await storage.findTsoByName(vendorName);

          results.push({
            row: i + 2,
            name: vendorName,
            action: existing ? "update" : "create",
            status: relationshipStatus,
            priority,
          });

          if (!dryRun) {
            if (existing) {
              await storage.updateTso(existing.id, tsoData);
              updated++;
            } else {
              await storage.createTso(tsoData);
              imported++;
            }
          } else {
            if (existing) updated++; else imported++;
          }
        } catch (rowErr: any) {
          errors.push(`Row ${i + 2} (${vendorName}): ${rowErr.message}`);
          skipped++;
        }
      }

      res.json({
        success: true,
        dryRun,
        imported,
        updated,
        skipped,
        total: rows.length,
        errors: errors.slice(0, 30),
        preview: dryRun ? results : undefined,
      });
    } catch (e: any) {
      res.status(500).json({ message: `Import failed: ${e.message}` });
    }
  });

  // ─── Import: Preview TSOs CSV (returns first N rows without importing) ────────

  app.post("/api/import/tsos/preview", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      let rows: Record<string, string>[];
      try {
        rows = csvParse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Record<string, string>[];
      } catch (e: any) {
        return res.status(400).json({ message: `Invalid CSV: ${e.message}` });
      }

      rows = rows.filter(r => (r["Vendor Name"] || "").trim());
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      const preview = rows.slice(0, 8);

      // Check which TSOs already exist
      const previewWithStatus = await Promise.all(preview.map(async row => {
        const name = (row["Vendor Name"] || "").trim();
        const existing = name ? await storage.findTsoByName(name) : null;
        return { ...row, _exists: !!existing, _existingId: existing?.id };
      }));

      res.json({
        totalRows: rows.length,
        headers,
        preview: previewWithStatus,
        columnMapping: {
          "Vendor Name": "name",
          "Priority": "priority",
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
          "Existing account or trial": "existing_account",
          "Shows Per Year (2026)": "shows_per_year",
          "TSO Event Codes": "tso_event_codes",
          "Activities": "activities_notes",
        },
      });
    } catch (e: any) {
      res.status(500).json({ message: `Preview failed: ${e.message}` });
    }
  });

  // ─── Auto-import from bundled zip ────────────────────────────────────────────

  app.post("/api/import/tsos/auto", isAuthenticated, async (req, res) => {
    try {
      const zipPath = require("path").join(process.cwd(), "TSOMASTEROUTBOUND.zip");
      const fs = require("fs");
      if (!fs.existsSync(zipPath)) {
        return res.status(404).json({ message: "TSOMASTEROUTBOUND.zip not found in project root" });
      }

      const AdmZip = require("adm-zip");
      const zip = new AdmZip(zipPath);
      const innerZipBuf = zip.readFile("ExportBlock-75f77eaf-760c-44f4-88f3-a20ea7d1b998-Part-1.zip");
      const zip2 = new AdmZip(innerZipBuf);
      const csvName = "Private & Shared/Untitled 020c3b436e734aa4b8979b81b479d109_TSO Outbound CRM 439dc32017b7444eaf4b600f9d25963d.csv";
      const csvBuffer = zip2.readFile(csvName);
      if (!csvBuffer) return res.status(404).json({ message: "CSV not found inside zip" });

      let rows: Record<string, string>[];
      try {
        rows = csvParse(csvBuffer, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Record<string, string>[];
      } catch (e: any) {
        return res.status(400).json({ message: `CSV parse error: ${e.message}` });
      }

      rows = rows.filter(r => (r["Vendor Name"] || "").trim());
      let imported = 0, updated = 0, skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const vendorName = (row["Vendor Name"] || "").trim();
        if (!vendorName) continue;
        try {
          const followUpDate = parseFlexibleDate(row["Follow up date"]);
          const nextShowDate = parseFlexibleDate(row["Agreed / Next Show Date"]);
          const tsoData = {
            name: vendorName,
            priority: (row["Priority"] || "").trim() || undefined,
            relationshipStatus: mapCsvStatus((row["Status"] || "").trim()),
            notes: (row["Notes"] || "").trim() || undefined,
            email: (row["Contact Email"] || "").trim() || undefined,
            contactNumber: (row["Contact Number"] || "").trim() || undefined,
            igHandle: (row["IG Handle"] || "").trim() || undefined,
            linkedin: (row["Linkedin"] || "").trim() || undefined,
            mainContactName: (row["Contact Name / Role"] || "").trim() || undefined,
            sponsorInfo: (row["Sponsor Info"] || "").trim() || undefined,
            estAnnualReach: (row["Est. Annual Reach"] || "").trim() || undefined,
            profileLink: (row["Profile Link"] || "").trim() || undefined,
            existingAccount: (row["Existing account or trial"] || "").trim().toUpperCase() === "Y",
            showsPerYear: (row["Shows Per Year (2026)"] || "").trim() || undefined,
            tsoEventCodes: (row["TSO Event Codes"] || "").trim() || undefined,
            activitiesNotes: (row["Activities"] || "").trim() || undefined,
            followUpDate: followUpDate ? followUpDate.toISOString().split("T")[0] : undefined,
            nextShowDate: nextShowDate ? nextShowDate.toISOString().split("T")[0] : undefined,
          };
          const existing = await storage.findTsoByName(vendorName);
          if (existing) { await storage.updateTso(existing.id, tsoData); updated++; }
          else { await storage.createTso(tsoData); imported++; }
        } catch (e: any) {
          errors.push(`Row ${i + 2} (${vendorName}): ${e.message}`);
          skipped++;
        }
      }

      res.json({ success: true, imported, updated, skipped, total: rows.length, errors: errors.slice(0, 20) });
    } catch (e: any) {
      res.status(500).json({ message: `Auto-import failed: ${e.message}` });
    }
  });

  return httpServer;
}

// ─── Status mapping helper ────────────────────────────────────────────────────

function mapCsvStatus(raw: string): string {
  if (!raw) return "Cold Outreach";
  const s = raw.trim();
  // Direct matches first
  const direct: Record<string, string> = {
    "Confirmed": "Active Partner",
    "Negotiating": "In Conversation",
    "Details Received": "In Conversation",
    "Initial Response": "Initial Contact",
    "Info Requested": "Initial Contact",
    "Needs Promo Codes": "Active Partner",
    "Not Contacted": "Cold Outreach",
    "Attempt 1: Initial Comms Sent": "Contacted",
  };
  if (direct[s]) return direct[s];
  // Fuzzy
  const sl = s.toLowerCase();
  if (sl.includes("confirmed")) return "Active Partner";
  if (sl.includes("negotiat")) return "In Conversation";
  if (sl.includes("sponsoring")) return "Sponsoring";
  if (sl.includes("initial")) return "Initial Contact";
  if (sl.includes("attempt") || sl.includes("comms sent")) return "Contacted";
  if (sl.includes("details") || sl.includes("info")) return "Initial Contact";
  return s || "Cold Outreach";
}
