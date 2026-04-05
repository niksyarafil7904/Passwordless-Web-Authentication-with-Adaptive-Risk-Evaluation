type LogLoginAttemptInput = {
    success: boolean;
    userId?: string;
    username?: string;
    credentialId?: string;
    deviceKey?: string;
    ip?: string | null;
    location?: string | null;
    userAgent?: string | null;
    riskScore?: number;
    riskLevel?: string;
    stepUpUsed?: boolean;
};
export declare function logLoginAttempt(input: LogLoginAttemptInput): Promise<void>;
export {};
//# sourceMappingURL=loginAttempt.d.ts.map