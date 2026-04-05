export declare const toUint8Array: (value: string) => Uint8Array<ArrayBuffer>;
export declare const toBase64url: (buf: Buffer) => string;
/**
 * Ensures input is converted to a Node.js Buffer safely.
 */
export declare function asBuffer(value: any, label: string): Buffer;
export declare function pickFirst<T>(...values: T[]): T | undefined;
/**
 * Convert Buffer -> Uint8Array backed by a guaranteed ArrayBuffer (not SharedArrayBuffer)
 */
export declare function toPrismaBytes(buf: Buffer): Uint8Array<ArrayBuffer>;
//# sourceMappingURL=helpers.d.ts.map