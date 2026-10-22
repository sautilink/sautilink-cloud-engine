import { Buffer } from "node:buffer";
import { parseIPv4, parseIPv6, isPrivateOrReservedIPv4 } from "../../utils/ip.js";

/** Validation errors contain fixed codes, never a submitted URL or secret. */
export class ProxyValidationError extends Error {
  constructor(code) {
    super(code);
    this.name = "ProxyValidationError";
    this.code = code;
  }
}

const invalid = (code) => { throw new ProxyValidationError(code); };
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/** Strictly global addresses only. In particular, no mapped/tunnel IPv6. */
export function isPublicIp(value) {
  if (typeof value !== "string" || value !== value.trim()) return false;
  if (/^\d+(?:\.\d+){3}$/.test(value)) {
    if (value.split(".").some((part) => String(Number(part)) !== part)) return false;
    return parseIPv4(value) !== null && !isPrivateOrReservedIPv4(value)
      && !value.startsWith("192.88.99.");
  }
  if (!value.includes(":") || /[%\[\]\s]/.test(value)) return false;
  const parts = parseIPv6(value);
  if (!parts || (parts[0] & 0xe000) !== 0x2000) return false;
  // IETF protocol assignments (Teredo/ORCHID included), documentation, 6to4.
  if (parts[0] === 0x2001 && (parts[1] < 0x0200 || parts[1] === 0x0db8)) return false;
  if (parts[0] === 0x2002 || (parts[0] === 0x3fff && parts[1] < 0x1000)) return false;
  return true;
}

function normalizeHost(value) {
  if (typeof value !== "string" || value.length > 255) invalid("invalid_host");
  let host = value.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (!host || /[\s\x00-\x20\x7f-\xff/@?#\\%]/.test(host)) invalid("invalid_host");
  if (host.includes(":")) {
    if (!isPublicIp(host)) invalid("private_address_blocked");
    try { return new URL(`http://[${host}]/`).hostname.slice(1, -1); }
    catch { invalid("invalid_host"); }
  }
  if (/^[\d.]+$/.test(host)) {
    if (!isPublicIp(host)) invalid("private_address_blocked");
    return host;
  }
  if (host.endsWith(".")) host = host.slice(0, -1);
  const labels = host.split(".");
  if (host.length > 253 || labels.length < 2 || labels.some((part) => !HOST_LABEL.test(part))) {
    invalid("invalid_host");
  }
  if (/(?:^|\.)(?:localhost|local|internal|home|lan)$/.test(host)) invalid("private_address_blocked");
  // Do not accept alternate numeric IP spellings that URL parsers normalize.
  try {
    const parsed = new URL(`http://${host}/`).hostname;
    if (parsed !== host) invalid("invalid_host");
  } catch { invalid("invalid_host"); }
  return host;
}

function decodeSecret(value) {
  if (typeof value !== "string" || value.length > 398 || value.length < 22 || /\s/.test(value)) {
    invalid("invalid_secret");
  }
  let bytes;
  if (/^(?:[a-f\d]{2})+$/i.test(value)) {
    bytes = Buffer.from(value, "hex");
  } else {
    if (!/^[a-z\d+/_-]+={0,2}$/i.test(value) || (/[+\/]/.test(value) && /[-_]/.test(value))) {
      invalid("invalid_secret");
    }
    const unpadded = value.replace(/=+$/, "");
    if (unpadded.length % 4 === 1 || (value.includes("=") && value.length % 4 !== 0)) invalid("invalid_secret");
    bytes = Buffer.from(unpadded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (bytes.toString("base64url") !== unpadded.replace(/\+/g, "-").replace(/\//g, "_")) {
      invalid("invalid_secret");
    }
  }
  if (bytes.length === 16) return { bytes, transport: "classic" };
  if (bytes.length === 17 && bytes[0] === 0xdd) return { bytes, transport: "padded" };
  if (bytes.length >= 18 && bytes.length <= 199 && bytes[0] === 0xee) {
    const domain = bytes.subarray(17).toString("ascii");
    // TDLib caps Fake TLS domain bytes at 182. Reject malformed/truncated tails.
    if (bytes.subarray(17).some((byte) => byte > 0x7f) || domain.length > 182
      || domain.split(".").some((label) => !HOST_LABEL.test(label))) invalid("invalid_tls_domain");
    return { bytes, transport: "fake_tls" };
  }
  invalid("unsupported_secret");
}

/**
 * Parse official Telegram proxy links, or {host|server, port, secret}.
 * Canonical secrets use lowercase hex, including originally base64 encoded ones.
 * DNS names are validated syntactically here; probeProxy must pin a public answer.
 */
export function normalizeProxy(input) {
  let fields = input;
  if (typeof input === "string") {
    if (input.length > 2048) invalid("invalid_link");
    let url;
    try { url = new URL(input.trim()); } catch { invalid("invalid_link"); }
    const telegram = (url.protocol === "https:" || url.protocol === "http:")
      && ["t.me", "telegram.me"].includes(url.hostname) && url.pathname === "/proxy";
    const scheme = url.protocol === "tg:" && url.hostname === "proxy"
      && (url.pathname === "" || url.pathname === "/");
    if ((!telegram && !scheme) || url.username || url.password || url.port || url.hash) invalid("invalid_link");
    for (const name of ["server", "port", "secret"]) {
      if (url.searchParams.getAll(name).length !== 1) invalid("invalid_link");
    }
    fields = Object.fromEntries(["server", "port", "secret"].map((name) => [name, url.searchParams.get(name)]));
  }
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) invalid("invalid_input");
  const host = normalizeHost(fields.host ?? fields.server);
  const portText = String(fields.port ?? "");
  if (!/^\d{1,5}$/.test(portText)) invalid("invalid_port");
  const port = Number(portText);
  if (port < 1 || port > 65535) invalid("invalid_port");
  const { bytes, transport } = decodeSecret(fields.secret);
  return { host, port, secret: bytes.toString("hex"), transport };
}
