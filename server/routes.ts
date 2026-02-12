import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, normalizeCompanyName, normalizeLocation, normalizePhone, normalizeWebsite } from "./storage";
import { insertCompanySchema, insertContactSchema, insertCallNoteSchema, insertTaskSchema, insertActivitySchema, insertDealSchema, insertTrustSchema, insertCompanyRelationshipSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";

// Hardcoded admin credentials (password is hashed with bcrypt)
const ADMIN_USERNAME = "connerszabo";
const ADMIN_PASSWORD_HASH = "$2b$10$v27rzXh.RCKA8o9kUWm/IOwYpskP0uqk3VJsUgFbOuZIorPEAsvhy";

// Helper to safely get string param
const getParam = (param: string | string[] | undefined): string => {
  return Array.isArray(param) ? param[0] : (param || "");
};

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

  // Global Search
  app.get("/api/search/:query", isAuthenticated, async (req, res) => {
    try {
      const query = req.params.query as string;
      if (!query || query.length < 2) {
        return res.json({ companies: [], contacts: [], deals: [] });
      }
      const results = await storage.globalSearch(query);
      res.json(results);
    } catch (error) {
      console.error("Search failed:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Companies (protected)
  app.get("/api/companies", isAuthenticated, async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Failed to fetch companies:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/:id", isAuthenticated, async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id as string);
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

      // Normalize phone before saving
      if (data.phone) {
        data.phone = normalizePhone(data.phone);
      }

      // Check for duplicates: name+location, phone, website
      if (data.name) {
        const duplicates = await storage.checkDuplicates({
          name: data.name,
          phone: data.phone || undefined,
          website: data.website || undefined,
          location: data.location || undefined,
        });

        if (duplicates.phoneMatch || duplicates.websiteMatch || duplicates.nameMatch) {
          const match = duplicates.phoneMatch || duplicates.websiteMatch || duplicates.nameMatch;
          const matchType = duplicates.phoneMatch ? "phone" : duplicates.websiteMatch ? "website" : "name";
          return res.status(409).json({
            error: `A company with this ${matchType} already exists`,
            existingId: match!.id,
            existingName: match!.name,
            matchType,
            phoneMatch: duplicates.phoneMatch ? { id: duplicates.phoneMatch.id, name: duplicates.phoneMatch.name, phone: duplicates.phoneMatch.phone } : undefined,
            websiteMatch: duplicates.websiteMatch ? { id: duplicates.websiteMatch.id, name: duplicates.websiteMatch.name, website: duplicates.websiteMatch.website } : undefined,
            nameMatch: duplicates.nameMatch ? { id: duplicates.nameMatch.id, name: duplicates.nameMatch.name, location: duplicates.nameMatch.location } : undefined,
          });
        }
      }

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
      // Normalize phone before saving
      if (data.phone) {
        data.phone = normalizePhone(data.phone);
      }
      const company = await storage.updateCompany(req.params.id as string, data);
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
      await storage.deleteCompany(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete company" });
    }
  });

  // Contacts (protected)
  app.get("/api/contacts", isAuthenticated, async (req, res) => {
    try {
      const contacts = await storage.getAllContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.get("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.id as string);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      console.error("Failed to fetch contact:", error);
      res.status(500).json({ error: "Failed to fetch contact" });
    }
  });

  app.post("/api/contacts", isAuthenticated, async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(data);
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const data = insertContactSchema.partial().parse(req.body);
      const contact = await storage.updateContact(req.params.id as string, data);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.post("/api/companies/:id/contacts", isAuthenticated, async (req, res) => {
    try {
      const data = insertContactSchema.parse({
        ...req.body,
        companyId: req.params.id as string,
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
      await storage.deleteContact(req.params.id as string);
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
        companyId: req.params.id as string,
      });
      const note = await storage.createCallNote(data);
      
      // Update lastContactDate on the company
      await storage.updateCompany(req.params.id as string, {
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
      await storage.deleteCallNote(req.params.id as string);
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
        duplicates: [] as { name: string; location: string; existingId: string; hasNewInfo: boolean; reason: string }[],
        importBatchId: importBatch.id,
      };

      // Track normalized name+location seen within this batch to detect intra-CSV duplicates
      const seenInBatch = new Set<string>();

      for (const companyData of companiesData) {
        if (!companyData.name || !companyData.name.trim()) continue;

        const trimmedName = companyData.name.trim();
        const trimmedLocation = companyData.location?.trim() || "";
        const batchKey = normalizeCompanyName(trimmedName) + "||" + normalizeLocation(trimmedLocation);

        // 1. Check for intra-batch duplicate (same CSV has this name+location twice)
        if (seenInBatch.has(batchKey)) {
          results.skipped++;
          results.duplicates.push({
            name: trimmedName,
            location: trimmedLocation,
            existingId: "",
            hasNewInfo: false,
            reason: "duplicate_in_csv",
          });
          continue;
        }
        seenInBatch.add(batchKey);

        // Normalize phone before checks
        const normalizedPhone = companyData.phone ? normalizePhone(companyData.phone) : "";
        if (normalizedPhone) companyData.phone = normalizedPhone;

        // 2. Check for existing company by phone
        if (normalizedPhone) {
          const phoneMatch = await storage.findCompanyByPhone(normalizedPhone);
          if (phoneMatch) {
            if (mode === "skip") {
              results.skipped++;
              results.duplicates.push({
                name: trimmedName,
                location: trimmedLocation,
                existingId: phoneMatch.id,
                hasNewInfo: false,
                reason: "duplicate_phone",
              });
              continue;
            }
            // For merge/overwrite modes, treat as existing
          }
        }

        // 3. Check for existing company by website
        const normalizedWeb = companyData.website ? normalizeWebsite(companyData.website) : "";
        if (normalizedWeb) {
          const websiteMatch = await storage.findCompanyByWebsite(companyData.website);
          if (websiteMatch) {
            if (mode === "skip") {
              results.skipped++;
              results.duplicates.push({
                name: trimmedName,
                location: trimmedLocation,
                existingId: websiteMatch.id,
                hasNewInfo: false,
                reason: "duplicate_website",
              });
              continue;
            }
          }
        }

        // 4. Check for existing company in database (normalized name + location)
        const existing = await storage.findCompanyByNameAndLocation(trimmedName, trimmedLocation);

        if (existing) {
          // Check if the new data has additional info
          const hasNewInfo = !!(
            (!existing.itManagerName && companyData.itManagerName) ||
            (!existing.itManagerEmail && companyData.itManagerEmail) ||
            (!existing.website && companyData.website) ||
            (!existing.phone && companyData.phone) ||
            (!existing.location && companyData.location) ||
            (!existing.academyTrustName && companyData.academyTrustName)
          );

          if (mode === "overwrite") {
            // Overwrite all fields with CSV data
            const updateData: Record<string, unknown> = {
              itManagerName: companyData.itManagerName || null,
              itManagerEmail: companyData.itManagerEmail || null,
              website: companyData.website || null,
              phone: companyData.phone || null,
              location: companyData.location || null,
              academyTrustName: companyData.academyTrustName || null,
              industry: companyData.industry || "Secondary School",
              ext: companyData.ext || null,
              notes: companyData.notes || null,
              budgetStatus: companyData.budgetStatus || "0-unqualified",
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
            if (!existing.budgetStatus && companyData.budgetStatus) updateData.budgetStatus = companyData.budgetStatus;

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
              name: trimmedName,
              location: trimmedLocation,
              existingId: existing.id,
              hasNewInfo,
              reason: "duplicate_in_database",
            });
          }
        } else {
          // Auto-link trust from academyTrustName
          let trustId: string | null = null;
          let parentCompanyId: string | null = null;
          if (companyData.academyTrustName?.trim()) {
            const trustName = companyData.academyTrustName.trim();
            // Try new trust-as-company system first
            let trustCompany = await storage.findTrustCompanyByName(trustName);
            if (!trustCompany) {
              // Create trust as company with isTrust=true
              trustCompany = await storage.createCompany({
                name: trustName,
                isTrust: true,
                industry: "Academy Trust",
              });
            }
            parentCompanyId = trustCompany.id;
            // Also link legacy trust for backward compat
            let trust = await storage.getTrustByName(trustName);
            if (!trust) {
              trust = await storage.createTrust({ name: trustName });
            }
            trustId = trust.id;
          }

          // Create new company with import batch ID
          const company = await storage.createCompany({
            name: trimmedName,
            website: companyData.website || null,
            phone: companyData.phone || null,
            location: companyData.location || null,
            academyTrustName: companyData.academyTrustName || null,
            industry: companyData.industry || "Secondary School",
            ext: companyData.ext || null,
            notes: companyData.notes || null,
            itManagerName: companyData.itManagerName || null,
            itManagerEmail: companyData.itManagerEmail || null,
            stageId: stageId || null,
            importBatchId: importBatch.id,
            budgetStatus: companyData.budgetStatus || "0-unqualified",
            trustId,
            parentCompanyId,
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
    } catch (error: any) {
      console.error("Bulk import error:", error);
      const message = error?.message || "Unknown error";
      res.status(500).json({
        error: `Import failed: ${message}`,
        detail: error?.code || undefined,
      });
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
      const deletedCount = await storage.deleteCompaniesByImportBatch(req.params.id as string);
      // Then delete the import record
      await storage.deleteCsvImport(req.params.id as string);
      res.json({ deletedCompanies: deletedCount });
    } catch (error) {
      console.error("Failed to delete CSV import:", error);
      res.status(500).json({ error: "Failed to delete CSV import" });
    }
  });

  // Backfill null lead statuses to default
  app.post("/api/companies/backfill-lead-status", isAuthenticated, async (req, res) => {
    try {
      const updatedCount = await storage.backfillLeadStatus();
      res.json({ updated: updatedCount, message: `Updated ${updatedCount} companies to default Lead Status` });
    } catch (error) {
      console.error("Backfill lead status error:", error);
      res.status(500).json({ error: "Failed to backfill lead status" });
    }
  });

  // Check for duplicate company by name, phone, website, location
  app.get("/api/companies/check-duplicate", isAuthenticated, async (req, res) => {
    try {
      const name = req.query.name as string;
      const phone = (req.query.phone as string) || undefined;
      const website = (req.query.website as string) || undefined;
      const location = (req.query.location as string) || undefined;
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const duplicates = await storage.checkDuplicates({ name, phone, website, location });
      const hasAny = !!(duplicates.phoneMatch || duplicates.websiteMatch || duplicates.nameMatch);

      res.json({
        exists: hasAny,
        phoneMatch: duplicates.phoneMatch ? { id: duplicates.phoneMatch.id, name: duplicates.phoneMatch.name, phone: duplicates.phoneMatch.phone } : null,
        websiteMatch: duplicates.websiteMatch ? { id: duplicates.websiteMatch.id, name: duplicates.websiteMatch.name, website: duplicates.websiteMatch.website } : null,
        nameMatch: duplicates.nameMatch ? { id: duplicates.nameMatch.id, name: duplicates.nameMatch.name, location: duplicates.nameMatch.location } : null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check for duplicate" });
    }
  });

  // Cleanup endpoints
  app.post("/api/cleanup/normalize-phones", isAuthenticated, async (req, res) => {
    try {
      const allCompanies = await storage.getCompanies();
      let updated = 0;

      for (const company of allCompanies) {
        if (!company.phone) continue;
        const normalized = normalizePhone(company.phone);
        if (normalized && normalized !== company.phone) {
          await storage.updateCompany(company.id, { phone: normalized });
          updated++;
        }
      }

      res.json({ updated });
    } catch (error) {
      console.error("Normalize phones error:", error);
      res.status(500).json({ error: "Failed to normalize phones" });
    }
  });

  app.post("/api/cleanup/merge-duplicates", isAuthenticated, async (req, res) => {
    try {
      const allCompanies = await storage.getCompanies();
      const mergeDetails: { kept: string; deleted: string; reason: string }[] = [];

      // Pass 1: Group by normalized phone
      type CompanyEntry = (typeof allCompanies)[number];
      const phoneGroups = new Map<string, CompanyEntry[]>();
      for (const company of allCompanies) {
        const normalized = normalizePhone(company.phone);
        if (!normalized) continue;
        const group = phoneGroups.get(normalized) || [];
        group.push(company);
        phoneGroups.set(normalized, group);
      }

      const mergedIds = new Set<string>();

      for (const [, group] of Array.from(phoneGroups.entries())) {
        if (group.length <= 1) continue;
        // Score each company and sort by score desc, then by createdAt asc (oldest first)
        const scored = await Promise.all(group.map(async (c) => ({
          company: c,
          score: await storage.scoreCompany(c),
        })));
        scored.sort((a, b) => b.score - a.score || new Date(a.company.createdAt).getTime() - new Date(b.company.createdAt).getTime());

        const keeper = scored[0].company;
        for (let i = 1; i < scored.length; i++) {
          const duplicate = scored[i].company;
          if (mergedIds.has(duplicate.id)) continue;

          // Merge non-null fields from duplicate into keeper
          const updates: Record<string, unknown> = {};
          if (!keeper.website && duplicate.website) updates.website = duplicate.website;
          if (!keeper.location && duplicate.location) updates.location = duplicate.location;
          if (!keeper.itManagerName && duplicate.itManagerName) updates.itManagerName = duplicate.itManagerName;
          if (!keeper.itManagerEmail && duplicate.itManagerEmail) updates.itManagerEmail = duplicate.itManagerEmail;
          if (!keeper.notes && duplicate.notes) updates.notes = duplicate.notes;
          if (!keeper.academyTrustName && duplicate.academyTrustName) updates.academyTrustName = duplicate.academyTrustName;
          if (!keeper.ext && duplicate.ext) updates.ext = duplicate.ext;

          if (Object.keys(updates).length > 0) {
            await storage.updateCompany(keeper.id, updates);
          }

          await storage.mergeCompanies(keeper.id, duplicate.id);
          mergedIds.add(duplicate.id);
          mergeDetails.push({ kept: keeper.name, deleted: duplicate.name, reason: "duplicate_phone" });
        }
      }

      // Pass 2: Group by normalized name + location (only for companies not already merged)
      const nameGroups = new Map<string, CompanyEntry[]>();
      for (const company of allCompanies) {
        if (mergedIds.has(company.id)) continue;
        const key = normalizeCompanyName(company.name) + "||" + normalizeLocation(company.location);
        const group = nameGroups.get(key) || [];
        group.push(company);
        nameGroups.set(key, group);
      }

      for (const [, group] of Array.from(nameGroups.entries())) {
        if (group.length <= 1) continue;
        // Only auto-merge if phones match or one has no phone
        const normalizedPhones = group.map((c: CompanyEntry) => normalizePhone(c.phone));
        const uniquePhones = new Set(normalizedPhones.filter((p: string) => p));
        if (uniquePhones.size > 1) continue; // Different phones, skip

        const scored = await Promise.all(group.map(async (c) => ({
          company: c,
          score: await storage.scoreCompany(c),
        })));
        scored.sort((a, b) => b.score - a.score || new Date(a.company.createdAt).getTime() - new Date(b.company.createdAt).getTime());

        const keeper = scored[0].company;
        for (let i = 1; i < scored.length; i++) {
          const duplicate = scored[i].company;
          if (mergedIds.has(duplicate.id)) continue;

          const updates: Record<string, unknown> = {};
          if (!keeper.website && duplicate.website) updates.website = duplicate.website;
          if (!keeper.phone && duplicate.phone) updates.phone = duplicate.phone;
          if (!keeper.location && duplicate.location) updates.location = duplicate.location;
          if (!keeper.itManagerName && duplicate.itManagerName) updates.itManagerName = duplicate.itManagerName;
          if (!keeper.itManagerEmail && duplicate.itManagerEmail) updates.itManagerEmail = duplicate.itManagerEmail;
          if (!keeper.notes && duplicate.notes) updates.notes = duplicate.notes;
          if (!keeper.academyTrustName && duplicate.academyTrustName) updates.academyTrustName = duplicate.academyTrustName;
          if (!keeper.ext && duplicate.ext) updates.ext = duplicate.ext;

          if (Object.keys(updates).length > 0) {
            await storage.updateCompany(keeper.id, updates);
          }

          await storage.mergeCompanies(keeper.id, duplicate.id);
          mergedIds.add(duplicate.id);
          mergeDetails.push({ kept: keeper.name, deleted: duplicate.name, reason: "duplicate_name" });
        }
      }

      res.json({ merged: mergeDetails.length, details: mergeDetails });
    } catch (error) {
      console.error("Merge duplicates error:", error);
      res.status(500).json({ error: "Failed to merge duplicates" });
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
      const task = await storage.getTask(req.params.id as string);
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
      const task = await storage.updateTask(req.params.id as string, updateData);
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
      await storage.deleteTask(req.params.id as string);
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
      const deals = await storage.getDealsByCompany(req.params.companyId as string);
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
      const deal = await storage.updateDeal(req.params.id as string, updateData);
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
      await storage.deleteDeal(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  // Activities routes
  // PERFORMANCE: Get paginated activities for faster loading
  app.get("/api/companies/:id/activities", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const activities = await storage.getActivitiesByCompanyPaginated(req.params.id as string, limit, offset);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  app.post("/api/companies/:id/activities", isAuthenticated, async (req, res) => {
    try {
      const { createdAt: customDate, ...rest } = req.body;
      const data = insertActivitySchema.parse({
        ...rest,
        companyId: req.params.id as string,
      });
      const activity = await storage.createActivity(data, customDate ? new Date(customDate) : undefined);
      
      // Update lastContactDate on the company for calls/emails
      if (data.type === 'call' || data.type === 'email') {
        await storage.updateCompany(req.params.id as string, {
          lastContactDate: new Date(),
        });
        
        // Increment daily call counter for call activities
        if (data.type === 'call') {
          await storage.incrementCallCounter();
        }
      }
      
      // Update lastQuoteDate and lastQuoteValue for quotes
      if (data.type === 'quote' && data.quoteValue) {
        await storage.updateCompany(req.params.id as string, {
          lastQuoteDate: new Date(),
          lastQuoteValue: data.quoteValue,
        });
      }
      
      // Update grossProfit for deal_won
      if (data.type === 'deal_won' && data.grossProfit) {
        await storage.updateCompany(req.params.id as string, {
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

      const activity = await storage.updateActivity(req.params.id as string, updateData);
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
      await storage.deleteActivity(req.params.id as string);
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

  // Global Search
  app.get("/api/search", isAuthenticated, async (req, res) => {
    try {
      const query = (req.query.q as string || "").trim();

      if (!query || query.length < 2) {
        return res.json({ companies: [], contacts: [], deals: [] });
      }

      const searchResults = await storage.globalSearch(query);
      res.json(searchResults);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Trusts
  app.get("/api/trusts", isAuthenticated, async (req, res) => {
    try {
      const trusts = await storage.getTrusts();
      res.json(trusts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trusts" });
    }
  });

  app.get("/api/trusts-with-stats", isAuthenticated, async (req, res) => {
    try {
      const trusts = await storage.getTrustsWithStats();
      res.json(trusts);
    } catch (error) {
      console.error("Failed to fetch trusts with stats:", error);
      res.status(500).json({ error: "Failed to fetch trusts with stats" });
    }
  });

  app.get("/api/trusts/:id", isAuthenticated, async (req, res) => {
    try {
      const trust = await storage.getTrust(req.params.id as string);
      if (!trust) {
        return res.status(404).json({ error: "Trust not found" });
      }
      res.json(trust);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trust" });
    }
  });

  app.post("/api/trusts", isAuthenticated, async (req, res) => {
    try {
      const data = insertTrustSchema.parse(req.body);
      const trust = await storage.createTrust(data);
      res.status(201).json(trust);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create trust" });
    }
  });

  app.patch("/api/trusts/:id", isAuthenticated, async (req, res) => {
    try {
      const data = insertTrustSchema.partial().parse(req.body);
      const trust = await storage.updateTrust(req.params.id as string, data);
      if (!trust) {
        return res.status(404).json({ error: "Trust not found" });
      }
      res.json(trust);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update trust" });
    }
  });

  app.delete("/api/trusts/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTrust(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete trust" });
    }
  });

  app.get("/api/trusts/:id/companies", isAuthenticated, async (req, res) => {
    try {
      const companies = await storage.getCompaniesByTrust(req.params.id as string);
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trust companies" });
    }
  });

  app.get("/api/trusts/:id/pipeline-summary", isAuthenticated, async (req, res) => {
    try {
      const summary = await storage.getTrustPipelineSummary(req.params.id as string);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pipeline summary" });
    }
  });

  app.get("/api/trusts/:id/activities", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const activities = await storage.getTrustActivities(req.params.id as string, limit, offset);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trust activities" });
    }
  });

  app.post("/api/trusts/migrate", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.migrateAcademyTrusts();
      res.json(result);
    } catch (error) {
      console.error("Trust migration error:", error);
      res.status(500).json({ error: "Failed to migrate trusts" });
    }
  });

  // Trust-as-company & relationship endpoints
  app.get("/api/companies/:id/children", isAuthenticated, async (req, res) => {
    try {
      const children = await storage.getChildCompanies(req.params.id as string);
      res.json(children);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch child companies" });
    }
  });

  app.post("/api/companies/:id/link-schools", isAuthenticated, async (req, res) => {
    try {
      const { schoolIds } = req.body;
      if (!Array.isArray(schoolIds)) {
        return res.status(400).json({ error: "schoolIds must be an array" });
      }
      await storage.linkSchoolsToTrust(req.params.id as string, schoolIds);
      res.json({ linked: schoolIds.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to link schools" });
    }
  });

  app.post("/api/companies/:id/unlink-school", isAuthenticated, async (req, res) => {
    try {
      await storage.unlinkSchoolFromTrust(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to unlink school" });
    }
  });

  app.get("/api/companies/:id/relationships", isAuthenticated, async (req, res) => {
    try {
      const relationships = await storage.getCompanyRelationships(req.params.id as string);
      res.json(relationships);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch relationships" });
    }
  });

  app.post("/api/companies/:id/relationships", isAuthenticated, async (req, res) => {
    try {
      const data = insertCompanyRelationshipSchema.parse({
        ...req.body,
        companyId: req.params.id as string,
      });
      const relationship = await storage.createCompanyRelationship(data);
      res.status(201).json(relationship);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create relationship" });
    }
  });

  app.delete("/api/company-relationships/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCompanyRelationship(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete relationship" });
    }
  });

  app.get("/api/trust-companies", isAuthenticated, async (req, res) => {
    try {
      const trustCompanies = await storage.getTrustCompanies();
      res.json(trustCompanies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trust companies" });
    }
  });

  // Migration endpoint: trusts table → companies with isTrust=true
  app.post("/api/migrate-trusts-to-companies", isAuthenticated, async (req, res) => {
    try {
      const allTrusts = await storage.getTrusts();
      let created = 0;
      let skipped = 0;

      for (const trust of allTrusts) {
        // Check if a trust company already exists
        const existing = await storage.findTrustCompanyByName(trust.name);
        if (existing) {
          skipped++;
          continue;
        }

        // Create company with isTrust=true
        const newCompany = await storage.createCompany({
          name: trust.name,
          website: trust.website,
          phone: trust.phone,
          isTrust: true,
          notes: trust.notes,
          industry: "Academy Trust",
        });

        // Update children: find companies with this trustId and set parentCompanyId
        const trustSchools = await storage.getCompaniesByTrust(trust.id);
        const schoolIds = trustSchools.map(s => s.id);
        if (schoolIds.length > 0) {
          await storage.linkSchoolsToTrust(newCompany.id, schoolIds);
        }

        created++;
      }

      res.json({ created, skipped, total: allTrusts.length });
    } catch (error) {
      console.error("Trust migration error:", error);
      res.status(500).json({ error: "Failed to migrate trusts to companies" });
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
