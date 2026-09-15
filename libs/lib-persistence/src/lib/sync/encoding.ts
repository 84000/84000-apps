/**
 * Base64 for Yjs update payloads.
 *
 * Needed because `realtime.send` accepts jsonb only — `realtime.messages` has a
 * `binary_payload bytea` column, but no SQL-callable path reaches it. So the
 * wire format is base64 even though the durable column is `bytea`. The ~33%
 * inflation applies to relayed bytes, not stored ones.
 *
 * Hand-rolled rather than `Buffer` or `atob`: this package runs in a browser
 * main thread, a dedicated worker, a SharedWorker and a Node agent process, and
 * `Buffer` is absent in the first three while `atob` is byte-oriented in a way
 * that needs the same manual widening anyway.
 */

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const LOOKUP = /* @__PURE__ */ (() => {
  const table = new Uint8Array(256).fill(255);
  for (let i = 0; i < ALPHABET.length; i += 1) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

export const toBase64 = (bytes: Uint8Array): string => {
  let out = '';
  let i = 0;

  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      ALPHABET[(n >> 18) & 63] +
      ALPHABET[(n >> 12) & 63] +
      ALPHABET[(n >> 6) & 63] +
      ALPHABET[n & 63];
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const n = bytes[i] << 16;
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63] + '==';
  } else if (remaining === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      ALPHABET[(n >> 18) & 63] +
      ALPHABET[(n >> 12) & 63] +
      ALPHABET[(n >> 6) & 63] +
      '=';
  }

  return out;
};

/**
 * Whitespace is skipped rather than rejected.
 *
 * Postgres `encode(…, 'base64')` emits MIME base64 — a newline every 76
 * characters. The RPCs strip those in SQL, but tolerating them here too means a
 * future caller that reaches a `bytea` through some other path gets a decode
 * instead of a crash. The failure this guards against is nasty precisely
 * because it is size-dependent: payloads under 57 bytes never wrap, so short
 * updates work and the first snapshot-sized one throws.
 */
export const fromBase64 = (text: string): Uint8Array => {
  let end = text.length;
  while (end > 0 && (text[end - 1] === '=' || text[end - 1] <= ' ')) end -= 1;

  const out = new Uint8Array((end * 3) >> 2);
  let outIndex = 0;
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < end; i += 1) {
    const code = text.charCodeAt(i);
    if (code === 10 || code === 13 || code === 32 || code === 9) continue;

    const value = LOOKUP[code];
    if (value === 255) {
      throw new Error(`Invalid base64 character at index ${i}`);
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIndex] = (buffer >> bits) & 255;
      outIndex += 1;
    }
  }

  return outIndex === out.length ? out : out.subarray(0, outIndex);
};

/**
 * Postgres renders `bytea` as `\x` + hex over PostgREST, so a row read back
 * through the REST API arrives hex-encoded rather than base64. The RPCs
 * deliberately `encode(..., 'base64')` to avoid this, but a direct table select
 * (which the tests use to inspect the log) still needs it.
 */
export const fromPostgresHex = (text: string): Uint8Array => {
  const body = text.startsWith('\\x') ? text.slice(2) : text;
  const out = new Uint8Array(body.length >> 1);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(body.substr(i * 2, 2), 16);
  }
  return out;
};
