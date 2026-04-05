"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.geoFromIp = geoFromIp;
const maxmind_1 = __importDefault(require("maxmind"));
const path_1 = __importDefault(require("path"));
let reader = null;
async function getReader() {
    if (reader)
        return reader;
    const dbPath = process.env.MAXMIND_DB_PATH;
    if (!dbPath)
        throw new Error("MAXMIND_DB_PATH missing in .env");
    const absPath = path_1.default.isAbsolute(dbPath) ? dbPath : path_1.default.resolve(process.cwd(), dbPath);
    reader = await maxmind_1.default.open(absPath);
    console.log("MaxMind GeoLite2 DB loaded:", absPath);
    return reader;
}
async function geoFromIp(ip) {
    if (!ip)
        return { countryCode: null, region: null, city: null, label: null };
    const r = await getReader();
    const data = r.get(ip);
    const countryCode = data?.country?.iso_code ?? null;
    const region = data?.subdivisions?.[0]?.names?.en ?? null;
    const city = data?.city?.names?.en ?? null;
    const label = countryCode && region ? `${countryCode}-${region}` :
        countryCode ? countryCode :
            null;
    return { countryCode, region, city, label };
}
//# sourceMappingURL=maxmind.js.map