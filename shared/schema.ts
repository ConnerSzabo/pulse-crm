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

// TSOs (Tournament/Show Organisers)
export const tsos = pgTable("tsos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  city: text("city"),
  notes: text("notes"),
  relationshipStatus: text("relationship_status").default("Cold Outreach"),
  mainContactName: text("main_contact_name"),
  contactRole: text("contact_role"),
  contactNumber: text("contact_number"),
  priority: text("priority").default("Medium"),
  vendorAccess: boolean("vendor_access").default(false),
  promoOptions: text("promo_options"),
  pricingNotes: text("pricing_notes"),
  sponsorInfo: text("sponsor_info"),
  isRecurring: boolean("is_recurring").default(false),
  nextStep: text("next_step"),
  tsoOnMainCrm: boolean("tso_on_main_crm").default(false),
  igHandle: text("ig_handle"),
  linkedin: text("linkedin"),
  estAnnualReach: text("est_annual_reach"),
  profileLink: text("profile_link"),
  existingAccount: boolean("existing_account").default(false),
  showsPerYear: text("shows_per_year"),
  tsoEventCodes: text("tso_event_codes"),
  followUpDate: date("follow_up_date"),
  nextShowDate: date("next_show_date"),
  activitiesNotes: text("activities_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTsoSchema = createInsertSchema(tsos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTso = z.infer<typeof insertTsoSchema>;
export type Tso = typeof tsos.$inferSelect;

// Shows
export const shows = pgTable("shows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  showName: text("show_name").notNull(),
  tsoId: varchar("tso_id").references(() => tsos.id, { onDelete: "cascade" }),
  showDate: date("show_date"),
  city: text("city"),
  venue: text("venue"),
  status: text("status").default("Contacted"),
  nextFollowupDate: date("next_followup_date"),
  attendingTso: text("attending_tso"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertShowSchema = createInsertSchema(shows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShow = z.infer<typeof insertShowSchema>;
export type Show = typeof shows.$inferSelect;

// Contacts
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tsoId: varchar("tso_id").references(() => tsos.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  title: text("title"),
  name: text("name"),
  phone: text("phone"),
  role: text("role"),
  igHandle: text("ig_handle"),
  lastContactDate: timestamp("last_contact_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// Activities (calls, emails, notes, etc.)
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tsoId: varchar("tso_id").references(() => tsos.id, { onDelete: "cascade" }).notNull(),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  note: text("note"),
  outcome: text("outcome"),
  loggedBy: text("logged_by"),
  isPinned: boolean("is_pinned").default(false).notNull(),
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

// Legacy call notes
export const callNotes = pgTable("call_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tsoId: varchar("tso_id").references(() => tsos.id, { onDelete: "cascade" }).notNull(),
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

// Tasks
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tsoId: varchar("tso_id").references(() => tsos.id, { onDelete: "set null" }),
  showId: varchar("show_id").references(() => shows.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  taskType: text("task_type"),
  dueDate: timestamp("due_date"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("To Do"),
  owner: text("owner"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

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

// Extended types
export type TaskWithTso = Task & {
  tso?: Tso;
  show?: Show;
};

export type ShowWithTso = Show & {
  tso?: Tso;
};

export type TsoWithRelations = Tso & {
  contacts: Contact[];
  activities: Activity[];
  tasks: Task[];
  shows: Show[];
};

export type ContactWithTso = Contact & {
  tsoName?: string;
};
