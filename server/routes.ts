import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, normalizeCompanyName } from "./storage";
import { mcpCors, mcpApiKeyGuard, mcpHandler, mcpSseHandler, mcpMessagesHandler } from "./mcp";
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
import AdmZip from "adm-zip";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Extracts CSV buffer from either a raw CSV file or a (possibly nested) ZIP file.
// For zips, finds the first .csv entry (prefers ones matching "outbound" or "tso").
// ─── Flexible column finder ───────────────────────────────────────────────────
// Tries a list of candidate column names and falls back to the first non-empty value.
function col(row: Record<string, string>, ...candidates: string[]): string {
  for (const c of candidates) {
    if (row[c]?.trim()) return row[c].trim();
  }
  return "";
}

// Find the TSO/vendor name from any CSV row regardless of column naming.
function findTsoName(row: Record<string, string>): string {
  const found = col(row,
    "Vendor Name", "Name", "TSO Name", "TSO", "Company", "Company Name",
    "Organization", "Organisation", "Business Name", "Title", "title",
  );
  if (found) return found;
  // Last resort: first column value
  const first = Object.values(row)[0];
  return (first || "").trim();
}

// Find the show name from any CSV row.
function findShowName(row: Record<string, string>): string {
  return col(row, "Show Name", "show_name", "Show", "Event", "Event Name", "Name", "Title") ||
    (Object.values(row)[0] || "").trim();
}

function extractCsvBuffer(fileBuffer: Buffer, originalName: string): Buffer {
  const isZip = originalName.toLowerCase().endsWith(".zip");
  if (!isZip) return fileBuffer;

  let zip: InstanceType<typeof AdmZip> = new AdmZip(fileBuffer);
  // Check for a nested zip (inner zip)
  const innerZipEntry = zip.getEntries().find(e => e.entryName.toLowerCase().endsWith(".zip"));
  if (innerZipEntry) {
    zip = new AdmZip(zip.readFile(innerZipEntry.entryName) as Buffer);
  }
  // Find best CSV: prefer one with "outbound" or "tso" in name
  const csvEntries = zip.getEntries().filter(e => e.entryName.toLowerCase().endsWith(".csv"));
  if (csvEntries.length === 0) throw new Error("No CSV file found inside zip");
  const preferred = csvEntries.find(e => {
    const n = e.entryName.toLowerCase();
    return n.includes("outbound") || n.includes("tso");
  }) || csvEntries[0];
  const buf = zip.readFile(preferred.entryName);
  if (!buf) throw new Error("Failed to read CSV from zip");
  return buf;
}

// Extracts all .md file entries from a zip (handling one level of nesting).
function extractMarkdownEntries(fileBuffer: Buffer, originalName: string): Array<{ entryName: string; content: string }> {
  if (!originalName.toLowerCase().endsWith(".zip")) return [];
  let zip = new AdmZip(fileBuffer);
  const innerZipEntry = zip.getEntries().find(e => e.entryName.toLowerCase().endsWith(".zip"));
  if (innerZipEntry) {
    zip = new AdmZip(zip.readFile(innerZipEntry.entryName) as Buffer);
  }
  return zip.getEntries()
    .filter(e => e.entryName.toLowerCase().endsWith(".md") && !e.isDirectory)
    .map(e => ({ entryName: e.entryName, content: e.getData().toString("utf8") }));
}

interface ParsedTsoMd {
  name?: string;
  contact_email?: string;
  contact_name?: string;
  est_annual_reach?: string;
  follow_up_date?: string;
  ig_handle?: string;
  linkedin?: string | null;
  notes?: string;
  priority?: string;
  profile_link?: string;
  shows_per_year?: string;
  status?: string;
}

function parseTSOMarkdown(content: string): ParsedTsoMd {
  const lines = content.split("\n");
  const data: ParsedTsoMd = {};

  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) data.name = headingMatch[1].trim();

  for (const line of lines) {
    const match = line.match(/^(.+?):\s*(.+)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim();
    switch (key) {
      case "Contact Email": data.contact_email = value; break;
      case "Contact Name / Role": data.contact_name = value; break;
      case "Est. Annual Reach": data.est_annual_reach = value; break;
      case "Follow up date": {
        const d = parseFlexibleDate(value);
        if (d) data.follow_up_date = d.toISOString().split("T")[0];
        break;
      }
      case "IG Handle": data.ig_handle = value; break;
      case "Linkedin": data.linkedin = value !== "None" ? value : null; break;
      case "Notes": data.notes = value; break;
      case "Priority": data.priority = value; break;
      case "Profile Link": data.profile_link = value; break;
      case "Shows Per Year (2026)": data.shows_per_year = value; break;
      case "Status": data.status = value; break;
    }
  }

  return data;
}

async function processMdEntries(
  entries: Array<{ entryName: string; content: string }>
): Promise<{ processed: number; matched: number; unmatched: number; errors: string[] }> {
  let processed = 0, matched = 0, unmatched = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    processed++;
    const parsed = parseTSOMarkdown(entry.content);
    if (!parsed.name) { unmatched++; continue; }

    const existing = await storage.findTsoByName(parsed.name);
    if (!existing) { unmatched++; continue; }

    matched++;
    const updates: Record<string, any> = {};

    if (!existing.email && parsed.contact_email) updates.email = parsed.contact_email;
    if (!existing.mainContactName && parsed.contact_name) updates.mainContactName = parsed.contact_name;
    if (!existing.estAnnualReach && parsed.est_annual_reach) updates.estAnnualReach = parsed.est_annual_reach;
    if (!existing.followUpDate && parsed.follow_up_date) updates.followUpDate = parsed.follow_up_date;
    if (!existing.igHandle && parsed.ig_handle) updates.igHandle = parsed.ig_handle;
    if (existing.linkedin == null && parsed.linkedin !== undefined) updates.linkedin = parsed.linkedin;
    if (!existing.priority && parsed.priority) updates.priority = parsed.priority;
    if (!existing.profileLink && parsed.profile_link) updates.profileLink = parsed.profile_link;
    if (!existing.showsPerYear && parsed.shows_per_year) updates.showsPerYear = parsed.shows_per_year;
    if (!existing.relationshipStatus && parsed.status) updates.relationshipStatus = mapCsvStatus(parsed.status);

    if (parsed.notes && !existing.notes?.includes(parsed.notes.trim())) {
      const existingNotes = existing.notes || "";
      updates.notes = existingNotes ? `${existingNotes}\n\n---\n\n${parsed.notes}` : parsed.notes;
    }

    if (Object.keys(updates).length > 0) {
      try {
        await storage.updateTso(existing.id, updates);
      } catch (e: any) {
        errors.push(`${parsed.name}: ${e.message}`);
        matched--;
      }
    }
  }

  return { processed, matched, unmatched, errors };
}

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

