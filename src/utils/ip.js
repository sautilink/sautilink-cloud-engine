/**
 * Pure JS IP helpers for SSRF checks (no Node net module).
 */

/**
 * @param {string} host
 * @returns {boolean}
 */
export function isIPv4Literal(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/**
 * @param {string} host
 * @returns {boolean}
 */
export function isIPv6Literal(host) {
  // Bracketed form is stripped by callers; allow compressed forms.
  if (!host || host.includes(".")) {
    // Possible IPv4-mapped: ::ffff:a.b.c.d handled separately
  }
  return host.includes(":");
}

/**
 * Parse IPv4 to 32-bit number, or null if invalid.
 * @param {string} ip
 * @returns {number|null}
 */
export function parseIPv4(ip) {
  const parts = String(ip).split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

/**
 * Expand simplified IPv6 to 8 hextets, or null.
 * Handles :: and dotted IPv4 tail (::ffff:192.0.2.1).
 * @param {string} ip
 * @returns {number[]|null} eight 16-bit values
 */
export function parseIPv6(ip) {
  let s = String(ip).toLowerCase().trim();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);

  // IPv4-mapped tail
  const v4Tail = s.match(/:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4Tail) {
    const v4 = parseIPv4(v4Tail[1]);
    if (v4 == null) return null;
    const hi = (v4 >>> 16) & 0xffff;
    const lo = v4 & 0xffff;
    s = s.slice(0, -v4Tail[1].length) + hi.toString(16) + ":" + lo.toString(16);
  }

  if (s.includes(".")) return null;

  const sides = s.split("::");
  if (sides.length > 2) return null;

  const parseSide = (side) => {
    if (side === "") return [];
    return side.split(":").map((h) => {
      if (!/^[0-9a-f]{1,4}$/i.test(h)) return NaN;
      return parseInt(h, 16);
    });
  };

  let head;
  let tail;
  if (sides.length === 1) {
    head = parseSide(sides[0]);
    tail = [];
    if (head.length !== 8 || head.some((x) => Number.isNaN(x))) return null;
    return head;
  }

  head = parseSide(sides[0]);
  tail = parseSide(sides[1]);
  if (head.some((x) => Number.isNaN(x)) || tail.some((x) => Number.isNaN(x))) {
    return null;
  }
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...Array(missing).fill(0), ...tail];
}

/**
 * True if IPv4 is in a non-public / special-use range we block for SSRF.
 * @param {string} ip
 * @returns {boolean}
 */
export function isPrivateOrReservedIPv4(ip) {
  const n = parseIPv4(ip);
  if (n == null) return true; // treat unparseable as blocked

  const inRange = (base, prefix) => {
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (n & mask) === (base & mask);
  };

  // 0.0.0.0/8
  if (inRange(0x00000000, 8)) return true;
  // 10.0.0.0/8
  if (inRange(0x0a000000, 8)) return true;
  // 100.64.0.0/10 (CGNAT)
  if (inRange(0x64400000, 10)) return true;
  // 127.0.0.0/8
  if (inRange(0x7f000000, 8)) return true;
  // 169.254.0.0/16 link-local / metadata
  if (inRange(0xa9fe0000, 16)) return true;
  // 172.16.0.0/12
  if (inRange(0xac100000, 12)) return true;
  // 192.0.0.0/24 (IETF protocol assignments — block broadly for safety)
  if (inRange(0xc0000000, 24)) return true;
  // 192.0.2.0/24 TEST-NET-1
  if (inRange(0xc0000200, 24)) return true;
  // 192.168.0.0/16
  if (inRange(0xc0a80000, 16)) return true;
  // 198.18.0.0/15 benchmarking
  if (inRange(0xc6120000, 15)) return true;
  // 198.51.100.0/24 TEST-NET-2
  if (inRange(0xc6336400, 24)) return true;
  // 203.0.113.0/24 TEST-NET-3
  if (inRange(0xcb007100, 24)) return true;
  // 224.0.0.0/4 multicast
  if (inRange(0xe0000000, 4)) return true;
  // 240.0.0.0/4 reserved / future
  if (inRange(0xf0000000, 4)) return true;

  return false;
}

/**
 * True if IPv6 is loopback, ULA, link-local, multicast, or IPv4-mapped private.
 * @param {string} ip
 * @returns {boolean}
 */
export function isPrivateOrReservedIPv6(ip) {
  const parts = parseIPv6(ip);
  if (!parts) return true;

  // :: / unspecified
  if (parts.every((p) => p === 0)) return true;
  // ::1 loopback
  if (parts.slice(0, 7).every((p) => p === 0) && parts[7] === 1) return true;

  // IPv4-mapped ::ffff:0:0/96
  if (
    parts[0] === 0 &&
    parts[1] === 0 &&
    parts[2] === 0 &&
    parts[3] === 0 &&
    parts[4] === 0 &&
    parts[5] === 0xffff
  ) {
    const v4 = ((parts[6] << 16) | parts[7]) >>> 0;
    const a = (v4 >>> 24) & 0xff;
    const b = (v4 >>> 16) & 0xff;
    const c = (v4 >>> 8) & 0xff;
    const d = v4 & 0xff;
    return isPrivateOrReservedIPv4(`${a}.${b}.${c}.${d}`);
  }

  // fe80::/10 link-local
  if ((parts[0] & 0xffc0) === 0xfe80) return true;
  // fc00::/7 unique local
  if ((parts[0] & 0xfe00) === 0xfc00) return true;
  // ff00::/8 multicast
  if ((parts[0] & 0xff00) === 0xff00) return true;
  // 2001:db8::/32 documentation
  if (parts[0] === 0x2001 && parts[1] === 0x0db8) return true;

  return false;
}

/**
 * @param {string} host - hostname or IP literal (no brackets required for v6)
 * @returns {boolean}
 */
export function isBlockedIpLiteral(host) {
  let h = String(host).toLowerCase().trim();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);

  if (isIPv4Literal(h)) return isPrivateOrReservedIPv4(h);
  if (h.includes(":")) return isPrivateOrReservedIPv6(h);
  return false;
}
