"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireDashboardAccess = requireDashboardAccess;
exports.redirectIfLoggedIn = redirectIfLoggedIn;
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            ok: false,
            message: "Unauthorized: Please login first"
        });
    }
    next();
}
function requireDashboardAccess(req, res, next) {
    if (!req.session.userId) {
        // For HTML page requests, redirect to login
        if (req.accepts('html')) {
            return res.redirect('/login');
        }
        // For API requests, return JSON error
        return res.status(401).json({
            ok: false,
            message: "Unauthorized: Please login first"
        });
    }
    next();
}
// Optional: Check if user is already logged in (for login page)
function redirectIfLoggedIn(req, res, next) {
    if (req.session.userId) {
        if (req.accepts('html')) {
            return res.redirect('/dashboard');
        }
        return res.json({ ok: true, message: "Already logged in" });
    }
    next();
}
//# sourceMappingURL=auth.js.map