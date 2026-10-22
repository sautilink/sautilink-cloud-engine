import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createCipheriv, createHash, createHmac } from "node:crypto";
import { normalizeProxy, probeProxy, isPublicIp } from "../src/proxy/protocol/index.js";
import { camouflagePublicKey } from "../src/proxy/protocol/fake-tls.js";

const KEY = "0123456789abcdef0123456789abcdef";
const NOW = 1792700000123;
const TLS_DOMAIN = "www.example.org";
const TLS_SECRET = `ee${KEY}${Buffer.from(TLS_DOMAIN).toString("hex")}`;
const proxy = (variant = "classic", host = "1.2.3.4") => ({
  host, port: 443,
  secret: variant === "fake_tls" ? TLS_SECRET : variant === "padded" ? `dd${KEY}` : KEY,
});
const u32 = (n) => { const bytes = Buffer.alloc(4); bytes.writeUInt32LE(n); return bytes; };
const sha = (value) => createHash("sha256").update(value).digest();
const hmac = (value) => createHmac("sha256", Buffer.from(KEY, "hex")).update(value).digest();
const tlsRecord = (data) => {
  const header = Buffer.from([0x17, 3, 3, 0, 0]);
  header.writeUInt16BE(data.length, 3);
  return Buffer.concat([header, data]);
};

/**
 * Independent server-side fixture: derive keys from received wire bytes, decrypt
 * the request, assert DC/constructor/nonce framing, then build an actual resPQ.
 * No production encode/decode helpers are used to build fixture responses.
 */
