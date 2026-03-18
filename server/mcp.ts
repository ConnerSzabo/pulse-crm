/**
 * PokéPulse CRM – MCP endpoint
 *
 * Implements the MCP streamable-HTTP transport directly (no SDK transport
 * layer) so it works with any HTTP client regardless of Accept headers.
 *
 * POST /mcp  – JSON-RPC 2.0 request/response
 * GET  /mcp  – SSE stream (kept alive for clients that require it)
 *
 * Configure in Claude Code:
 *   claude mcp add pokepulse-crm \
 *     --transport http \
 *     --url "https://crm.wavesystems.co.uk/mcp" \
 *     --header "X-Api-Key: <MCP_API_KEY>"
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { tsos, activities } from "@shared/schema";
import * as schema from "@shared/schema";
import { eq, ilike, lte, isNotNull, and } from "drizzle-orm";
import { nanoid } from "nanoid";

// ─── SSE session store ────────────────────────────────────────────────────────
// Maps sessionId → active SSE response object for the SSE transport.

const sseSessions = new Map<string, Response>();

// ─── Tool definitions (sent in tools/list) ────────────────────────────────────

const TOOLS = [
  {
    name: "get_all_tsos",
    description:
      "Return every TSO record in the CRM including name, city, relationship status, priority, contact details, notes, next show date, and follow-up date.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_tso_by_name",
    description:
      "Look up a TSO by name (case-insensitive partial match). A single match returns the full record with activities, shows, tasks, and contacts.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Full or partial TSO name" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_tso_status",
    description:
      "Update a TSO's relationship status. Valid values: Not Contacted, Attempt 1: Initial Comms Sent, Attempt 2: Follow-up Sent, Attempt 3: Final Follow-up, Initial Response, Info Requested, Details Received, Proposal Sent, Negotiating, Needs Promo Codes, Confirmed, Not Interested, Ghosted / Disqualified.",
    inputSchema: {
      type: "object",
      properties: {
        name:   { type: "string", description: "Full or partial TSO name" },
        status: { type: "string", description: "New relationship status" },
      },
      required: ["name", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "add_tso_note",
    description: "Add a note or activity log entry to a TSO. Appears in the TSO's activity timeline in the CRM.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Full or partial TSO name" },
        note: { type: "string", description: "Note content to log" },
        type: {
          type: "string",
          enum: ["Note", "Call", "Email", "Follow-up", "Meeting"],
          description: "Activity type (default: Note)",
        },
      },
      required: ["name", "note"],
      additionalProperties: false,
    },
  },
  {
    name: "list_overdue_followups",
    description: "Return all TSOs whose follow-up date is today or overdue, sorted most overdue first.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

// ─── Tool implementations ─────────────────────────────────────────────────────

async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_all_tsos": {
      const rows = await db.select().from(tsos).orderBy(tsos.name);
      return rows;
    }

    case "get_tso_by_name": {
      const search = String(args.name ?? "");
      const matches = await db.select().from(tsos).where(ilike(tsos.name, `%${search}%`)).limit(5);
      if (matches.length === 0) return { error: "No TSO found" };
      if (matches.length > 1) {
        return {
          message: `${matches.length} TSOs matched – refine your search`,
          matches: matches.map(t => ({ id: t.id, name: t.name, city: t.city, relationshipStatus: t.relationshipStatus })),
        };
      }
      const tso = matches[0];
      const [tsoActivities, tsoShows, tsoTasks, tsoContacts] = await Promise.all([
        db.select().from(schema.activities).where(eq(schema.activities.tsoId, tso.id)).orderBy(schema.activities.createdAt),
        db.select().from(schema.shows).where(eq(schema.shows.tsoId, tso.id)).orderBy(schema.shows.showDate),
        db.select().from(schema.tasks).where(eq(schema.tasks.tsoId, tso.id)).orderBy(schema.tasks.createdAt),
        db.select().from(schema.contacts).where(eq(schema.contacts.tsoId, tso.id)),
      ]);
      return { ...tso, activities: tsoActivities, shows: tsoShows, tasks: tsoTasks, contacts: tsoContacts };
    }

    case "update_tso_status": {
      const search = String(args.name ?? "");
      const status = String(args.status ?? "");
      const matches = await db.select().from(tsos).where(ilike(tsos.name, `%${search}%`)).limit(2);
      if (matches.length === 0) return { error: "No TSO found" };
      if (matches.length > 1) {
        return { error: "Multiple TSOs matched – be more specific", matches: matches.map(t => ({ id: t.id, name: t.name })) };
      }
      const [updated] = await db
        .update(tsos)
        .set({ relationshipStatus: status, updatedAt: new Date() })
        .where(eq(tsos.id, matches[0].id))
        .returning();
      return { success: true, tso: { id: updated.id, name: updated.name, relationshipStatus: updated.relationshipStatus } };
    }

    case "add_tso_note": {
      const search = String(args.name ?? "");
      const note   = String(args.note ?? "");
      const type   = String(args.type ?? "Note") as "Note" | "Call" | "Email" | "Follow-up" | "Meeting";
      const matches = await db.select().from(tsos).where(ilike(tsos.name, `%${search}%`)).limit(2);
      if (matches.length === 0) return { error: "No TSO found" };
      if (matches.length > 1) {
        return { error: "Multiple TSOs matched – be more specific", matches: matches.map(t => ({ id: t.id, name: t.name })) };
      }
      const [activity] = await db
        .insert(activities)
        .values({ tsoId: matches[0].id, type, note, loggedBy: "Claude (MCP)", isPinned: false })
        .returning();
      return { success: true, activity: { id: activity.id, tsoId: activity.tsoId, type: activity.type, note: activity.note, createdAt: activity.createdAt } };
    }

    case "list_overdue_followups": {
      const today = new Date().toISOString().slice(0, 10);
      const rows = await db
        .select()
        .from(tsos)
        .where(and(isNotNull(tsos.followUpDate), lte(tsos.followUpDate, today)))
        .orderBy(tsos.followUpDate);
      return {
        count: rows.length,
        asOf: today,
        records: rows.map(t => ({
          id: t.id, name: t.name, city: t.city,
          followUpDate: t.followUpDate, relationshipStatus: t.relationshipStatus,
          priority: t.priority, nextStep: t.nextStep, email: t.email, phone: t.phone,
        })),
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── CORS middleware ───────────────────────────────────────────────────────────

export function mcpCors(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, X-Api-Key, Authorization, Mcp-Session-Id, Last-Event-ID",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

// ─── API-key guard ─────────────────────────────────────────────────────────────

export function mcpApiKeyGuard(req: Request, res: Response, next: NextFunction) {
  const key = process.env.MCP_API_KEY;
  if (!key) {
    res.status(503).json({ error: "MCP endpoint is not configured on this server" });
    return;
  }
  // Accept key via X-Api-Key header OR ?key= query param (useful for SSE URLs).
  const provided = (req.headers["x-api-key"] as string | undefined) ?? (req.query.key as string | undefined);
  if (provided !== key) {
    res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
    return;
  }
  next();
}

// ─── MCP request handler ───────────────────────────────────────────────────────
//
// Implements JSON-RPC 2.0 directly — no SDK transport layer, no Accept-header
// validation, no Hono bridge, no SSE negotiation.  Works with any HTTP client.
//
// GET  /mcp → keeps an SSE connection open (server-initiated notifications are
//             not used in this stateless server, but some clients require the
//             endpoint to accept GET before they'll send POST).
// POST /mcp → JSON-RPC dispatch: initialize / tools/list / tools/call / ping.

export async function mcpHandler(req: Request, res: Response) {
  // ── GET: open a long-lived SSE stream ──────────────────────────────────────
  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    // Send a comment every 25 s to prevent proxy timeouts.
    const keepAlive = setInterval(() => res.write(": ping\n\n"), 25_000);
    req.on("close", () => clearInterval(keepAlive));
    return;
  }

  // ── POST: JSON-RPC 2.0 dispatch ────────────────────────────────────────────
  const body = req.body as { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };
  const id = body?.id ?? null;

  const ok  = (result: unknown) => res.json({ jsonrpc: "2.0", id, result });
  const err = (code: number, message: string) =>
    res.status(400).json({ jsonrpc: "2.0", id, error: { code, message } });

  const method = body?.method ?? "";

  // Notifications: client sends, no response expected.
  if (method.startsWith("notifications/")) {
    res.status(202).end();
    return;
  }

  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "pokepulse-crm", version: "1.0.0" },
      });

    case "ping":
      return ok({});

    case "tools/list":
      return ok({ tools: TOOLS });

    case "tools/call": {
      const params = body.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
      const toolName = params?.name ?? "";
      const toolArgs = params?.arguments ?? {};
      try {
        const result = await runTool(toolName, toolArgs);
        return ok({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (e: any) {
        console.error("MCP tool error:", e);
        return err(-32000, e?.message ?? "Tool execution failed");
      }
    }

    default:
      return err(-32601, `Method not found: ${method}`);
  }
}

// ─── SSE transport ─────────────────────────────────────────────────────────────
//
// Implements the MCP SSE transport spec:
//   GET  /mcp/sse  → opens SSE stream, emits "endpoint" event with POST URL
//   POST /mcp/messages?sessionId=<id> → client sends JSON-RPC here;
//                                        server sends response via the SSE stream
//
// The API key may be passed as X-Api-Key header OR ?key=... query parameter.

export async function mcpSseHandler(req: Request, res: Response) {
  const sessionId = nanoid();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Tell the client where to POST messages for this session.
  const messagesUrl = `/mcp/messages?sessionId=${sessionId}`;
  res.write(`event: endpoint\ndata: ${messagesUrl}\n\n`);

  sseSessions.set(sessionId, res);

  const keepAlive = setInterval(() => res.write(": ping\n\n"), 25_000);
  req.on("close", () => {
    clearInterval(keepAlive);
    sseSessions.delete(sessionId);
  });
}

export async function mcpMessagesHandler(req: Request, res: Response) {
  const sessionId = req.query.sessionId as string;
  const sseRes = sseSessions.get(sessionId);

  if (!sseRes) {
    res.status(400).json({ error: "Unknown or expired session" });
    return;
  }

  const body = req.body as { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };
  const id = body?.id ?? null;
  const method = body?.method ?? "";

  const send = (result: unknown) => {
    sseRes.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id, result })}\n\n`);
    res.status(202).end();
  };
  const sendErr = (code: number, message: string) => {
    sseRes.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n\n`);
    res.status(202).end();
  };

  if (method.startsWith("notifications/")) {
    res.status(202).end();
    return;
  }

  switch (method) {
    case "initialize":
      return send({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "pokepulse-crm", version: "1.0.0" },
      });

    case "ping":
      return send({});

    case "tools/list":
      return send({ tools: TOOLS });

    case "tools/call": {
      const params = body.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
      const toolName = params?.name ?? "";
      const toolArgs = params?.arguments ?? {};
      try {
        const result = await runTool(toolName, toolArgs);
        return send({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (e: any) {
        console.error("MCP SSE tool error:", e);
        return sendErr(-32000, e?.message ?? "Tool execution failed");
      }
    }

    default:
      return sendErr(-32601, `Method not found: ${method}`);
  }
}
