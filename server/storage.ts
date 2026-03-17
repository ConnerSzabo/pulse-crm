import { db } from "./db";
import { eq, ilike, desc, asc, and, sql, isNull, or } from "drizzle-orm";
import {
  users,
  tsos,
  shows,
  contacts,
  callNotes,
  activities,
  tasks,
  csvImports,
  type Tso,
  type InsertTso,
  type Show,
  type InsertShow,
  type Contact,
  type InsertContact,
  type CallNote,
  type InsertCallNote,
  type Activity,
  type InsertActivity,
  type Task,
  type InsertTask,
  type TaskWithTso,
  type ShowWithTso,
  type TsoWithRelations,
  type ContactWithTso,
  type CsvImport,
  type InsertCsvImport,
} from "@shared/schema";

export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0044") && digits.length === 14) digits = "0" + digits.slice(4);
  else if (digits.startsWith("44") && digits.length === 12) digits = "0" + digits.slice(2);
  if (digits.length > 0 && !digits.startsWith("0")) digits = "0" + digits;
  return digits;
}

export function normalizeWebsite(website: string | null | undefined): string {
  if (!website) return "";
  let n = website.trim().toLowerCase();
  n = n.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  return n;
}

export function normalizeCompanyName(name: string): string {
  let n = name.trim().toLowerCase();
  n = n.replace(/^(the|a|an)\s+/i, "");
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

export function normalizeLocation(location: string | null | undefined): string {
  if (!location) return "";
  return location.trim().toLowerCase().replace(/\s+/g, " ");
}

export const storage = {
  // ─── AUTH ────────────────────────────────────────────────────────
  async getUserByUsername(username: string) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  },

  async getUserById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  // ─── TSOs ─────────────────────────────────────────────────────────
  async getTsos(search?: string, status?: string): Promise<Tso[]> {
    let q = db.select().from(tsos).$dynamic();
    const conditions = [];
    if (search) conditions.push(ilike(tsos.name, `%${search}%`));
    if (status && status !== "all") conditions.push(eq(tsos.relationshipStatus, status));
    if (conditions.length > 0) q = q.where(and(...conditions));
    return q.orderBy(desc(tsos.createdAt));
  },

  async getTsoById(id: string): Promise<TsoWithRelations | null> {
    const [tso] = await db.select().from(tsos).where(eq(tsos.id, id));
    if (!tso) return null;
    const [tsoContacts, tsoActivities, tsoTasks, tsoShows] = await Promise.all([
      db.select().from(contacts).where(eq(contacts.tsoId, id)).orderBy(desc(contacts.createdAt)),
      db.select().from(activities).where(eq(activities.tsoId, id)).orderBy(desc(activities.createdAt)),
      db.select().from(tasks).where(eq(tasks.tsoId, id)).orderBy(desc(tasks.createdAt)),
      db.select().from(shows).where(eq(shows.tsoId, id)).orderBy(desc(shows.showDate)),
    ]);
    return { ...tso, contacts: tsoContacts, activities: tsoActivities, tasks: tsoTasks, shows: tsoShows };
  },

  async createTso(data: InsertTso): Promise<Tso> {
    const [tso] = await db.insert(tsos).values(data).returning();
    return tso;
  },

  async updateTso(id: string, data: Partial<InsertTso>): Promise<Tso | null> {
    const [tso] = await db.update(tsos).set({ ...data, updatedAt: new Date() }).where(eq(tsos.id, id)).returning();
    return tso || null;
  },

  async deleteTso(id: string): Promise<boolean> {
    const result = await db.delete(tsos).where(eq(tsos.id, id));
    return (result.rowCount ?? 0) > 0;
  },

  async findTsoByName(name: string): Promise<Tso | null> {
    const normalized = normalizeCompanyName(name);
    const all = await db.select().from(tsos);
    const match = all.find(t => normalizeCompanyName(t.name) === normalized);
    return match || null;
  },

  // ─── SHOWS ────────────────────────────────────────────────────────
  async getShows(tsoId?: string, status?: string): Promise<ShowWithTso[]> {
    const rows = await db.select().from(shows).orderBy(desc(shows.showDate));
    const tsoRows = await db.select().from(tsos);
    const tsoMap = new Map(tsoRows.map(t => [t.id, t]));
    let result = rows.map(s => ({ ...s, tso: s.tsoId ? tsoMap.get(s.tsoId) : undefined }));
    if (tsoId) result = result.filter(s => s.tsoId === tsoId);
    if (status && status !== "all") result = result.filter(s => s.status === status);
    return result;
  },

  async getShowById(id: string): Promise<ShowWithTso | null> {
    const [show] = await db.select().from(shows).where(eq(shows.id, id));
    if (!show) return null;
    const tso = show.tsoId ? (await db.select().from(tsos).where(eq(tsos.id, show.tsoId)))[0] : undefined;
    return { ...show, tso };
  },

  async createShow(data: InsertShow): Promise<Show> {
    const [show] = await db.insert(shows).values(data).returning();
    return show;
  },

  async updateShow(id: string, data: Partial<InsertShow>): Promise<Show | null> {
    const [show] = await db.update(shows).set({ ...data, updatedAt: new Date() }).where(eq(shows.id, id)).returning();
    return show || null;
  },

  async findShowByName(name: string): Promise<Show | null> {
    const norm = normalizeCompanyName(name);
    const all = await db.select().from(shows);
    const exact = all.find(s => normalizeCompanyName(s.showName) === norm);
    if (exact) return exact;
    const partial = all.find(s => {
      const sn = normalizeCompanyName(s.showName);
      return sn.includes(norm) || norm.includes(sn);
    });
    return partial || null;
  },

  async deleteShow(id: string): Promise<boolean> {
    const result = await db.delete(shows).where(eq(shows.id, id));
    return (result.rowCount ?? 0) > 0;
  },

  // ─── CONTACTS ─────────────────────────────────────────────────────
  async getContacts(tsoId?: string): Promise<ContactWithTso[]> {
    const rows = await db.select().from(contacts).orderBy(desc(contacts.createdAt));
    const tsoRows = await db.select().from(tsos);
    const tsoMap = new Map(tsoRows.map(t => [t.id, t.name]));
    let result = rows.map(c => ({ ...c, tsoName: c.tsoId ? tsoMap.get(c.tsoId) : undefined }));
    if (tsoId) result = result.filter(c => c.tsoId === tsoId);
    return result;
  },

  async createContact(data: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(data).returning();
    return contact;
  },

  async updateContact(id: string, data: Partial<InsertContact>): Promise<Contact | null> {
    const [contact] = await db.update(contacts).set(data).where(eq(contacts.id, id)).returning();
    return contact || null;
  },

  async deleteContact(id: string): Promise<boolean> {
    const result = await db.delete(contacts).where(eq(contacts.id, id));
    return (result.rowCount ?? 0) > 0;
  },

  // ─── ACTIVITIES ───────────────────────────────────────────────────
  async getActivities(tsoId: string): Promise<Activity[]> {
    return db.select().from(activities).where(eq(activities.tsoId, tsoId)).orderBy(desc(activities.createdAt));
  },

  async createActivity(data: InsertActivity): Promise<Activity> {
    const [activity] = await db.insert(activities).values(data).returning();
    return activity;
  },

  async updateActivity(id: string, data: Partial<InsertActivity>): Promise<Activity | null> {
    const [activity] = await db.update(activities).set({ ...data, editedAt: new Date() }).where(eq(activities.id, id)).returning();
    return activity || null;
  },

  async deleteActivity(id: string): Promise<boolean> {
    const result = await db.delete(activities).where(eq(activities.id, id));
    return (result.rowCount ?? 0) > 0;
  },

  // ─── CALL NOTES ───────────────────────────────────────────────────
  async getCallNotes(tsoId: string): Promise<CallNote[]> {
    return db.select().from(callNotes).where(eq(callNotes.tsoId, tsoId)).orderBy(desc(callNotes.createdAt));
  },

  async createCallNote(data: InsertCallNote): Promise<CallNote> {
    const [note] = await db.insert(callNotes).values(data).returning();
    return note;
  },

  // ─── TASKS ────────────────────────────────────────────────────────
  async getTasks(tsoId?: string, showId?: string): Promise<TaskWithTso[]> {
    const rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
    const tsoRows = await db.select().from(tsos);
    const showRows = await db.select().from(shows);
    const tsoMap = new Map(tsoRows.map(t => [t.id, t]));
    const showMap = new Map(showRows.map(s => [s.id, s]));
    let result = rows.map(t => ({
      ...t,
      tso: t.tsoId ? tsoMap.get(t.tsoId) : undefined,
      show: t.showId ? showMap.get(t.showId) : undefined,
    }));
    if (tsoId) result = result.filter(t => t.tsoId === tsoId);
    if (showId) result = result.filter(t => t.showId === showId);
    return result;
  },

  async createTask(data: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(data).returning();
    return task;
  },

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task | null> {
    const [task] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return task || null;
  },

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return (result.rowCount ?? 0) > 0;
  },

  // ─── CSV IMPORTS ──────────────────────────────────────────────────
  async createCsvImport(data: InsertCsvImport): Promise<CsvImport> {
    const [record] = await db.insert(csvImports).values(data).returning();
    return record;
  },

  async getCsvImports(): Promise<CsvImport[]> {
    return db.select().from(csvImports).orderBy(desc(csvImports.importedAt));
  },

  // ─── DASHBOARD ────────────────────────────────────────────────────
  async getDashboardStats() {
    const [tsoCount] = await db.select({ count: sql<number>`count(*)` }).from(tsos);
    const [showCount] = await db.select({ count: sql<number>`count(*)` }).from(shows);
    const [taskCount] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "To Do"));
    const [contactCount] = await db.select({ count: sql<number>`count(*)` }).from(contacts);
    const recentActivities = await db.select().from(activities).orderBy(desc(activities.createdAt)).limit(10);
    const upcomingShows = await db.select().from(shows)
      .where(sql`show_date >= CURRENT_DATE`)
      .orderBy(asc(shows.showDate))
      .limit(5);
    return {
      tsoCount: Number(tsoCount.count),
      showCount: Number(showCount.count),
      openTaskCount: Number(taskCount.count),
      contactCount: Number(contactCount.count),
      recentActivities,
      upcomingShows,
    };
  },
};

