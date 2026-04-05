"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
// backend/src/routes/dashboard.ts
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
exports.dashboardRouter = (0, express_1.Router)();
// Helper function to get client IP
function getClientIp(req) {
    const cf = req.headers["cf-connecting-ip"];
    if (typeof cf === "string" && cf.length > 0)
        return cf;
    const xffRaw = req.headers["x-forwarded-for"];
    const xff = typeof xffRaw === "string" ? xffRaw : Array.isArray(xffRaw) ? xffRaw[0] : undefined;
    if (xff && xff.length > 0) {
        return xff.split(",")[0].trim();
    }
    return req.ip;
}
// 1. GET /me - Get current user profile
exports.dashboardRouter.get("/me", async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                username: true,
                email: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.json({
            username: user.username,
            email: user.email,
        });
    }
    catch (error) {
        console.error("Error fetching user:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});
// 2. GET /devices - Get all trusted devices (WebAuthn credentials)
exports.dashboardRouter.get("/devices", async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        // Get all WebAuthn credentials for this user
        const credentials = await prisma_1.prisma.webAuthnCredential.findMany({
            where: { userId: userId },
            orderBy: { createdAt: "desc" },
        });
        // Get the credential ID used for current session (if stored)
        const currentCredentialId = req.session.currentCredentialId;
        // Format devices for frontend
        const devices = credentials.map((cred) => ({
            id: cred.id,
            name: cred.deviceName || `Passkey ${cred.id.slice(-6)}`,
            os: cred.deviceOS || "Unknown OS",
            lastActive: cred.lastUsedAt
                ? new Date(cred.lastUsedAt).toLocaleString()
                : new Date(cred.createdAt).toLocaleString(),
            isCurrentDevice: currentCredentialId === String(cred.id), // Compare as strings
            credentialId: Buffer.from(cred.credentialId).toString("base64url"),
        }));
        return res.json({ devices });
    }
    catch (error) {
        console.error("Error fetching devices:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});
// backend/src/routes/dashboard.ts - Activity endpoint
exports.dashboardRouter.get("/activity", async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        const [loginAttempts, credentials] = await Promise.all([
            prisma_1.prisma.loginAttempt.findMany({
                where: { userId: userId },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            prisma_1.prisma.webAuthnCredential.findMany({
                where: { userId: userId },
                select: { credentialId: true, deviceName: true },
            }),
        ]);
        const deviceNameMap = new Map();
        credentials.forEach(cred => {
            const key = Buffer.from(cred.credentialId).toString('base64url');
            deviceNameMap.set(key, cred.deviceName);
        });
        const activities = loginAttempts.map((attempt) => {
            // Parse riskReasons from JSON string
            let reasons = [];
            if (attempt.riskReasons) {
                try {
                    const parsed = JSON.parse(attempt.riskReasons);
                    if (Array.isArray(parsed)) {
                        reasons = parsed;
                    }
                }
                catch (e) {
                    console.error("Failed to parse riskReasons:", e);
                    reasons = [];
                }
            }
            let riskColor = '#64748b';
            if (attempt.riskLevel === 'low')
                riskColor = '#10b981';
            else if (attempt.riskLevel === 'high')
                riskColor = '#ef4444';
            return {
                event: attempt.success ? "Login Success" : "Login Failed",
                device: attempt.deviceKey
                    ? (deviceNameMap.get(attempt.deviceKey) || `Device ${attempt.deviceKey.slice(-6)}`)
                    : "Unknown Device",
                location: attempt.location || "Unknown Location",
                timestamp: new Date(attempt.createdAt).toLocaleString(),
                riskScore: attempt.riskScore,
                riskLevel: attempt.riskLevel,
                riskColor: riskColor,
                riskReasons: reasons,
            };
        });
        return res.json({ activities });
    }
    catch (error) {
        console.error("Error fetching activity:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});
// 4. DELETE /devices/remove/:id - Remove a trusted device
exports.dashboardRouter.delete("/devices/remove/:id", async (req, res) => {
    try {
        const userId = req.session.userId;
        const deviceId = req.params.id;
        if (!userId) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        // Verify the device belongs to this user
        const credential = await prisma_1.prisma.webAuthnCredential.findFirst({
            where: {
                id: deviceId,
                userId: userId,
            },
        });
        if (!credential) {
            return res.status(404).json({ error: "Device not found" });
        }
        // Prevent removing the last device
        const deviceCount = await prisma_1.prisma.webAuthnCredential.count({
            where: { userId: userId },
        });
        if (deviceCount === 1) {
            return res.status(400).json({
                error: "Cannot remove last device. You need at least one passkey to login."
            });
        }
        // Delete the credential
        await prisma_1.prisma.webAuthnCredential.delete({
            where: { id: deviceId },
        });
        // Log the activity
        await prisma_1.prisma.loginAttempt.create({
            data: {
                userId: userId,
                success: true,
                riskScore: 0,
                riskLevel: "info",
                deviceKey: credential.credentialId.toString(),
                ip: getClientIp(req),
                userAgent: req.get("user-agent") || null,
                location: "Device removed",
            },
        });
        return res.json({ success: true, message: "Device removed successfully" });
    }
    catch (error) {
        console.error("Error removing device:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});
//# sourceMappingURL=dashboard.js.map