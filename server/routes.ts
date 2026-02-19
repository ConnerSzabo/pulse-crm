import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, normalizeCompanyName, normalizeLocation, normalizePhone, normalizeWebsite } from "./storage";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { activities, companies, contacts, callNotes, tasks, users } from "@shared/schema";
import { insertCompanySchema, insertContactSchema, insertCallNoteSchema, insertTaskSchema, insertActivitySchema, insertDealSchema, insertTrustSchema, insertCompanyRelationshipSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";
import { loginLimiter } from "./index";

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

export function registerRoutes(
  httpServer: Server,
  app: Express
): Server {
  // Auth routes (not protected)
  app.post("/api/login", loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      // Look up user in database
      const [user] = await db.select().from(users).where(eq(users.username, username));
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Set session
      req.session.userId = user.id;
      req.session.username = user.username;

      res.json({ message: "Login successful", username: user.username });
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
      res.clearCookie("wavesys.sid");
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
      const { contactId, ...rest } = req.body;
      const companyId = req.params.id as string;
      const data = insertCallNoteSchema.parse({
        ...rest,
        companyId,
      });
      const now = new Date();

      console.log(`[callNote] Creating note for company=${companyId}, contact=${contactId || 'none'}`);

      // Use a transaction so note + date updates are atomic
      const note = await db.transaction(async (tx) => {
        const [created] = await tx.insert(callNotes).values(data).returning();
        console.log(`[callNote] Note ${created.id} inserted`);

        // Update lastContactDate on the company
        const [updatedCompany] = await tx.update(companies).set({ lastContactDate: now }).where(eq(companies.id, companyId)).returning();
        console.log(`[callNote] Company ${companyId} lastContactDate updated to ${updatedCompany?.lastContactDate}`);

        // Update contact lastContactDate if contactId provided
        if (contactId) {
          const [updatedContact] = await tx.update(contacts).set({ lastContactDate: now }).where(eq(contacts.id, contactId)).returning();
          console.log(`[callNote] Contact ${contactId} lastContactDate updated to ${updatedContact?.lastContactDate}, rows=${updatedContact ? 1 : 0}`);
        }

        return created;
      });

      console.log(`[callNote] Transaction committed for note ${note.id}`);
      res.status(201).json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("[callNote] Failed to create call note:", error);
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
        contactsCreated: 0,
        contactsSkipped: 0,
        phonesFormatted: 0,
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

        // Normalize phone before checks (add leading 0 if 10 digits)
        const rawPhone = companyData.phone || "";
        const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : "";
        if (normalizedPhone) {
          if (normalizedPhone !== rawPhone.replace(/\D/g, "")) {
            results.phonesFormatted++;
          }
          companyData.phone = normalizedPhone;
        }

        // Parse integer fields
        const schoolCapacity = companyData.schoolCapacity ? parseInt(String(companyData.schoolCapacity), 10) || null : null;
        const pupilHeadcount = companyData.pupilHeadcount ? parseInt(String(companyData.pupilHeadcount), 10) || null : null;

        // Duplicate detection: phone → website → name
        let existingCompany: Awaited<ReturnType<typeof storage.findCompanyByPhone>> = undefined;
        let matchReason = "";

        // Check 1: phone match
        if (normalizedPhone) {
          existingCompany = await storage.findCompanyByPhone(normalizedPhone);
          if (existingCompany) matchReason = "duplicate_phone";
        }

        // Check 2: website match (if no phone match)
        if (!existingCompany && companyData.website) {
          const normalizedWeb = normalizeWebsite(companyData.website);
          if (normalizedWeb) {
            existingCompany = await storage.findCompanyByWebsite(companyData.website);
            if (existingCompany) matchReason = "duplicate_website";
          }
        }

        // Check 3: name + location match (if no phone or website match)
        if (!existingCompany) {
          existingCompany = await storage.findCompanyByNameAndLocation(trimmedName, trimmedLocation);
          if (existingCompany) matchReason = "duplicate_in_database";
        }

        // Check 4: name-only match (fallback for different locations)
        if (!existingCompany && trimmedName) {
          existingCompany = await storage.findCompanyByNameAndLocation(trimmedName, null);
          if (existingCompany) matchReason = "duplicate_name_only";
        }

        let companyId: string;

        if (existingCompany) {
          companyId = existingCompany.id;

          // Check if the new data has additional info
          const hasNewInfo = !!(
            (!existingCompany.itManagerName && companyData.itManagerName) ||
            (!existingCompany.itManagerEmail && companyData.itManagerEmail) ||
            (!existingCompany.website && companyData.website) ||
            (!existingCompany.phone && companyData.phone) ||
            (!existingCompany.location && companyData.location) ||
            (!existingCompany.academyTrustName && companyData.academyTrustName) ||
            (!existingCompany.urn && companyData.urn) ||
            (!existingCompany.street && companyData.street) ||
            (!existingCompany.postcode && companyData.postcode) ||
            (!existingCompany.county && companyData.county) ||
            (!existingCompany.schoolType && companyData.schoolType) ||
            (existingCompany.schoolCapacity === null && schoolCapacity !== null) ||
            (existingCompany.pupilHeadcount === null && pupilHeadcount !== null)
          );

          if (mode === "overwrite") {
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
              urn: companyData.urn || null,
              street: companyData.street || null,
              postcode: companyData.postcode || null,
              county: companyData.county || null,
              schoolType: companyData.schoolType || null,
              schoolCapacity,
              pupilHeadcount,
            };

            await storage.updateCompany(existingCompany.id, updateData);
            results.updated++;
          } else if (mode === "merge") {
            // Merge: only fill empty fields - NEVER overwrite existing lead status, owner, etc.
            const updateData: Record<string, unknown> = {};
            if (!existingCompany.itManagerName && companyData.itManagerName) updateData.itManagerName = companyData.itManagerName;
            if (!existingCompany.itManagerEmail && companyData.itManagerEmail) updateData.itManagerEmail = companyData.itManagerEmail;
            if (!existingCompany.website && companyData.website) updateData.website = companyData.website;
            if (!existingCompany.phone && companyData.phone) updateData.phone = companyData.phone;
            if (!existingCompany.location && companyData.location) updateData.location = companyData.location;
            if (!existingCompany.academyTrustName && companyData.academyTrustName) updateData.academyTrustName = companyData.academyTrustName;
            if (!existingCompany.ext && companyData.ext) updateData.ext = companyData.ext;
            if (!existingCompany.notes && companyData.notes) updateData.notes = companyData.notes;
            // New fields - merge only if empty
            if (!existingCompany.urn && companyData.urn) updateData.urn = companyData.urn;
            if (!existingCompany.street && companyData.street) updateData.street = companyData.street;
            if (!existingCompany.postcode && companyData.postcode) updateData.postcode = companyData.postcode;
            if (!existingCompany.county && companyData.county) updateData.county = companyData.county;
            if (!existingCompany.schoolType && companyData.schoolType) updateData.schoolType = companyData.schoolType;
            if (existingCompany.schoolCapacity === null && schoolCapacity !== null) updateData.schoolCapacity = schoolCapacity;
            if (existingCompany.pupilHeadcount === null && pupilHeadcount !== null) updateData.pupilHeadcount = pupilHeadcount;
            // NEVER overwrite budgetStatus for merge mode

            if (Object.keys(updateData).length > 0) {
              await storage.updateCompany(existingCompany.id, updateData);
              results.updated++;
            } else {
              results.skipped++;
              results.duplicates.push({
                name: trimmedName,
                location: trimmedLocation,
                existingId: existingCompany.id,
                hasNewInfo,
                reason: matchReason,
              });
            }
          } else {
            // skip mode
            results.skipped++;
            results.duplicates.push({
              name: trimmedName,
              location: trimmedLocation,
              existingId: existingCompany.id,
              hasNewInfo,
              reason: matchReason,
            });
          }
        } else {
          // No duplicate found - CREATE new company

          // Auto-link trust from academyTrustName
          let trustId: string | null = null;
          let parentCompanyId: string | null = null;
          if (companyData.academyTrustName?.trim()) {
            const trustName = companyData.academyTrustName.trim();
            let trustCompany = await storage.findTrustCompanyByName(trustName);
            if (!trustCompany) {
              trustCompany = await storage.createCompany({
                name: trustName,
                isTrust: true,
                industry: "Academy Trust",
              });
            }
            parentCompanyId = trustCompany.id;
            let trust = await storage.getTrustByName(trustName);
            if (!trust) {
              trust = await storage.createTrust({ name: trustName });
            }
            trustId = trust.id;
          }

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
            urn: companyData.urn || null,
            street: companyData.street || null,
            postcode: companyData.postcode || null,
            county: companyData.county || null,
            schoolType: companyData.schoolType || null,
            schoolCapacity,
            pupilHeadcount,
          });

          companyId = company.id;
          results.imported++;

          // Auto-link school to trust via company_relationships (bidirectional)
          if (parentCompanyId) {
            try {
              await storage.createCompanyRelationship({
                companyId: parentCompanyId,
                relatedCompanyId: company.id,
                relationshipType: "Part of Trust",
              });
            } catch {
              // Ignore if relationship already exists
            }
          }

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

        // Upsert headteacher contact (for both new and merged companies)
        const headName = [companyData.headFirstName, companyData.headLastName]
          .filter(Boolean)
          .map((s: string) => s.trim())
          .join(" ");

        if (headName) {
          const salutations = ["mr", "mrs", "ms", "miss", "dr", "rev", "prof", "sir", "dame", "lord", "lady"];
          let contactTitle = companyData.headTitle?.trim() || null;
          let contactRole = companyData.headJobTitle?.trim() || "Headteacher";
          if (contactRole && salutations.includes(contactRole.toLowerCase())) {
            if (!contactTitle) contactTitle = contactRole;
            contactRole = "Headteacher";
          }
          if (!contactRole) contactRole = "Headteacher";

          // Find existing headteacher contact to update
          const existingContacts = await storage.getContactsByCompany(companyId);
          const headteacherRoles = ["headteacher", "head teacher", "head", "principal", ...salutations];
          const existingHead = existingContacts.find((c) => {
            // Match by name OR by headteacher-like role
            const nameMatch = c.name && c.name.toLowerCase().trim() === headName.toLowerCase().trim();
            const roleMatch = c.role && headteacherRoles.includes(c.role.toLowerCase().trim());
            return nameMatch || roleMatch;
          });

          try {
            if (existingHead) {
              // Update existing headteacher contact
              await storage.updateContact(existingHead.id, {
                name: headName,
                title: contactTitle,
                role: contactRole,
                phone: normalizedPhone || existingHead.phone || null,
              });
              results.contactsSkipped++; // counted as update, not new creation
            } else {
              // Create new headteacher contact
              await storage.createContact({
                companyId,
                name: headName,
                email: "",
                title: contactTitle,
                role: contactRole,
                phone: normalizedPhone || null,
              });
              results.contactsCreated++;
            }
          } catch {
            // Ignore contact upsert errors
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
      res.status(500).json({
        error: "Import failed. Check your CSV format and try again.",
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

      // Pass 3: Group by normalized website (only for companies not already merged)
      const websiteGroups = new Map<string, CompanyEntry[]>();
      for (const company of allCompanies) {
        if (mergedIds.has(company.id)) continue;
        const normalized = normalizeWebsite(company.website);
        if (!normalized) continue;
        const group = websiteGroups.get(normalized) || [];
        group.push(company);
        websiteGroups.set(normalized, group);
      }

      for (const [, group] of Array.from(websiteGroups.entries())) {
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
          mergeDetails.push({ kept: keeper.name, deleted: duplicate.name, reason: "duplicate_website" });
        }
      }

      res.json({ merged: mergeDetails.length, details: mergeDetails });
    } catch (error) {
      console.error("Merge duplicates error:", error);
      res.status(500).json({ error: "Failed to merge duplicates" });
    }
  });

  // Comprehensive cleanup: normalize phones + merge all duplicates in one call
  app.post("/api/cleanup/full", isAuthenticated, async (req, res) => {
    try {
      // Step 1: Normalize phones
      const allCompanies = await storage.getCompanies();
      let phonesFormatted = 0;
      for (const company of allCompanies) {
        if (!company.phone) continue;
        const normalized = normalizePhone(company.phone);
        if (normalized && normalized !== company.phone) {
          await storage.updateCompany(company.id, { phone: normalized });
          phonesFormatted++;
        }
      }

      // Step 2: Merge duplicates (phone → name+location → website)
      const mergeResponse = await fetch(`http://localhost:${(httpServer.address() as any)?.port || 5000}/api/cleanup/merge-duplicates`, {
        method: "POST",
        headers: { cookie: req.headers.cookie || "" },
      });
      const mergeResult = await mergeResponse.json();

      res.json({
        phonesFormatted,
        merged: mergeResult.merged || 0,
        details: mergeResult.details || [],
      });
    } catch (error) {
      console.error("Full cleanup error:", error);
      res.status(500).json({ error: "Failed to run full cleanup" });
    }
  });

  // Call Queue endpoint - get prioritized list of companies to call
  app.get("/api/call-queue", isAuthenticated, async (req, res) => {
    try {
      const allCompanies = await storage.getCompanies();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Filter and score companies for call queue
      const queue: { company: typeof allCompanies[0]; priority: number; reason: string }[] = [];

      for (const company of allCompanies) {
        // Skip closed won/lost (account-active or quoted-lost)
        if (company.budgetStatus === "4-account-active" || company.budgetStatus === "3b-quoted-lost") continue;

        let priority = 0;
        let reason = "";

        const lastContact = company.lastContactDate ? new Date(company.lastContactDate) : null;
        const daysSinceContact = lastContact
          ? Math.floor((today.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        // Priority 1: Quoted but no follow-up (3-quote-presented with no contact in 3+ days)
        if (company.budgetStatus === "3-quote-presented" && daysSinceContact >= 3) {
          priority = 100 + daysSinceContact;
          reason = "Quote follow-up needed";
        }
        // Priority 2: Intent leads not contacted in 5+ days
        else if (company.budgetStatus === "2-intent" && daysSinceContact >= 5) {
          priority = 80 + daysSinceContact;
          reason = "Intent lead - needs contact";
        }
        // Priority 3: Qualified leads not contacted in 7+ days
        else if (company.budgetStatus === "1-qualified" && daysSinceContact >= 7) {
          priority = 60 + daysSinceContact;
          reason = "Qualified lead - overdue";
        }
        // Priority 4: Unqualified with no contact in 14+ days
        else if (company.budgetStatus === "0-unqualified" && daysSinceContact >= 14) {
          priority = 40 + Math.min(daysSinceContact, 60);
          reason = "Needs qualification";
        }
        // Priority 5: Any company never contacted
        else if (!lastContact) {
          priority = 50;
          reason = "Never contacted";
        }
        else {
          continue; // Skip - recently contacted
        }

        queue.push({ company, priority, reason });
      }

      // Sort by priority descending
      queue.sort((a, b) => b.priority - a.priority);

      res.json(queue.slice(0, 100)); // Cap at 100 items
    } catch (error) {
      console.error("Call queue error:", error);
      res.status(500).json({ error: "Failed to generate call queue" });
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
      const { dueDate, contactId, ...rest } = req.body;
      const companyId = req.params.companyId as string;
      const validated = insertTaskSchema.parse({
        ...rest,
        companyId,
        dueDate: dueDate ? new Date(dueDate) : null,
      });
      const now = new Date();

      console.log(`[task] Creating task for company=${companyId}, contact=${contactId || 'none'}`);

      // Use a transaction so task + date updates are atomic
      const task = await db.transaction(async (tx) => {
        const [created] = await tx.insert(tasks).values(validated).returning();
        console.log(`[task] Task ${created.id} inserted`);

        // Update lastContactDate on the company
        const [updatedCompany] = await tx.update(companies).set({ lastContactDate: now }).where(eq(companies.id, companyId)).returning();
        console.log(`[task] Company ${companyId} lastContactDate updated to ${updatedCompany?.lastContactDate}`);

        // Update contact lastContactDate if contactId provided
        if (contactId) {
          const [updatedContact] = await tx.update(contacts).set({ lastContactDate: now }).where(eq(contacts.id, contactId)).returning();
          console.log(`[task] Contact ${contactId} lastContactDate updated to ${updatedContact?.lastContactDate}, rows=${updatedContact ? 1 : 0}`);
        }

        return created;
      });

      console.log(`[task] Transaction committed for task ${task.id}`);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("[task] Failed to create task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const { dueDate, ...rest } = req.body;
      const validated = insertTaskSchema.partial().parse(rest);
      const updateData = {
        ...validated,
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      };
      const task = await storage.updateTask(req.params.id as string, updateData);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
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
      const validated = insertDealSchema.partial().parse(rest);
      const updateData = {
        ...validated,
        ...(decisionTimeline !== undefined && { decisionTimeline: decisionTimeline ? new Date(decisionTimeline) : null }),
      };
      const deal = await storage.updateDeal(req.params.id as string, updateData);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
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
      const companyId = req.params.id as string;
      const contactId = req.body.contactId || null;
      const data = insertActivitySchema.parse({
        ...rest,
        companyId,
        contactId,
      });

      const now = new Date();

      console.log(`[activity] Creating type="${data.type}" for company=${companyId}, contact=${contactId}`);

      // Use a transaction so activity + all date updates are atomic
      const activity = await db.transaction(async (tx) => {
        // 1. Create the activity (contactId is now stored on the activity record)
        const values = customDate ? { ...data, createdAt: new Date(customDate) } : data;
        const [created] = await tx.insert(activities).values(values).returning();
        console.log(`[activity] Activity ${created.id} inserted`);

        // 2. Build company update (always update lastContactDate)
        const companyUpdate: Record<string, unknown> = { lastContactDate: now };

        if (data.type === 'quote' && data.quoteValue) {
          companyUpdate.lastQuoteDate = now;
          companyUpdate.lastQuoteValue = data.quoteValue;
        }

        if (data.type === 'deal_won' && data.grossProfit) {
          companyUpdate.grossProfit = data.grossProfit;
        }

        const [updatedCompany] = await tx.update(companies).set(companyUpdate).where(eq(companies.id, companyId)).returning();
        console.log(`[activity] Company ${companyId} lastContactDate updated to ${updatedCompany?.lastContactDate}`);

        // 3. Update contact lastContactDate if contactId provided
        if (contactId) {
          const [updatedContact] = await tx.update(contacts).set({ lastContactDate: now }).where(eq(contacts.id, contactId)).returning();
          console.log(`[activity] Contact ${contactId} lastContactDate updated to ${updatedContact?.lastContactDate}, rows=${updatedContact ? 1 : 0}`);
          if (!updatedContact) {
            console.warn(`[activity] WARNING: Contact ${contactId} not found — lastContactDate not updated`);
          }
        } else {
          console.log(`[activity] No contactId provided — skipping contact lastContactDate update`);
        }

        return created;
      });

      // Increment daily call counter outside the transaction (non-critical)
      if (data.type === 'call') {
        await storage.incrementCallCounter();
      }

      console.log(`[activity] Transaction committed successfully for activity ${activity.id}`);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("[activity] Failed to create activity:", error);
      res.status(500).json({ error: "Failed to create activity" });
    }
  });

  app.patch("/api/activities/:id", isAuthenticated, async (req, res) => {
    try {
      const activityUpdateSchema = z.object({
        note: z.string().optional(),
        outcome: z.string().optional(),
        createdAt: z.string().optional(),
      }).strict();

      const parsed = activityUpdateSchema.parse(req.body);
      const updateData: Record<string, unknown> = { editedAt: new Date() };
      if (parsed.note !== undefined) updateData.note = parsed.note;
      if (parsed.outcome !== undefined) updateData.outcome = parsed.outcome;
      if (parsed.createdAt !== undefined) updateData.createdAt = new Date(parsed.createdAt);

      const activity = await storage.updateActivity(req.params.id as string, updateData);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
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

  // Setup trusts: create trust companies from academy_trust_name and link schools
  app.post("/api/setup-trusts", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.setupTrustsFromAcademyNames();
      res.json(result);
    } catch (error) {
      console.error("Trust setup error:", error);
      res.status(500).json({ error: "Failed to setup trusts" });
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

  // Dashboard: hot leads count (intent status, not trust)
  app.get("/api/dashboard/hot-leads", isAuthenticated, async (req, res) => {
    try {
      const allCompanies = await storage.getCompanies();
      const hotLeads = allCompanies.filter(
        (c) => !c.isTrust && c.budgetStatus === "2-intent"
      );
      res.json({ count: hotLeads.length, companies: hotLeads.slice(0, 10).map(c => ({ id: c.id, name: c.name })) });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hot leads" });
    }
  });

  // Dashboard: recent activity (last 10 activities across all companies)
  app.get("/api/dashboard/recent-activity", isAuthenticated, async (req, res) => {
    try {
      const result = await db.select({
        id: activities.id,
        companyId: activities.companyId,
        type: activities.type,
        note: activities.note,
        outcome: activities.outcome,
        quoteValue: activities.quoteValue,
        createdAt: activities.createdAt,
        companyName: companies.name,
      })
        .from(activities)
        .leftJoin(companies, eq(activities.companyId, companies.id))
        .orderBy(desc(activities.createdAt))
        .limit(10);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent activity" });
    }
  });

  return httpServer;
}
