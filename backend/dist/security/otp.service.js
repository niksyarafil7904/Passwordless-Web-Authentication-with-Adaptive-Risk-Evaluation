"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueStepUpOtp = issueStepUpOtp;
exports.verifyStepUpOtp = verifyStepUpOtp;
// backend/src/security/otp.service.ts
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const OTP_PEPPER = process.env.OTP_PEPPER ?? "dev-only-change-me";
function randomOtp() {
    const n = crypto_1.default.randomInt(0, 1000000);
    return n.toString().padStart(6, "0");
}
async function scryptHash(input) {
    const salt = crypto_1.default.randomBytes(16);
    return new Promise((resolve, reject) => {
        crypto_1.default.scrypt(input, salt, 64, (err, key) => {
            if (err)
                return reject(err);
            resolve(`${salt.toString("hex")}.${Buffer.from(key).toString("hex")}`);
        });
    });
}
async function scryptVerify(input, stored) {
    const [saltHex, hashHex] = stored.split(".");
    if (!saltHex || !hashHex)
        return Promise.resolve(false);
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    return new Promise((resolve) => {
        crypto_1.default.scrypt(input, salt, expected.length, (err, key) => {
            if (err)
                return resolve(false);
            const actual = Buffer.from(key);
            if (actual.length !== expected.length)
                return resolve(false);
            resolve(crypto_1.default.timingSafeEqual(actual, expected));
        });
    });
}
async function issueStepUpOtp(userId) {
    const otp = randomOtp();
    const otpHash = await scryptHash(`${otp}:${OTP_PEPPER}`);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    // Invalidate any existing unused OTPs for this user
    await prisma_1.prisma.otpToken.updateMany({
        where: {
            userId,
            purpose: "STEP_UP",
            usedAt: null,
            expiresAt: { gt: new Date() }
        },
        data: { usedAt: new Date() },
    });
    const token = await prisma_1.prisma.otpToken.create({
        data: {
            userId,
            otpHash,
            purpose: "STEP_UP",
            expiresAt
        },
    });
    return { otp, otpId: token.id, expiresAt: token.expiresAt };
}
async function verifyStepUpOtp(userId, code) {
    const now = new Date();
    const token = await prisma_1.prisma.otpToken.findFirst({
        where: {
            userId,
            purpose: "STEP_UP",
            usedAt: null,
            expiresAt: { gt: now }
        },
        orderBy: { createdAt: "desc" },
    });
    if (!token) {
        return { ok: false, reason: "NO_ACTIVE_OTP" };
    }
    if (token.attempts >= MAX_ATTEMPTS) {
        await prisma_1.prisma.otpToken.update({
            where: { id: token.id },
            data: { usedAt: now }
        });
        return { ok: false, reason: "TOO_MANY_ATTEMPTS" };
    }
    const isValid = await scryptVerify(`${code}:${OTP_PEPPER}`, token.otpHash);
    if (!isValid) {
        await prisma_1.prisma.otpToken.update({
            where: { id: token.id },
            data: { attempts: { increment: 1 } },
        });
        return { ok: false, reason: "INVALID_OTP" };
    }
    await prisma_1.prisma.otpToken.update({
        where: { id: token.id },
        data: { usedAt: now }
    });
    return { ok: true };
}
//# sourceMappingURL=otp.service.js.map