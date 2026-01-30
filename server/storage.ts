import { db } from "./db";
import { eq, ilike, desc, asc, and, lt, gte } from "drizzle-orm";
import {
  companies,
  contacts,
  callNotes,
  pipelineStages,
  tasks,
  type Company,
  type InsertCompany,
  type Contact,
  type InsertContact,
  type CallNote,
  type InsertCallNote,
  type PipelineStage,
  type InsertPipelineStage,
  type CompanyWithRelations,
  type Task,
  type InsertTask,
  type TaskWithCompany,
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

  // Call Notes
  getCallNotesByCompany(companyId: string): Promise<CallNote[]>;
  createCallNote(note: InsertCallNote): Promise<CallNote>;
  deleteCallNote(id: string): Promise<void>;

  // Tasks
  getTasks(): Promise<TaskWithCompany[]>;
  getTasksByCompany(companyId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
  getTasksDueToday(): Promise<TaskWithCompany[]>;
  getOverdueTasks(): Promise<TaskWithCompany[]>;

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
    const tasksList = await this.getTasksByCompany(id);
    const stages = await this.getPipelineStages();
    const stage = company.stageId ? stages.find((s) => s.id === company.stageId) : undefined;

    return {
      ...company,
      contacts: contactsList,
      callNotes: notesList,
      tasks: tasksList,
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
    // Delete related contacts, notes, and tasks first
    await db.delete(contacts).where(eq(contacts.companyId, id));
    await db.delete(callNotes).where(eq(callNotes.companyId, id));
    await db.delete(tasks).where(eq(tasks.companyId, id));
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
      ? await db.select().from(companies)
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
      ? await db.select().from(companies)
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
      ? await db.select().from(companies)
      : [];
    const companyMap = new Map(companiesList.map(c => [c.id, c]));

    return tasksList.map(t => ({
      ...t,
      company: companyMap.get(t.companyId)!,
    }));
  }

  // Seed default pipeline stages
  async seedData(): Promise<void> {
    const existingStages = await this.getPipelineStages();
    if (existingStages.length > 0) return;

    const defaultStages: InsertPipelineStage[] = [
      { name: "Not Contacted", order: 1, color: "#94a3b8" },
      { name: "Contacted", order: 2, color: "#f59e0b" },
      { name: "Follow-Up Scheduled", order: 3, color: "#3b82f6" },
      { name: "Proposal Sent", order: 4, color: "#8b5cf6" },
      { name: "Closed Won", order: 5, color: "#10b981" },
      { name: "Closed Lost", order: 6, color: "#ef4444" },
    ];

    for (const stage of defaultStages) {
      await this.createPipelineStage(stage);
    }
  }
}

export const storage = new DatabaseStorage();
