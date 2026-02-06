-- Performance Optimization: Add indexes for frequently queried columns
-- REQUEST 24: Speed up queries by 10-100x on filtered/joined columns

-- Companies indexes (most queried table)
CREATE INDEX IF NOT EXISTS "idx_companies_budget_status" ON "companies" ("budget_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_companies_location" ON "companies" ("location");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_companies_academy_trust" ON "companies" ("academy_trust_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_companies_stage_id" ON "companies" ("stage_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_companies_created_at" ON "companies" ("created_at");
--> statement-breakpoint

-- Contacts indexes (frequently joined with companies)
CREATE INDEX IF NOT EXISTS "idx_contacts_company_id" ON "contacts" ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contacts_email" ON "contacts" ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contacts_lead_status" ON "contacts" ("lead_status");
--> statement-breakpoint

-- Deals indexes (frequently filtered by stage)
CREATE INDEX IF NOT EXISTS "idx_deals_company_id" ON "deals" ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deals_stage_id" ON "deals" ("stage_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deals_created_at" ON "deals" ("created_at");
--> statement-breakpoint

-- Activities indexes (timeline queries - CRITICAL for performance)
CREATE INDEX IF NOT EXISTS "idx_activities_company_id" ON "activities" ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activities_created_at" ON "activities" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activities_company_created" ON "activities" ("company_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activities_type" ON "activities" ("type");
--> statement-breakpoint

-- Tasks indexes (frequently filtered by status and company)
CREATE INDEX IF NOT EXISTS "idx_tasks_company_id" ON "tasks" ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_due_date" ON "tasks" ("due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_created_at" ON "tasks" ("created_at");
--> statement-breakpoint

-- Call notes indexes (legacy table)
CREATE INDEX IF NOT EXISTS "idx_call_notes_company_id" ON "call_notes" ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_call_notes_created_at" ON "call_notes" ("created_at" DESC);
--> statement-breakpoint

-- Composite index for most common query pattern (company activities ordered by date)
-- This will dramatically speed up the activity timeline
CREATE INDEX IF NOT EXISTS "idx_activities_company_type_date" ON "activities" ("company_id", "type", "created_at" DESC);
