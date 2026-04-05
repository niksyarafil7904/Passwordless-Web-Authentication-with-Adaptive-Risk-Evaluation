// src/audit/loginAttempt.ts
import { prisma } from "../lib/prisma";

type LogLoginAttemptInput = {
  success: boolean;

  userId?: string;
  username?: string;
  credentialId?: string; // base64url string from client (body.id)
  deviceKey?: string;

  ip?: string | null;
  location?: string | null;
  userAgent?: string | null;

  riskScore?: number;
  riskLevel?: string;
  stepUpUsed?: boolean;
};

export async function logLoginAttempt(input: LogLoginAttemptInput) {
  try {
    await prisma.loginAttempt.create({
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
  } catch (e) {
    // Never fail login because audit logging failed
    console.error("logLoginAttempt failed:", e);
  }
}
