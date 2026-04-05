"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionRouter = void 0;
const express_1 = require("express");
exports.sessionRouter = (0, express_1.Router)();
/**
 * Destroys server session + clears cookie
 */
exports.sessionRouter.post("/logout", (req, res) => {
    // If there is no session user, we still respond OK (idempotent logout)
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout destroy error:", err);
            return res.status(500).json({ ok: false, message: "Failed to logout" });
        }
        // must match the name in session({ name: "authsid", ... })
        res.clearCookie("authsid", {
            httpOnly: true,
            sameSite: "none",
            secure: true,
        });
        return res.json({ ok: true });
    });
});
//# sourceMappingURL=session.js.map