function fixture({
  variant = "classic", fragment = 0, badTlsHmac = false,
  tlsOnly = false, rawReply, modifyFrame, modifyBody,
  responseInnerPadding = 0, responseEnvelopePadding = 0, responseOuterPadding,
} = {}) {
  const writes = [], errors = [], destinations = [];
  let controller, cancelled = false, closeCount = 0, abortCount = 0, requestCount = 0;
  const emit = (bytes) => {
    if (cancelled) return;
    if (!fragment) controller.enqueue(bytes);
    else for (let offset = 0; offset < bytes.length; offset += fragment) controller.enqueue(bytes.subarray(offset, offset + fragment));
  };
  const inspectTlsHello = (hello) => {
    assert.ok(hello.length >= 517 && hello.length <= 2048, "complete bounded ClientHello");
    assert.equal(hello.subarray(0, 3).toString("hex"), "160301");
    assert.equal(hello.readUInt16BE(3), hello.length - 5);
    assert.equal(hello[5], 1);
    assert.equal(hello.readUIntBE(6, 3), hello.length - 9);
    assert.equal(hello.subarray(9, 11).toString("hex"), "0303");
    assert.equal(hello[43], 32, "session id exactly where official server reads it");
    const supplied = Buffer.from(hello.subarray(11, 43));
    const zero = Buffer.from(hello);
    zero.fill(0, 11, 43);
    const expected = hmac(zero);
    assert.deepEqual(supplied.subarray(0, 28), expected.subarray(0, 28));
    assert.equal((supplied.readUInt32LE(28) ^ expected.readUInt32LE(28)) >>> 0, Math.floor(NOW / 1000));
    const suiteLength = hello.readUInt16BE(76);
    assert.equal(suiteLength % 2, 0);
    assert.equal(hello.subarray(80, 82).toString("hex"), "1301", "first non-GREASE suite is TLS 1.3");
    let cursor = 78 + suiteLength;
    assert.equal(hello.subarray(cursor, cursor + 2).toString("hex"), "0100");
    cursor += 2;
    assert.equal(hello.readUInt16BE(cursor), hello.length - cursor - 2);
    cursor += 2;
    let seenSni = false, seenX25519 = false;
    while (cursor < hello.length) {
      const id = hello.readUInt16BE(cursor), length = hello.readUInt16BE(cursor + 2);
      const data = hello.subarray(cursor + 4, cursor + 4 + length);
      assert.equal(data.length, length);
      if (id === 0) {
        assert.equal(data.readUInt16BE(0), data.length - 2);
        assert.equal(data[2], 0);
        assert.equal(data.readUInt16BE(3), TLS_DOMAIN.length);
        assert.equal(data.subarray(5).toString(), TLS_DOMAIN);
        seenSni = true;
      }
      if (id === 0x33) {
        assert.equal(data.readUInt16BE(0), data.length - 2);
        assert.equal(data.subarray(2, 6).toString("hex"), "001d0020");
        assert.equal(data.length, 38);
        seenX25519 = true;
      }
      cursor += 4 + length;
    }
    assert.equal(cursor, hello.length);
    assert.ok(seenSni && seenX25519);

    // Official server response: ServerHello + CCS + opaque application record.
    const reply = Buffer.alloc(127 + 11 + 64);
    Buffer.from("160303007a020000760303", "hex").copy(reply);
    reply[43] = 32;
    hello.copy(reply, 44, 44, 76);
    Buffer.from("130100002e00330024001d0020", "hex").copy(reply, 76);
    reply.fill(0x31, 89, 121);
    Buffer.from("002b000203041403030001011703030040", "hex").copy(reply, 121);
    reply.fill(0x58, 138);
    hmac(Buffer.concat([supplied, reply])).copy(reply, 11);
    if (badTlsHmac) reply[11] ^= 1;
    emit(reply);
  };
  const inspectMtproto = (packet) => {
    requestCount++;
    assert.ok(packet.length >= 64 + 4 + 40);
    const init = packet.subarray(0, 64);
    const key = Buffer.from(KEY, "hex");
    const decode = createCipheriv("aes-256-ctr", sha(Buffer.concat([init.subarray(8, 40), key])), init.subarray(40, 56));
    const decodedHeader = decode.update(init);
    assert.equal(decodedHeader.readUInt32LE(56), variant === "classic" ? 0xeeeeeeee : 0xdddddddd);
    assert.equal(decodedHeader.readInt16LE(60), 2);
    const request = decode.update(packet.subarray(64));
    assert.equal(request.readUInt32LE(0), request.length - 4);
    assert.deepEqual(request.subarray(4, 12), Buffer.alloc(8));
    const requestId = request.readBigUInt64LE(12);
    assert.equal(requestId & 3n, 0n);
    assert.notEqual(requestId & 0xffffffffn, 0n);
    assert.equal(Number(requestId >> 32n), Math.floor(NOW / 1000));
    const bodyLength = request.readUInt32LE(20);
    assert.ok(bodyLength >= 20 && bodyLength % 4 === 0);
    assert.equal(request.readUInt32LE(24), 0xbe7e8ef1);
    assert.ok(request.length - 24 - bodyLength <= (variant === "classic" ? 0 : 15));
    const nonce = request.subarray(28, 44);
    const body = Buffer.concat([
      u32(0x05162463), nonce, Buffer.alloc(16, 0x9a),
      Buffer.from("0817ed48941a08f981000000", "hex"),
      u32(0x1cb5c415), u32(1), Buffer.from("216be86c022bb4c3", "hex"),
      Buffer.alloc(responseInnerPadding, 0x5a),
    ]);
    assert.equal(body.length, 64 + responseInnerPadding);
    modifyBody?.(body);
    const outerPadding = responseOuterPadding ?? (variant === "classic" ? 0 : 7);
    let frame = Buffer.alloc(20 + body.length + responseEnvelopePadding + outerPadding);
    frame.writeBigUInt64LE((BigInt(Math.floor(NOW / 1000)) << 32n) | 1n, 8);
    frame.writeUInt32LE(body.length, 16);
    body.copy(frame, 20);
    frame = modifyFrame?.(frame) ?? frame;
    const reverse = Buffer.from(init).reverse();
    const encode = createCipheriv("aes-256-ctr", sha(Buffer.concat([reverse.subarray(8, 40), key])), reverse.subarray(40, 56));
    let reply = rawReply ? rawReply({ encode, frame, nonce }) : encode.update(Buffer.concat([u32(frame.length), frame]));
    if (variant === "fake_tls") {
      // Split encrypted bytes inside the frame length and nonce, forcing CTR and
      // transport parsers to preserve state across multiple TLS records.
      reply = Buffer.concat([tlsRecord(reply.subarray(0, 2)), tlsRecord(reply.subarray(2, 37)), tlsRecord(reply.subarray(37))]);
    }
    emit(reply);
  };
  const socket = {
    opened: Promise.resolve({ remoteAddress: "1.2.3.4" }),
    closed: new Promise(() => {}),
    readable: new ReadableStream({ start(value) { controller = value; }, cancel() { cancelled = true; } }),
    writable: new WritableStream({
      write(bytes) {
        try {
          const data = Buffer.from(bytes);
          writes.push(data);
          if (variant === "fake_tls" && writes.length === 1) return inspectTlsHello(data);
          if (variant === "fake_tls") {
            assert.equal(data.subarray(0, 9).toString("hex"), "140303000101170303");
            assert.equal(data.readUInt16BE(9), data.length - 11);
            if (!tlsOnly) inspectMtproto(data.subarray(11));
          } else inspectMtproto(data);
        } catch (error) { errors.push(error); throw error; }
      },
      abort() { abortCount++; },
    }),
    close() {
      closeCount++;
      if (!cancelled) { cancelled = true; try { controller.close(); } catch {} }
      return Promise.resolve();
    },
  };
  return {
    socket, writes, errors, destinations,
    connect(address, options) { destinations.push({ address, options }); return socket; },
    get closeCount() { return closeCount; },
    get abortCount() { return abortCount; },
    get requestCount() { return requestCount; },
  };
}

