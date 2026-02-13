import { db } from "./db";
import { eq, ilike, desc, asc, and, lt, gte, sql, isNull, isNotNull, between, inArray } from "drizzle-orm";
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
  trusts,
  companyRelationships,
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
  type DealWithCompanyAndStage,
  type Trust,
  type InsertTrust,
  type TrustWithStats,
  type ContactWithCompany,
  type CompanyRelationship,
  type InsertCompanyRelationship,
  type CompanyRelationshipWithCompany,
} from "@shared/schema";

/**
 * Normalize a phone number for duplicate detection.
 * Strips all non-digits, prepends 0 if exactly 10 digits (UK numbers missing leading 0).
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = "0" + digits;
  return digits;
}

/**
 * Normalize a website URL for duplicate detection.
 * Lowercases, removes protocol, www., and trailing slash.
 */
export function normalizeWebsite(website: string | null | undefined): string {
  if (!website) return "";
  let normalized = website.trim().toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, "");
  normalized = normalized.replace(/^www\./, "");
  normalized = normalized.replace(/\/+$/, "");
  return normalized;
}

/**
 * Normalize a company name for duplicate detection.
 * Trims whitespace, lowercases, removes common prefixes,
 * standardizes "St." / "St " to "Saint ", and collapses multiple spaces.
 */
