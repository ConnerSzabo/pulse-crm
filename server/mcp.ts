/**
 * PokéPulse CRM – MCP tools
 *
 * Mounted on the main Express app at POST /mcp.
 * Requires X-Api-Key header matching MCP_API_KEY env var.
 *
 * Configure in Claude Code:
 *   claude mcp add pokepulse-crm \
 *     --transport http \
 *     --url "https://<your-railway-url>/mcp" \
 *     --header "X-Api-Key: <MCP_API_KEY>"
 */

import type { Request, Response, NextFunction } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { db } from "./db";
import { tsos, activities } from "@shared/schema";
import * as schema from "@shared/schema";
import { eq, ilike, lte, isNotNull, and } from "drizzle-orm";

const VALID_STATUSES = [
  "Not Contacted",
  "Attempt 1: Initial Comms Sent",
  "Attempt 2: Follow-up Sent",
  "Attempt 3: Final Follow-up",
  "Initial Response",
  "Info Requested",
  "Details Received",
  "Proposal Sent",
  "Negotiating",
  "Needs Promo Codes",
  "Confirmed",
  "Not Interested",
  "Ghosted / Disqualified",
] as const;

/* ─── Factory: create a fresh McpServer per request ─────────
 * McpServer.connect() binds a server to a single transport for
 * its lifetime.  Calling connect() a second time on the same
 * instance throws "Server already connected", so every stateless
 * HTTP request must get its own McpServer + Transport pair.
 * ────────────────────────────────────────────────────────── */
function createMcpServer(): McpServer {
  const server = new McpServer({ name: "pokepulse-crm", version: "1.0.0" });

  server.tool(
  "get_all_tsos",
  "Return every TSO record in the CRM including name, city, relationship status, priority, contact details, notes, next show date, and follow-up date.",
  {},
  async () => {
    const rows = await db.select().from(tsos).orderBy(tsos.name);
    return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
  },
);

  server.tool(
  "get_tso_by_name",
  "Look up a TSO by name (case-insensitive partial match). Single match returns full record with activities, shows, tasks, and contacts.",
  { name: z.string().describe("Full or partial TSO name") },
  async ({ name }) => {
    const matches = await db.select().from(tsos).where(ilike(tsos.name, `%${name}%`)).limit(5);
    if (matches.length === 0) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No TSO found" }) }] };
    }
    if (matches.length > 1) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            message: `${matches.length} TSOs matched – refine your search`,
            matches: matches.map(t => ({ id: t.id, name: t.name, city: t.city, relationshipStatus: t.relationshipStatus })),
          }, null, 2),
        }],
      };
    }
    const tso = matches[0];
    const [tsoActivities, tsoShows, tsoTasks, tsoContacts] = await Promise.all([
      db.select().from(schema.activities).where(eq(schema.activities.tsoId, tso.id)).orderBy(schema.activities.createdAt),
      db.select().from(schema.shows).where(eq(schema.shows.tsoId, tso.id)).orderBy(schema.shows.showDate),
      db.select().from(schema.tasks).where(eq(schema.tasks.tsoId, tso.id)).orderBy(schema.tasks.createdAt),
      db.select().from(schema.contacts).where(eq(schema.contacts.tsoId, tso.id)),
    ]);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ ...tso, activities: tsoActivities, shows: tsoShows, tasks: tsoTasks, contacts: tsoContacts }, null, 2),
      }],
    };
  },
);

  server.tool(
  "update_tso_status",
  `Update a TSO's relationship status. Valid values: ${VALID_STATUSES.join(", ")}`,
  {
    name:   z.string().describe("Full or partial TSO name"),
    status: z.enum(VALID_STATUSES).describe("New relationship status"),
  },
  async ({ name, status }) => {
    const matches = await db.select().from(tsos).where(ilike(tsos.name, `%${name}%`)).limit(2);
    if (matches.length === 0) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No TSO found" }) }] };
    }
    if (matches.length > 1) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: "Multiple TSOs matched – be more specific", matches: matches.map(t => ({ id: t.id, name: t.name })) }),
        }],
      };
    }
    const [updated] = await db
      .update(tsos)
      .set({ relationshipStatus: status, updatedAt: new Date() })
      .where(eq(tsos.id, matches[0].id))
      .returning();
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ success: true, tso: { id: updated.id, name: updated.name, relationshipStatus: updated.relationshipStatus } }, null, 2),
      }],
    };
  },
);

  server.tool(
  "add_tso_note",
  "Add a note or activity log entry to a TSO. Appears in the TSO's activity timeline in the CRM.",
  {
    name: z.string().describe("Full or partial TSO name"),
    note: z.string().describe("Note content to log"),
    type: z.enum(["Note", "Call", "Email", "Follow-up", "Meeting"]).default("Note").describe("Activity type"),
  },
  async ({ name, note, type }) => {
    const matches = await db.select().from(tsos).where(ilike(tsos.name, `%${name}%`)).limit(2);
    if (matches.length === 0) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No TSO found" }) }] };
    }
    if (matches.length > 1) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: "Multiple TSOs matched – be more specific", matches: matches.map(t => ({ id: t.id, name: t.name })) }),
        }],
      };
    }
    const [activity] = await db
      .insert(activities)
      .values({ tsoId: matches[0].id, type, note, loggedBy: "Claude (MCP)", isPinned: false })
      .returning();
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ success: true, activity: { id: activity.id, tsoId: activity.tsoId, type: activity.type, note: activity.note, createdAt: activity.createdAt } }, null, 2),
      }],
    };
  },
);

  server.tool(
  "list_overdue_followups",
  "Return all TSOs whose follow-up date is today or overdue, sorted most overdue first.",
  {},
  async () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await db
      .select()
      .from(tsos)
      .where(and(isNotNull(tsos.followUpDate), lte(tsos.followUpDate, today)))
      .orderBy(tsos.followUpDate);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          count: rows.length,
          asOf: today,
          records: rows.map(t => ({
            id: t.id, name: t.name, city: t.city,
            followUpDate: t.followUpDate, relationshipStatus: t.relationshipStatus,
            priority: t.priority, nextStep: t.nextStep, email: t.email, phone: t.phone,
          })),
        }, null, 2),
      }],
    };
  },
);

  return server;
}

/* ─── Middleware + route handler (used by routes.ts) ─────── */
export function mcpApiKeyGuard(req: Request, res: Response, next: NextFunction) {
  const key = process.env.MCP_API_KEY;
  if (!key) {
    // MCP_API_KEY not configured — disable endpoint
    res.status(503).json({ error: "MCP endpoint is not configured on this server" });
    return;
  }
  if (req.headers["x-api-key"] !== key) {
    res.status(401).json({ error: "Unauthorized: invalid or missing X-Api-Key header" });
    return;
  }
  next();
}

export async function mcpHandler(req: Request, res: Response) {
  // Fresh server + transport per request — stateless HTTP pattern.
  // Avoids "Server already connected" on the 2nd+ request.
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    // Return plain application/json instead of an SSE stream for POST responses.
    // This is spec-compliant and far more compatible with plugin systems that
    // don't handle SSE parsing correctly (or can't cope with gzip-encoded SSE).
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
}
