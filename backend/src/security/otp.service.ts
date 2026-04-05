// backend/src/security/otp.service.ts
import crypto from "crypto";
import { prisma } from "../lib/prisma";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const OTP_PEPPER = process.env.OTP_PEPPER ?? "dev-only-change-me";

function randomOtp(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

async function scryptHash(input: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.scrypt(input, salt, 64, (err, key) => {
      if (err) return reject(err);
      resolve(`${salt.toString("hex")}.${Buffer.from(key).toString("hex")}`);
    });
  });
}

async function scryptVerify(input: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(".");
  if (!saltHex || !hashHex) return Promise.resolve(false);

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");

  return new Promise((resolve) => {
    crypto.scrypt(input, salt, expected.length, (err, key) => {
      if (err) return resolve(false);
      const actual = Buffer.from(key);
      if (actual.length !== expected.length) return resolve(false);
      resolve(crypto.timingSafeEqual(actual, expected));
    });
  });
}

export async function issueStepUpOtp(userId: string) {
  const otp = randomOtp();
  const otpHash = await scryptHash(`${otp}:${OTP_PEPPER}`);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Invalidate any existing unused OTPs for this user
  await prisma.otpToken.updateMany({
    where: { 
      userId, 
      purpose: "STEP_UP", 
      usedAt: null, 
      expiresAt: { gt: new Date() } 
    },
    data: { usedAt: new Date() },
  });

  const token = await prisma.otpToken.create({
    data: { 
      userId, 
      otpHash, 
      purpose: "STEP_UP", 
      expiresAt 
    },
  });

  return { otp, otpId: token.id, expiresAt: token.expiresAt };
}

export async function verifyStepUpOtp(userId: string, code: string) {
  const now = new Date();

  const token = await prisma.otpToken.findFirst({
    where: { 
      userId, 
      purpose: "STEP_UP", 
      usedAt: null, 
      expiresAt: { gt: now } 
    },
    orderBy: { createdAt: "desc" },
  });

  if (!token) {
    return { ok: false as const, reason: "NO_ACTIVE_OTP" as const };
  }

  if (token.attempts >= MAX_ATTEMPTS) {
    await prisma.otpToken.update({ 
      where: { id: token.id }, 
      data: { usedAt: now } 
    });
    return { ok: false as const, reason: "TOO_MANY_ATTEMPTS" as const };
  }

  const isValid = await scryptVerify(`${code}:${OTP_PEPPER}`, token.otpHash);

  if (!isValid) {
    await prisma.otpToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false as const, reason: "INVALID_OTP" as const };
  }

  await prisma.otpToken.update({ 
    where: { id: token.id }, 
    data: { usedAt: now } 
  });

  return { ok: true as const };
}