// src/webauthn/helpers.ts
export const toUint8Array = (value: string) => new TextEncoder().encode(value);

export const toBase64url = (buf: Buffer) => buf.toString("base64url");

/**
 * Ensures input is converted to a Node.js Buffer safely.
 */
export function asBuffer(value: any, label: string): Buffer {
  if (value === undefined || value === null) {
    throw new Error(`${label} is missing`);
  }
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  if (typeof value === "string") return Buffer.from(value, "base64url");
  if (value?.buffer instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(value.buffer));
  }
  throw new Error(`${label} has unsupported type: ${typeof value}`);
}

export function pickFirst<T>(...values: T[]): T | undefined {
  for (const v of values) if (v !== undefined && v !== null) return v;
  return undefined;
}

/**
 * Convert Buffer -> Uint8Array backed by a guaranteed ArrayBuffer (not SharedArrayBuffer)
 */
export function toPrismaBytes(buf: Buffer): Uint8Array<ArrayBuffer> {
  const ab = new ArrayBuffer(buf.length);
  const view: Uint8Array<ArrayBuffer> = new Uint8Array(ab);
  view.set(buf);
  return view;
}
