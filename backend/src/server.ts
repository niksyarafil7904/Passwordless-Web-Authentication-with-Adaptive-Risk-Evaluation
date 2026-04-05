// src/server.ts
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Only load .env in development (not in production/Railway)
if (process.env.NODE_ENV !== 'production') {
  const result = dotenv.config({ override: true });
  console.log("DOTENV parsed =", result.parsed);
  if (result.error) {
    console.log("DOTENV error =", result.error);
  }
} else {
  console.log("Running in production mode - using environment variables");
}

console.log("CWD =", process.cwd());
console.log("BOOT ORIGIN =", process.env.ORIGIN);
console.log("BOOT RP_ID  =", process.env.RP_ID);

console.log("BOOT ORIGIN =", process.env.ORIGIN);
console.log("BOOT RP_ID  =", process.env.RP_ID);

import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import cors from "cors";

import session from "express-session";
import { sessionRouter } from "./routes/session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

import { healthRouter } from "./routes/health";
import { webauthnRouter } from "./routes/webauthn";

import { otpRouter } from "./routes/otp";
import { dashboardRouter } from "./routes/dashboard";
import { requireAuth, requireDashboardAccess, redirectIfLoggedIn } from "./middleware/auth";

console.log("BOOT ORIGIN =", process.env.ORIGIN);
console.log("BOOT RP_ID  =", process.env.RP_ID);

const app = express();

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:4000', 'https://auth.testonline.digital',],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

// --------------------
// Middleware
// --------------------

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://static.cloudflareinsights.com"],
        connectSrc: ["'self'", "http://localhost:4000"],
      },
    },
  })
);

app.use(pinoHttp());
app.use(express.json());

// Handle invalid JSON errors
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      ok: false,
      message: "Invalid JSON received",
      hint: "Ensure JSON keys and values are double-quoted",
    });
  }
  next(err);
});

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// --------------------
// Session Management
// --------------------
const PgSession = connectPgSimple(session);
const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
const sessionSecret = process.env.SESSION_SECRET;

if (!databaseUrl || !sessionSecret) {
  throw new Error("DATABASE_URL or SESSION_SECRET missing in .env");
}

const sessionPool = new Pool({ connectionString: databaseUrl });
sessionPool
  .query("select current_database() as db, current_schema() as schema, current_user as user")
  .then((r) => console.log("SESSION DB CHECK:", r.rows[0]))
  .catch((e) => console.error("SESSION DB CHECK ERR:", e));

// Behind Cloudflare Tunnel (proxy), so trust the first proxy
app.set("trust proxy", 1);

app.use(
  session({
    name: "authsid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new PgSession({
      pool: sessionPool,
      createTableIfMissing: true,
      tableName: "sessions_pg",
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

// Session refresh middleware - touch session on activity
app.use((req, res, next) => {
  if (req.session.userId) {
    req.session.touch();
  }
  next();
});

// Session debug middleware (remove in production)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔍 SESSION DEBUG:');
    console.log('  URL:', req.method, req.url);
    console.log('  Session ID:', req.sessionID);
    console.log('  User ID:', req.session.userId);
    console.log('  Has auth challenge:', !!req.session.webauthnAuthChallenge);
    console.log('  Cookie header:', req.headers.cookie ? 'Present' : 'Missing');
  }
  next();
});

// --------------------
// Public Routes (no auth required)
// --------------------
app.use(healthRouter);
app.use("/webauthn", webauthnRouter);
app.use("/otp", otpRouter); 

// --------------------
// Protected API Routes (auth required)
// --------------------
app.use("/me", requireAuth);
app.use("/devices", requireAuth);
app.use("/activity", requireAuth);
app.use(dashboardRouter);
app.use(sessionRouter);

// Logout endpoint
app.post("/logout", async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ ok: false, message: "Logout failed" });
    }
    res.clearCookie('authsid');
    res.json({ ok: true, message: "Logged out successfully" });
  });
});

// --------------------
// Serve Frontend (Vite build)
// --------------------
const frontendDistPath = path.resolve(__dirname, "../../FRONTEND/dist");
const frontendIndexHtml = path.join(frontendDistPath, "index.html");

if (fs.existsSync(frontendIndexHtml)) {
  app.use(express.static(frontendDistPath));

  // Protected routes - require authentication
  app.get('/dashboard', requireDashboardAccess, (req, res) => {
    res.sendFile(frontendIndexHtml);
  });

  app.get('/profile', requireDashboardAccess, (req, res) => {
    res.sendFile(frontendIndexHtml);
  });

  app.get('/add-device', requireDashboardAccess, (req, res) => {
    res.sendFile(frontendIndexHtml);
  });

  // Login page - redirect if already logged in
  app.get('/login', redirectIfLoggedIn, (req, res) => {
    res.sendFile(frontendIndexHtml);
  });

  // OTP page - no auth required (step-up)
  app.get('/otp', (req, res) => {
    res.sendFile(frontendIndexHtml);
  });

  // SPA fallback: serve index.html for non-API routes (with protection)
  app.get(/.*/, (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith("/webauthn") || 
        req.path.startsWith("/health") || 
        req.path.startsWith("/otp") ||
        req.path.startsWith("/me") ||
        req.path.startsWith("/devices") ||
        req.path.startsWith("/activity") ||
        req.path.startsWith("/logout")) {
      return next();
    }
    
    // Protect dashboard routes
    if (req.path === '/' || req.path === '/dashboard' || req.path === '/profile' || req.path === '/add-device') {
      if (!req.session.userId) {
        return res.redirect('/login');
      }
    }
    
    return res.sendFile(frontendIndexHtml);
  });

  console.log("Serving frontend from:", frontendDistPath);
} else {
  console.log("Frontend build not found at:", frontendDistPath);
  console.log("Build it with: cd FRONTEND && npm run build");
}

// --------------------
// Global Error Handler
// --------------------
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: err?.message ?? "Server error" });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Server ready at http://localhost:${port}`);
});