test("normalization canonicalizes classic, padded and Fake TLS hex/base64 variants", () => {
  for (const variant of ["classic", "padded", "fake_tls"]) {
    const input = proxy(variant, "PROXY.EXAMPLE.ORG.");
    const expected = { ...input, host: "proxy.example.org", transport: variant };
    assert.deepEqual(normalizeProxy(input), expected);
    const encoded = Buffer.from(input.secret, "hex");
    for (const secret of [input.secret.toUpperCase(), encoded.toString("base64"), encoded.toString("base64url")]) {
      const query = new URLSearchParams({ server: input.host, port: "443", secret });
      assert.deepEqual(normalizeProxy(`https://t.me/proxy?${query}`), expected);
      assert.deepEqual(normalizeProxy(`https://telegram.me/proxy?${query}`), expected);
      assert.deepEqual(normalizeProxy(`tg://proxy?${query}`), expected);
    }
  }
  assert.equal(normalizeProxy({ ...proxy(), host: "[2606:4700:4700:0:0:0:0:1111]" }).host, "2606:4700:4700::1111");
});

test("normalization rejects malformed links, ambiguous encodings and secret tails", () => {
  const bad = [
    "https://evil.example/proxy?server=1.2.3.4&port=443&secret=" + KEY,
    "https://t.me/proxy?server=1.2.3.4&server=8.8.8.8&port=443&secret=" + KEY,
    "https://t.me/proxy?server=1.2.3.4&port=443&secret=" + KEY + "#fragment",
    "https://user@t.me/proxy?server=1.2.3.4&port=443&secret=" + KEY,
    ...[0, 65536, -1, "0x1bb", "443junk", "443.0"].map((port) => ({ ...proxy(), port })),
    ...["f".repeat(31), "aa" + KEY, KEY + "0000", "ee" + KEY, "ee" + KEY + "00", "ee" + KEY + "ff", "ee" + KEY + Buffer.from("x".repeat(183)).toString("hex"), "AQ==junk", "AQ==", "Z".repeat(22)].map((secret) => ({ ...proxy(), secret })),
    ...["localhost", "metadata.internal", "127.1", "0x7f000001", "2130706433", "0177.0.0.1", "example.org/path", "user@example.org", "host_name.example", "example.org:443", "127.0.0.1", "[::1]", "[fe80::1%eth0]"].map((host) => ({ ...proxy(), host })),
  ];
  for (const value of bad) assert.throws(() => normalizeProxy(value), { name: "ProxyValidationError" });
});

test("endpoint safety rejects special IP ranges and transition IPv6 addresses", () => {
  for (const address of ["1.2.3.4", "8.8.8.8", "2606:4700:4700::1111"]) assert.equal(isPublicIp(address), true, address);
  for (const address of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "100.64.0.1", "192.0.2.1", "198.51.100.2", "203.0.113.1", "224.0.0.1", "192.88.99.1", "::", "::1", "::ffff:8.8.8.8", "64:ff9b::a00:1", "2002:0a00:0001::", "2001:0000::1", "2001:db8::1", "3fff::1", "fc00::1", "fe80::1", "ff02::1", "1.2.3.04", "1.2.3.4 "]) {
    assert.equal(isPublicIp(address), false, address);
  }
});

