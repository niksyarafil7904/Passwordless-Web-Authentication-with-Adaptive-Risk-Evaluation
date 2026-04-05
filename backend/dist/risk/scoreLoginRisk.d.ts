export type RiskResult = {
    riskScore: number;
    riskLevel: "low" | "high";
    reasons: string[];
};
/**
 * Step 7 risk scoring:
 * +40 new deviceKey
 * +20 new IP
 * +10 unusual login time (needs at least 5 successful attempts)
 * +25 new country (GeoLite2)
 * +10 new region/state within same country (GeoLite2)
 */
export declare function scoreLoginRisk(params: {
    userId: string;
    ip: string | null;
    deviceKey: string | null;
    now?: Date;
}): Promise<RiskResult>;
//# sourceMappingURL=scoreLoginRisk.d.ts.map