"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webauthnRouter = void 0;
// src/routes/webauthn.ts
const express_1 = require("express");
const server_1 = require("@simplewebauthn/server");
const prisma_1 = require("../lib/prisma");
const config_1 = require("../webauthn/config");
const maxmind_1 = require("../geoip/maxmind");
const helpers_1 = require("../webauthn/helpers");
const otp_service_1 = require("../security/otp.service");
const email_service_1 = require("../security/email.service");
const scoreLoginRisk_1 = require("../risk/scoreLoginRisk");
const loginAttempt_1 = require("../audit/loginAttempt");
exports.webauthnRouter = (0, express_1.Router)();
const { rpID, rpName, expectedOrigin } = config_1.webauthnConfig;
// Helper function to parse User Agent for device info
function parseUserAgent(ua) {
    if (!ua)
        return { os: "Unknown", browser: "Unknown", deviceName: "Unknown Device" };
    let os = "Unknown";
    let browser = "Unknown";
    // Detect OS
    if (ua.includes("Windows NT 10.0"))
        os = "Windows 10";
    else if (ua.includes("Windows NT 11.0"))
        os = "Windows 11";
    else if (ua.includes("Windows"))
        os = "Windows";
    else if (ua.includes("Mac OS X"))
        os = "macOS";
    else if (ua.includes("iPhone"))
        os = "iOS";
    else if (ua.includes("iPad"))
        os = "iPadOS";
    else if (ua.includes("Android"))
        os = "Android";
    else if (ua.includes("Linux"))
        os = "Linux";
    // Detect Browser
    if (ua.includes("Chrome") && !ua.includes("Edg"))
        browser = "Chrome";
    else if (ua.includes("Firefox"))
        browser = "Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome"))
        browser = "Safari";
    else if (ua.includes("Edg"))
        browser = "Edge";
    else if (ua.includes("Opera"))
        browser = "Opera";
    const deviceName = `${os} - ${browser}`;
    return { os, browser, deviceName };
}
// Prefer Cloudflare header when present, then fall back to Express' req.ip.
function getClientIp(req) {
    const cf = req.headers["cf-connecting-ip"];
    if (typeof cf === "string" && cf.length > 0)
        return cf;
    const xffRaw = req.headers["x-forwarded-for"];
    const xff = typeof xffRaw === "string"
        ? xffRaw
        : Array.isArray(xffRaw)
            ? xffRaw[0]
            : undefined;
    if (xff && xff.length > 0) {
        return xff.split(",")[0].trim();
    }
    return req.ip ?? null;
}
function getUserAgent(req) {
    return req.get("user-agent") ?? null;
}
// 1) Generate Registration Options
exports.webauthnRouter.post("/register/options", async (req, res) => {
    const { username, email } = req.body;
    if (!username || !email) {
        return res.status(400).json({ ok: false, message: "username and email required" });
    }
    const user = await prisma_1.prisma.user.upsert({
        where: { username },
        update: { email },
        create: { username, email },
    });
    const existingCreds = await prisma_1.prisma.webAuthnCredential.findMany({
        where: { userId: user.id },
        select: { credentialId: true },
    });
    const options = await (0, server_1.generateRegistrationOptions)({
        rpName,
        rpID,
        userID: (0, helpers_1.toUint8Array)(user.id),
        userName: user.username,
        attestationType: "none",
        excludeCredentials: existingCreds.map((c) => ({
            id: Buffer.from(c.credentialId).toString("base64url"),
            type: "public-key",
        })),
        authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
        },
    });
    req.session.webauthnRegChallenge = options.challenge;
    req.session.pendingUserId = String(user.id); // Convert to string
    console.log("OPTIONS sessionID:", req.sessionID);
    console.log("OPTIONS challenge:", req.session.webauthnRegChallenge);
    return res.json({ ok: true, options });
});
// 2) Verify Registration & Store Credential
exports.webauthnRouter.post("/register/verify", async (req, res) => {
    try {
        const body = req.body;
        const expectedChallenge = req.session.webauthnRegChallenge;
        const pendingUserId = req.session.pendingUserId;
        console.log("VERIFY sessionID:", req.sessionID);
        console.log("VERIFY expectedChallenge:", expectedChallenge);
        console.log("VERIFY body.id:", body?.id);
        if (!expectedChallenge || !pendingUserId) {
            return res.status(400).json({
                ok: false,
                message: "Session expired or missing challenge",
                debug: { hasChallenge: !!expectedChallenge, hasPendingUserId: !!pendingUserId },
            });
        }
        const verification = await (0, server_1.verifyRegistrationResponse)({
            response: body,
            expectedChallenge,
            expectedOrigin,
            expectedRPID: rpID,
            requireUserVerification: true,
        });
        console.log("VERIFY verified:", verification.verified);
        if (!verification.verified || !verification.registrationInfo) {
            return res.status(400).json({
                ok: false,
                message: "Registration not verified",
                debug: {
                    verified: verification.verified,
                    hasRegistrationInfo: !!verification.registrationInfo,
                },
            });
        }
        const reg = verification.registrationInfo;
        const credentialIdRaw = (0, helpers_1.pickFirst)(reg.credentialID, reg.credentialId, reg.id, reg.credential?.id, reg.credential?.credentialID, reg.credential?.credentialId);
        const publicKeyRaw = (0, helpers_1.pickFirst)(reg.credentialPublicKey, reg.publicKey, reg.credential?.publicKey, reg.credential?.credentialPublicKey);
        const counter = (0, helpers_1.pickFirst)(reg.counter, reg.credential?.counter, 0) ?? 0;
        if (!credentialIdRaw || !publicKeyRaw) {
            return res.status(400).json({
                ok: false,
                message: "registrationInfo missing credential fields",
                debug: {
                    registrationInfoKeys: Object.keys(reg ?? {}),
                    credentialKeys: reg?.credential ? Object.keys(reg.credential) : null,
                },
            });
        }
        const credentialIdBuf = (0, helpers_1.asBuffer)(credentialIdRaw, "credentialID");
        const publicKeyBuf = (0, helpers_1.asBuffer)(publicKeyRaw, "credentialPublicKey");
        const existing = await prisma_1.prisma.webAuthnCredential.findFirst({
            where: { credentialId: (0, helpers_1.toPrismaBytes)(credentialIdBuf) },
            select: { id: true, userId: true },
        });
        if (existing) {
            delete req.session.webauthnRegChallenge;
            delete req.session.pendingUserId;
            return res.status(409).json({
                ok: false,
                message: "Credential already registered",
                debug: { credentialOwnerUserId: existing.userId },
            });
        }
        const transports = body?.response?.transports ??
            body?.clientExtensionResults?.transports ??
            null;
        // Parse user agent for device info
        const userAgent = getUserAgent(req);
        const deviceInfo = parseUserAgent(userAgent);
        await prisma_1.prisma.webAuthnCredential.create({
            data: {
                userId: pendingUserId,
                credentialId: (0, helpers_1.toPrismaBytes)(credentialIdBuf),
                publicKey: (0, helpers_1.toPrismaBytes)(publicKeyBuf),
                counter,
                ...(transports ? { transports: transports } : {}),
                deviceName: deviceInfo.deviceName,
                deviceOS: deviceInfo.os,
                deviceBrowser: deviceInfo.browser,
            },
        });
        delete req.session.webauthnRegChallenge;
        delete req.session.pendingUserId;
        req.session.userId = pendingUserId; // Already a string
        // Store the credential ID for this session
        const newCredential = await prisma_1.prisma.webAuthnCredential.findFirst({
            where: { credentialId: (0, helpers_1.toPrismaBytes)(credentialIdBuf) },
            select: { id: true },
        });
        if (newCredential) {
            req.session.currentCredentialId = String(newCredential.id);
        }
        return res.json({
            ok: true,
            verified: true,
            redirectTo: "/dashboard"
        });
    }
    catch (err) {
        console.error("Registration Verify Error FULL:", err);
        return res.status(400).json({
            ok: false,
            message: err?.message ?? "Verification error",
            name: err?.name,
            cause: err?.cause,
        });
    }
});
// 3) Login Options (Assertion Challenge)
exports.webauthnRouter.post("/login/options", async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ ok: false, message: "username required" });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { username },
        select: { id: true, username: true },
    });
    if (!user) {
        await (0, loginAttempt_1.logLoginAttempt)({
            success: false,
            username,
            ip: getClientIp(req),
            userAgent: getUserAgent(req),
            riskScore: 0,
            riskLevel: "unknown",
        });
        return res.status(404).json({ ok: false, message: "User not found" });
    }
    const creds = await prisma_1.prisma.webAuthnCredential.findMany({
        where: { userId: user.id },
        select: { credentialId: true, transports: true },
    });
    if (creds.length === 0) {
        await (0, loginAttempt_1.logLoginAttempt)({
            success: false,
            userId: user.id,
            username: user.username,
            ip: getClientIp(req),
            userAgent: getUserAgent(req),
            riskScore: 0,
            riskLevel: "unknown",
        });
        return res.status(400).json({
            ok: false,
            message: "No passkeys registered for this user",
        });
    }
    const options = await (0, server_1.generateAuthenticationOptions)({
        rpID,
        userVerification: "required",
        allowCredentials: creds.map((c) => ({
            id: Buffer.from(c.credentialId).toString("base64url"),
            transports: (c.transports ?? []),
        })),
    });
    req.session.webauthnAuthChallenge = options.challenge;
    req.session.pendingUserId = String(user.id); // Convert to string
    req.session.pendingUsername = user.username;
    console.log("LOGIN OPTIONS sessionID:", req.sessionID);
    console.log("LOGIN OPTIONS challenge:", req.session.webauthnAuthChallenge);
    return res.json({ ok: true, options });
});
// 4) Login Verify (Assertion Verify)
exports.webauthnRouter.post("/login/verify", async (req, res) => {
    try {
        const body = req.body;
        const expectedChallenge = req.session.webauthnAuthChallenge;
        const pendingUserId = req.session.pendingUserId;
        console.log("LOGIN VERIFY sessionID:", req.sessionID);
        console.log("LOGIN VERIFY expectedChallenge:", expectedChallenge);
        console.log("LOGIN VERIFY body.id:", body?.id);
        if (!expectedChallenge || !pendingUserId) {
            // Only log if we have userId
            if (pendingUserId) {
                await (0, loginAttempt_1.logLoginAttempt)({
                    success: false,
                    userId: pendingUserId,
                    ip: getClientIp(req),
                    userAgent: getUserAgent(req),
                    riskScore: 0,
                    riskLevel: "unknown",
                });
            }
            return res.status(400).json({
                ok: false,
                message: "Session expired or missing auth challenge",
                debug: {
                    hasChallenge: !!expectedChallenge,
                    hasPendingUserId: !!pendingUserId,
                },
            });
        }
        const credentialIdB64 = body?.id;
        if (!credentialIdB64) {
            if (pendingUserId) {
                await (0, loginAttempt_1.logLoginAttempt)({
                    success: false,
                    userId: pendingUserId,
                    ip: getClientIp(req),
                    userAgent: getUserAgent(req),
                    riskScore: 0,
                    riskLevel: "unknown",
                    ...(req.session.pendingUsername ? { username: req.session.pendingUsername } : {}),
                });
            }
            return res.status(400).json({ ok: false, message: "Missing credential id in assertion" });
        }
        const creds = await prisma_1.prisma.webAuthnCredential.findMany({
            where: { userId: pendingUserId },
            select: {
                id: true,
                userId: true,
                credentialId: true,
                publicKey: true,
                counter: true,
                transports: true,
            },
        });
        const matched = creds.find((c) => Buffer.from(c.credentialId).toString("base64url") === credentialIdB64);
        if (!matched) {
            await (0, loginAttempt_1.logLoginAttempt)({
                success: false,
                userId: pendingUserId,
                credentialId: credentialIdB64,
                deviceKey: credentialIdB64,
                ip: getClientIp(req),
                userAgent: getUserAgent(req),
                riskScore: 0,
                riskLevel: "unknown",
                ...(req.session.pendingUsername ? { username: req.session.pendingUsername } : {}),
            });
            return res.status(404).json({ ok: false, message: "Credential not found for this user" });
        }
        const verification = await (0, server_1.verifyAuthenticationResponse)({
            response: body,
            expectedChallenge,
            expectedOrigin,
            expectedRPID: rpID,
            requireUserVerification: true,
            credential: {
                id: credentialIdB64,
                publicKey: Buffer.from(matched.publicKey),
                counter: matched.counter,
                transports: (matched.transports ?? []),
            },
        });
        console.log("LOGIN VERIFY verified:", verification.verified);
        if (!verification.verified) {
            await (0, loginAttempt_1.logLoginAttempt)({
                success: false,
                userId: pendingUserId,
                credentialId: credentialIdB64,
                deviceKey: credentialIdB64,
                ip: getClientIp(req),
                userAgent: getUserAgent(req),
                riskScore: 0,
                riskLevel: "unknown",
                ...(req.session.pendingUsername ? { username: req.session.pendingUsername } : {}),
            });
            return res.status(400).json({ ok: false, verified: false });
        }
        const info = verification.authenticationInfo;
        const newCounter = ((0, helpers_1.pickFirst)(info?.newCounter, info?.counter, matched.counter) ?? matched.counter);
        await prisma_1.prisma.webAuthnCredential.update({
            where: { id: matched.id },
            data: {
                counter: newCounter,
                lastUsedAt: new Date(),
            },
        });
        const deviceKey = credentialIdB64;
        const ip = getClientIp(req);
        // Add timeout for geo lookup
        console.log("Getting geo location...");
        let geo = { label: "Unknown Location" };
        try {
            const geoResult = await (0, maxmind_1.geoFromIp)(ip);
            geo = { label: geoResult?.label || "Unknown Location" };
            console.log("Geo complete:", geo.label);
        }
        catch (geoError) {
            console.error("GeoIP error:", geoError);
            // Continue with default geo (Unknown Location)
        }
        // Add timeout for risk scoring
        console.log("Scoring login risk...");
        let risk = {
            riskScore: 0,
            riskLevel: 'low',
            reasons: [],
        };
        try {
            const riskPromise = (0, scoreLoginRisk_1.scoreLoginRisk)({
                userId: matched.userId,
                ip,
                deviceKey,
            });
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Risk scoring timeout')), 8000);
            });
            risk = await Promise.race([riskPromise, timeoutPromise]);
            console.log("Risk score complete:", risk.riskLevel);
        }
        catch (riskError) {
            console.error("Risk scoring error or timeout:", riskError);
            // risk already has default low risk
        }
        console.log("Creating login attempt...");
        const loginAttempt = await prisma_1.prisma.loginAttempt.create({
            data: {
                success: true,
                userId: matched.userId,
                username: req.session.pendingUsername ?? null,
                riskScore: risk.riskScore,
                riskLevel: risk.riskLevel,
                stepUpUsed: false,
                ip,
                location: geo.label,
                userAgent: getUserAgent(req),
                deviceKey,
                riskReasons: JSON.stringify(risk.reasons),
            },
            select: { id: true },
        });
        // Clear transient WebAuthn session state
        delete req.session.webauthnAuthChallenge;
        delete req.session.pendingUserId;
        delete req.session.pendingUsername;
        // Store the credential ID for this session (for dashboard device tracking)
        req.session.currentCredentialId = String(matched.id);
        // HIGH risk: require step-up OTP
        if (risk.riskLevel === "high") {
            console.log("High risk detected, requiring OTP...");
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: matched.userId },
                select: { email: true, username: true },
            });
            if (!user?.email) {
                return res.status(400).json({ ok: false, message: "User email not found for OTP delivery" });
            }
            const { otp, expiresAt } = await (0, otp_service_1.issueStepUpOtp)(matched.userId);
            await (0, email_service_1.sendStepUpOtpEmail)({
                to: user.email,
                username: user.username,
                otp,
                expiresAt,
                riskReasons: risk.reasons,
            });
            req.session.stepUp = {
                userId: String(matched.userId),
                loginAttemptId: String(loginAttempt.id),
                createdAt: Date.now(),
            };
            return res.json({
                ok: false,
                verified: true,
                requiresOtp: true,
                riskScore: risk.riskScore,
                riskLevel: risk.riskLevel,
                reasons: risk.reasons,
            });
        }
        // LOW risk: login immediately
        console.log("Low risk login, setting session...");
        req.session.userId = String(matched.userId);
        console.log("Login successful!");
        return res.json({
            ok: true,
            verified: true,
            riskScore: risk.riskScore,
            riskLevel: risk.riskLevel,
            reasons: risk.reasons,
        });
    }
    catch (err) {
        console.error("Login Verify Error FULL:", err);
        // Try to get userId from session
        const userId = req.session.pendingUserId || req.session.userId;
        if (userId) {
            await (0, loginAttempt_1.logLoginAttempt)({
                success: false,
                userId: userId,
                ip: getClientIp(req),
                userAgent: getUserAgent(req),
                riskScore: 0,
                riskLevel: "unknown",
            });
        }
        return res.status(400).json({
            ok: false,
            message: err?.message ?? "Verification error",
            name: err?.name,
            cause: err?.cause,
        });
    }
});
//# sourceMappingURL=webauthn.js.map