test("TLS camouflage public key matches RFC 7748's X25519 test vector", () => {
  const input = Buffer.from("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a", "hex");
  assert.equal(camouflagePublicKey(input).toString("hex"), "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a");
});

for (const variant of ["classic", "padded", "fake_tls"]) {
  test(`${variant}: only a valid nonce-bound resPQ yields active, including byte-fragmented input`, async () => {
    const f = fixture({ variant, fragment: 1 });
    const result = await probeProxy(proxy(variant), { connect: f.connect, now: () => NOW });
    assert.deepEqual(f.errors, []);
    assert.equal(result.status, "active");
    assert.equal(result.check_level, "mtproto");
    assert.equal(result.reason_code, "mtproto_ok");
    assert.equal(result.checked_at, new Date(NOW).toISOString());
    assert.ok(Number.isInteger(result.latency_ms));
    assert.equal(f.requestCount, 1);
    assert.equal(f.closeCount, 1);
    assert.equal(f.destinations[0].options.secureTransport, "off");
  });
  test(`${variant}: mismatched nonce never counts as active`, async () => {
    const f = fixture({ variant, modifyBody(body) { body[4] ^= 1; } });
    const result = await probeProxy(proxy(variant), { connect: f.connect, now: () => NOW });
    assert.deepEqual(f.errors, []);
    assert.equal(result.status, "unverified");
    assert.equal(result.check_level, "tcp");
    assert.equal(result.reason_code, "nonce_mismatch");
    assert.equal(result.latency_ms, null);
    assert.equal(f.closeCount, 1);
  });
}

test("accepted NoCrypto body padding and external padded framing remain distinct", async () => {
  const f = fixture({ variant: "padded", responseInnerPadding: 240, responseOuterPadding: 15 });
  const result = await probeProxy(proxy("padded"), { connect: f.connect, now: () => NOW });
  assert.deepEqual(f.errors, []);
  assert.equal(result.status, "active");
});

test("official unencrypted response padding may have any word length, not only AES block lengths", async () => {
  // Telegram Desktop extendedNotSecurePadding() uses 0..63 words. A valid
  // nonce-bound resPQ must remain valid at every permitted padding length.
  for (const variant of ["classic", "padded", "fake_tls"]) {
    for (let responseInnerPadding = 0; responseInnerPadding <= 252; responseInnerPadding += 4) {
      const f = fixture({ variant, responseInnerPadding });
      const result = await probeProxy(proxy(variant), { connect: f.connect, now: () => NOW });
      assert.deepEqual(f.errors, []);
      assert.equal(result.status, "active", `${variant} with ${responseInnerPadding} bytes of body padding`);
      assert.equal(result.check_level, "mtproto");
    }
  }
});

test("unencrypted response padding outside the declared body is distinct from transport padding", async () => {
  // Official iOS writes the real body length before appending random padding
  // words. Desktop's receiver also permits trailing bytes outside that length.
  for (const variant of ["classic", "padded", "fake_tls"]) {
    for (let responseEnvelopePadding = 0; responseEnvelopePadding <= 252; responseEnvelopePadding += 4) {
      const f = fixture({ variant, responseEnvelopePadding });
      const result = await probeProxy(proxy(variant), { connect: f.connect, now: () => NOW });
      assert.deepEqual(f.errors, []);
      assert.equal(result.status, "active", `${variant} with ${responseEnvelopePadding} bytes after the declared body`);
      assert.equal(result.check_level, "mtproto");
    }
    const boundary = fixture({ variant, responseInnerPadding: 16, responseEnvelopePadding: 236, responseOuterPadding: variant === "classic" ? 0 : 15 });
    const valid = await probeProxy(proxy(variant), { connect: boundary.connect, now: () => NOW });
    assert.deepEqual(boundary.errors, []);
    assert.equal(valid.status, "active");
    const oversized = fixture({ variant, responseInnerPadding: 128, responseEnvelopePadding: 128, responseOuterPadding: variant === "classic" ? 0 : 15 });
    const denied = await probeProxy(proxy(variant), { connect: oversized.connect, now: () => NOW });
    assert.deepEqual(oversized.errors, []);
    assert.equal(denied.status, "unverified");
    assert.equal(denied.reason_code, "invalid_response_padding");
    const mismatch = fixture({ variant, responseEnvelopePadding: 236, modifyBody(body) { body[4] ^= 1; } });
    const wrongNonce = await probeProxy(proxy(variant), { connect: mismatch.connect, now: () => NOW });
    assert.equal(wrongNonce.status, "unverified");
    assert.equal(wrongNonce.reason_code, "nonce_mismatch");
  }
});

