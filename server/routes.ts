import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCompanySchema, insertContactSchema, insertCallNoteSchema, insertTaskSchema, insertActivitySchema, insertDealSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";

// Hardcoded admin credentials (password is hashed with bcrypt)
const ADMIN_USERNAME = "connerszabo";
const ADMIN_PASSWORD_HASH = "$2b$10$v27rzXh.RCKA8o9kUWm/IOwYpskP0uqk3VJsUgFbOuZIorPEAsvhy";

// Authentication middleware
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.userId) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize seed data
  await storage.seedData();

  // Auth routes (not protected)
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      // Check credentials
      if (username !== ADMIN_USERNAME) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const isValidPassword = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Set session
      req.session.userId = "admin";
      req.session.username = username;
      
      res.json({ message: "Login successful", username });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.session.userId) {
      res.json({ authenticated: true, username: req.session.username });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Pipeline Stages (protected)
  app.get("/api/pipeline-stages", isAuthenticated, async (req, res) => {
    try {
      const stages = await storage.getPipelineStages();
      res.json(stages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pipeline stages" });
    }
  });

  // Companies (protected)
  app.get("/api/companies", isAuthenticated, async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/:id", isAuthenticated, async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Failed to fetch company:", error);
      res.status(500).json({ error: "Failed to fetch company" });
    }
  });

  app.post("/api/companies", isAuthenticated, async (req, res) => {
    try {
      const data = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(data);
      res.status(201).json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  app.patch("/api/companies/:id", isAuthenticated, async (req, res) => {
    try {
      const data = insertCompanySchema.partial().parse(req.body);
      const company = await storage.updateCompany(req.params.id, data);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update company" });
    }
  });

  app.delete("/api/companies/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCompany(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete company" });
    }
  });

  // Contacts (protected)
  app.post("/api/companies/:id/contacts", isAuthenticated, async (req, res) => {
    try {
      const data = insertContactSchema.parse({
        ...req.body,
        companyId: req.params.id,
      });
      const contact = await storage.createContact(data);
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.delete("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteContact(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  // Call Notes (protected)
  app.post("/api/companies/:id/notes", isAuthenticated, async (req, res) => {
    try {
      const data = insertCallNoteSchema.parse({
        ...req.body,
        companyId: req.params.id,
      });
      const note = await storage.createCallNote(data);
      
      // Update lastContactDate on the company
      await storage.updateCompany(req.params.id, {
        lastContactDate: new Date(),
      });
      
      res.status(201).json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create call note" });
    }
  });

  app.delete("/api/notes/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCallNote(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete call note" });
    }
  });

  // Bulk import with duplicate detection
  app.post("/api/companies/bulk-import", isAuthenticated, async (req, res) => {
    try {
      const { companies: companiesData, stageId, updateExisting, updateMode, fileName } = req.body;
      // updateMode: "skip" (default) | "merge" (fill empty fields) | "overwrite" (replace all)
      const mode = updateMode || (updateExisting ? "merge" : "skip");

      if (!Array.isArray(companiesData)) {
        return res.status(400).json({ error: "Companies must be an array" });
      }

      // Create import batch record
      const importBatch = await storage.createCsvImport({
        fileName: fileName || "import.csv",
        importedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
      });

      const results = {
        imported: 0,
        skipped: 0,
        updated: 0,
        duplicates: [] as { name: string; existingId: string; hasNewInfo: boolean }[],
        importBatchId: importBatch.id,
      };

      for (const companyData of companiesData) {
        if (!companyData.name || !companyData.name.trim()) continue;

        // Check for existing company (case-insensitive)
        const existing = await storage.findCompanyByName(companyData.name.trim());

        if (existing) {
          // Check if the new data has additional info
          const hasNewInfo =
            (!existing.itManagerName && companyData.itManagerName) ||
            (!existing.itManagerEmail && companyData.itManagerEmail) ||
            (!existing.website && companyData.website) ||
            (!existing.phone && companyData.phone) ||
            (!existing.location && companyData.location) ||
            (!existing.academyTrustName && companyData.academyTrustName);

          if (mode === "overwrite") {
            // Overwrite all fields with CSV data
            const updateData: Record<string, unknown> = {
              itManagerName: companyData.itManagerName || null,
              itManagerEmail: companyData.itManagerEmail || null,
              website: companyData.website || null,
              phone: companyData.phone || null,
              location: companyData.location || null,
              academyTrustName: companyData.academyTrustName || null,
              ext: companyData.ext || null,
              notes: companyData.notes || null,
            };

            await storage.updateCompany(existing.id, updateData);
            results.updated++;
          } else if (mode === "merge" && hasNewInfo) {
            // Merge: only fill empty fields
            const updateData: Record<string, unknown> = {};
            if (!existing.itManagerName && companyData.itManagerName) updateData.itManagerName = companyData.itManagerName;
            if (!existing.itManagerEmail && companyData.itManagerEmail) updateData.itManagerEmail = companyData.itManagerEmail;
            if (!existing.website && companyData.website) updateData.website = companyData.website;
            if (!existing.phone && companyData.phone) updateData.phone = companyData.phone;
            if (!existing.location && companyData.location) updateData.location = companyData.location;
            if (!existing.academyTrustName && companyData.academyTrustName) updateData.academyTrustName = companyData.academyTrustName;
            if (!existing.ext && companyData.ext) updateData.ext = companyData.ext;
            if (!existing.notes && companyData.notes) updateData.notes = companyData.notes;

            await storage.updateCompany(existing.id, updateData);
            results.updated++;

            // Also create IT Manager contact if they have the info
            if (companyData.itManagerName && companyData.itManagerEmail) {
              try {
                await storage.createContact({
                  companyId: existing.id,
                  name: companyData.itManagerName,
                  email: companyData.itManagerEmail,
                  role: "IT Manager",
                  phone: null,
                });
              } catch {
                // Contact might already exist
              }
            }
          } else {
            results.skipped++;
            results.duplicates.push({
              name: companyData.name,
              existingId: existing.id,
              hasNewInfo,
            });
          }
        } else {
          // Create new company with import batch ID
          const company = await storage.createCompany({
            name: companyData.name.trim(),
            website: companyData.website || null,
            phone: companyData.phone || null,
            location: companyData.location || null,
            academyTrustName: companyData.academyTrustName || null,
            ext: companyData.ext || null,
            notes: companyData.notes || null,
            itManagerName: companyData.itManagerName || null,
            itManagerEmail: companyData.itManagerEmail || null,
            stageId: stageId || null,
            importBatchId: importBatch.id,
          });

          results.imported++;

          // Auto-create IT Manager as first contact
          if (companyData.itManagerName && companyData.itManagerEmail) {
            try {
              await storage.createContact({
                companyId: company.id,
                name: companyData.itManagerName,
                email: companyData.itManagerEmail,
                role: "IT Manager",
                phone: null,
              });
            } catch {
              // Ignore contact creation errors
            }
          }
        }
      }

      // Update import batch with final counts
      await storage.updateCsvImport(importBatch.id, {
        importedCount: results.imported,
        updatedCount: results.updated,
        skippedCount: results.skipped,
      });

      res.json(results);
    } catch (error) {
      console.error("Bulk import error:", error);
      res.status(500).json({ error: "Failed to import companies" });
    }
  });

  // CSV Imports management
  app.get("/api/csv-imports", isAuthenticated, async (req, res) => {
    try {
      const imports = await storage.getCsvImports();
      res.json(imports);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CSV imports" });
    }
  });

  app.delete("/api/csv-imports/:id", isAuthenticated, async (req, res) => {
    try {
      // First delete all companies from this import batch
      const deletedCount = await storage.deleteCompaniesByImportBatch(req.params.id);
      // Then delete the import record
      await storage.deleteCsvImport(req.params.id);
      res.json({ deletedCompanies: deletedCount });
    } catch (error) {
      console.error("Failed to delete CSV import:", error);
      res.status(500).json({ error: "Failed to delete CSV import" });
    }
  });

  // Check for duplicate company name
  app.get("/api/companies/check-duplicate", isAuthenticated, async (req, res) => {
    try {
      const name = req.query.name as string;
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const existing = await storage.findCompanyByName(name.trim());
      res.json({ exists: !!existing, existingId: existing?.id || null });
    } catch (error) {
      res.status(500).json({ error: "Failed to check for duplicate" });
    }
  });

  // Tasks routes
  app.get("/api/tasks", isAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getTasks();
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/due-today", isAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getTasksDueToday();
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks due today" });
    }
  });

  app.get("/api/tasks/overdue", isAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getOverdueTasks();
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch overdue tasks" });
    }
  });

  app.get("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  app.post("/api/companies/:companyId/tasks", isAuthenticated, async (req, res) => {
    try {
      const { dueDate, ...rest } = req.body;
      const validated = insertTaskSchema.parse({
        ...rest,
        companyId: req.params.companyId,
        dueDate: dueDate ? new Date(dueDate) : null,
      });
      const task = await storage.createTask(validated);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const { dueDate, ...rest } = req.body;
      const updateData = {
        ...rest,
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      };
      const task = await storage.updateTask(req.params.id, updateData);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTask(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Deals routes
  app.get("/api/deals", isAuthenticated, async (req, res) => {
    try {
      const deals = await storage.getAllDeals();
      res.json(deals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  app.get("/api/companies/:companyId/deals", isAuthenticated, async (req, res) => {
    try {
      const deals = await storage.getDealsByCompany(req.params.companyId);
      res.json(deals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  app.post("/api/companies/:companyId/deals", isAuthenticated, async (req, res) => {
    try {
      const { decisionTimeline, ...rest } = req.body;
      const validated = insertDealSchema.parse({
        ...rest,
        companyId: req.params.companyId,
        decisionTimeline: decisionTimeline ? new Date(decisionTimeline) : null,
      });
      const deal = await storage.createDeal(validated);
      res.status(201).json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create deal" });
    }
  });

  app.patch("/api/deals/:id", isAuthenticated, async (req, res) => {
    try {
      const { decisionTimeline, ...rest } = req.body;
      const updateData = {
        ...rest,
        ...(decisionTimeline !== undefined && { decisionTimeline: decisionTimeline ? new Date(decisionTimeline) : null }),
      };
      const deal = await storage.updateDeal(req.params.id, updateData);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deal" });
    }
  });

  app.delete("/api/deals/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteDeal(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  // Activities routes
  app.post("/api/companies/:id/activities", isAuthenticated, async (req, res) => {
    try {
      const data = insertActivitySchema.parse({
        ...req.body,
        companyId: req.params.id,
      });
      const activity = await storage.createActivity(data);
      
      // Update lastContactDate on the company for calls/emails
      if (data.type === 'call' || data.type === 'email') {
        await storage.updateCompany(req.params.id, {
          lastContactDate: new Date(),
        });
        
        // Increment daily call counter for call activities
        if (data.type === 'call') {
          await storage.incrementCallCounter();
        }
      }
      
      // Update lastQuoteDate and lastQuoteValue for quotes
      if (data.type === 'quote' && data.quoteValue) {
        await storage.updateCompany(req.params.id, {
          lastQuoteDate: new Date(),
          lastQuoteValue: data.quoteValue,
        });
      }
      
      // Update grossProfit for deal_won
      if (data.type === 'deal_won' && data.grossProfit) {
        await storage.updateCompany(req.params.id, {
          grossProfit: data.grossProfit,
        });
      }
      
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create activity" });
    }
  });

  app.patch("/api/activities/:id", isAuthenticated, async (req, res) => {
    try {
      const { note, outcome, createdAt } = req.body;
      const updateData: Record<string, unknown> = { editedAt: new Date() };
      if (note !== undefined) updateData.note = note;
      if (outcome !== undefined) updateData.outcome = outcome;
      if (createdAt !== undefined) updateData.createdAt = new Date(createdAt);

      const activity = await storage.updateActivity(req.params.id, updateData);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json(activity);
    } catch (error) {
      console.error("Failed to update activity:", error);
      res.status(500).json({ error: "Failed to update activity" });
    }
  });

  app.delete("/api/activities/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteActivity(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete activity" });
    }
  });

  // Daily stats routes
  app.get("/api/stats/today", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getTodayStats();
      res.json(stats || { callsMade: 0 });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch today's stats" });
    }
  });

  app.post("/api/stats/increment-calls", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.incrementCallCounter();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to increment call counter" });
    }
  });

  // Call Analytics routes
  app.get("/api/call-analytics", isAuthenticated, async (req, res) => {
    try {
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;

      if (!startDateStr || !endDateStr) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);

      const calls = await storage.getCallActivities(startDate, endDate);
      res.json(calls);
    } catch (error) {
      console.error("Call analytics error:", error);
      res.status(500).json({ error: "Failed to fetch call analytics" });
    }
  });

  app.post("/api/call-analytics/migrate-outcomes", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.migrateCallOutcomes();
      res.json(result);
    } catch (error) {
      console.error("Migration error:", error);
      res.status(500).json({ error: "Failed to migrate outcomes" });
    }
  });

  // Dashboard aggregate routes
  app.get("/api/dashboard/pipeline-value", isAuthenticated, async (req, res) => {
    try {
      const value = await storage.getTotalPipelineValue();
      res.json({ value });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pipeline value" });
    }
  });

  app.get("/api/dashboard/gp-this-month", isAuthenticated, async (req, res) => {
    try {
      const value = await storage.getGPThisMonth();
      res.json({ value });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch GP this month" });
    }
  });

  app.get("/api/dashboard/deals-needing-followup", isAuthenticated, async (req, res) => {
    try {
      const deals = await storage.getDealsNeedingFollowup();
      res.json(deals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deals needing follow-up" });
    }
  });

  return httpServer;
}
