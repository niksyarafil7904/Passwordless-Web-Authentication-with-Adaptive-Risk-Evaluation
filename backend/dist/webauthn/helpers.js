"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBase64url = exports.toUint8Array = void 0;
exports.asBuffer = asBuffer;
exports.pickFirst = pickFirst;
exports.toPrismaBytes = toPrismaBytes;
// src/webauthn/helpers.ts
const toUint8Array = (value) => new TextEncoder().encode(value);
exports.toUint8Array = toUint8Array;
const toBase64url = (buf) => buf.toString("base64url");
exports.toBase64url = toBase64url;
/**
 * Ensures input is converted to a Node.js Buffer safely.
 */
function asBuffer(value, label) {
    if (value === undefined || value === null) {
        throw new Error(`${label} is missing`);
    }
    if (Buffer.isBuffer(value))
        return value;
    if (value instanceof Uint8Array)
        return Buffer.from(value);
    if (value instanceof ArrayBuffer)
        return Buffer.from(new Uint8Array(value));
    if (typeof value === "string")
        return Buffer.from(value, "base64url");
    if (value?.buffer instanceof ArrayBuffer) {
        return Buffer.from(new Uint8Array(value.buffer));
    }
    throw new Error(`${label} has unsupported type: ${typeof value}`);
}
function pickFirst(...values) {
    for (const v of values)
        if (v !== undefined && v !== null)
            return v;
    return undefined;
}
/**
 * Convert Buffer -> Uint8Array backed by a guaranteed ArrayBuffer (not SharedArrayBuffer)
 */
function toPrismaBytes(buf) {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    view.set(buf);
    return view;
}
//# sourceMappingURL=helpers.js.map