test("Fake TLS invalid HMAC is rejected before an MTProto request is written", async () => {
  const f = fixture({ variant: "fake_tls", badTlsHmac: true });
  const result = await probeProxy(proxy("fake_tls"), { connect: f.connect, now: () => NOW });
  assert.deepEqual(f.errors, []);
  assert.equal(result.status, "unverified");
  assert.equal(result.reason_code, "tls_auth_failed");
  assert.equal(f.writes.length, 1);
  assert.equal(f.requestCount, 0);
  assert.equal(f.closeCount, 1);
});

test("a valid Fake TLS server hello alone cannot yield active", async () => {
  const f = fixture({ variant: "fake_tls", tlsOnly: true });
  const result = await probeProxy(proxy("fake_tls"), { connect: f.connect, now: () => NOW, timeoutMs: 25 });
  assert.deepEqual(f.errors, []);
  assert.equal(result.status, "offline");
  assert.equal(result.reason_code, "timeout");
  assert.equal(result.check_level, "tcp");
  assert.equal(f.closeCount, 1);
});

test("HTTP, malformed MTProto, oversized frames and invalid TL structures are not active", async () => {
  const cases = [
    { rawReply: () => Buffer.from("HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n"), reason: "invalid_frame" },
    { rawReply: ({ encode }) => encode.update(u32(0x7fffffff)), reason: "invalid_frame" },
    { rawReply: ({ encode }) => encode.update(Buffer.concat([u32(4), Buffer.from("6cfeffff", "hex")])), reason: "transport_rejected" },
    { modifyFrame(frame) { frame[0] = 1; }, reason: "invalid_auth_envelope" },
    { modifyFrame(frame) { frame[8] &= 0xfe; }, reason: "invalid_server_message_id" },
    { modifyFrame(frame) { frame.writeUInt32LE(1000, 16); }, reason: "invalid_body_length" },
    { modifyBody(body) { body[0] = 0; }, reason: "unexpected_response" },
    { modifyBody(body) { body[36] = 254; }, reason: "invalid_pq_length" },
    { modifyBody(body) { body[44] = 2; }, reason: "invalid_pq_value" },
    { modifyBody(body) { body.writeUInt32LE(0, 48); }, reason: "invalid_fingerprint_vector" },
    { modifyBody(body) { body.writeUInt32LE(0, 52); }, reason: "invalid_fingerprint_count" },
    { modifyBody(body) { body.writeUInt32LE(17, 52); }, reason: "invalid_fingerprint_count" },
    { modifyBody(body) { body.fill(0, 56, 64); }, reason: "invalid_fingerprint_value" },
    { responseOuterPadding: 1, reason: "invalid_transport_padding" },
    { responseInnerPadding: 256, reason: "invalid_body_padding" },
  ];
  for (const entry of cases) {
    const f = fixture(entry);
    const result = await probeProxy(proxy(), { connect: f.connect, now: () => NOW });
    assert.deepEqual(f.errors, []);
    assert.notEqual(result.status, "active");
    assert.equal(result.reason_code, entry.reason);
    assert.equal(result.check_level, "tcp");
    assert.equal(f.closeCount, 1);
  }
});

test("DNS answers are all validated, and only the pinned IP is passed to connect", async () => {
  const f = fixture();
  let resolved = 0;
  const result = await probeProxy(proxy("classic", "proxy.example.org"), {
    connect: f.connect, now: () => NOW,
    resolveHost: async (host, { signal }) => {
      resolved++;
      assert.equal(host, "proxy.example.org");
      assert.equal(signal.aborted, false);
      return ["8.8.8.8", "2606:4700:4700::1111"];
    },
  });
  assert.deepEqual(f.errors, []);
  assert.equal(result.status, "active");
  assert.equal(resolved, 1);
  assert.equal(f.destinations[0].address.hostname, "8.8.8.8");
  for (const addresses of [["8.8.8.8", "127.0.0.1"], ["proxy.example.org"], ["169.254.169.254"]]) {
    const denied = await probeProxy(proxy("classic", "proxy.example.org"), {
      connect() { assert.fail("must not open a socket"); }, resolveHost: async () => addresses,
    });
    assert.equal(denied.status, "unverified");
    assert.equal(denied.reason_code, "private_address_blocked");
    assert.equal(denied.check_level, "none");
  }
});

