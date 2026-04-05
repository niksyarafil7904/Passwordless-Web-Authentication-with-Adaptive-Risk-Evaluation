export type GeoResult = {
    countryCode: string | null;
    region: string | null;
    city: string | null;
    label: string | null;
};
export declare function geoFromIp(ip: string | null): Promise<GeoResult>;
//# sourceMappingURL=maxmind.d.ts.map