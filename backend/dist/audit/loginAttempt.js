"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logLoginAttempt = logLoginAttempt;
// src/audit/loginAttempt.ts
const prisma_1 = require("../lib/prisma");
async function logLoginAttempt(input) {
    try {
        await prisma_1.prisma.loginAttempt.create({
            data: {
                success: input.success,
                userId: input.userId ?? null,
                username: input.username ?? null,
                // "deviceKey" is in your model and will be used for risk scoring later
                deviceKey: input.deviceKey ?? input.credentialId ?? null,
                ip: input.ip ?? null,
                location: input.location ?? null,
                userAgent: input.userAgent ?? null,
                // placeholders for now (Step 7 will compute real values)
                riskScore: input.riskScore ?? 0,
                riskLevel: input.riskLevel ?? "unknown",
                stepUpUsed: input.stepUpUsed ?? false,
            },
        });
    }
    catch (e) {
        // Never fail login because audit logging failed
        console.error("logLoginAttempt failed:", e);
    }
}
//# sourceMappingURL=loginAttempt.js.map