"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.otpRouter = void 0;
// backend/src/routes/otp.ts
const express_1 = require("express");
const otp_service_1 = require("../security/otp.service");
const email_service_1 = require("../security/email.service");
const prisma_1 = require("../lib/prisma");
exports.otpRouter = (0, express_1.Router)();
exports.otpRouter.post("/verify", async (req, res) => {
    try {
        // Accept 'code' from frontend
        const code = String(req.body?.code ?? req.body?.otp ?? "").trim();
        const stepUp = req.session.stepUp;
        console.log("OTP Verify - Session:", {
            hasStepUp: !!stepUp,
            userId: stepUp?.userId,
            loginAttemptId: stepUp?.loginAttemptId
        });
        console.log("OTP Verify - Code length:", code.length);
        if (!stepUp?.userId || !stepUp?.loginAttemptId) {
            return res.status(400).json({
                ok: false,
                message: "No pending step-up session. Please login again."
            });
        }
        if (!/^\d{6}$/.test(code)) {
            return res.status(400).json({
                ok: false,
                message: "Invalid OTP format. Please enter a 6-digit code."
            });
        }
        const result = await (0, otp_service_1.verifyStepUpOtp)(stepUp.userId, code);
        if (!result.ok) {
            let message = "";
            switch (result.reason) {
                case "NO_ACTIVE_OTP":
                    message = "No active OTP found. Please request a new code.";
                    break;
                case "TOO_MANY_ATTEMPTS":
                    message = "Too many failed attempts. Please request a new code.";
                    break;
                case "INVALID_OTP":
                    message = "Invalid OTP code. Please try again.";
                    break;
                default:
                    message = "OTP verification failed.";
            }
            return res.status(401).json({ ok: false, message, reason: result.reason });
        }
        // Set user as logged in
        req.session.userId = stepUp.userId;
        // Update login attempt to mark step-up as used
        await prisma_1.prisma.loginAttempt.update({
            where: { id: stepUp.loginAttemptId },
            data: { stepUpUsed: true },
        });
        // Clear OTP session
        delete req.session.stepUp;
        console.log("OTP verified successfully for user:", stepUp.userId);
        return res.json({ ok: true, message: "OTP verified successfully" });
    }
    catch (error) {
        console.error("OTP verification error:", error);
        return res.status(500).json({
            ok: false,
            message: "Internal server error. Please try again."
        });
    }
});
exports.otpRouter.post("/resend", async (req, res) => {
    try {
        const stepUp = req.session.stepUp;
        if (!stepUp?.userId) {
            return res.status(400).json({
                ok: false,
                message: "No pending step-up session"
            });
        }
        const now = Date.now();
        const createdAtMs = stepUp.createdAt;
        // Check if session expired (5 minutes)
        if (now - createdAtMs > 5 * 60 * 1000) {
            delete req.session.stepUp;
            return res.status(400).json({
                ok: false,
                message: "Step-up session expired. Please login again."
            });
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: stepUp.userId },
            select: { email: true, username: true },
        });
        if (!user) {
            delete req.session.stepUp;
            return res.status(404).json({
                ok: false,
                message: "User not found"
            });
        }
        const { otp, expiresAt } = await (0, otp_service_1.issueStepUpOtp)(stepUp.userId);
        await (0, email_service_1.sendStepUpOtpEmail)({
            to: user.email,
            username: user.username,
            otp,
            expiresAt,
        });
        console.log("OTP resent to:", user.email);
        return res.json({
            ok: true,
            message: "OTP resent successfully. Please check your email."
        });
    }
    catch (error) {
        console.error("Resend OTP error:", error);
        return res.status(500).json({
            ok: false,
            message: "Failed to resend OTP. Please try again."
        });
    }
});
//# sourceMappingURL=otp.js.map