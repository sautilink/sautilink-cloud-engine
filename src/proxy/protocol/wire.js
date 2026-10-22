import { Buffer } from "node:buffer";
import { createCipheriv, createHash, timingSafeEqual } from "node:crypto";

// https://core.telegram.org/mtproto/mtproto-transports#transport-obfuscation
// https://core.telegram.org/mtproto/auth_key
// https://github.com/tdlib/td/blob/master/td/mtproto/NoCryptoStorer.h

export class ProbeError extends Error {
  constructor(code, status = "unverified") {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export const fail = (code, status) => { throw new ProbeError(code, status); };
export const u16be = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
export const u32le = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
export const equal = (a, b) => a.length === b.length && timingSafeEqual(a, b);

/** Bounded socket reader: fragmented/coalesced input, capped memory and work. */
export class ByteReader {
  constructor(reader, checkDeadline, { maxBytes = 96 * 1024, maxReads = 1024 } = {}) {
    this.reader = reader;
    this.checkDeadline = checkDeadline;
    this.maxBytes = maxBytes;
    this.maxReads = maxReads;
    this.bytes = 0;
    this.reads = 0;
    this.pending = Buffer.alloc(0);
  }

  async readExactly(size) {
    if (!Number.isInteger(size) || size < 0 || size > 65536) fail("response_too_large");
    const parts = [];
    let left = size;
    while (left > 0) {
      this.checkDeadline();
      if (!this.pending.length) {
        if (++this.reads > this.maxReads) fail("response_too_fragmented");
        const { done, value } = await this.reader.read();
        this.checkDeadline();
        if (done) fail("connection_closed", "offline");
        if (!(value instanceof Uint8Array)) fail("invalid_socket_chunk");
        this.bytes += value.byteLength;
        if (this.bytes > this.maxBytes) fail("response_too_large");
        this.pending = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
        if (!this.pending.length) continue;
      }
      const take = Math.min(left, this.pending.length);
      parts.push(this.pending.subarray(0, take));
      this.pending = this.pending.subarray(take);
      left -= take;
    }
    return Buffer.concat(parts, size);
  }
}

export function makeObfuscatedSession(secret, transport, dcId, randomBytes) {
  let header;
  for (let attempt = 0; attempt < 32; attempt++) {
    header = Buffer.from(randomBytes(64));
    if (header.length !== 64) fail("random_source_invalid");
    const magic = header.readUInt32LE(0);
    if (header[0] !== 0xef && header.readUInt32LE(4) !== 0
      && ![0x44414548, 0x54534f50, 0x20544547, 0x4954504f, 0xdddddddd, 0xeeeeeeee, 0x02010316].includes(magic)) break;
    header = null;
  }
  if (!header) fail("random_source_invalid");
  const padded = transport !== "classic";
  header.writeUInt32LE(padded ? 0xdddddddd : 0xeeeeeeee, 56);
  header.writeInt16LE(dcId, 60);
  const reverse = Buffer.from(header).reverse();
  const key = secret.length === 16 ? secret : secret.subarray(1, 17);
  const derive = (bytes) => createHash("sha256").update(bytes).update(key).digest();
  const outgoing = createCipheriv("aes-256-ctr", derive(header.subarray(8, 40)), header.subarray(40, 56));
  const incoming = createCipheriv("aes-256-ctr", derive(reverse.subarray(8, 40)), reverse.subarray(40, 56));
  const encryptedHeader = outgoing.update(header); // Advance outgoing CTR by all 64 bytes.
  const wireHeader = Buffer.concat([header.subarray(0, 56), encryptedHeader.subarray(56)]);
  return { wireHeader, outgoing, incoming, padded };
}

export function makeReqPq(nonce, nowMs, padded, randomBytes) {
  if (nonce.length !== 16) fail("random_source_invalid");
  const body = Buffer.concat([u32le(0xbe7e8ef1), nonce, Buffer.from(randomBytes(12))]);
  if (body.length !== 32) fail("random_source_invalid");
  const payload = Buffer.alloc(20 + body.length);
  const seconds = BigInt(Math.floor(nowMs / 1000));
  const fraction = BigInt(Math.max(4, Math.floor((nowMs % 1000) * 4294967.296))) & ~3n;
  payload.writeBigUInt64LE((seconds << 32n) | fraction, 8);
  payload.writeUInt32LE(body.length, 16);
  body.copy(payload, 20);
  const padding = padded ? Buffer.from(randomBytes(Buffer.from(randomBytes(1))[0] & 15)) : Buffer.alloc(0);
  return Buffer.concat([u32le(payload.length + padding.length), payload, padding]);
}

/** Decryption is stateful across arbitrary socket/TLS record boundaries. */
export async function readMtprotoResponse(source, session, nonce) {
  const prefix = session.incoming.update(await source.readExactly(4));
  const length = prefix.readUInt32LE(0);
  if (length < 4 || length > 4096) fail("invalid_frame");
  const frame = session.incoming.update(await source.readExactly(length));
  if (frame.length <= 19 && frame.readInt32LE(0) < 0) fail("transport_rejected", "offline");
  if (frame.length < 20 || !frame.subarray(0, 8).equals(Buffer.alloc(8))) fail("invalid_auth_envelope");
  const messageId = frame.readBigUInt64LE(8);
  if (messageId === 0n || (messageId & 1n) !== 1n) fail("invalid_server_message_id");
  const bodyLength = frame.readUInt32LE(16);
  if (bodyLength < 56 || bodyLength > 1024 || bodyLength % 4 !== 0 || bodyLength + 20 > frame.length) {
    fail("invalid_body_length");
  }
  const outerPadding = frame.length - 20 - bodyLength;
  // Unencrypted MTProto messages can carry random bytes beyond their declared
  // body length (Telegram iOS), independently of padded transport framing.
  // Classic intermediate frames still have to contain whole words.
  if (!session.padded && outerPadding % 4 !== 0) fail("invalid_transport_padding");
  const body = frame.subarray(20, 20 + bodyLength);
  if (body.readUInt32LE(0) !== 0x05162463) fail("unexpected_response");
  if (!equal(body.subarray(4, 20), nonce)) fail("nonce_mismatch");
  // resPQ: constructor, nonce, server_nonce, TL bytes(pq), Vector<long>.
  const pqLength = body[36];
  if (pqLength < 1 || pqLength > 8 || 37 + pqLength > body.length) fail("invalid_pq_length");
  const pq = body.subarray(37, 37 + pqLength);
  if (pq[0] === 0 || (pq.length === 8 && pq[0] > 127) || (pq[pq.length - 1] & 1) === 0
    || (pq.length === 1 && pq[0] < 15)) fail("invalid_pq_value");
  const vectorOffset = 36 + Math.ceil((1 + pqLength) / 4) * 4;
  if (vectorOffset + 8 > body.length || body.readUInt32LE(vectorOffset) !== 0x1cb5c415) fail("invalid_fingerprint_vector");
  const count = body.readUInt32LE(vectorOffset + 4);
  const used = vectorOffset + 8 + count * 8;
  if (count < 1 || count > 16 || used > body.length) fail("invalid_fingerprint_count");
  for (let i = 0; i < count; i++) {
    if (body.readBigUInt64LE(vectorOffset + 8 + i * 8) === 0n) fail("invalid_fingerprint_value");
  }
  // Desktop includes 0..63 padding words in the declared body; iOS appends
  // extra words outside it. Bound their combined allowance so accepting both
  // layouts cannot double the padding budget. Padded transports may add their
  // own final 0..15 bytes. None of this changes the nonce-bound resPQ parsing.
  const innerPadding = body.length - used;
  if (innerPadding > 252) fail("invalid_body_padding");
  if (innerPadding + outerPadding > 252 + (session.padded ? 15 : 0)) fail("invalid_response_padding");
  return true;
}
