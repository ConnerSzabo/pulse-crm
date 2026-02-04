import { db } from "./db";
import { eq, ilike, desc, asc, and, lt, gte, sql, isNotNull, between, inArray } from "drizzle-orm";
import {
  companies,
  contacts,
  callNotes,
  activities,
  pipelineStages,
  tasks,
  dailyStats,
  csvImports,
  deals,
  type Company,
  type InsertCompany,
  type Contact,
  type InsertContact,
  type CallNote,
  type InsertCallNote,
  type Activity,
  type InsertActivity,
  type PipelineStage,
  type InsertPipelineStage,
  type CompanyWithRelations,
  type Task,
  type InsertTask,
  type TaskWithCompany,
  type DailyStats,
  type InsertDailyStats,
  type CsvImport,
  type InsertCsvImport,
  type Deal,
  type InsertDeal,
  type DealWithStage,
} from "@shared/schema";

export interface IStorage {
  // Pipeline Stages
  getPipelineStages(): Promise<PipelineStage[]>;
  createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage>;

  // Companies
  getCompanies(): Promise<(Company & { stage?: PipelineStage })[]>;
  getCompany(id: string): Promise<CompanyWithRelations | undefined>;
  findCompanyByName(name: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<void>;

  // Contacts
  getContactsByCompany(companyId: string): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  deleteContact(id: string): Promise<void>;

  // Call Notes (legacy)
  getCallNotesByCompany(companyId: string): Promise<CallNote[]>;
  createCallNote(note: InsertCallNote): Promise<CallNote>;
  deleteCallNote(id: string): Promise<void>;

  // Activities
  getActivitiesByCompany(companyId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  deleteActivity(id: string): Promise<void>;
  getActivitiesThisMonth(type?: string): Promise<Activity[]>;

  // Tasks
  getTasks(): Promise<TaskWithCompany[]>;
  getTasksByCompany(companyId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
  getTasksDueToday(): Promise<TaskWithCompany[]>;
  getOverdueTasks(): Promise<TaskWithCompany[]>;

  // Daily Stats
  getTodayStats(): Promise<DailyStats | undefined>;
  incrementCallCounter(): Promise<DailyStats>;

  // Dashboard aggregates
  getTotalPipelineValue(): Promise<number>;
  getGPThisMonth(): Promise<number>;
  getDealsNeedingFollowup(): Promise<(Company & { stage?: PipelineStage })[]>;

  // Deals
  getDealsByCompany(companyId: string): Promise<DealWithStage[]>;
  getDeal(id: string): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: string, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: string): Promise<void>;
  getAllDeals(): Promise<DealWithStage[]>;

  // CSV Imports
  getCsvImports(): Promise<CsvImport[]>;
  createCsvImport(data: InsertCsvImport): Promise<CsvImport>;
  updateCsvImport(id: string, data: Partial<InsertCsvImport>): Promise<CsvImport | undefined>;
  deleteCsvImport(id: string): Promise<void>;
  deleteCompaniesByImportBatch(batchId: string): Promise<number>;

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
    const activitiesList = await this.getActivitiesByCompany(id);
    const tasksList = await this.getTasksByCompany(id);
    const dealsList = await this.getDealsByCompany(id);
    const stages = await this.getPipelineStages();
    const stage = company.stageId ? stages.find((s) => s.id === company.stageId) : undefined;

    return {
      ...company,
      contacts: contactsList,
      callNotes: notesList,
      activities: activitiesList,
      tasks: tasksList,
      deals: dealsList,
      stage,
    };
  }

  async findCompanyByName(name: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(ilike(companies.name, name));
    return company;
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
    // Delete related contacts, notes, activities, tasks, and deals first
    await db.delete(contacts).where(eq(contacts.companyId, id));
    await db.delete(callNotes).where(eq(callNotes.companyId, id));
    await db.delete(activities).where(eq(activities.companyId, id));
    await db.delete(tasks).where(eq(tasks.companyId, id));
    await db.delete(deals).where(eq(deals.companyId, id));
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

  // Tasks
  async getTasks(): Promise<TaskWithCompany[]> {
    const tasksList = await db
      .select()
      .from(tasks)
      .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));
    
    const companyIds = Array.from(new Set(tasksList.map(t => t.companyId)));
    const companiesList = companyIds.length > 0
      ? await db.select().from(companies).where(inArray(companies.id, companyIds))
      : [];
    const companyMap = new Map(companiesList.map(c => [c.id, c]));

    return tasksList.map(t => ({
      ...t,
      company: companyMap.get(t.companyId)!,
    }));
  }

