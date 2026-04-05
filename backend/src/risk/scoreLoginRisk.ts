import { prisma } from "../lib/prisma";
import { geoFromIp } from "../geoip/maxmind";

export type RiskResult = {
  riskScore: number;
  riskLevel: "low" | "high";
  reasons: string[];
};

function hourDiff(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 24 - d);
}

function modeHour(hours: number[]) {
  const freq = new Map<number, number>();
  for (const h of hours) freq.set(h, (freq.get(h) ?? 0) + 1);

  let bestHour = hours[0] ?? 0;
  let bestCount = -1;

  for (const [h, count] of freq.entries()) {
    if (count > bestCount) {
      bestHour = h;
      bestCount = count;
    }
  }
  return bestHour;
}

function parseLocationLabel(label: string | null | undefined) {
  if (!label) return { country: null as string | null, region: null as string | null };

  // label examples:
  // "MY-Selangor"
  // "US-California"
  // "MY"
  const [country, ...rest] = label.split("-");
  const region = rest.length > 0 ? rest.join("-") : null;

  return {
    country: country || null,
    region,
  };
}

/**
 * Step 7 risk scoring:
 * +40 new deviceKey
 * +20 new IP
 * +10 unusual login time (needs at least 5 successful attempts)
 * +25 new country (GeoLite2)
 * +10 new region/state within same country (GeoLite2)
 */
export async function scoreLoginRisk(params: {
  userId: string;
  ip: string | null;
  deviceKey: string | null;
  now?: Date;
}): Promise<RiskResult> {
  const now = params.now ?? new Date();

  // Pull recent successful attempts (baseline)
  const recentSuccess = await prisma.loginAttempt.findMany({
    where: { userId: params.userId, success: true },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { ip: true, deviceKey: true, createdAt: true, location: true },
  });

  const reasons: string[] = [];
  let score = 0;

  // New device?
  if (params.deviceKey) {
    const seenDevice = recentSuccess.some((a) => a.deviceKey === params.deviceKey);
    if (!seenDevice) {
      score += 40;
      reasons.push("new_device");
    }
  }

  // New IP?
  if (params.ip) {
    const seenIp = recentSuccess.some((a) => a.ip === params.ip);
    if (!seenIp) {
      score += 20;
      reasons.push("new_ip");
    }
  }

  // Location (country/region) based on MaxMind GeoLite2
  // We only score this if we can resolve current geo AND we have at least one successful baseline location.
  const currentGeo = await geoFromIp(params.ip);
  const currentParsed = parseLocationLabel(currentGeo.label);

  const lastSuccessWithLocation = recentSuccess.find((a) => !!a.location);
  if (currentParsed.country && lastSuccessWithLocation?.location) {
    const prevParsed = parseLocationLabel(lastSuccessWithLocation.location);

    if (prevParsed.country && prevParsed.country !== currentParsed.country) {
      score += 45;
      reasons.push("new_country");
    } else if (
      prevParsed.country &&
      prevParsed.country === currentParsed.country &&
      prevParsed.region &&
      currentParsed.region &&
      prevParsed.region !== currentParsed.region
    ) {
      score += 10;
      reasons.push("new_region");
    }
  } else {
    // optional: only add this if you want visibility in your JSON
    reasons.push("insufficient_history_for_location_check");
  }

  // Unusual hour? (only if we have enough baseline)
  if (recentSuccess.length >= 5) {
    const hours = recentSuccess.map((a) => a.createdAt.getHours());
    const typical = modeHour(hours);
    const currentHour = now.getHours();
    const diff = hourDiff(typical, currentHour);

    if (diff > 2) {
      score += 10;
      reasons.push("unusual_time");
    }
  } else {
    reasons.push("insufficient_history_for_time_check");
  }

  const riskLevel: "low" | "high" = score >= 60 ? "high" : "low";
  return { riskScore: score, riskLevel, reasons };
}