// Seed admin user
async function seedData() {
  const bcrypt = await import("bcrypt");
  const existing = await db.select().from(users).where(eq(users.username, "admin"));
  if (existing.length === 0) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error("WARNING: ADMIN_PASSWORD env var is not set. Admin user NOT created. Set ADMIN_PASSWORD to enable first-time login.");
      return;
    }
    const hash = await bcrypt.hash(adminPassword, 12);
    await db.insert(users).values({ username: "admin", password: hash });
    console.log("Admin user created from ADMIN_PASSWORD env var.");
  }

  // One-time password reset: set RESET_USERNAME and RESET_PASSWORD env vars to trigger
  const resetUsername = process.env.RESET_USERNAME;
  const resetPassword = process.env.RESET_PASSWORD;
  if (resetUsername && resetPassword) {
    const hash = await bcrypt.hash(resetPassword, 12);
    const result = await db.update(users).set({ password: hash }).where(eq(users.username, resetUsername)).returning({ username: users.username });
    if (result.length > 0) {
      console.log(`Password reset for user '${resetUsername}' completed via RESET_USERNAME/RESET_PASSWORD env vars.`);
    } else {
      console.warn(`Password reset attempted for '${resetUsername}' but no such user found.`);
    }
  }
}

// Attach seedData to storage export
(storage as any).seedData = seedData;
