import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { testConnection } from "./db";
import { storage } from "./storage";

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL environment variable is required");
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET environment variable is required");
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);

// Enable gzip compression for all responses
app.use(compression());

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    username?: string;
  }
}

// Session setup
const pgStore = connectPg(session);
app.set("trust proxy", 1);
app.use(
  session({
    store: new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: "sessions",
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  })
);

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const isLargeArray = Array.isArray(capturedJsonResponse) && capturedJsonResponse.length > 20;
        if (isLargeArray) {
          logLine += ` :: [${capturedJsonResponse.length} items]`;
        } else {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
      }

      if (duration > 500) {
        console.warn(`SLOW API CALL (${duration}ms): ${req.method} ${path}`);
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({ message });
    });

    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`serving on port ${port}`);

        runPostStartupTasks();
      },
    );
  } catch (error) {
    console.error("FATAL: Server startup failed:", error);
    process.exit(1);
  }
})();

async function runPostStartupTasks() {
  try {
    log("Testing database connection...");
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error("WARNING: Database connection test failed.");
    }
  } catch (err) {
    console.error("WARNING: Database connection test error:", err);
  }

  try {
    const backfilled = await storage.backfillLeadStatus();
    if (backfilled > 0) {
      console.log(`Updated ${backfilled} companies to default Lead Status: 0 - Unqualified`);
    }
  } catch (err) {
    console.error("Failed to backfill lead status:", err);
  }

  try {
    const { migratedCount, trustsCreated } = await storage.migrateAcademyTrusts();
    if (migratedCount > 0 || trustsCreated > 0) {
      console.log(`Trust migration: ${migratedCount} companies migrated, ${trustsCreated} trusts created`);
    }
  } catch (err) {
    console.error("Failed to migrate academy trusts:", err);
  }

  log("Post-startup tasks completed.");
}
