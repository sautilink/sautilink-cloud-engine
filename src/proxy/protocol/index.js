import { Buffer } from "node:buffer";
import { randomBytes as secureRandomBytes } from "node:crypto";
import { normalizeProxy, isPublicIp, ProxyValidationError } from "./normalize.js";
import { ByteReader, ProbeError, fail, makeObfuscatedSession, makeReqPq, readMtprotoResponse } from "./wire.js";
import { FakeTlsReader, makeFakeTlsHello, verifyFakeTlsHello, wrapFakeTlsFirstPacket } from "./fake-tls.js";

export { normalizeProxy, isPublicIp, ProxyValidationError } from "./normalize.js";

const swallow = (promise) => { if (promise?.then) Promise.resolve(promise).catch(() => {}); };

function classify(error) {
  if (error instanceof ProxyValidationError) return { status: "unverified", reason_code: error.code };
  if (error instanceof ProbeError) return { status: error.status, reason_code: error.code };
  const dns = { DNS_TIMEOUT: "dns_timeout", DNS_UNAVAILABLE: "dns_unavailable", PRIVATE_ADDRESS_BLOCKED: "private_address_blocked" };
  if (dns[error?.code]) return { status: "unverified", reason_code: dns[error.code] };
  if (/^ERR_(?:CRYPTO_|METHOD_NOT_IMPLEMENTED|NOT_IMPLEMENTED)/.test(String(error?.code ?? ""))) {
    return { status: "unverified", reason_code: "checker_unavailable" };
  }
  // Workers deliberately prohibit some public destinations. That is not evidence
  // the proxy itself is offline. Never return the raw exception or endpoint.
  const message = String(error?.message ?? "");
  if (/proxy request failed, cannot connect to the specified address|TCP Loop detected|Cloudflare.*(?:blocked|not allowed)|(?:blocked|not allowed).*Cloudflare|connections? to port 25.*(?:prohibited|blocked)/i.test(message)) {
    return { status: "unverified", reason_code: "platform_restricted" };
  }
  return { status: "offline", reason_code: "connection_failed" };
}

/**
 * One accountless req_pq/resPQ availability probe. This verifies a nonce-bound
 * MTProto response, NOT the server's RSA identity or the operator's trust.
 *
 * connect: Cloudflare sockets.connect-compatible function (injected by caller).
 * resolveHost(host,{signal}): Promise<string[]> of literal public IPs. All returned
 * addresses are checked and the chosen literal is pinned for this connection.
 * now(): epoch milliseconds, used for timestamps; the deadline uses a real timer.
 * No retry, user data, Telegram login, Bot API token or HTTP fallback is involved.
 */
export async function probeProxy(input, {
  connect,
  resolveHost,
  timeoutMs = 7000,
  now = Date.now,
  randomBytes = secureRandomBytes,
  dcId = 2,
} = {}) {
  const timestamp = () => {
    const value = Number(typeof now === "function" ? now() : NaN);
    return Number.isFinite(value) && value >= 0 && value < 8640000000000000 ? value : Date.now();
  };
  const start = Date.now();
  const budget = Math.min(15000, Math.max(25, Number(timeoutMs) || 7000));
  const controller = new AbortController();
  let socket, reader, writer, timer, stopped = false, tcpReached = false, phase = "resolve";
  const closeSocket = (value) => {
    try { swallow(value?.closed); swallow(value?.close?.()); } catch {}
  };
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    controller.abort();
    try { swallow(reader?.cancel()); } catch {}
    try { swallow(writer?.abort()); } catch {}
    closeSocket(socket);
  };
  const checkDeadline = () => {
    if (stopped || Date.now() - start >= budget) fail("timeout", phase === "resolve" ? "unverified" : "offline");
  };
  const result = (state) => ({
    ...state,
    latency_ms: state.status === "active" ? Math.max(0, Date.now() - start) : null,
    check_level: state.status === "active" ? "mtproto" : tcpReached ? "tcp" : "none",
    checked_at: new Date(timestamp()).toISOString(),
  });
  try {
    const proxy = normalizeProxy(input);
    if (typeof connect !== "function") fail("checker_unavailable");
    if (!Number.isInteger(dcId) || dcId < 1 || dcId > 5) fail("invalid_datacenter");
    const work = async () => {
      let addresses;
      if (isPublicIp(proxy.host)) {
        addresses = [proxy.host];
      } else {
        if (typeof resolveHost !== "function") fail("dns_unavailable");
        addresses = await resolveHost(proxy.host, { signal: controller.signal });
        checkDeadline();
      }
      if (!Array.isArray(addresses) || addresses.length > 32) fail("dns_invalid_response");
      if (!addresses.length) fail("dns_no_address", "offline");
      if (addresses.some((address) => !isPublicIp(address))) fail("private_address_blocked");
      checkDeadline();
      // Connect only to the validated address, never the hostname again.
      phase = "connect";
      const pendingSocket = connect({ hostname: addresses[0], port: proxy.port }, { secureTransport: "off", allowHalfOpen: false });
      socket = await Promise.resolve(pendingSocket).then((value) => {
        if (stopped) closeSocket(value);
        return value;
      });
      checkDeadline();
      if (!socket?.readable?.getReader || !socket?.writable?.getWriter) fail("checker_unavailable");
      swallow(socket.closed);
      await socket.opened;
      checkDeadline();
      tcpReached = true;
      phase = "protocol";
      reader = socket.readable.getReader();
      writer = socket.writable.getWriter();
      const raw = new ByteReader(reader, checkDeadline);
      const secret = Buffer.from(proxy.secret, "hex");
      const write = async (bytes) => { checkDeadline(); await writer.write(bytes); checkDeadline(); };
      let incoming = raw;
      if (proxy.transport === "fake_tls") {
        const { hello, digest } = makeFakeTlsHello(secret, timestamp(), randomBytes);
        await write(hello);
        await verifyFakeTlsHello(raw, secret, digest);
        checkDeadline();
        incoming = new FakeTlsReader(raw);
      }
      const session = makeObfuscatedSession(secret, proxy.transport, dcId, randomBytes);
      const nonce = Buffer.from(randomBytes(16));
      const request = makeReqPq(nonce, timestamp(), session.padded, randomBytes);
      let packet = Buffer.concat([session.wireHeader, session.outgoing.update(request)]);
      if (proxy.transport === "fake_tls") packet = wrapFakeTlsFirstPacket(packet);
      await write(packet);
      await readMtprotoResponse(incoming, session, nonce);
      checkDeadline();
      return { status: "active", reason_code: "mtproto_ok" };
    };
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        cleanup();
        reject(new ProbeError("timeout", phase === "resolve" ? "unverified" : "offline"));
      }, budget);
    });
    return result(await Promise.race([work(), deadline]));
  } catch (error) {
    return result(classify(error));
  } finally {
    clearTimeout(timer);
    cleanup();
  }
}
