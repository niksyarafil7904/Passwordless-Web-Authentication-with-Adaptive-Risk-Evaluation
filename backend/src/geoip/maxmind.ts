import maxmind, { Reader } from "maxmind";
import path from "path";

export type GeoResult = {
  countryCode: string | null;
  region: string | null; // state/subdivision
  city: string | null;
  label: string | null;  // "MY-Selangor" or "US-California" or "MY"
};

let reader: Reader<any> | null = null;

async function getReader() {
  if (reader) return reader;

  const dbPath = process.env.MAXMIND_DB_PATH;
  if (!dbPath) throw new Error("MAXMIND_DB_PATH missing in .env");

  const absPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
  reader = await maxmind.open(absPath);

  console.log("MaxMind GeoLite2 DB loaded:", absPath);
  return reader;
}

export async function geoFromIp(ip: string | null): Promise<GeoResult> {
  if (!ip) return { countryCode: null, region: null, city: null, label: null };

  const r = await getReader();
  const data = r.get(ip);

  const countryCode = data?.country?.iso_code ?? null;
  const region = data?.subdivisions?.[0]?.names?.en ?? null;
  const city = data?.city?.names?.en ?? null;

  const label =
    countryCode && region ? `${countryCode}-${region}` :
    countryCode ? countryCode :
    null;

  return { countryCode, region, city, label };
}