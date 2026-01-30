import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
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

// Companies/Schools
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  website: text("website"),
  phone: text("phone"),
  location: text("location"),
  academyTrustName: text("academy_trust_name"),
  ext: text("ext"),
  notes: text("notes"),
  itManagerName: text("it_manager_name"),
  itManagerEmail: text("it_manager_email"),
  stageId: varchar("stage_id").references(() => pipelineStages.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// Contacts for companies
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  email: text("email").notNull(),
  name: text("name"),
  role: text("role"),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// Call notes/logs
export const callNotes = pgTable("call_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCallNoteSchema = createInsertSchema(callNotes).omit({
  id: true,
  createdAt: true,
});

export type InsertCallNote = z.infer<typeof insertCallNoteSchema>;
export type CallNote = typeof callNotes.$inferSelect;

// Extended types with relations
export type CompanyWithRelations = Company & {
  contacts: Contact[];
  callNotes: CallNote[];
  stage?: PipelineStage;
};
