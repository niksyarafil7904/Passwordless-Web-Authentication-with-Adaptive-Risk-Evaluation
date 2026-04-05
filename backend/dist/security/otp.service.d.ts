export declare function issueStepUpOtp(userId: string): Promise<{
    otp: string;
    otpId: string;
    expiresAt: Date;
}>;
export declare function verifyStepUpOtp(userId: string, code: string): Promise<{
    ok: false;
    reason: "NO_ACTIVE_OTP";
} | {
    ok: false;
    reason: "TOO_MANY_ATTEMPTS";
} | {
    ok: false;
    reason: "INVALID_OTP";
} | {
    ok: true;
    reason?: never;
}>;
//# sourceMappingURL=otp.service.d.ts.map