import { Buffer } from "node:buffer";
import { createHmac, createPrivateKey, createPublicKey } from "node:crypto";
import { equal, fail, u16be } from "./wire.js";

// Wire format references (independent implementation, no native dependencies):
// https://github.com/tdlib/td/blob/master/td/mtproto/TlsInit.cpp
// https://github.com/TelegramMessenger/MTProxy/blob/master/net/net-tcp-rpc-ext-server.c
// The TLS-shaped exchange authenticates the configured shared proxy secret.
// It does not authenticate Telegram's upstream RSA key or establish actual TLS.
const CHANGE_CIPHER_SPEC = Buffer.from("140303000101", "hex");
const APPLICATION_PREFIX = Buffer.from("170303", "hex");
const SERVER_PREFIX = Buffer.from("160303", "hex");
const X25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b656e04220420", "hex");
const X25519_SPKI_PREFIX = Buffer.from("302a300506032b656e032100", "hex");

/** Native X25519, used only for TLS camouflage bytes; no account key is made. */
export function camouflagePublicKey(randomScalar) {
  const scalar = Buffer.from(randomScalar);
  if (scalar.length !== 32) fail("random_source_invalid");
  try {
    const privateKey = createPrivateKey({
      key: Buffer.concat([X25519_PKCS8_PREFIX, scalar]), format: "der", type: "pkcs8",
    });
    const der = createPublicKey(privateKey).export({ format: "der", type: "spki" });
    if (der.length !== X25519_SPKI_PREFIX.length + 32
      || !equal(der.subarray(0, X25519_SPKI_PREFIX.length), X25519_SPKI_PREFIX)) fail("checker_unavailable");
    return Buffer.from(der.subarray(X25519_SPKI_PREFIX.length));
  } catch { fail("checker_unavailable"); }
}

const vector = (bytes) => Buffer.concat([u16be(bytes.length), bytes]);
const extension = (id, bytes) => Buffer.concat([u16be(id), vector(bytes)]);
const hmac = (key, bytes) => createHmac("sha256", key).update(bytes).digest();

export function makeFakeTlsHello(secret, nowMs, randomBytes) {
  const key = secret.subarray(1, 17);
  const domain = secret.subarray(17);
  const sessionId = Buffer.from(randomBytes(32));
  if (sessionId.length !== 32) fail("random_source_invalid");
  const publicKey = camouflagePublicKey(randomBytes(32));
  const suites = Buffer.from("0a0a130113021303c02bc02fc02cc030cca9cca8c013c014009c009d002f0035", "hex");
  const sni = vector(Buffer.concat([Buffer.from([0]), vector(domain)]));
  const share = vector(Buffer.concat([Buffer.from("001d", "hex"), vector(publicKey)]));
  const extensions = [
    extension(0x0a0a, Buffer.alloc(0)),
    extension(0, sni),
    extension(0x000a, Buffer.from("0006001d00170018", "hex")),
    extension(0x000b, Buffer.from("0100", "hex")),
    extension(0x000d, Buffer.from("001004030804040105030805050108060601", "hex")),
    extension(0x0010, Buffer.from("000c02683208687474702f312e31", "hex")),
    extension(0x0017, Buffer.alloc(0)),
    extension(0x0023, Buffer.alloc(0)),
    extension(0x002b, Buffer.from("0403040303", "hex")),
    extension(0x002d, Buffer.from("0101", "hex")),
    extension(0x0033, share),
    extension(0xff01, Buffer.from([0])),
  ];
  const bodyPrefix = Buffer.concat([
    Buffer.from("0303", "hex"), Buffer.alloc(32), Buffer.from([32]), sessionId,
    vector(suites), Buffer.from("0100", "hex"),
  ]);
  // The official MTProxy server recognizes ClientHello only when record >=512.
  const withoutPadding = 5 + 4 + bodyPrefix.length + 2 + Buffer.concat(extensions).length;
  extensions.push(extension(0x0015, Buffer.alloc(Math.max(0, 517 - withoutPadding - 4))));
  const body = Buffer.concat([bodyPrefix, vector(Buffer.concat(extensions))]);
  const handshakeHeader = Buffer.alloc(4);
  handshakeHeader[0] = 1;
  handshakeHeader.writeUIntBE(body.length, 1, 3);
  const hello = Buffer.concat([Buffer.from("160301", "hex"), u16be(body.length + 4), handshakeHeader, body]);
  const digest = hmac(key, hello);
  digest.writeUInt32LE((digest.readUInt32LE(28) ^ Math.floor(nowMs / 1000)) >>> 0, 28);
  digest.copy(hello, 11);
  return { hello, digest };
}

export async function verifyFakeTlsHello(reader, secret, clientDigest) {
  const firstHeader = await reader.readExactly(5);
  if (!equal(firstHeader.subarray(0, 3), SERVER_PREFIX)) fail("tls_handshake_invalid");
  const firstLength = firstHeader.readUInt16BE(3);
  if (firstLength < 38 || firstLength > 16384) fail("tls_handshake_invalid");
  const firstBody = await reader.readExactly(firstLength);
  if (firstBody[0] !== 2 || firstBody.readUIntBE(1, 3) !== firstLength - 4
    || firstBody[4] !== 3 || firstBody[5] !== 3) fail("tls_handshake_invalid");
  const secondHeader = await reader.readExactly(11);
  if (!equal(secondHeader.subarray(0, 6), CHANGE_CIPHER_SPEC)
    || !equal(secondHeader.subarray(6, 9), APPLICATION_PREFIX)) fail("tls_handshake_invalid");
  const secondLength = secondHeader.readUInt16BE(9);
  if (secondLength === 0 || firstLength + secondLength + 16 > 65536) fail("tls_handshake_invalid");
  const secondBody = await reader.readExactly(secondLength);
  const response = Buffer.concat([firstHeader, firstBody, secondHeader, secondBody]);
  const received = Buffer.from(response.subarray(11, 43));
  response.fill(0, 11, 43);
  const expected = hmac(secret.subarray(1, 17), Buffer.concat([clientDigest, response]));
  if (!equal(received, expected)) fail("tls_auth_failed");
}

export function wrapFakeTlsFirstPacket(packet) {
  if (packet.length > 16384) fail("invalid_frame");
  return Buffer.concat([CHANGE_CIPHER_SPEC, APPLICATION_PREFIX, u16be(packet.length), packet]);
}

/** Remove TLS application record framing before the continuous AES-CTR stream. */
export class FakeTlsReader {
  constructor(reader) {
    this.reader = reader;
    this.pending = Buffer.alloc(0);
    this.records = 0;
  }

  async readExactly(size) {
    const parts = [];
    let left = size;
    while (left > 0) {
      if (!this.pending.length) {
        if (++this.records > 32) fail("response_too_fragmented");
        const header = await this.reader.readExactly(5);
        if (!equal(header.subarray(0, 3), APPLICATION_PREFIX)) fail("tls_record_invalid");
        const length = header.readUInt16BE(3);
        if (length < 1 || length > 18432) fail("tls_record_invalid");
        this.pending = await this.reader.readExactly(length);
      }
      const take = Math.min(left, this.pending.length);
      parts.push(this.pending.subarray(0, take));
      this.pending = this.pending.subarray(take);
      left -= take;
    }
    return Buffer.concat(parts, size);
  }
}
