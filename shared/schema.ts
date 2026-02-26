import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Pipeline stages for deal tracking
export const pipelineStages = pgTable("pipeline_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  color: text("color").notNull().default("#6366f1"),
});

export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({
  id: true,
});

export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;

// Academy Trusts
export const trusts = pgTable("trusts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  website: text("website"),
  phone: text("phone"),
  email: text("email"),
  decisionMakerName: text("decision_maker_name"),
  decisionMakerEmail: text("decision_maker_email"),
  decisionMakerPhone: text("decision_maker_phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTrustSchema = createInsertSchema(trusts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTrust = z.infer<typeof insertTrustSchema>;
export type Trust = typeof trusts.$inferSelect;

export type TrustWithStats = Trust & {
  schoolCount: number;
  totalPipelineValue: number;
  lastActivityDate: Date | null;
  lastActivityType: string | null;
  lastActivitySchoolName: string | null;
};

// Companies/Schools
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  website: text("website"),
  phone: text("phone"),
  location: text("location"),
  academyTrustName: text("academy_trust_name"),
  industry: text("industry").default("Secondary School"),
  trustId: varchar("trust_id").references(() => trusts.id),
  isTrust: boolean("is_trust").default(false).notNull(),
  parentCompanyId: varchar("parent_company_id"),
  ext: text("ext"),
  notes: text("notes"),
  itManagerName: text("it_manager_name"),
  itManagerEmail: text("it_manager_email"),
  stageId: varchar("stage_id").references(() => pipelineStages.id),
  lastContactDate: timestamp("last_contact_date"),
  nextAction: text("next_action"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Wave Systems specific fields - Lead Status for sales pipeline
  budgetStatus: text("budget_status").default("0-unqualified"), // Lead status: 0-unqualified, 1-qualified, 2-intent, 3-quote-presented, 3b-quoted-lost, 4-account-active
  decisionTimeline: text("decision_timeline"),
  decisionMakerName: text("decision_maker_name"),
  decisionMakerRole: text("decision_maker_role"),
  lastQuoteDate: timestamp("last_quote_date"),
  lastQuoteValue: numeric("last_quote_value", { precision: 12, scale: 2 }),
  grossProfit: numeric("gross_profit", { precision: 12, scale: 2 }),
  tradeInInterest: boolean("trade_in_interest"),
  buyerHonestyScore: text("buyer_honesty_score"), // Good / Questionable / Time Waster
  nextBudgetCycle: timestamp("next_budget_cycle"),
  importBatchId: varchar("import_batch_id"),
  // School-specific fields
  urn: text("urn"),
  street: text("street"),
  postcode: text("postcode"),
  county: text("county"),
  schoolType: text("school_type"),
  schoolCapacity: integer("school_capacity"),
  pupilHeadcount: integer("pupil_headcount"),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// Company Relationships (many-to-many between companies)
export const companyRelationships = pgTable("company_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  relatedCompanyId: varchar("related_company_id").references(() => companies.id).notNull(),
  relationshipType: text("relationship_type").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCompanyRelationshipSchema = createInsertSchema(companyRelationships).omit({
  id: true,
  createdAt: true,
});

export type InsertCompanyRelationship = z.infer<typeof insertCompanyRelationshipSchema>;
export type CompanyRelationship = typeof companyRelationships.$inferSelect;

export type CompanyRelationshipWithCompany = CompanyRelationship & {
  relatedCompany: Company;
};

// Contacts for companies
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  email: text("email").notNull(),
  title: text("title"),
  name: text("name"),
  phone: text("phone"),
  role: text("role"),
  leadStatus: text("lead_status").default("0-unqualified"),
  lastContactDate: timestamp("last_contact_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export type ContactWithCompany = Contact & {
  companyName?: string;
  companyBudgetStatus?: string;
};

// Activity log (calls, emails, quotes, follow-ups, deals)
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  contactId: varchar("contact_id").references(() => contacts.id),
  type: text("type").notNull(), // call, email, quote, follow_up, deal_won, deal_lost
  note: text("note"),
  outcome: text("outcome"), // For calls: Reception / Voicemail, Decision Maker Details, Connected to DM
  quoteValue: numeric("quote_value", { precision: 12, scale: 2 }), // For quotes
  grossProfit: numeric("gross_profit", { precision: 12, scale: 2 }), // For deals
  loggedBy: text("logged_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  editedAt: timestamp("edited_at"),
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
  editedAt: true,
});

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

// Keep legacy callNotes for backwards compatibility
export const callNotes = pgTable("call_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  note: text("note").notNull(),
  loggedBy: text("logged_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCallNoteSchema = createInsertSchema(callNotes).omit({
  id: true,
  createdAt: true,
});

export type InsertCallNote = z.infer<typeof insertCallNoteSchema>;
export type CallNote = typeof callNotes.$inferSelect;

// Tasks for companies
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  taskType: text("task_type"), // follow_up_quote, check_budget, general
  dueDate: timestamp("due_date"),
  priority: text("priority").notNull().default("medium"), // high, medium, low
  status: text("status").notNull().default("todo"), // todo, in_progress, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Daily stats for tracking (calls counter, etc.)
export const dailyStats = pgTable("daily_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  callsMade: integer("calls_made").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDailyStatsSchema = createInsertSchema(dailyStats).omit({
  id: true,
  createdAt: true,
});

export type InsertDailyStats = z.infer<typeof insertDailyStatsSchema>;
export type DailyStats = typeof dailyStats.$inferSelect;

// Deals for companies (multiple deals per company)
export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  title: text("title").notNull(),
  stageId: varchar("stage_id").references(() => pipelineStages.id),
  expectedGP: numeric("expected_gp", { precision: 12, scale: 2 }),
  budgetStatus: text("budget_status"), // Confirmed / Indicative / Unknown
  decisionTimeline: timestamp("decision_timeline"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
});

export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

// CSV Import tracking
export const csvImports = pgTable("csv_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
  importedCount: integer("imported_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
});

export const insertCsvImportSchema = createInsertSchema(csvImports).omit({
  id: true,
  importedAt: true,
});

export type InsertCsvImport = z.infer<typeof insertCsvImportSchema>;
export type CsvImport = typeof csvImports.$inferSelect;

// Extended types with relations
export type TaskWithCompany = Task & {
  company: Company;
};

export type DealWithStage = Deal & {
  stage?: PipelineStage;
};

export type DealWithCompanyAndStage = Deal & {
  stage?: PipelineStage;
  company?: Company;
};

export type CompanyWithRelations = Company & {
  contacts: Contact[];
  callNotes: CallNote[];
  activities: Activity[];
  tasks: Task[];
  deals: DealWithStage[];
  stage?: PipelineStage;
  trust?: Trust;
  parentCompany?: Company;
  childCompanies?: Company[];
  relationships?: CompanyRelationshipWithCompany[];
};