export function normalizeCompanyName(name: string): string {
  let normalized = name.trim().toLowerCase();
  // Remove common prefixes
  normalized = normalized.replace(/^(the|a|an)\s+/i, "");
  // Standardize "St." and "St " to "Saint "
  normalized = normalized.replace(/\bst\.\s*/g, "saint ");
  normalized = normalized.replace(/\bst\s+/g, "saint ");
  // Collapse multiple spaces to single space
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

/**
 * Normalize a location for duplicate detection.
 * Trims whitespace, lowercases, and collapses multiple spaces.
 */
export function normalizeLocation(location: string | null | undefined): string {
  if (!location) return "";
  return location.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface IStorage {
  // Pipeline Stages
  getPipelineStages(): Promise<PipelineStage[]>;
  createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage>;

  // Companies
  getCompanies(): Promise<(Company & { stage?: PipelineStage; trust?: Trust })[]>;
  getCompany(id: string): Promise<CompanyWithRelations | undefined>;
  findCompanyByNameAndLocation(name: string, location: string | null | undefined): Promise<Company | undefined>;
  findCompanyByPhone(phone: string): Promise<Company | undefined>;
  findCompanyByWebsite(website: string): Promise<Company | undefined>;
  checkDuplicates(params: { name: string; phone?: string; website?: string; location?: string }): Promise<{ phoneMatch?: Company; websiteMatch?: Company; nameMatch?: Company }>;
  mergeCompanies(keepId: string, deleteId: string): Promise<void>;
  scoreCompany(company: Company): Promise<number>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<void>;

  // Contacts
  getAllContacts(): Promise<ContactWithCompany[]>;
  getContact(id: string): Promise<ContactWithCompany | undefined>;
  getContactsByCompany(companyId: string): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, data: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<void>;

  // Call Notes (legacy)
  getCallNotesByCompany(companyId: string): Promise<CallNote[]>;
  createCallNote(note: InsertCallNote): Promise<CallNote>;
  deleteCallNote(id: string): Promise<void>;

  // Activities
  getActivitiesByCompany(companyId: string): Promise<Activity[]>;
  getActivitiesByCompanyPaginated(companyId: string, limit: number, offset: number): Promise<Activity[]>;
  getActivity(id: string): Promise<Activity | undefined>;
  createActivity(activity: InsertActivity, customDate?: Date): Promise<Activity>;
  updateActivity(id: string, data: Partial<InsertActivity> & { editedAt?: Date }): Promise<Activity | undefined>;
  deleteActivity(id: string): Promise<void>;
  getActivitiesThisMonth(type?: string): Promise<Activity[]>;
  getCallActivities(startDate: Date, endDate: Date): Promise<(Activity & { companyName?: string })[]>;
  migrateCallOutcomes(): Promise<{ updated: number }>;

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
  getAllDeals(): Promise<DealWithCompanyAndStage[]>;

  // CSV Imports
  getCsvImports(): Promise<CsvImport[]>;
  createCsvImport(data: InsertCsvImport): Promise<CsvImport>;
  updateCsvImport(id: string, data: Partial<InsertCsvImport>): Promise<CsvImport | undefined>;
  deleteCsvImport(id: string): Promise<void>;
  deleteCompaniesByImportBatch(batchId: string): Promise<number>;

  // Backfill
  backfillLeadStatus(): Promise<number>;

  // Search
  globalSearch(query: string): Promise<{
    companies: (Company & { stage?: PipelineStage })[];
    contacts: (Contact & { companyName?: string })[];
    deals: (Deal & { companyName?: string; stage?: PipelineStage })[];
  }>;

  // Trusts
  getTrusts(): Promise<Trust[]>;
  getTrust(id: string): Promise<Trust | undefined>;
  getTrustByName(name: string): Promise<Trust | undefined>;
  createTrust(trust: InsertTrust): Promise<Trust>;
  updateTrust(id: string, data: Partial<InsertTrust>): Promise<Trust | undefined>;
  deleteTrust(id: string): Promise<void>;
  getCompaniesByTrust(trustId: string): Promise<(Company & { stage?: PipelineStage; deals: DealWithStage[] })[]>;
  getTrustPipelineSummary(trustId: string): Promise<{ stageId: string; stageName: string; stageColor: string; dealCount: number; totalValue: number }[]>;
  getTrustActivities(trustId: string, limit: number, offset: number): Promise<(Activity & { companyName?: string })[]>;
  getTrustsWithStats(): Promise<TrustWithStats[]>;
  migrateAcademyTrusts(): Promise<{ migratedCount: number; trustsCreated: number }>;

  // Trust Companies & Relationships
  getChildCompanies(parentId: string): Promise<(Company & { stage?: PipelineStage })[]>;
  getTrustCompanies(): Promise<(Company & { stage?: PipelineStage; childCount?: number })[]>;
  findTrustCompanyByName(name: string): Promise<Company | undefined>;
  getCompanyRelationships(companyId: string): Promise<CompanyRelationshipWithCompany[]>;
  createCompanyRelationship(data: InsertCompanyRelationship): Promise<CompanyRelationship>;
  deleteCompanyRelationship(id: string): Promise<void>;
  linkSchoolsToTrust(trustId: string, schoolIds: string[]): Promise<void>;
  unlinkSchoolFromTrust(schoolId: string): Promise<void>;
  setupTrustsFromAcademyNames(): Promise<{ trustsCreated: number; trustsSkipped: number; schoolsLinked: number; uniqueTrustNames: number }>;

  // Seed
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // In-memory cache for pipeline stages (rarely change, queried frequently)
  private pipelineStagesCache: PipelineStage[] | null = null;
  private pipelineStagesCacheTime = 0;
  private static STAGES_CACHE_TTL = 60_000; // 1 minute

  // Pipeline Stages
  async getPipelineStages(): Promise<PipelineStage[]> {
    const now = Date.now();
    if (this.pipelineStagesCache && (now - this.pipelineStagesCacheTime) < DatabaseStorage.STAGES_CACHE_TTL) {
      return this.pipelineStagesCache;
    }
    const stages = await db.select().from(pipelineStages).orderBy(pipelineStages.order);
    this.pipelineStagesCache = stages;
    this.pipelineStagesCacheTime = now;
    return stages;
  }

  private invalidateStagesCache() {
    this.pipelineStagesCache = null;
  }

  async createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage> {
    this.invalidateStagesCache();
    const [result] = await db.insert(pipelineStages).values(stage).returning();
    return result;
  }

  // Companies
  async getCompanies(): Promise<(Company & { stage?: PipelineStage; trust?: Trust; parentCompany?: Company })[]> {
    const companiesList = await db.select().from(companies).orderBy(companies.name);
    const stages = await this.getPipelineStages();
    const stageMap = new Map(stages.map((s) => [s.id, s]));

    // Load trusts for companies that have trustId (legacy)
    const trustIds = Array.from(new Set(companiesList.map(c => c.trustId).filter(Boolean))) as string[];
    const trustsList = trustIds.length > 0
      ? await db.select().from(trusts).where(inArray(trusts.id, trustIds))
      : [];
    const trustMap = new Map(trustsList.map(t => [t.id, t]));

    // Build a map of all companies for parentCompany lookups
    const companyMap = new Map(companiesList.map(c => [c.id, c]));

    return companiesList.map((c) => ({
      ...c,
      stage: c.stageId ? stageMap.get(c.stageId) : undefined,
      trust: c.trustId ? trustMap.get(c.trustId) : undefined,
      parentCompany: c.parentCompanyId ? companyMap.get(c.parentCompanyId) : undefined,
    }));
  }

  async getCompany(id: string): Promise<CompanyWithRelations | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    if (!company) return undefined;

    const results = await Promise.allSettled([
      this.getContactsByCompany(id),
      this.getCallNotesByCompany(id),
      this.getActivitiesByCompanyPaginated(id, 20, 0),
      this.getTasksByCompany(id),
      this.getDealsByCompany(id),
      this.getPipelineStages(),
      company.trustId ? db.select().from(trusts).where(eq(trusts.id, company.trustId)).then(r => r[0]) : Promise.resolve(undefined),
      company.parentCompanyId ? db.select().from(companies).where(eq(companies.id, company.parentCompanyId)).then(r => r[0]) : Promise.resolve(undefined),
      company.isTrust ? db.select().from(companies).where(eq(companies.parentCompanyId, id)).orderBy(companies.name) : Promise.resolve([]),
      this.getCompanyRelationships(id),
    ]);

    const queryNames = ["contacts", "callNotes", "activities", "tasks", "deals", "stages", "trust", "parentCompany", "childCompanies", "relationships"];
    const getValue = <T>(result: PromiseSettledResult<T>, fallback: T, name: string): T => {
      if (result.status === "rejected") {
        console.error(`getCompany(${id}): ${name} query failed:`, result.reason);
        return fallback;
      }
      return result.value;
    };

    const contactsList = getValue(results[0], [], queryNames[0]);
    const notesList = getValue(results[1], [], queryNames[1]);
    const activitiesList = getValue(results[2], [], queryNames[2]);
    const tasksList = getValue(results[3], [], queryNames[3]);
    const dealsList = getValue(results[4], [] as DealWithStage[], queryNames[4]);
    const stages = getValue(results[5], [] as PipelineStage[], queryNames[5]);
    const trust = getValue(results[6], undefined, queryNames[6]);
    const parentCompany = getValue(results[7], undefined, queryNames[7]);
    const childCompanies = getValue(results[8], [] as Company[], queryNames[8]);
    const relationships = getValue(results[9], [] as CompanyRelationshipWithCompany[], queryNames[9]);

    const stage = company.stageId ? stages.find((s) => s.id === company.stageId) : undefined;

    return {
      ...company,
      contacts: contactsList,
      callNotes: notesList,
      activities: activitiesList,
      tasks: tasksList,
      deals: dealsList,
      stage,
      trust,
      parentCompany,
      childCompanies,
      relationships,
    };
  }

  async findCompanyByNameAndLocation(name: string, location: string | null | undefined): Promise<Company | undefined> {
    const normalizedName = normalizeCompanyName(name);
    const normalizedLoc = normalizeLocation(location);
    // Apply the same normalization in SQL for a reliable match.
    // Name: trim, lowercase, strip prefixes, standardize "st."/"st " → "saint ", collapse spaces
    // Location: trim, lowercase, coalesce null to ''
    const [company] = await db
      .select()
      .from(companies)
      .where(
        sql`TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM(${companies.name})), '^(the|a|an)\\s+', '', 'i'), '\\mst\\.\\s*', 'saint ', 'gi'), '\\mst\\s+', 'saint ', 'gi'), '\\s+', ' ', 'g')) = ${normalizedName}
        AND LOWER(TRIM(COALESCE(${companies.location}, ''))) = ${normalizedLoc}`
      );
    return company;
  }

  async findCompanyByPhone(phone: string): Promise<Company | undefined> {
    const normalized = normalizePhone(phone);
    if (!normalized) return undefined;
    // Match by stripping non-digits from the DB phone and comparing, also handle 10-digit → 11-digit normalization
    const [company] = await db
      .select()
      .from(companies)
      .where(
        sql`CASE
          WHEN LENGTH(REGEXP_REPLACE(${companies.phone}, '\\D', '', 'g')) = 10
          THEN '0' || REGEXP_REPLACE(${companies.phone}, '\\D', '', 'g')
          ELSE REGEXP_REPLACE(${companies.phone}, '\\D', '', 'g')
        END = ${normalized}
        AND ${companies.phone} IS NOT NULL
        AND ${companies.phone} != ''`
      )
      .limit(1);
    return company;
  }

  async findCompanyByWebsite(website: string): Promise<Company | undefined> {
    const normalized = normalizeWebsite(website);
    if (!normalized) return undefined;
    const [company] = await db
      .select()
      .from(companies)
      .where(
        sql`REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM(${companies.website})), '^https?://', '', 'i'), '^www\\.', '', 'i'), '/+$', '', 'g') = ${normalized}
        AND ${companies.website} IS NOT NULL
        AND ${companies.website} != ''`
      )
      .limit(1);
    return company;
  }

  async checkDuplicates(params: { name: string; phone?: string; website?: string; location?: string }): Promise<{ phoneMatch?: Company; websiteMatch?: Company; nameMatch?: Company }> {
    const result: { phoneMatch?: Company; websiteMatch?: Company; nameMatch?: Company } = {};

    if (params.phone) {
      const match = await this.findCompanyByPhone(params.phone);
      if (match) result.phoneMatch = match;
    }

    if (params.website) {
      const match = await this.findCompanyByWebsite(params.website);
      if (match) result.websiteMatch = match;
    }

    if (params.name) {
      const match = await this.findCompanyByNameAndLocation(params.name, params.location);
      if (match) result.nameMatch = match;
    }

    return result;
  }

  async mergeCompanies(keepId: string, deleteId: string): Promise<void> {
    // Move contacts from duplicate to keeper
    await db.update(contacts).set({ companyId: keepId }).where(eq(contacts.companyId, deleteId));
    // Move activities
    await db.update(activities).set({ companyId: keepId }).where(eq(activities.companyId, deleteId));
    // Move tasks
    await db.update(tasks).set({ companyId: keepId }).where(eq(tasks.companyId, deleteId));
    // Move deals
    await db.update(deals).set({ companyId: keepId }).where(eq(deals.companyId, deleteId));
    // Move call notes
    await db.update(callNotes).set({ companyId: keepId }).where(eq(callNotes.companyId, deleteId));
    // Update parentCompanyId references
    await db.update(companies).set({ parentCompanyId: keepId }).where(eq(companies.parentCompanyId, deleteId));
    // Move company relationships
    await db.update(companyRelationships).set({ companyId: keepId }).where(eq(companyRelationships.companyId, deleteId));
    await db.update(companyRelationships).set({ relatedCompanyId: keepId }).where(eq(companyRelationships.relatedCompanyId, deleteId));
    // Delete the duplicate company
    await db.delete(companyRelationships).where(
      sql`${companyRelationships.companyId} = ${deleteId} OR ${companyRelationships.relatedCompanyId} = ${deleteId}`
    );
    await db.delete(companies).where(eq(companies.id, deleteId));
  }

  async scoreCompany(company: Company): Promise<number> {
    let score = 0;
    if (company.website) score += 5;
    if (company.phone) score += 3;
    if (company.location) score += 2;
    if (company.itManagerName) score += 2;
    if (company.itManagerEmail) score += 2;
    if (company.notes) score += 1;
    if (company.academyTrustName) score += 1;
    if (company.lastContactDate) score += 2;
    if (company.lastQuoteValue) score += 2;
    // Count contacts
    const contactsList = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.companyId, company.id));
    score += contactsList.length * 2;
    return score;
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
    // Delete company relationships
    await db.delete(companyRelationships).where(
      sql`${companyRelationships.companyId} = ${id} OR ${companyRelationships.relatedCompanyId} = ${id}`
    );
    // Null out parentCompanyId for child companies
    await db.update(companies).set({ parentCompanyId: null }).where(eq(companies.parentCompanyId, id));
    await db.delete(companies).where(eq(companies.id, id));
  }

  // Contacts
  async getAllContacts(): Promise<ContactWithCompany[]> {
    const contactsList = await db.select().from(contacts).orderBy(desc(contacts.createdAt));
    const companyIds = Array.from(new Set(contactsList.map(c => c.companyId).filter(Boolean))) as string[];
    const companiesList = companyIds.length > 0
      ? await db.select().from(companies).where(inArray(companies.id, companyIds))
      : [];
    const companyMap = new Map(companiesList.map(c => [c.id, c]));

    return contactsList.map(c => ({
      ...c,
      companyName: c.companyId ? companyMap.get(c.companyId)?.name : undefined,
      companyBudgetStatus: c.companyId ? companyMap.get(c.companyId)?.budgetStatus ?? undefined : undefined,
    }));
  }

  async getContact(id: string): Promise<ContactWithCompany | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    if (!contact) return undefined;

    let companyName: string | undefined;
    let companyBudgetStatus: string | undefined;
    if (contact.companyId) {
      const [company] = await db.select().from(companies).where(eq(companies.id, contact.companyId));
      companyName = company?.name;
      companyBudgetStatus = company?.budgetStatus ?? undefined;
    }

    return { ...contact, companyName, companyBudgetStatus };
  }

  async getContactsByCompany(companyId: string): Promise<Contact[]> {
    return db.select().from(contacts).where(eq(contacts.companyId, companyId));
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [result] = await db.insert(contacts).values(contact).returning();
    return result;
  }

  async updateContact(id: string, data: Partial<InsertContact>): Promise<Contact | undefined> {
    const [result] = await db
      .update(contacts)
      .set(data)
      .where(eq(contacts.id, id))
      .returning();
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

  // PERFORMANCE: Paginated activities for faster initial load
  async getActivitiesByCompanyPaginated(companyId: string, limit: number, offset: number): Promise<Activity[]> {
    return db
      .select()
      .from(activities)
      .where(eq(activities.companyId, companyId))
      .orderBy(desc(activities.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getActivity(id: string): Promise<Activity | undefined> {
    const [activity] = await db.select().from(activities).where(eq(activities.id, id));
    return activity;
  }

  async createActivity(activity: InsertActivity, customDate?: Date): Promise<Activity> {
    const values = customDate ? { ...activity, createdAt: customDate } : activity;
    const [result] = await db.insert(activities).values(values).returning();
    return result;
  }

  async updateActivity(id: string, data: Partial<InsertActivity> & { editedAt?: Date }): Promise<Activity | undefined> {
    const [result] = await db
      .update(activities)
      .set(data)
      .where(eq(activities.id, id))
      .returning();
    return result;
  }

  async deleteActivity(id: string): Promise<void> {
    await db.delete(activities).where(eq(activities.id, id));
  }

  async getCallActivities(startDate: Date, endDate: Date): Promise<(Activity & { companyName?: string })[]> {
    const callActivities = await db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.type, "call"),
          gte(activities.createdAt, startDate),
          lt(activities.createdAt, endDate)
        )
      )
      .orderBy(desc(activities.createdAt));

    // Get company names
    const companyIds = Array.from(new Set(callActivities.map(a => a.companyId)));
    const companiesList = companyIds.length > 0
      ? await db.select().from(companies).where(inArray(companies.id, companyIds))
      : [];
    const companyMap = new Map(companiesList.map(c => [c.id, c.name]));

    return callActivities.map(a => ({
      ...a,
      companyName: companyMap.get(a.companyId),
    }));
  }

  async migrateCallOutcomes(): Promise<{ updated: number }> {
    // Map old outcomes to new ones
    const receptionVoicemailOutcomes = ['voicemail', 'no_answer', 'busy', 'wrong_number', 'Reception / Voicemail'];
    const connectedOutcomes = ['answered', 'connected', 'spoke', 'Connected to DM'];
    const detailsOutcomes = ['got details', 'info received', 'Decision Maker Details'];

    let updated = 0;

    // Migrate reception/voicemail
    const r1 = await db.update(activities)
      .set({ outcome: 'Reception / Voicemail' })
      .where(
        and(
          eq(activities.type, 'call'),
          inArray(activities.outcome, receptionVoicemailOutcomes)
        )
      )
      .returning();
    updated += r1.length;

    // Migrate connected to DM
    const r2 = await db.update(activities)
      .set({ outcome: 'Connected to DM' })
      .where(
        and(
          eq(activities.type, 'call'),
          inArray(activities.outcome, connectedOutcomes)
        )
      )
      .returning();
    updated += r2.length;

    // Migrate decision maker details
    const r3 = await db.update(activities)
      .set({ outcome: 'Decision Maker Details' })
      .where(
        and(
          eq(activities.type, 'call'),
          inArray(activities.outcome, detailsOutcomes)
        )
      )
      .returning();
    updated += r3.length;

    // Any remaining non-null outcomes that don't match the 3 valid ones → map to Reception / Voicemail
    const validOutcomes = ['Reception / Voicemail', 'Connected to DM', 'Decision Maker Details'];
    const remaining = await db.select().from(activities).where(
      and(
        eq(activities.type, 'call'),
        isNotNull(activities.outcome),
        sql`${activities.outcome} NOT IN ('Reception / Voicemail', 'Connected to DM', 'Decision Maker Details')`
      )
    );
    if (remaining.length > 0) {
      const remainingIds = remaining.map(r => r.id);
      const r4 = await db.update(activities)
        .set({ outcome: 'Reception / Voicemail' })
        .where(inArray(activities.id, remainingIds))
        .returning();
      updated += r4.length;
    }

    return { updated };
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

  async getAllDeals(): Promise<DealWithCompanyAndStage[]> {
    const dealsList = await db
      .select()
      .from(deals)
      .orderBy(desc(deals.createdAt));

    const stages = await this.getPipelineStages();
    const stageMap = new Map(stages.map(s => [s.id, s]));

    // Get all companies for the deals
    const companyIds = Array.from(new Set(dealsList.map(d => d.companyId)));
    const companiesList = companyIds.length > 0
      ? await db.select().from(companies).where(inArray(companies.id, companyIds))
      : [];
    const companyMap = new Map(companiesList.map(c => [c.id, c]));

    return dealsList.map(d => ({
      ...d,
      stage: d.stageId ? stageMap.get(d.stageId) : undefined,
      company: companyMap.get(d.companyId),
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

  async backfillLeadStatus(): Promise<number> {
    const result = await db
      .update(companies)
      .set({ budgetStatus: "0-unqualified" })
      .where(isNull(companies.budgetStatus))
      .returning();
    return result.length;
  }

  // Global Search
  async globalSearch(query: string): Promise<{
    companies: (Company & { stage?: PipelineStage })[];
    contacts: (Contact & { companyName?: string })[];
    deals: (Deal & { companyName?: string; stage?: PipelineStage })[];
  }> {
    const searchPattern = `%${query}%`;
    const stages = await this.getPipelineStages();
    const stageMap = new Map(stages.map(s => [s.id, s]));

    // Search companies
    const companiesResults = await db
      .select()
      .from(companies)
      .where(
        sql`LOWER(${companies.name}) LIKE LOWER(${searchPattern})
          OR LOWER(${companies.location}) LIKE LOWER(${searchPattern})
          OR LOWER(${companies.academyTrustName}) LIKE LOWER(${searchPattern})`
      )
      .limit(5);

    const companiesWithStages = companiesResults.map(c => ({
      ...c,
      stage: c.stageId ? stageMap.get(c.stageId) : undefined,
    }));

    // Search contacts
    const contactsResults = await db
      .select()
      .from(contacts)
      .where(
        sql`LOWER(${contacts.name}) LIKE LOWER(${searchPattern})
          OR LOWER(${contacts.email}) LIKE LOWER(${searchPattern})`
      )
      .limit(5);

    const contactCompanyIds = Array.from(new Set(contactsResults.map(c => c.companyId).filter((id): id is string => !!id)));
    const contactCompanies = contactCompanyIds.length > 0
      ? await db.select().from(companies).where(inArray(companies.id, contactCompanyIds))
      : [];
    const contactCompanyMap = new Map(contactCompanies.map(c => [c.id, c.name]));

    const contactsWithCompany = contactsResults.map(c => ({
      ...c,
      companyName: c.companyId ? contactCompanyMap.get(c.companyId) : undefined,
    }));

    // Search deals
    const dealsResults = await db
      .select()
      .from(deals)
      .where(sql`LOWER(${deals.title}) LIKE LOWER(${searchPattern})`)
      .limit(5);

    // Get company names and stages for deals
    const dealCompanyIds = Array.from(new Set(dealsResults.map(d => d.companyId)));
    const dealCompanies = dealCompanyIds.length > 0
      ? await db.select().from(companies).where(inArray(companies.id, dealCompanyIds))
      : [];
    const dealCompanyMap = new Map(dealCompanies.map(c => [c.id, c.name]));

    const dealsWithCompanyAndStage = dealsResults.map(d => ({
      ...d,
      companyName: dealCompanyMap.get(d.companyId),
      stage: d.stageId ? stageMap.get(d.stageId) : undefined,
    }));

    // Also search trust companies (companies with isTrust=true) and merge into results
    const trustCompaniesResults = await db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.isTrust, true),
          sql`LOWER(${companies.name}) LIKE LOWER(${searchPattern})`
        )
      )
      .limit(5);

    // Add trust companies to companies results (avoid duplicates)
    const existingCompanyIds = new Set(companiesWithStages.map(c => c.id));
    const trustCompaniesWithStages = trustCompaniesResults
      .filter(c => !existingCompanyIds.has(c.id))
      .map(c => ({
        ...c,
        stage: c.stageId ? stageMap.get(c.stageId) : undefined,
      }));

    return {
      companies: [...companiesWithStages, ...trustCompaniesWithStages],
      contacts: contactsWithCompany,
      deals: dealsWithCompanyAndStage,
    };
  }

  // Trusts
  async getTrusts(): Promise<Trust[]> {
    return db.select().from(trusts).orderBy(trusts.name);
  }

  async getTrust(id: string): Promise<Trust | undefined> {
    const [trust] = await db.select().from(trusts).where(eq(trusts.id, id));
    return trust;
  }

  async getTrustByName(name: string): Promise<Trust | undefined> {
    const [trust] = await db.select().from(trusts).where(ilike(trusts.name, name));
    return trust;
  }

  async createTrust(trust: InsertTrust): Promise<Trust> {
    const [result] = await db.insert(trusts).values(trust).returning();
    return result;
  }

  async updateTrust(id: string, data: Partial<InsertTrust>): Promise<Trust | undefined> {
    const [result] = await db
      .update(trusts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(trusts.id, id))
      .returning();
    return result;
  }

  async deleteTrust(id: string): Promise<void> {
    // Unlink companies first
    await db.update(companies).set({ trustId: null }).where(eq(companies.trustId, id));
    await db.delete(trusts).where(eq(trusts.id, id));
  }

  async getCompaniesByTrust(trustId: string): Promise<(Company & { stage?: PipelineStage; deals: DealWithStage[] })[]> {
    const companiesList = await db.select().from(companies).where(eq(companies.trustId, trustId)).orderBy(companies.name);
    if (companiesList.length === 0) return [];

    const stages = await this.getPipelineStages();
    const stageMap = new Map(stages.map(s => [s.id, s]));

    // Batch load deals for all companies
    const companyIds = companiesList.map(c => c.id);
    const allDeals = await db.select().from(deals).where(inArray(deals.companyId, companyIds));

    const dealsByCompany = new Map<string, DealWithStage[]>();
    for (const deal of allDeals) {
      const list = dealsByCompany.get(deal.companyId) || [];
      list.push({ ...deal, stage: deal.stageId ? stageMap.get(deal.stageId) : undefined });
      dealsByCompany.set(deal.companyId, list);
    }

    return companiesList.map(c => ({
      ...c,
      stage: c.stageId ? stageMap.get(c.stageId) : undefined,
      deals: dealsByCompany.get(c.id) || [],
    }));
  }

  async getTrustPipelineSummary(trustId: string): Promise<{ stageId: string; stageName: string; stageColor: string; dealCount: number; totalValue: number }[]> {
    const companiesList = await db.select({ id: companies.id }).from(companies).where(eq(companies.trustId, trustId));
    if (companiesList.length === 0) return [];

    const companyIds = companiesList.map(c => c.id);
    const allDeals = await db.select().from(deals).where(inArray(deals.companyId, companyIds));
    const stages = await this.getPipelineStages();
    const stageMap = new Map(stages.map(s => [s.id, s]));

    const summary = new Map<string, { dealCount: number; totalValue: number }>();
    for (const deal of allDeals) {
      if (!deal.stageId) continue;
      const existing = summary.get(deal.stageId) || { dealCount: 0, totalValue: 0 };
      existing.dealCount++;
      existing.totalValue += deal.expectedGP ? parseFloat(deal.expectedGP) : 0;
      summary.set(deal.stageId, existing);
    }

    return stages
      .filter(s => summary.has(s.id))
      .map(s => ({
        stageId: s.id,
        stageName: s.name,
        stageColor: s.color,
        dealCount: summary.get(s.id)!.dealCount,
        totalValue: summary.get(s.id)!.totalValue,
      }));
  }

  async getTrustActivities(trustId: string, limit: number, offset: number): Promise<(Activity & { companyName?: string })[]> {
    const companiesList = await db.select({ id: companies.id, name: companies.name }).from(companies).where(eq(companies.trustId, trustId));
    if (companiesList.length === 0) return [];

    const companyIds = companiesList.map(c => c.id);
    const companyNameMap = new Map(companiesList.map(c => [c.id, c.name]));

    const activitiesList = await db
      .select()
      .from(activities)
      .where(inArray(activities.companyId, companyIds))
      .orderBy(desc(activities.createdAt))
      .limit(limit)
      .offset(offset);

    return activitiesList.map(a => ({
      ...a,
      companyName: companyNameMap.get(a.companyId),
    }));
  }

  async getTrustsWithStats(): Promise<TrustWithStats[]> {
    const trustsList = await db.select().from(trusts).orderBy(trusts.name);
    if (trustsList.length === 0) return [];

    // Get all companies with trustId
    const allCompanies = await db
      .select({ id: companies.id, trustId: companies.trustId })
      .from(companies)
      .where(isNotNull(companies.trustId));

    // Count schools per trust
    const schoolCountMap = new Map<string, number>();
    const companyIdsByTrust = new Map<string, string[]>();
    for (const c of allCompanies) {
      if (!c.trustId) continue;
      schoolCountMap.set(c.trustId, (schoolCountMap.get(c.trustId) || 0) + 1);
      const ids = companyIdsByTrust.get(c.trustId) || [];
      ids.push(c.id);
      companyIdsByTrust.set(c.trustId, ids);
    }

    // Get all deals for companies in trusts
    const allCompanyIds = allCompanies.map(c => c.id);
    const allDeals = allCompanyIds.length > 0
      ? await db.select().from(deals).where(inArray(deals.companyId, allCompanyIds))
      : [];

    // Pipeline value per trust
    const pipelineMap = new Map<string, number>();
    const companyToTrust = new Map<string, string>();
    for (const c of allCompanies) {
      if (c.trustId) companyToTrust.set(c.id, c.trustId);
    }
    for (const deal of allDeals) {
      const tId = companyToTrust.get(deal.companyId);
      if (tId && deal.expectedGP) {
        pipelineMap.set(tId, (pipelineMap.get(tId) || 0) + parseFloat(deal.expectedGP));
      }
    }

    // Last activity per trust
    const allActivities = allCompanyIds.length > 0
      ? await db
          .select({ companyId: activities.companyId, createdAt: activities.createdAt })
          .from(activities)
          .where(inArray(activities.companyId, allCompanyIds))
          .orderBy(desc(activities.createdAt))
      : [];

    const lastActivityMap = new Map<string, Date>();
    for (const a of allActivities) {
      const tId = companyToTrust.get(a.companyId);
      if (tId && !lastActivityMap.has(tId)) {
        lastActivityMap.set(tId, a.createdAt);
      }
    }

    return trustsList.map(t => ({
      ...t,
      schoolCount: schoolCountMap.get(t.id) || 0,
      totalPipelineValue: pipelineMap.get(t.id) || 0,
      lastActivityDate: lastActivityMap.get(t.id) || null,
    }));
  }

  async migrateAcademyTrusts(): Promise<{ migratedCount: number; trustsCreated: number }> {
    let migratedCount = 0;
    let trustsCreated = 0;

    // Get all companies with academyTrustName
    const companiesWithTrust = await db.select().from(companies).where(isNotNull(companies.academyTrustName));

    for (const company of companiesWithTrust) {
      if (!company.academyTrustName || !company.academyTrustName.trim()) continue;

      // Skip if already has trustId
      if (company.trustId) {
        // Still set industry if null
        if (!company.industry) {
          await db.update(companies)
            .set({ industry: "Secondary School" })
            .where(eq(companies.id, company.id));
          migratedCount++;
        }
        continue;
      }

      const trustName = company.academyTrustName.trim();

      // Find or create trust
      let trust = await this.getTrustByName(trustName);
      if (!trust) {
        trust = await this.createTrust({ name: trustName });
        trustsCreated++;
      }

      // Update company with trustId and industry
      const updateData: Record<string, unknown> = { trustId: trust.id };
      if (!company.industry) {
        updateData.industry = "Secondary School";
      }

      await db.update(companies)
        .set(updateData)
        .where(eq(companies.id, company.id));
      migratedCount++;
    }

    // Set industry for companies without academyTrustName that have null industry
    const noTrustResult = await db.update(companies)
      .set({ industry: "Secondary School" })
      .where(and(isNull(companies.industry)))
      .returning();
    migratedCount += noTrustResult.length;

    return { migratedCount, trustsCreated };
  }

  // Trust Companies & Relationships
  async getChildCompanies(parentId: string): Promise<(Company & { stage?: PipelineStage })[]> {
    const childList = await db.select().from(companies).where(eq(companies.parentCompanyId, parentId)).orderBy(companies.name);
    if (childList.length === 0) return [];
    const stages = await this.getPipelineStages();
    const stageMap = new Map(stages.map(s => [s.id, s]));
    return childList.map(c => ({
      ...c,
      stage: c.stageId ? stageMap.get(c.stageId) : undefined,
    }));
  }

  async getTrustCompanies(): Promise<(Company & { stage?: PipelineStage; childCount?: number })[]> {
    // Get all companies with isTrust=true — these are the trust parent companies
    const trustCompaniesList = await db
      .select()
      .from(companies)
      .where(eq(companies.isTrust, true))
      .orderBy(companies.name);

    if (trustCompaniesList.length === 0) return [];

    const trustIds = trustCompaniesList.map(c => c.id);

    // Count schools per trust via "Part of Trust" relationships
    // Since relationships are bidirectional, count only where the trust is companyId
    // and the relatedCompanyId is NOT also a trust (i.e. it's a school)
    const trustIdSet = new Set(trustIds);
    const trustRels = await db
      .select({
        companyId: companyRelationships.companyId,
        relatedCompanyId: companyRelationships.relatedCompanyId,
      })
      .from(companyRelationships)
      .where(eq(companyRelationships.relationshipType, "Part of Trust"));

    const childCountMap = new Map<string, number>();
    for (const rel of trustRels) {
      // Only count if companyId is a trust and relatedCompanyId is NOT a trust (it's a school)
      if (trustIdSet.has(rel.companyId) && !trustIdSet.has(rel.relatedCompanyId)) {
        childCountMap.set(rel.companyId, (childCountMap.get(rel.companyId) || 0) + 1);
      }
    }

    const stages = await this.getPipelineStages();
    const stageMap = new Map(stages.map(s => [s.id, s]));

    return trustCompaniesList.map(c => ({
      ...c,
      stage: c.stageId ? stageMap.get(c.stageId) : undefined,
      childCount: childCountMap.get(c.id) || 0,
    }));
  }

  async findTrustCompanyByName(name: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.isTrust, true), ilike(companies.name, name)));
    return company;
  }

  async getCompanyRelationships(companyId: string): Promise<CompanyRelationshipWithCompany[]> {
    const rels = await db
      .select()
      .from(companyRelationships)
      .where(
        sql`${companyRelationships.companyId} = ${companyId} OR ${companyRelationships.relatedCompanyId} = ${companyId}`
      )
      .orderBy(desc(companyRelationships.createdAt));

    if (rels.length === 0) return [];

    // Get all related company IDs
    const relatedIds = new Set<string>();
    for (const r of rels) {
      if (r.companyId !== companyId) relatedIds.add(r.companyId);
      if (r.relatedCompanyId !== companyId) relatedIds.add(r.relatedCompanyId);
    }

    const relatedCompanies = relatedIds.size > 0
      ? await db.select().from(companies).where(inArray(companies.id, Array.from(relatedIds)))
      : [];
    const companyMap = new Map(relatedCompanies.map(c => [c.id, c]));

    // Deduplicate: for bidirectional pairs, only show one
    const seen = new Set<string>();
    const result: CompanyRelationshipWithCompany[] = [];
    for (const r of rels) {
      const otherId = r.companyId === companyId ? r.relatedCompanyId : r.companyId;
      const pairKey = [r.companyId, r.relatedCompanyId].sort().join("||");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      const relatedCompany = companyMap.get(otherId);
      if (relatedCompany) {
        result.push({ ...r, relatedCompany });
      }
    }

    return result;
  }

  async createCompanyRelationship(data: InsertCompanyRelationship): Promise<CompanyRelationship> {
    // Create bidirectional relationship
    const [result] = await db.insert(companyRelationships).values(data).returning();
    // Create reverse
    await db.insert(companyRelationships).values({
      companyId: data.relatedCompanyId,
      relatedCompanyId: data.companyId,
      relationshipType: data.relationshipType,
      notes: data.notes,
    });
    return result;
  }

  async deleteCompanyRelationship(id: string): Promise<void> {
    // Find the relationship to delete the reverse too
    const [rel] = await db.select().from(companyRelationships).where(eq(companyRelationships.id, id));
    if (rel) {
      await db.delete(companyRelationships).where(eq(companyRelationships.id, id));
      // Delete reverse
      await db.delete(companyRelationships).where(
        and(
          eq(companyRelationships.companyId, rel.relatedCompanyId),
          eq(companyRelationships.relatedCompanyId, rel.companyId),
          eq(companyRelationships.relationshipType, rel.relationshipType),
        )
      );
    }
  }

  async linkSchoolsToTrust(trustId: string, schoolIds: string[]): Promise<void> {
    if (schoolIds.length === 0) return;
    for (const schoolId of schoolIds) {
      await db.update(companies).set({ parentCompanyId: trustId }).where(eq(companies.id, schoolId));
    }
  }

  async unlinkSchoolFromTrust(schoolId: string): Promise<void> {
    await db.update(companies).set({ parentCompanyId: null }).where(eq(companies.id, schoolId));
  }

  async setupTrustsFromAcademyNames(): Promise<{ trustsCreated: number; trustsSkipped: number; schoolsLinked: number; uniqueTrustNames: number }> {
    // Step 1: Get all unique academy_trust_name values from companies
    const rows = await db
      .selectDistinct({ academyTrustName: companies.academyTrustName })
      .from(companies)
      .where(and(isNotNull(companies.academyTrustName), sql`${companies.academyTrustName} != ''`));

    const uniqueNames = rows.map(r => r.academyTrustName!).filter(Boolean);
    let trustsCreated = 0;
    let trustsSkipped = 0;
    let schoolsLinked = 0;

    for (const trustName of uniqueNames) {
      // Check if trust company already exists (by name with isTrust=true)
      const existing = await this.findTrustCompanyByName(trustName);
      let trustCompany: Company;

      if (existing) {
        trustCompany = existing;
        trustsSkipped++;
      } else {
        // Create the trust company
        trustCompany = await this.createCompany({
          name: trustName,
          isTrust: true,
          industry: "Academy Trust",
        });
        trustsCreated++;
      }

      // Step 2: Find all schools with this academy_trust_name
      const schoolsWithTrust = await db
        .select()
        .from(companies)
        .where(and(
          ilike(companies.academyTrustName, trustName),
          sql`${companies.id} != ${trustCompany.id}`
        ));

      // Link each school via company_relationships (skip if already linked)
      for (const school of schoolsWithTrust) {
        // Check if relationship already exists
        const existingRel = await db
          .select()
          .from(companyRelationships)
          .where(and(
            eq(companyRelationships.companyId, trustCompany.id),
            eq(companyRelationships.relatedCompanyId, school.id),
            eq(companyRelationships.relationshipType, "Part of Trust")
          ));

        if (existingRel.length === 0) {
          // Create bidirectional relationship
          await db.insert(companyRelationships).values({
            companyId: trustCompany.id,
            relatedCompanyId: school.id,
            relationshipType: "Part of Trust",
          });
          await db.insert(companyRelationships).values({
            companyId: school.id,
            relatedCompanyId: trustCompany.id,
            relationshipType: "Part of Trust",
          });
          schoolsLinked++;
        }
      }
    }

    return { trustsCreated, trustsSkipped, schoolsLinked, uniqueTrustNames: uniqueNames.length };
  }

  // Seed default pipeline stages (Wave Systems)
  async seedData(): Promise<void> {
    try {
      const existingStages = await this.getPipelineStages();

      const defaultStages: InsertPipelineStage[] = [
        { name: "Qualified Opportunity", order: 1, color: "#3b82f6" },
        { name: "Quote Presented", order: 2, color: "#8b5cf6" },
        { name: "Decision Maker Brought-In", order: 3, color: "#f59e0b" },
        { name: "Awaiting Order", order: 4, color: "#a855f7" },
        { name: "Closed Won", order: 5, color: "#10b981" },
        { name: "Closed Lost", order: 6, color: "#ef4444" },
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