// Extracts the likely organiser name from a show name by stripping city/date/number suffixes.
function extractTsoNameFromShow(showName: string): string {
  return (showName
    .replace(/\s*\*FREE\*\s*$/i, "")                   // *FREE*
    .replace(/\s*[-–|]\s*[A-Z][A-Za-z ,&!0-9]*$/, "") // " - City/Location" or " | Date" suffix
    .replace(/\s*\((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^)]*\)/gi, "") // (Month...)
    .replace(/\s+#\d+\s*$/, "")                        // trailing "#N"
    .replace(/\s+\d{1,2}(st|nd|rd|th)?\s*$/, "")      // trailing ordinal / number
    .replace(/[⭐🔥!]+\s*$/, "")                       // trailing emoji/punctuation
    .trim()) || showName;
}

// Tries to match a show name to an existing TSO using progressive fuzzy matching.
function matchShowToTso(showName: string, allTsos: { id: string; name: string }[]): { id: string; name: string } | null {
  const norm = normalizeCompanyName;

  // Build candidate names to try (most-specific first)
  const candidates = Array.from(new Set([
    showName,
    extractTsoNameFromShow(showName),
    showName.replace(/\s*[-–]\s*.+$/, "").trim(),   // everything after " - "
    showName.replace(/\s*\([^)]+\)\s*$/, "").trim(), // strip trailing "(…)"
    showName.replace(/\s+#\d+\s*$/, "").trim(),
    showName.replace(/\s+\d+\s*$/, "").trim(),
  ].filter(Boolean)));

  for (const candidate of candidates) {
    const n = norm(candidate);
    const match = allTsos.find(t => norm(t.name) === n);
    if (match) return match;
  }

  // Partial prefix / contains match
  const showNorm = norm(showName);
  return allTsos.find(t => {
    const tsoNorm = norm(t.name);
    if (tsoNorm.length < 5) return false;
    return showNorm.startsWith(tsoNorm) || tsoNorm.startsWith(showNorm) ||
           showNorm.includes(tsoNorm) || tsoNorm.includes(showNorm);
  }) || null;
}

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
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.json({ message: "Login successful", username: user.username });
      });
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

  // ─── MCP ──────────────────────────────────────────────────────────────────
  // ── MCP streamable-HTTP transport (POST + GET /mcp) ────────────────────────
  app.options("/mcp", mcpCors);
  app.post("/mcp", mcpCors, mcpApiKeyGuard, mcpHandler);
  app.get("/mcp", mcpCors, mcpApiKeyGuard, mcpHandler);

  // ── MCP SSE transport (GET /mcp/sse + POST /mcp/messages) ──────────────────
  // API key accepted as X-Api-Key header OR ?key=... query param.
  app.options("/mcp/sse", mcpCors);
  app.get("/mcp/sse", mcpCors, mcpApiKeyGuard, mcpSseHandler);
  app.options("/mcp/messages", mcpCors);
  app.post("/mcp/messages", mcpCors, mcpApiKeyGuard, mcpMessagesHandler);

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
    const parsed = insertTsoSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid fields", errors: parsed.error.flatten() });
    try {
      const tso = await storage.updateTso((req.params.id as string), parsed.data);
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
    const parsed = insertActivitySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid fields", errors: parsed.error.flatten() });
    try {
      const act = await storage.updateActivity((req.params.id as string), parsed.data);
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
    const parsed = insertContactSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid fields", errors: parsed.error.flatten() });
    try {
      const contact = await storage.updateContact((req.params.id as string), parsed.data);
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

  // ─── TSO Shows (per TSO) ──────────────────────────────────────────────────

  app.get("/api/tsos/:id/shows", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.getShows((req.params.id as string));
      res.json(result);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch shows" });
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
    const parsed = insertShowSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid fields", errors: parsed.error.flatten() });
    try {
      const show = await storage.updateShow((req.params.id as string), parsed.data);
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

  // ─── Show → TSO re-linking ─────────────────────────────────────────────────

  app.post("/api/shows/relink-tsos", isAuthenticated, async (req, res) => {
    try {
      const createMissing = req.body.createMissing !== false; // default true
      const allShows = await storage.getShows();
      const unlinked = allShows.filter(s => !s.tsoId);
      const allTsos = await storage.getTsos();

      let linked = 0, created = 0, unmatched = 0;
      const unmatchedNames: string[] = [];

      for (const show of unlinked) {
        const match = matchShowToTso(show.showName, allTsos);
        if (match) {
          await storage.updateShow(show.id, { tsoId: match.id });
          linked++;
        } else if (createMissing) {
          const tsoName = extractTsoNameFromShow(show.showName);
          // Don't create if we already have a TSO with this extracted name
          const existingByExtracted = matchShowToTso(tsoName, allTsos);
          if (existingByExtracted) {
            await storage.updateShow(show.id, { tsoId: existingByExtracted.id });
            linked++;
          } else {
            const newTso = await storage.createTso({ name: tsoName, relationshipStatus: "Cold Outreach" });
            await storage.updateShow(show.id, { tsoId: newTso.id });
            allTsos.push(newTso); // keep local list up-to-date for subsequent iterations
            created++;
          }
        } else {
          unmatched++;
          if (unmatchedNames.length < 20) unmatchedNames.push(show.showName);
        }
      }

      res.json({ success: true, linked, created, unmatched, total: unlinked.length, unmatchedNames });
    } catch (e: any) {
      res.status(500).json({ message: `Relink failed: ${e.message}` });
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
    const parsed = insertTaskSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid fields", errors: parsed.error.flatten() });
    try {
      const task = await storage.updateTask((req.params.id as string), parsed.data);
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

      let csvBuf: Buffer;
      try {
        csvBuf = extractCsvBuffer(req.file.buffer, req.file.originalname);
      } catch (e: any) {
        return res.status(400).json({ message: e.message });
      }

      let rows: Record<string, string>[];
      try {
        rows = csvParse(csvBuf, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true,
        }) as Record<string, string>[];
      } catch (e: any) {
        return res.status(400).json({ message: `Invalid CSV: ${e.message}` });
      }

      // Filter out blank rows
      rows = rows.filter(r => findTsoName(r));

      const dryRun = req.body.dryRun === "true" || req.query.dryRun === "true";
      const results: any[] = [];
      let imported = 0, skipped = 0, updated = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const vendorName = findTsoName(row);
        if (!vendorName) continue;

        try {
          // Parse dates — try multiple column name variants
          const followUpDate = parseFlexibleDate(col(row, "Follow up date", "Follow Up Date", "Follow-up Date", "Followup Date", "follow_up_date"));
          const nextShowDate = parseFlexibleDate(col(row, "Agreed / Next Show Date", "Next Show Date", "next_show_date", "Show Date", "Date"));

          // Parse contact name/role
          const contactRaw = col(row, "Contact Name / Role", "Contact Name", "Contact", "contact_name", "Main Contact");

          // Parse existing account boolean
          const existingAccount = col(row, "Existing account or trial", "Existing Account", "existing_account").toUpperCase() === "Y";

          // Parse shows per year
          const showsPerYear = col(row, "Shows Per Year (2026)", "Shows Per Year", "shows_per_year", "Shows/Year") || undefined;

          // Priority
          const priority = col(row, "Priority", "priority") || undefined;

          // Status
          const statusRaw = col(row, "Status", "Relationship Status", "status");
          const relationshipStatus = mapCsvStatus(statusRaw);

          const tsoData = {
            name: vendorName,
            priority,
            relationshipStatus,
            notes: col(row, "Notes", "notes", "Note") || undefined,
            email: col(row, "Contact Email", "Email", "email", "contact_email") || undefined,
            phone: col(row, "Phone", "phone", "Phone Number", "Contact Number", "contact_number") || undefined,
            contactNumber: col(row, "Contact Number", "contact_number", "Phone", "phone") || undefined,
            igHandle: col(row, "IG Handle", "ig_handle", "Instagram", "Instagram Handle") || undefined,
            linkedin: col(row, "Linkedin", "LinkedIn", "linkedin") || undefined,
            mainContactName: contactRaw || undefined,
            city: col(row, "City", "city", "Location", "location") || undefined,
            website: col(row, "Website", "website", "URL", "url") || undefined,
            sponsorInfo: col(row, "Sponsor Info", "sponsor_info", "Sponsorship Info") || undefined,
            estAnnualReach: col(row, "Est. Annual Reach", "Annual Reach", "est_annual_reach") || undefined,
            profileLink: col(row, "Profile Link", "profile_link", "Profile URL") || undefined,
            existingAccount,
            showsPerYear,
            tsoEventCodes: col(row, "TSO Event Codes", "tso_event_codes", "Event Codes") || undefined,
            activitiesNotes: col(row, "Activities", "activities_notes", "Activity Notes") || undefined,
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

      // ── Markdown enrichment (only on real import, not dry-run) ─────────────
      let mdResult: { processed: number; matched: number; unmatched: number; errors: string[] } | undefined;
      if (!dryRun) {
        const mdEntries = extractMarkdownEntries(req.file.buffer, req.file.originalname);
        if (mdEntries.length > 0) {
          mdResult = await processMdEntries(mdEntries);
        }
      }

      res.json({
        success: true,
        dryRun,
        csv_import: { imported, updated, skipped, total: rows.length, errors: errors.slice(0, 30) },
        markdown_import: mdResult ?? null,
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

      let csvBuf: Buffer;
      try {
        csvBuf = extractCsvBuffer(req.file.buffer, req.file.originalname);
      } catch (e: any) {
        return res.status(400).json({ message: e.message });
      }

      let rows: Record<string, string>[];
      try {
        rows = csvParse(csvBuf, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Record<string, string>[];
      } catch (e: any) {
        return res.status(400).json({ message: `Invalid CSV: ${e.message}` });
      }

      rows = rows.filter(r => findTsoName(r));
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      const preview = rows.slice(0, 8);

      // Check which TSOs already exist
      const previewWithStatus = await Promise.all(preview.map(async row => {
        const name = findTsoName(row);
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

  // ─── Import: Shows CSV (with TSO matching + dry-run) ─────────────────────────

  app.post("/api/import/shows/preview", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      let csvBuf: Buffer;
      try {
        csvBuf = extractCsvBuffer(req.file.buffer, req.file.originalname);
      } catch (e: any) {
        return res.status(400).json({ message: e.message });
      }
      let rows: Record<string, string>[];
      try {
        rows = csvParse(csvBuf, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Record<string, string>[];
      } catch (e: any) {
        return res.status(400).json({ message: `Invalid CSV: ${e.message}` });
      }
      rows = rows.filter(r => findShowName(r));
      const allTsos = await storage.getTsos();
      const preview = await Promise.all(rows.slice(0, 20).map(async row => {
        const showName = findShowName(row);
        const csvTso = col(row, "TSO", "tso", "Organizer", "Organiser", "TSO Name", "Vendor");
        const { name: tsoName } = parseTsoName(csvTso);
        // Try matching
        let matchedTso: typeof allTsos[0] | undefined;
        let matchType: "exact" | "partial" | "none" = "none";
        if (tsoName) {
          const cleanName = tsoName.toLowerCase();
          matchedTso = allTsos.find(t => t.name.toLowerCase() === cleanName);
          if (matchedTso) {
            matchType = "exact";
          } else {
            matchedTso = allTsos.find(t => {
              const tl = t.name.toLowerCase();
              return tl.includes(cleanName) || cleanName.includes(tl);
            });
            if (matchedTso) matchType = "partial";
          }
        }
        return {
          showName,
          csvTso: csvTso || "—",
          matchedTsoName: matchedTso?.name || "—",
          matchedTsoId: matchedTso?.id || null,
          matchType,
          date: row["Date"] || row["date"] || "",
          city: row["City"] || row["city"] || "",
          status: row["Status"] || row["status"] || "",
        };
      }));
      res.json({ totalRows: rows.length, preview });
    } catch (e: any) {
      res.status(500).json({ message: `Preview failed: ${e.message}` });
    }
  });

  app.post("/api/import/shows", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      let csvBuf: Buffer;
      try {
        csvBuf = extractCsvBuffer(req.file.buffer, req.file.originalname);
      } catch (e: any) {
        return res.status(400).json({ message: e.message });
      }
      let rows: Record<string, string>[];
      try {
        rows = csvParse(csvBuf, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Record<string, string>[];
      } catch (e: any) {
        return res.status(400).json({ message: `Invalid CSV: ${e.message}` });
      }
      rows = rows.filter(r => findShowName(r));
      const dryRun = req.query.dryRun === "true";
      const allTsos = await storage.getTsos();
      let imported = 0, linked = 0, unlinked = 0;
      const unlinkedShows: string[] = [];
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const showName = findShowName(row);
        if (!showName) continue;
        try {
          const csvTso = col(row, "TSO", "tso", "Organizer", "Organiser", "TSO Name", "Vendor");
          const { name: tsoName } = parseTsoName(csvTso);
          let tsoId: string | undefined;
          if (tsoName) {
            const cleanName = tsoName.toLowerCase();
            let match = allTsos.find(t => t.name.toLowerCase() === cleanName);
            if (!match) {
              match = allTsos.find(t => {
                const tl = t.name.toLowerCase();
                return tl.includes(cleanName) || cleanName.includes(tl);
              });
            }
            tsoId = match?.id;
          }
          if (tsoId) linked++; else unlinked++;
          if (tsoId === undefined && unlinkedShows.length < 20) unlinkedShows.push(showName);
          const showDate = parseFlexibleDate(col(row, "Date", "Show Date", "Event Date", "date"));
          const nextFollowup = parseFlexibleDate(col(row, "Next Follow-Up", "next_followup", "Next Followup", "Follow Up Date"));
          if (!dryRun) {
            await storage.createShow({
              showName,
              tsoId: tsoId || undefined,
              showDate: showDate ? showDate.toISOString().split("T")[0] : undefined,
              city: col(row, "City", "city", "Location", "location") || undefined,
              venue: col(row, "Venue", "venue", "Venue Name") || undefined,
              status: mapShowStatus(col(row, "Status", "status")),
              nextFollowupDate: nextFollowup ? nextFollowup.toISOString().split("T")[0] : undefined,
              attendingTso: col(row, "Attending TSO", "attending_tso") || undefined,
              notes: col(row, "Notes", "notes", "Note") || undefined,
            });
          }
          imported++;
        } catch (rowErr: any) {
          errors.push(`Row ${i + 2}: ${rowErr.message}`);
        }
      }

      if (!dryRun) {
        await storage.createCsvImport({
          fileName: req.file.originalname,
          importedCount: imported,
          updatedCount: 0,
          skippedCount: errors.length,
        });
      }

      res.json({
        success: true,
        dryRun,
        imported,
        linked,
        unlinked,
        unlinkedShows,
        total: rows.length,
        errors: errors.slice(0, 20),
      });
    } catch (e: any) {
      res.status(500).json({ message: `Import failed: ${e.message}` });
    }
  });

  // ─── Import: Shows with Notes (zip containing CSV + markdown files) ──────────

  async function processShowsZip(buf: Buffer): Promise<{
    csvRows: number; mdFiles: number; total: number;
    imported: number; updated: number; linked: number; unlinked: number;
    unlinkedShows: string[]; errors: string[];
    dryRun: boolean;
  }> {
    
    const zip1 = new AdmZip(buf);

    // Detect inner zip or use directly
    let zip2: any = zip1;
    const innerZipEntry = zip1.getEntries().find((e: any) => e.entryName.endsWith(".zip"));
    if (innerZipEntry) {
      zip2 = new AdmZip(zip1.readFile(innerZipEntry.entryName) as Buffer);
    }

    const entries: any[] = zip2.getEntries();
    let csvAllBuf: Buffer | null = null;
    let csvMainBuf: Buffer | null = null;
    const mdFiles: Array<{ filename: string; content: string }> = [];

    for (const entry of entries) {
      const n = entry.entryName as string;
      if (n.endsWith("_all.csv")) csvAllBuf = zip2.readFile(entry.entryName);
      else if (n.endsWith(".csv")) csvMainBuf = zip2.readFile(entry.entryName);
      else if (n.endsWith(".md")) {
        mdFiles.push({
          filename: n.split("/").pop()!,
          content: zip2.readAsText(entry),
        });
      }
    }

    const primaryCsvBuf = csvAllBuf || csvMainBuf;
    let csvRows: Record<string, string>[] = [];
    if (primaryCsvBuf) {
      csvRows = (csvParse(primaryCsvBuf, {
        columns: true, skip_empty_lines: true, trim: true, bom: true,
      }) as Record<string, string>[]).filter(r => (r["Show Name"] || "").trim());
    }

    // Parse markdown files: extract structured key:value fields
    function parseMdFields(content: string): Record<string, string> {
      const fields: Record<string, string> = {};
      for (const line of content.split("\n")) {
        const l = line.trim();
        if (l.startsWith("# ")) { fields["Show Name"] = l.slice(2).trim(); continue; }
        const m = l.match(/^([A-Za-z ]+):\s*(.+)$/);
        if (m) fields[m[1].trim()] = m[2].trim();
      }
      return fields;
    }

    function getMdBaseName(filename: string): string {
      return filename.replace(/\s+[a-f0-9]{32}\.md$/i, "").replace(/\.md$/i, "").trim();
    }

    function normalizeShow(name: string): string {
      return name.trim().toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ").trim();
    }

    // Build show map from CSV (keyed by normalized name)
    const showMap = new Map<string, Record<string, string>>();
    for (const row of csvRows) {
      const name = (row["Show Name"] || "").trim();
      if (name) showMap.set(normalizeShow(name), { ...row });
    }

    // Merge markdown fields into CSV rows (fill gaps), add md-only shows
    for (const md of mdFiles) {
      const parsed = parseMdFields(md.content);
      const mdName = (parsed["Show Name"] || getMdBaseName(md.filename)).trim();
      const key = normalizeShow(mdName);

      if (showMap.has(key)) {
        const existing = showMap.get(key)!;
        if (!existing["Venue"] && parsed["Venue"]) existing["Venue"] = parsed["Venue"];
        if (!existing["Status"] && parsed["Status"]) existing["Status"] = parsed["Status"];
        if (!existing["City"] && parsed["City"]) existing["City"] = parsed["City"];
        if (!existing["Text"] && parsed["Text"]) existing["Text"] = parsed["Text"];
      } else {
        // Show exists only in markdown — add it
        showMap.set(key, {
          "Show Name": mdName,
          "City": parsed["City"] || "",
          "Date": parsed["Date"] || "",
          "Status": parsed["Status"] || "",
          "TSO": parsed["TSO"] || "",
          "Venue": parsed["Venue"] || "",
          "TSO ON MAIN CRM": parsed["TSO ON MAIN CRM"] || "",
          "Text": parsed["Text"] || "",
        });
      }
    }

    // Get all TSOs for matching
    const allTsos = await storage.getTsos();
    function matchTso(csvTsoName: string): string | undefined {
      if (!csvTsoName) return undefined;
      const { name: tsoName } = parseTsoName(csvTsoName);
      if (!tsoName) return undefined;
      const cleanName = tsoName.toLowerCase().replace(/[_\s]+/g, " ").trim();
      let match = allTsos.find(t =>
        t.name.toLowerCase().replace(/[_\s]+/g, " ").trim() === cleanName
      );
      if (!match) {
        match = allTsos.find(t => {
          const tl = t.name.toLowerCase().replace(/[_\s]+/g, " ").trim();
          return tl.includes(cleanName) || cleanName.includes(tl);
        });
      }
      return match?.id;
    }

    let imported = 0, updated = 0, linked = 0, unlinked = 0;
    const unlinkedShows: string[] = [];
    const errors: string[] = [];

    for (const [, row] of Array.from(showMap)) {
      const showName = (row["Show Name"] || "").trim();
      if (!showName) continue;
      try {
        const tsoId = matchTso(row["TSO"] || "");
        if (tsoId) linked++; else {
          unlinked++;
          if (unlinkedShows.length < 30) unlinkedShows.push(showName);
        }

        const showDate = parseFlexibleDate(row["Date"] || "");
        const nextFollowup = parseFlexibleDate(row["Next Follow-Up"] || row["Next Followup"] || "");
        const notes = row["Text"] ? row["Text"].trim() || undefined : undefined;

        const existing = await storage.findShowByName(showName);
        if (existing) {
          await storage.updateShow(existing.id, {
            ...(row["City"] && !existing.city ? { city: row["City"] } : {}),
            ...(row["Venue"] && !existing.venue ? { venue: row["Venue"] } : {}),
            ...(row["Status"] && !existing.status ? { status: mapShowStatus(row["Status"]) } : {}),
            ...(notes && !existing.notes ? { notes } : {}),
            ...(tsoId && !existing.tsoId ? { tsoId } : {}),
          });
          updated++;
        } else {
          await storage.createShow({
            showName,
            tsoId: tsoId || undefined,
            showDate: showDate ? showDate.toISOString().split("T")[0] : undefined,
            city: row["City"] || undefined,
            venue: row["Venue"] || undefined,
            status: mapShowStatus(row["Status"] || ""),
            nextFollowupDate: nextFollowup ? nextFollowup.toISOString().split("T")[0] : undefined,
            attendingTso: row["Attending TSO"] || undefined,
            notes: notes || undefined,
          });
          imported++;
        }
      } catch (e: any) {
        errors.push(`${showName}: ${e.message}`);
      }
    }

    return {
      csvRows: csvRows.length, mdFiles: mdFiles.length, total: showMap.size,
      imported, updated, linked, unlinked, unlinkedShows, errors,
      dryRun: false,
    };
  }

  app.post("/api/import/shows-with-notes", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const result = await processShowsZip(req.file.buffer);
      await storage.createCsvImport({
        fileName: req.file.originalname,
        importedCount: result.imported,
        updatedCount: result.updated,
        skippedCount: result.errors.length,
      });
      res.json({ success: true, ...result, errors: result.errors.slice(0, 20) });
    } catch (e: any) {
      res.status(500).json({ message: `Import failed: ${e.message}` });
    }
  });

  app.post("/api/import/shows-with-notes/preview", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      
      const zip1 = new AdmZip(req.file.buffer);
      let zip2: any = zip1;
      const innerZipEntry = zip1.getEntries().find((e: any) => e.entryName.endsWith(".zip"));
      if (innerZipEntry) zip2 = new AdmZip(zip1.readFile(innerZipEntry.entryName) as Buffer);
      const entries: any[] = zip2.getEntries();
      let csvCount = 0, mdCount = 0, csvRows = 0;
      for (const entry of entries) {
        const n = entry.entryName as string;
        if (n.endsWith(".csv")) {
          csvCount++;
          try {
            const rows = csvParse(zip2.readFile(entry.entryName), { columns: true, skip_empty_lines: true, trim: true, bom: true }) as any[];
            csvRows = Math.max(csvRows, rows.filter((r: any) => (r["Show Name"] || "").trim()).length);
          } catch {}
        } else if (n.endsWith(".md")) mdCount++;
      }
      const allTsos = await storage.getTsos();
      res.json({ csvFiles: csvCount, csvRows, mdFiles: mdCount, tsoCount: allTsos.length });
    } catch (e: any) {
      res.status(500).json({ message: `Preview failed: ${e.message}` });
    }
  });

  app.post("/api/import/shows-with-notes/auto", isAuthenticated, async (req, res) => {
    try {
      
      
      const zipPath = join(process.cwd(), "TSO Shows new.zip");
      if (!existsSync(zipPath)) {
        return res.status(404).json({ message: "TSO Shows new.zip not found in project root" });
      }
      const buf = readFileSync(zipPath);
      const result = await processShowsZip(buf);
      await storage.createCsvImport({
        fileName: "TSO Shows new.zip (auto)",
        importedCount: result.imported,
        updatedCount: result.updated,
        skippedCount: result.errors.length,
      });
      res.json({ success: true, ...result, errors: result.errors.slice(0, 20) });
    } catch (e: any) {
      res.status(500).json({ message: `Auto-import failed: ${e.message}` });
    }
  });

  // ─── Auto-import from bundled zip ────────────────────────────────────────────

  app.post("/api/import/tsos/auto", isAuthenticated, async (req, res) => {
    try {
      const zipPath = join(process.cwd(), "TSOMASTEROUTBOUND.zip");
      
      if (!existsSync(zipPath)) {
        return res.status(404).json({ message: "TSOMASTEROUTBOUND.zip not found in project root" });
      }

      
      const zip = new AdmZip(zipPath);
      const innerZipBuf = zip.readFile("ExportBlock-75f77eaf-760c-44f4-88f3-a20ea7d1b998-Part-1.zip");
      const zip2 = new AdmZip(innerZipBuf as Buffer);
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

      // ── Markdown enrichment ──────────────────────────────────────────────────
      const mdEntries = zip2.getEntries()
        .filter(e => e.entryName.toLowerCase().endsWith(".md") && !e.isDirectory)
        .map(e => ({ entryName: e.entryName, content: e.getData().toString("utf8") }));

      let mdResult: { processed: number; matched: number; unmatched: number; errors: string[] } | undefined;
      if (mdEntries.length > 0) {
        mdResult = await processMdEntries(mdEntries);
      }

      res.json({
        success: true,
        csv_import: { imported, updated, skipped, total: rows.length, errors: errors.slice(0, 20) },
        markdown_import: mdResult ?? null,
      });
    } catch (e: any) {
      res.status(500).json({ message: `Auto-import failed: ${e.message}` });
    }
  });

  // ─── Full migration: accepts 3 file uploads ───────────────────────────────────
  //
  // POST /api/import/full-migration  (multipart/form-data)
  //   tsoZip   — tso outbound final.zip  → TSOs CSV + MD notes
  //   showsZip — tsoshows.zip            → Shows CSV + MD notes
  //   xlsx     — Condensed info.xlsx     → Tasks, TSO enrichment
  //
  // Merge strategy (never overwrites existing data):
  //   - TSOs: create if new; if exists, only fill fields that are currently null/empty
  //   - Shows: merge-only (city/venue/status/notes only filled if empty)
  //   - Tasks: dedup by title — skip if same title already exists for that TSO
  //   - TSO enrichment: only fills empty fields
  //
  const migrationUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

  app.post(
    "/api/import/full-migration",
    isAuthenticated,
    migrationUpload.fields([
      { name: "tsoZip",   maxCount: 1 },
      { name: "showsZip", maxCount: 1 },
      { name: "xlsx",     maxCount: 1 },
    ]),
    async (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const tsoZipBuf   = files?.tsoZip?.[0]?.buffer;
    const showsZipBuf = files?.showsZip?.[0]?.buffer;
    const xlsxBuf     = files?.xlsx?.[0]?.buffer;

    const missing: string[] = [];
    if (!tsoZipBuf)   missing.push("tsoZip (TSO outbound zip)");
    if (!showsZipBuf) missing.push("showsZip (Shows zip)");
    if (!xlsxBuf)     missing.push("xlsx (Condensed info Excel)");
    if (missing.length > 0) {
      return res.status(400).json({ message: "Missing required files", missing });
    }

    const report: Record<string, any> = {};
    const allErrors: string[] = [];

    // ── 1. TSOs from tso outbound zip ──────────────────────────────────────
    try {
      const outerZip = new AdmZip(tsoZipBuf);
      const innerEntry = outerZip.getEntries().find(e => e.entryName.toLowerCase().endsWith(".zip"));
      const innerZip = innerEntry
        ? new AdmZip(outerZip.readFile(innerEntry.entryName) as Buffer)
        : outerZip;

      // Find CSV (prefer non-_all.csv)
      const csvEntries = innerZip.getEntries().filter(e => e.entryName.toLowerCase().endsWith(".csv"));
      const csvEntry = csvEntries.find(e => !e.entryName.endsWith("_all.csv")) || csvEntries[0];
      if (!csvEntry) throw new Error("No CSV found inside tso outbound final.zip");

      const csvBuf = innerZip.readFile(csvEntry.entryName)!;
      let tsoRows: Record<string, string>[] = (csvParse(csvBuf, {
        columns: true, skip_empty_lines: true, trim: true, bom: true,
      }) as Record<string, string>[]).filter(r => (r["Vendor Name"] || "").trim());

      let tsoImported = 0, tsoUpdated = 0, tsoSkipped = 0;
      const tsoErrors: string[] = [];

      for (let i = 0; i < tsoRows.length; i++) {
        const row = tsoRows[i];
        const name = (row["Vendor Name"] || "").trim();
        if (!name) continue;
        try {
          const followUpDate = parseFlexibleDate(row["Follow up date"]);
          const nextShowDate = parseFlexibleDate(row["Agreed / Next Show Date"]);
          const incoming = {
            name,
            priority:            (row["Priority"] || "").trim() || null,
            relationshipStatus:  (row["Status"] || "").trim() || null,
            notes:               (row["Notes"] || "").trim() || null,
            email:               (row["Contact Email"] || "").trim() || null,
            phone:               (row["Contact Number"] || "").trim() || null,
            igHandle:            (row["IG Handle"] || "").trim() || null,
            linkedin:            (row["Linkedin"] || "").trim() || null,
            mainContactName:     (row["Contact Name / Role"] || "").trim() || null,
            sponsorInfo:         (row["Sponsor Info"] || "").trim() || null,
            estAnnualReach:      (row["Est. Annual Reach"] || "").trim() || null,
            profileLink:         (row["Profile Link"] || "").trim() || null,
            existingAccount:     (row["Existing account or trial"] || "").trim().toUpperCase() === "Y",
            showsPerYear:        (row["Shows Per Year (2026)"] || "").trim() || null,
            tsoEventCodes:       (row["TSO Event Codes"] || "").trim() || null,
            activitiesNotes:     (row["Activities"] || "").trim() || null,
            followUpDate:        followUpDate ? followUpDate.toISOString().split("T")[0] : null,
            nextShowDate:        nextShowDate ? nextShowDate.toISOString().split("T")[0] : null,
          };

          const existing = await storage.findTsoByName(name);
          if (existing) {
            // Merge-only: only set fields that are currently null/empty
            const updates: Record<string, any> = {};
            if (!existing.priority          && incoming.priority)          updates.priority          = incoming.priority;
            if (!existing.relationshipStatus && incoming.relationshipStatus) updates.relationshipStatus = incoming.relationshipStatus;
            if (!existing.email             && incoming.email)             updates.email             = incoming.email;
            if (!existing.phone             && incoming.phone)             updates.phone             = incoming.phone;
            if (!existing.igHandle          && incoming.igHandle)          updates.igHandle          = incoming.igHandle;
            if (!existing.linkedin          && incoming.linkedin)          updates.linkedin          = incoming.linkedin;
            if (!existing.mainContactName   && incoming.mainContactName)   updates.mainContactName   = incoming.mainContactName;
            if (!existing.sponsorInfo       && incoming.sponsorInfo)       updates.sponsorInfo       = incoming.sponsorInfo;
            if (!existing.estAnnualReach    && incoming.estAnnualReach)    updates.estAnnualReach    = incoming.estAnnualReach;
            if (!existing.profileLink       && incoming.profileLink)       updates.profileLink       = incoming.profileLink;
            if (!existing.existingAccount   && incoming.existingAccount)   updates.existingAccount   = incoming.existingAccount;
            if (!existing.showsPerYear      && incoming.showsPerYear)      updates.showsPerYear      = incoming.showsPerYear;
            if (!existing.tsoEventCodes     && incoming.tsoEventCodes)     updates.tsoEventCodes     = incoming.tsoEventCodes;
            if (!existing.activitiesNotes   && incoming.activitiesNotes)   updates.activitiesNotes   = incoming.activitiesNotes;
            if (!existing.followUpDate      && incoming.followUpDate)      updates.followUpDate      = incoming.followUpDate;
            if (!existing.nextShowDate      && incoming.nextShowDate)      updates.nextShowDate      = incoming.nextShowDate;
            // Notes: append new content if not already present
            if (incoming.notes) {
              if (!existing.notes) {
                updates.notes = incoming.notes;
              } else if (!existing.notes.includes(incoming.notes.substring(0, 40))) {
                updates.notes = existing.notes + "\n\n---\n\n" + incoming.notes;
              }
            }
            if (Object.keys(updates).length > 0) {
              await storage.updateTso(existing.id, updates as any);
              tsoUpdated++;
            } else {
              tsoSkipped++;
            }
          } else {
            await storage.createTso({
              name: incoming.name,
              priority:          incoming.priority ?? undefined,
              relationshipStatus: incoming.relationshipStatus ?? undefined,
              notes:             incoming.notes ?? undefined,
              email:             incoming.email ?? undefined,
              phone:             incoming.phone ?? undefined,
              igHandle:          incoming.igHandle ?? undefined,
              linkedin:          incoming.linkedin ?? undefined,
              mainContactName:   incoming.mainContactName ?? undefined,
              sponsorInfo:       incoming.sponsorInfo ?? undefined,
              estAnnualReach:    incoming.estAnnualReach ?? undefined,
              profileLink:       incoming.profileLink ?? undefined,
              existingAccount:   incoming.existingAccount,
              showsPerYear:      incoming.showsPerYear ?? undefined,
              tsoEventCodes:     incoming.tsoEventCodes ?? undefined,
              activitiesNotes:   incoming.activitiesNotes ?? undefined,
              followUpDate:      incoming.followUpDate ?? undefined,
              nextShowDate:      incoming.nextShowDate ?? undefined,
            } as any);
            tsoImported++;
          }
        } catch (e: any) {
          tsoErrors.push(`TSO row ${i + 2} (${name}): ${e.message}`);
        }
      }

      // MD enrichment — uses existing merge-only processMdEntries
      const mdEntries = innerZip.getEntries()
        .filter(e => e.entryName.toLowerCase().endsWith(".md") && !e.isDirectory && e.getData().length > 10)
        .map(e => ({ entryName: e.entryName, content: e.getData().toString("utf8") }));
      const mdResult = mdEntries.length > 0 ? await processMdEntries(mdEntries) : null;

      report.tso_csv = { total: tsoRows.length, imported: tsoImported, updated: tsoUpdated, skipped: tsoSkipped, errors: tsoErrors };
      report.tso_md  = mdResult ?? { processed: 0, matched: 0, unmatched: 0, errors: [] };
      allErrors.push(...tsoErrors);
    } catch (e: any) {
      report.tso_csv = { error: e.message };
      allErrors.push(`TSO zip: ${e.message}`);
    }

    // ── 2. Shows from tsoshows.zip ──────────────────────────────────────────
    try {
      const showResult = await processShowsZip(showsZipBuf!);
      report.shows = showResult;
      allErrors.push(...showResult.errors);
    } catch (e: any) {
      report.shows = { error: e.message };
      allErrors.push(`Shows zip: ${e.message}`);
    }

    // ── 3. Excel enrichment from Condensed info.xlsx ────────────────────────
    try {
      const wb = XLSX.read(xlsxBuf, { type: "buffer" });
      const xlsxErrors: string[] = [];
      let tasksCreated = 0, tasksSkipped = 0;
      let tsoEnriched = 0;

      // ── 3a. Actions Now → Tasks ──────────────────────────────────────────
      const actionsSheet = wb.Sheets["🚨 Actions Now"];
      if (actionsSheet) {
        const actionsRows = XLSX.utils.sheet_to_json(actionsSheet, { defval: "" }) as Record<string, string>[];
        const existingTasks = await storage.getTasks();
        const existingTitles = new Set(existingTasks.map(t => t.title.toLowerCase().trim()));

        for (const row of actionsRows) {
          const title = (row["Action"] || "").toString().trim();
          if (!title) continue;
          if (existingTitles.has(title.toLowerCase())) { tasksSkipped++; continue; }

          try {
            const rawTso = (row["TSO"] || "").toString().trim();
            const { name: tsoName } = parseTsoName(rawTso);
            const tso = tsoName ? await storage.findTsoByName(tsoName) : null;
            const dueDate = parseFlexibleDate((row["Deadline"] || "").toString());
            const rawPriority = (row["#"] || "").toString();
            const priority = mapPriority(rawPriority);
            const notes = [
              row["Notes"] ? `Notes: ${row["Notes"]}` : "",
              row["Owner"] ? `Owner: ${row["Owner"]}` : "",
              row["Status"] ? `Status: ${row["Status"]}` : "",
            ].filter(Boolean).join("\n");

            await storage.createTask({
              title,
              tsoId:    tso?.id ?? undefined,
              priority,
              status:   "To Do",
              owner:    (row["Owner"] || "").toString().trim() || undefined,
              notes:    notes || undefined,
              dueDate:  dueDate ?? undefined,
              taskType: "Action",
            } as any);
            existingTitles.add(title.toLowerCase());
            tasksCreated++;
          } catch (e: any) {
            xlsxErrors.push(`Task "${title}": ${e.message}`);
          }
        }
      }

      // ── 3b. Full Pipeline → enrich TSOs ─────────────────────────────────
      const pipelineSheet = wb.Sheets["📊 Full Pipeline"];
      if (pipelineSheet) {
        const pipelineRows = XLSX.utils.sheet_to_json(pipelineSheet, { defval: "" }) as Record<string, any>[];
        for (const row of pipelineRows) {
          const rawTso = (row["TSO"] || "").toString().trim();
          if (!rawTso || rawTso === "TSO") continue;
          const { name: tsoName } = parseTsoName(rawTso);
          if (!tsoName) continue;
          const existing = await storage.findTsoByName(tsoName);
          if (!existing) continue;

          const updates: Record<string, any> = {};
          const region   = (row["Region"] || "").toString().trim();
          const keyNote  = (row["Key Note"] || "").toString().trim();
          const score    = (row["Score"] || "").toString().trim();
          const contact  = (row["Contact"] || "").toString().trim();
          const cost     = (row["Cost"] || "").toString().trim();
          const vendorAccess = (row["Vendor Access"] || "").toString().trim();

          // Append Excel pipeline insight as a note suffix if not already present
          const pipelineNote = [
            region     ? `Region: ${region}` : "",
            score      ? `Score: ${score}` : "",
            keyNote    ? `Key Note: ${keyNote}` : "",
            cost       ? `Cost: ${cost}` : "",
            vendorAccess ? `Vendor Access: ${vendorAccess}` : "",
          ].filter(Boolean).join(" | ");

          if (pipelineNote) {
            if (!existing.notes) {
              updates.notes = pipelineNote;
            } else if (!existing.notes.includes(keyNote.substring(0, 30))) {
              updates.notes = existing.notes + "\n\n[Pipeline]\n" + pipelineNote;
            }
          }
          if (!existing.mainContactName && contact) updates.mainContactName = contact;
          if (!existing.sponsorInfo && cost) updates.sponsorInfo = cost;

          if (Object.keys(updates).length > 0) {
            await storage.updateTso(existing.id, updates as any);
            tsoEnriched++;
          }
        }
      }

      // ── 3c. Budget → enrich TSO sponsor info ────────────────────────────
      const budgetSheet = wb.Sheets["💰 Budget"];
      if (budgetSheet) {
        const budgetRows = XLSX.utils.sheet_to_json(budgetSheet, { defval: "" }) as Record<string, any>[];
        for (const row of budgetRows) {
          const rawTso = (row["TSO"] || "").toString().trim();
          // Skip header-like rows and summary rows
          if (!rawTso || rawTso === "TSO" || rawTso.includes("TOTAL") || rawTso.includes("PENDING") || rawTso.includes("BUDGET") || rawTso.includes("Scenario") || rawTso.includes("Conservative") || rawTso.includes("Moderate") || rawTso.includes("Recommended") || rawTso.includes("Full commitment")) continue;
          const { name: tsoName } = parseTsoName(rawTso);
          if (!tsoName) continue;
          const existing = await storage.findTsoByName(tsoName);
          if (!existing) continue;

          const deal      = (row["Deal"] || "").toString().trim();
          const budgetNotes = (row["Notes / Sponsorship packages / Vendor & Attendee info"] || "").toString().trim();
          const updates: Record<string, any> = {};

          if (!existing.sponsorInfo && deal) updates.sponsorInfo = deal;
          if (budgetNotes) {
            const combined = deal ? `Deal: ${deal}\n\n${budgetNotes}` : budgetNotes;
            if (!existing.notes) {
              updates.notes = combined;
            } else if (!existing.notes.includes(deal.substring(0, 20))) {
              updates.notes = existing.notes + "\n\n[Budget]\n" + combined;
            }
          }
          if (Object.keys(updates).length > 0) {
            await storage.updateTso(existing.id, updates as any);
            tsoEnriched++;
          }
        }
      }

      report.excel = {
        sheets_processed: ["🚨 Actions Now", "📊 Full Pipeline", "💰 Budget"],
        tasks_created: tasksCreated,
        tasks_skipped: tasksSkipped,
        tso_records_enriched: tsoEnriched,
        errors: xlsxErrors,
      };
      allErrors.push(...xlsxErrors);
    } catch (e: any) {
      report.excel = { error: e.message };
      allErrors.push(`Excel: ${e.message}`);
    }

    // ── Validation summary ─────────────────────────────────────────────────
    const allTsos  = await storage.getTsos();
    const allShows = await storage.getShows();
    const allTasks = await storage.getTasks();
    report.validation = {
      total_tsos_in_db:   allTsos.length,
      total_shows_in_db:  allShows.length,
      total_tasks_in_db:  allTasks.length,
      total_errors:       allErrors.length,
    };

    res.json({
      success: allErrors.length === 0,
      message: allErrors.length === 0
        ? "Full migration complete — all data imported and merged."
        : `Migration complete with ${allErrors.length} non-fatal error(s).`,
      report,
      errors: allErrors.slice(0, 50),
    });
  }); // end full-migration

  return httpServer;
}

// ─── Show status mapping ──────────────────────────────────────────────────────

function mapShowStatus(raw: string | undefined): string {
  if (!raw) return "Contacted";
  const s = raw.trim();
  const map: Record<string, string> = {
    "Confirmed": "Confirmed",
    "Sponsoring": "Sponsoring",
    "In Conversation": "In Conversation",
    "Contacted": "Contacted",
    "Completed": "Completed",
    "Negotiating": "In Conversation",
    "Details Received": "In Conversation",
    "Initial Response": "Contacted",
    "Info Requested": "Contacted",
  };
  return map[s] || "Contacted";
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
