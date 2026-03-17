/**
 * PokéPulse CRM – MCP Server
 *
 * Exposes CRM data as tools for Claude / Claude Code.
 * Runs as a standalone HTTP process (StreamableHTTP transport).
 *
 * Required env vars:
 *   DATABASE_URL  – same Postgres URL used by the main app
 *   MCP_API_KEY   – secret that callers must send in X-Api-Key header
 *
 * Optional:
 *   MCP_PORT      – defaults to 3001
 *
 * Configure in Claude Code (~/.claude.json or .mcp.json):
 *   {
 *     "mcpServers": {
 *       "pokepulse-crm": {
 *         "type": "http",
 *         "url": "http://localhost:3001/mcp",
 *         "headers": { "X-Api-Key": "<your MCP_API_KEY>" }
 *       }
 *     }
 *   }
 */

import express, { type Request, type Response, type NextFunction } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { tsos, activities } from "@shared/schema";
import { eq, ilike, lte, or, isNotNull, and } from "drizzle-orm";
import * as schema from "@shared/schema";

/* ─── Env validation ─────────────────────────────────────── */
if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is required");
  process.exit(1);
}
if (!process.env.MCP_API_KEY) {
  console.error("FATAL: MCP_API_KEY is required");
  process.exit(1);
}

const MCP_API_KEY = process.env.MCP_API_KEY;
const MCP_PORT   = parseInt(process.env.MCP_PORT ?? "3001", 10);

/* ─── DB connection ──────────────────────────────────────── */
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const db   = drizzle(pool, { schema });

/* ─── MCP Server ─────────────────────────────────────────── */
const server = new McpServer({
  name:    "pokepulse-crm",
  version: "1.0.0",
});

// ── Tool 1: get_all_tsos ─────────────────────────────────
server.tool(
  "get_all_tsos",
  "Return every TSO record in the CRM. Includes name, city, relationship status, priority, contact details, notes, next show date, and follow-up date.",
  {},
  async () => {
    const rows = await db
      .select()
      .from(tsos)
      .orderBy(tsos.name);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(rows, null, 2),
      }],
    };
  },
);

// ── Tool 2: get_tso_by_name ──────────────────────────────
server.tool(
  "get_tso_by_name",
  "Look up a single TSO by name (case-insensitive, partial match). Returns the TSO record plus all linked activities, tasks, shows, and contacts.",
  { name: z.string().describe("Full or partial TSO name to search for") },
  async ({ name }) => {
    const matches = await db
      .select()
      .from(tsos)
      .where(ilike(tsos.name, `%${name}%`))
      .limit(5);

    if (matches.length === 0) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No TSO found matching that name" }) }] };
    }

    // If multiple matches return a summary list; if exactly one, enrich it
    if (matches.length > 1) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            message: `${matches.length} TSOs matched. Refine your search or pick one of the names below.`,
            matches: matches.map(t => ({ id: t.id, name: t.name, city: t.city, relationshipStatus: t.relationshipStatus })),
          }, null, 2),
        }],
      };
    }

    const tso = matches[0];

    // Fetch related records in parallel
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

// ── Tool 3: update_tso_status ────────────────────────────
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
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No TSO found matching that name" }) }] };
    }
    if (matches.length > 1) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: "Multiple TSOs matched – be more specific",
            matches: matches.map(t => ({ id: t.id, name: t.name })),
          }),
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

// ── Tool 4: add_tso_note ─────────────────────────────────
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
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No TSO found matching that name" }) }] };
    }
    if (matches.length > 1) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: "Multiple TSOs matched – be more specific",
            matches: matches.map(t => ({ id: t.id, name: t.name })),
          }),
        }],
      };
    }

    const [activity] = await db
      .insert(activities)
      .values({
        tsoId:    matches[0].id,
        type,
        note,
        loggedBy: "Claude (MCP)",
        isPinned: false,
      })
      .returning();

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          activity: { id: activity.id, tsoId: activity.tsoId, type: activity.type, note: activity.note, createdAt: activity.createdAt },
        }, null, 2),
      }],
    };
  },
);

// ── Tool 5: list_overdue_followups ───────────────────────
server.tool(
  "list_overdue_followups",
  "Return all TSOs whose follow-up date is today or in the past (overdue). Sorted by follow-up date ascending (most overdue first).",
  {},
  async () => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const rows = await db
      .select()
      .from(tsos)
      .where(
        and(
          isNotNull(tsos.followUpDate),
          lte(tsos.followUpDate, today),
        ),
      )
      .orderBy(tsos.followUpDate);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          count:   rows.length,
          asOf:    today,
          records: rows.map(t => ({
            id:                 t.id,
            name:               t.name,
            city:               t.city,
            followUpDate:       t.followUpDate,
            relationshipStatus: t.relationshipStatus,
            priority:           t.priority,
            nextStep:           t.nextStep,
            email:              t.email,
            phone:              t.phone,
          })),
        }, null, 2),
      }],
    };
  },
);

/* ─── Express app ────────────────────────────────────────── */
const app = express();
app.use(express.json());

// Health check — no auth required
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", server: "pokepulse-crm-mcp" });
});

// API key guard — all routes below this require X-Api-Key
app.use((req: Request, res: Response, next: NextFunction) => {
  const key = req.headers["x-api-key"];
  if (!key || key !== MCP_API_KEY) {
    res.status(401).json({ error: "Unauthorized: invalid or missing X-Api-Key header" });
    return;
  }
  next();
});

// MCP endpoint — stateless, one transport per request
app.post("/mcp", async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.listen(MCP_PORT, "0.0.0.0", () => {
  console.log(`PokéPulse CRM MCP server running on port ${MCP_PORT}`);
  console.log(`Endpoint: POST http://localhost:${MCP_PORT}/mcp`);
  console.log(`Required header: X-Api-Key: <MCP_API_KEY>`);
});