  async getTasksByCompany(companyId: string): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.companyId, companyId))
      .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [result] = await db.insert(tasks).values(task).returning();
    return result;
  }

  async updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined> {
    const [result] = await db
      .update(tasks)
      .set(task)
      .where(eq(tasks.id, id))
      .returning();
    return result;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getTasksDueToday(): Promise<TaskWithCompany[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasksList = await db
      .select()
      .from(tasks)
      .where(
        and(
          gte(tasks.dueDate, today),
          lt(tasks.dueDate, tomorrow),
          eq(tasks.status, "todo")
        )
      )
      .orderBy(asc(tasks.dueDate));

    const companyIds = Array.from(new Set(tasksList.map(t => t.companyId)));
    const companiesList = companyIds.length > 0
      ? await db.select().from(companies).where(inArray(companies.id, companyIds))
      : [];
    const companyMap = new Map(companiesList.map(c => [c.id, c]));

    return tasksList.map(t => ({
      ...t,
      company: companyMap.get(t.companyId)!,
    }));
  }

  async getOverdueTasks(): Promise<TaskWithCompany[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tasksList = await db
      .select()
      .from(tasks)
      .where(
        and(
          lt(tasks.dueDate, today),
          eq(tasks.status, "todo")
        )
      )
      .orderBy(asc(tasks.dueDate));

    const companyIds = Array.from(new Set(tasksList.map(t => t.companyId)));
    const companiesList = companyIds.length > 0
      ? await db.select().from(companies).where(inArray(companies.id, companyIds))
      : [];
    const companyMap = new Map(companiesList.map(c => [c.id, c]));

    return tasksList.map(t => ({
      ...t,
      company: companyMap.get(t.companyId)!,
    }));
  }

  // Activities
  async getActivitiesByCompany(companyId: string): Promise<Activity[]> {
    return db
      .select()
      .from(activities)
      .where(eq(activities.companyId, companyId))
      .orderBy(desc(activities.createdAt));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [result] = await db.insert(activities).values(activity).returning();
    return result;
  }

  async deleteActivity(id: string): Promise<void> {
    await db.delete(activities).where(eq(activities.id, id));
  }

  async getActivitiesThisMonth(type?: string): Promise<Activity[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    if (type) {
      return db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.type, type),
            gte(activities.createdAt, startOfMonth)
          )
        )
        .orderBy(desc(activities.createdAt));
    }
    
    return db
      .select()
      .from(activities)
      .where(gte(activities.createdAt, startOfMonth))
      .orderBy(desc(activities.createdAt));
  }

  // Daily Stats
  async getTodayStats(): Promise<DailyStats | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const [stats] = await db
      .select()
      .from(dailyStats)
      .where(eq(dailyStats.date, today));
    return stats;
  }

  async incrementCallCounter(): Promise<DailyStats> {
    const today = new Date().toISOString().split('T')[0];
    const existing = await this.getTodayStats();
    
    if (existing) {
      const [result] = await db
        .update(dailyStats)
        .set({ callsMade: existing.callsMade + 1 })
        .where(eq(dailyStats.id, existing.id))
        .returning();
      return result;
    }
    
    const [result] = await db
      .insert(dailyStats)
      .values({ date: today, callsMade: 1 })
      .returning();
    return result;
  }

  // Dashboard aggregates
  async getTotalPipelineValue(): Promise<number> {
    // Sum of lastQuoteValue for all companies with a quote and not closed
    const stages = await this.getPipelineStages();
    const closedWonStage = stages.find(s => s.name === 'Closed Won');
    const closedLostStage = stages.find(s => s.name === 'Closed Lost');
    
    const companiesList = await db.select().from(companies);
    
    let total = 0;
    for (const c of companiesList) {
      // Exclude closed won and closed lost from pipeline value
      if (c.stageId === closedWonStage?.id || c.stageId === closedLostStage?.id) continue;
      if (c.lastQuoteValue) {
        total += parseFloat(c.lastQuoteValue);
      }
    }
    return total;
  }

  async getGPThisMonth(): Promise<number> {
    // Sum of grossProfit from deal_won activities this month
    const dealWonActivities = await this.getActivitiesThisMonth('deal_won');
    let total = 0;
    for (const a of dealWonActivities) {
      if (a.grossProfit) {
        total += parseFloat(a.grossProfit);
      }
    }
    return total;
  }

  async getDealsNeedingFollowup(): Promise<(Company & { stage?: PipelineStage })[]> {
    // Companies with a quote date > 3 days ago and no contact since
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const stages = await this.getPipelineStages();
    const stageMap = new Map(stages.map(s => [s.id, s]));
    const quotePresentedStage = stages.find(s => s.name === 'Quote Presented');
    
    const companiesList = await db.select().from(companies);
    
    return companiesList
      .filter(c => {
        // Has a quote date
        if (!c.lastQuoteDate) return false;
        // Quote was more than 3 days ago
        if (new Date(c.lastQuoteDate) > threeDaysAgo) return false;
        // No contact since quote
        if (c.lastContactDate && new Date(c.lastContactDate) > new Date(c.lastQuoteDate)) return false;
        // Not closed
        const stage = c.stageId ? stageMap.get(c.stageId) : undefined;
        if (stage?.name === 'Closed Won' || stage?.name === 'Closed Lost') return false;
        return true;
      })
      .map(c => ({
        ...c,
        stage: c.stageId ? stageMap.get(c.stageId) : undefined,
      }));
  }

  // Deals
  async getDealsByCompany(companyId: string): Promise<DealWithStage[]> {
    const dealsList = await db
      .select()
      .from(deals)
      .where(eq(deals.companyId, companyId))
      .orderBy(desc(deals.createdAt));

    const stages = await this.getPipelineStages();
    const stageMap = new Map(stages.map(s => [s.id, s]));

    return dealsList.map(d => ({
      ...d,
      stage: d.stageId ? stageMap.get(d.stageId) : undefined,
    }));
  }

  async getDeal(id: string): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal;
  }

  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [result] = await db.insert(deals).values(deal).returning();
    return result;
  }

  async updateDeal(id: string, deal: Partial<InsertDeal>): Promise<Deal | undefined> {
    const [result] = await db
      .update(deals)
      .set(deal)
      .where(eq(deals.id, id))
      .returning();
    return result;
  }

  async deleteDeal(id: string): Promise<void> {
    await db.delete(deals).where(eq(deals.id, id));
  }

  async getAllDeals(): Promise<DealWithStage[]> {
    const dealsList = await db
      .select()
      .from(deals)
      .orderBy(desc(deals.createdAt));

    const stages = await this.getPipelineStages();
    const stageMap = new Map(stages.map(s => [s.id, s]));

    return dealsList.map(d => ({
      ...d,
      stage: d.stageId ? stageMap.get(d.stageId) : undefined,
    }));
  }

  // CSV Imports
  async getCsvImports(): Promise<CsvImport[]> {
    return db.select().from(csvImports).orderBy(desc(csvImports.importedAt));
  }

  async createCsvImport(data: InsertCsvImport): Promise<CsvImport> {
    const [result] = await db.insert(csvImports).values(data).returning();
    return result;
  }

  async updateCsvImport(id: string, data: Partial<InsertCsvImport>): Promise<CsvImport | undefined> {
    const [result] = await db
      .update(csvImports)
      .set(data)
      .where(eq(csvImports.id, id))
      .returning();
    return result;
  }

  async deleteCsvImport(id: string): Promise<void> {
    await db.delete(csvImports).where(eq(csvImports.id, id));
  }

  async deleteCompaniesByImportBatch(batchId: string): Promise<number> {
    // First get all company IDs in this batch
    const companiesToDelete = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.importBatchId, batchId));

    // Delete related data for each company
    for (const company of companiesToDelete) {
      await db.delete(contacts).where(eq(contacts.companyId, company.id));
      await db.delete(callNotes).where(eq(callNotes.companyId, company.id));
      await db.delete(activities).where(eq(activities.companyId, company.id));
      await db.delete(tasks).where(eq(tasks.companyId, company.id));
      await db.delete(deals).where(eq(deals.companyId, company.id));
    }

    // Delete the companies
    const result = await db.delete(companies).where(eq(companies.importBatchId, batchId)).returning();
    return result.length;
  }

  // Seed default pipeline stages (Wave Systems)
  async seedData(): Promise<void> {
    try {
      const existingStages = await this.getPipelineStages();

      const defaultStages: InsertPipelineStage[] = [
        { name: "Contacted", order: 1, color: "#94a3b8" },
        { name: "Future Deal", order: 2, color: "#f59e0b" },
        { name: "Quote Presented", order: 3, color: "#3b82f6" },
        { name: "Decision Maker Brought In", order: 4, color: "#8b5cf6" },
        { name: "Awaiting Order", order: 5, color: "#a855f7" },
        { name: "Closed Won", order: 6, color: "#10b981" },
        { name: "Closed Lost", order: 7, color: "#ef4444" },
      ];

      if (existingStages.length === 0) {
        // Create new stages
        for (const stage of defaultStages) {
          await this.createPipelineStage(stage);
        }
      } else {
        // Update existing stages to match the new names/order
        const targetNames = new Set(defaultStages.map(s => s.name));

        // Find stages that shouldn't exist (like "Future Pipeline", "Recycled")
        const stagesToDelete = existingStages.filter(s => !targetNames.has(s.name));

        // First, unassign companies and deals from stages we're about to delete
        for (const stage of stagesToDelete) {
          // Set stageId to null for companies referencing this stage
          await db.update(companies)
            .set({ stageId: null })
            .where(eq(companies.stageId, stage.id));
          // Set stageId to null for deals referencing this stage
          await db.update(deals)
            .set({ stageId: null })
            .where(eq(deals.stageId, stage.id));
          // Now safe to delete the stage
          await db.delete(pipelineStages).where(eq(pipelineStages.id, stage.id));
        }

        // Update order/color for existing stages and create missing ones
        for (const stage of defaultStages) {
          const existing = existingStages.find(s => s.name === stage.name);
          if (existing) {
            await db.update(pipelineStages)
              .set({ order: stage.order, color: stage.color })
              .where(eq(pipelineStages.id, existing.id));
          } else {
            await this.createPipelineStage(stage);
          }
        }
      }
    } catch (error) {
      console.error("Error seeding pipeline stages:", error);
      // Don't throw - allow app to start even if seeding fails
    }
  }
}

export const storage = new DatabaseStorage();
