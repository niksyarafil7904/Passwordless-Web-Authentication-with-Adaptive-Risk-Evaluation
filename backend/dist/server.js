"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
console.log("CWD =", process.cwd());
console.log("ENV PATH =", path_1.default.join(process.cwd(), ".env"));
const result = dotenv_1.default.config({ override: true });
console.log("DOTENV parsed =", result.parsed);
console.log("DOTENV error  =", result.error);
console.log("BOOT ORIGIN =", process.env.ORIGIN);
console.log("BOOT RP_ID  =", process.env.RP_ID);
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const pino_http_1 = __importDefault(require("pino-http"));
const cors_1 = __importDefault(require("cors"));
const express_session_1 = __importDefault(require("express-session"));
const session_1 = require("./routes/session");
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const pg_1 = __importDefault(require("pg"));
const health_1 = require("./routes/health");
const webauthn_1 = require("./routes/webauthn");
const otp_1 = require("./routes/otp");
const dashboard_1 = require("./routes/dashboard");
const auth_1 = require("./middleware/auth");
console.log("BOOT ORIGIN =", process.env.ORIGIN);
console.log("BOOT RP_ID  =", process.env.RP_ID);
const app = (0, express_1.default)();
// CORS configuration
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:4000', 'https://auth.testonline.digital',],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};
app.use((0, cors_1.default)(corsOptions));
// --------------------
// Middleware
// --------------------
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://static.cloudflareinsights.com"],
            connectSrc: ["'self'", "http://localhost:4000"],
        },
    },
}));
app.use((0, pino_http_1.default)());
app.use(express_1.default.json());
// Handle invalid JSON errors
app.use((err, _req, res, next) => {
    if (err?.type === "entity.parse.failed") {
        return res.status(400).json({
            ok: false,
            message: "Invalid JSON received",
            hint: "Ensure JSON keys and values are double-quoted",
        });
    }
    next(err);
});
app.use((0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
}));
// --------------------
// Session Management
// --------------------
const PgSession = (0, connect_pg_simple_1.default)(express_session_1.default);
const { Pool } = pg_1.default;
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
app.use((0, express_session_1.default)({
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
        secure: false,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24,
    },
}));
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
app.use(health_1.healthRouter);
app.use("/webauthn", webauthn_1.webauthnRouter);
app.use("/otp", otp_1.otpRouter);
// --------------------
// Protected API Routes (auth required)
// --------------------
app.use("/me", auth_1.requireAuth);
app.use("/devices", auth_1.requireAuth);
app.use("/activity", auth_1.requireAuth);
app.use(dashboard_1.dashboardRouter);
app.use(session_1.sessionRouter);
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
const frontendDistPath = path_1.default.resolve(__dirname, "../../FRONTEND/dist");
const frontendIndexHtml = path_1.default.join(frontendDistPath, "index.html");
if (fs_1.default.existsSync(frontendIndexHtml)) {
    app.use(express_1.default.static(frontendDistPath));
    // Protected routes - require authentication
    app.get('/dashboard', auth_1.requireDashboardAccess, (req, res) => {
        res.sendFile(frontendIndexHtml);
    });
    app.get('/profile', auth_1.requireDashboardAccess, (req, res) => {
        res.sendFile(frontendIndexHtml);
    });
    app.get('/add-device', auth_1.requireDashboardAccess, (req, res) => {
        res.sendFile(frontendIndexHtml);
    });
    // Login page - redirect if already logged in
    app.get('/login', auth_1.redirectIfLoggedIn, (req, res) => {
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
}
else {
    console.log("Frontend build not found at:", frontendDistPath);
    console.log("Build it with: cd FRONTEND && npm run build");
}
// --------------------
// Global Error Handler
// --------------------
app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ ok: false, error: err?.message ?? "Server error" });
});
const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
    console.log(`Server ready at http://localhost:${port}`);
});
//# sourceMappingURL=server.js.map