import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],   // unsafe-inline required by Vite/FullCalendar
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        frameAncestors: ["'none'"],   // blocks clickjacking
        baseUri: ["'self'"],           // prevents <base> tag injection
        formAction: ["'self'"],        // forms can only submit to own origin
      },
    },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// Login-specific rate limiter: 10 attempts per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

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
    name: "sid",
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
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours (working day session)
    },
  })
);

app.use(
  express.json({
    limit: "1mb",
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

// Health check — responds immediately, no DB required
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

(async () => {
  try {
    registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      const message = status >= 500 ? "Internal Server Error" : (err.message || "Internal Server Error");
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

        // All DB operations run AFTER server is listening — never block port binding
        runPostStartupTasks();
      },
    );
  } catch (error) {
    console.error("FATAL: Server startup failed:", error);
    process.exit(1);
  }
})();

async function runPostStartupTasks() {
  // 1. Test database connection
  try {
    log("Testing database connection...");
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error("WARNING: Database connection test failed.");
    }
  } catch (err) {
    console.error("WARNING: Database connection test error:", err);
  }

  // 2. Push schema (create/update tables) — runs on every startup so Railway never needs a separate build step
  try {
    log("Pushing database schema...");
    const { execSync } = await import("child_process");
    execSync("npx drizzle-kit push --force", { stdio: "inherit", cwd: process.cwd() });
    log("Database schema up to date.");
  } catch (err) {
    console.error("WARNING: Schema push failed (non-fatal):", err);
  }

  // 3. Seed admin user if needed
  try {
    await (storage as any).seedData();
    log("Seed data initialized.");
  } catch (err) {
    console.error("WARNING: Seed data failed (non-fatal):", err);
  }

  log("Post-startup tasks completed.");
}