test("unconfigured, invalid, DNS and platform restrictions remain unverified", async () => {
  const missing = await probeProxy(proxy());
  assert.equal(missing.reason_code, "checker_unavailable");
  assert.equal(missing.status, "unverified");
  const unsafe = await probeProxy({ ...proxy(), host: "127.0.0.1" }, { connect() { assert.fail(); } });
  assert.equal(unsafe.reason_code, "private_address_blocked");
  for (const code of ["DNS_TIMEOUT", "DNS_UNAVAILABLE", "PRIVATE_ADDRESS_BLOCKED"]) {
    const result = await probeProxy(proxy("classic", "proxy.example.org"), {
      connect() { assert.fail(); }, resolveHost() { throw Object.assign(new Error("sensitive details"), { code }); },
    });
    assert.equal(result.status, "unverified");
    assert.equal(JSON.stringify(result).includes("sensitive"), false);
  }
  const blocked = await probeProxy(proxy(), {
    connect() { throw new Error("proxy request failed, cannot connect to the specified address"); },
  });
  assert.equal(blocked.status, "unverified");
  assert.equal(blocked.reason_code, "platform_restricted");
  assert.equal(blocked.check_level, "none");
});

test("overall deadline cancels reads and closes sockets without retry", async () => {
  let closed = 0, cancelled = 0, calls = 0;
  const socket = {
    opened: Promise.resolve(), closed: new Promise(() => {}),
    readable: new ReadableStream({ cancel() { cancelled++; } }),
    writable: new WritableStream({ write() {} }), close() { closed++; },
  };
  const started = Date.now();
  const result = await probeProxy(proxy(), { connect() { calls++; return socket; }, timeoutMs: 25 });
  assert.equal(result.reason_code, "timeout");
  assert.equal(result.check_level, "tcp");
  assert.ok(Date.now() - started < 500);
  assert.equal(calls, 1);
  assert.equal(closed, 1);
  assert.equal(cancelled, 1);
});

test("a late DNS resolution cannot start network work after the deadline", async () => {
  let resolve;
  const result = await probeProxy(proxy("classic", "proxy.example.org"), {
    resolveHost: () => new Promise((value) => { resolve = value; }),
    connect() { assert.fail("expired probe must not connect"); }, timeoutMs: 25,
  });
  assert.equal(result.reason_code, "timeout");
  assert.equal(result.status, "unverified");
  resolve(["8.8.8.8"]);
  await new Promise((value) => setTimeout(value, 0));
});

test("a socket arriving after the deadline is still closed", async () => {
  let resolve, closed = 0;
  const result = await probeProxy(proxy(), {
    connect: () => new Promise((value) => { resolve = value; }), timeoutMs: 25,
  });
  assert.equal(result.reason_code, "timeout");
  resolve({ close() { closed++; } });
  await new Promise((value) => setTimeout(value, 0));
  assert.equal(closed, 1);
});

test("a stalled write cannot extend the overall deadline", async () => {
  let closed = 0;
  const result = await probeProxy(proxy(), {
    connect: () => ({
      opened: Promise.resolve(), readable: new ReadableStream(),
      writable: new WritableStream({ write: () => new Promise(() => {}) }), close() { closed++; },
    }), timeoutMs: 25,
  });
  assert.equal(result.reason_code, "timeout");
  assert.equal(closed, 1);
});

test("the socket reader bounds bytes and empty-read work before parsing", async () => {
  for (const [kind, reason] of [["large", "response_too_large"], ["empty", "response_too_fragmented"]]) {
    let closed = 0;
    const result = await probeProxy(proxy(), {
      connect: () => ({
        opened: Promise.resolve(),
        readable: new ReadableStream({ pull(controller) { controller.enqueue(Buffer.alloc(kind === "large" ? 100 * 1024 : 0)); } }),
        writable: new WritableStream(), close() { closed++; },
      }),
    });
    assert.equal(result.status, "unverified");
    assert.equal(result.reason_code, reason);
    assert.equal(closed, 1);
  }
});
