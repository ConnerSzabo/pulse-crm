import { db } from "./db";
import { eq } from "drizzle-orm";
import {
  companies,
  contacts,
  callNotes,
  pipelineStages,
  type Company,
  type InsertCompany,
  type Contact,
  type InsertContact,
  type CallNote,
  type InsertCallNote,
  type PipelineStage,
  type InsertPipelineStage,
  type CompanyWithRelations,
} from "@shared/schema";

export interface IStorage {
  // Pipeline Stages
  getPipelineStages(): Promise<PipelineStage[]>;
  createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage>;

  // Companies
  getCompanies(): Promise<(Company & { stage?: PipelineStage })[]>;
  getCompany(id: string): Promise<CompanyWithRelations | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<void>;

  // Contacts
  getContactsByCompany(companyId: string): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  deleteContact(id: string): Promise<void>;

  // Call Notes
  getCallNotesByCompany(companyId: string): Promise<CallNote[]>;
  createCallNote(note: InsertCallNote): Promise<CallNote>;
  deleteCallNote(id: string): Promise<void>;

  // Seed
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Pipeline Stages
  async getPipelineStages(): Promise<PipelineStage[]> {
    return db.select().from(pipelineStages).orderBy(pipelineStages.order);
  }

  async createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage> {
    const [result] = await db.insert(pipelineStages).values(stage).returning();
    return result;
  }

  // Companies
  async getCompanies(): Promise<(Company & { stage?: PipelineStage })[]> {
    const companiesList = await db.select().from(companies).orderBy(companies.name);
    const stages = await this.getPipelineStages();
    const stageMap = new Map(stages.map((s) => [s.id, s]));

    return companiesList.map((c) => ({
      ...c,
      stage: c.stageId ? stageMap.get(c.stageId) : undefined,
    }));
  }

  async getCompany(id: string): Promise<CompanyWithRelations | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    if (!company) return undefined;

    const contactsList = await this.getContactsByCompany(id);
    const notesList = await this.getCallNotesByCompany(id);
    const stages = await this.getPipelineStages();
    const stage = company.stageId ? stages.find((s) => s.id === company.stageId) : undefined;

    return {
      ...company,
      contacts: contactsList,
      callNotes: notesList,
      stage,
    };
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [result] = await db.insert(companies).values(company).returning();
    return result;
  }

  async updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined> {
    const [result] = await db
      .update(companies)
      .set(company)
      .where(eq(companies.id, id))
      .returning();
    return result;
  }

  async deleteCompany(id: string): Promise<void> {
    // Delete related contacts and notes first
    await db.delete(contacts).where(eq(contacts.companyId, id));
    await db.delete(callNotes).where(eq(callNotes.companyId, id));
    await db.delete(companies).where(eq(companies.id, id));
  }

  // Contacts
  async getContactsByCompany(companyId: string): Promise<Contact[]> {
    return db.select().from(contacts).where(eq(contacts.companyId, companyId));
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [result] = await db.insert(contacts).values(contact).returning();
    return result;
  }

  async deleteContact(id: string): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  // Call Notes
  async getCallNotesByCompany(companyId: string): Promise<CallNote[]> {
    return db.select().from(callNotes).where(eq(callNotes.companyId, companyId));
  }

  async createCallNote(note: InsertCallNote): Promise<CallNote> {
    const [result] = await db.insert(callNotes).values(note).returning();
    return result;
  }

  async deleteCallNote(id: string): Promise<void> {
    await db.delete(callNotes).where(eq(callNotes.id, id));
  }

  // Seed default pipeline stages
  async seedData(): Promise<void> {
    const existingStages = await this.getPipelineStages();
    if (existingStages.length > 0) return;

    const defaultStages: InsertPipelineStage[] = [
      { name: "Lead", order: 1, color: "#6366f1" },
      { name: "Contacted", order: 2, color: "#f59e0b" },
      { name: "Qualified", order: 3, color: "#3b82f6" },
      { name: "Proposal", order: 4, color: "#8b5cf6" },
      { name: "Won", order: 5, color: "#10b981" },
      { name: "Lost", order: 6, color: "#ef4444" },
    ];

    for (const stage of defaultStages) {
      await this.createPipelineStage(stage);
    }

    // Seed some sample companies
    const stages = await this.getPipelineStages();
    const leadStage = stages.find((s) => s.name === "Lead");
    const contactedStage = stages.find((s) => s.name === "Contacted");
    const qualifiedStage = stages.find((s) => s.name === "Qualified");

    const sampleCompanies: InsertCompany[] = [
      { name: "Greenwood Elementary School", phone: "555-123-4567", stageId: leadStage?.id },
      { name: "Tech Solutions Inc", phone: "555-234-5678", stageId: contactedStage?.id },
      { name: "Valley High School", phone: "555-345-6789", stageId: qualifiedStage?.id },
      { name: "Riverside Academy", phone: "555-456-7890", stageId: leadStage?.id },
      { name: "Metro Business College", phone: "555-567-8901", stageId: null },
    ];

    for (const company of sampleCompanies) {
      const created = await this.createCompany(company);
      
      // Add sample contacts for first two companies
      if (company.name === "Greenwood Elementary School") {
        await this.createContact({
          companyId: created.id,
          email: "principal@greenwood.edu",
          name: "Sarah Johnson",
          role: "Principal",
        });
        await this.createContact({
          companyId: created.id,
          email: "admin@greenwood.edu",
          name: "Mike Williams",
          role: "Administrator",
        });
        await this.createCallNote({
          companyId: created.id,
          note: "Initial call - interested in learning more about our services. Asked for pricing info.",
        });
      }

      if (company.name === "Tech Solutions Inc") {
        await this.createContact({
          companyId: created.id,
          email: "ceo@techsolutions.com",
          name: "John Smith",
          role: "CEO",
        });
        await this.createCallNote({
          companyId: created.id,
          note: "Follow-up call. They need a demo scheduled for next week.",
        });
        await this.createCallNote({
          companyId: created.id,
          note: "Sent proposal documents via email. Waiting for response.",
        });
      }
    }
  }
}

export const storage = new DatabaseStorage();
