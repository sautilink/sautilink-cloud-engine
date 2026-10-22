#!/usr/bin/env node
/**
 * Explicit, bounded network smoke test using only the configured public feeds.
 * Run: node scripts/proxy-smoke.mjs --live [--limit=30]
 * No hostnames, proxy secrets, Telegram credentials or connect URLs are logged.
 */
import { createConnection } from "node:net";
import { Duplex } from "node:stream";
import { collectSources } from "../src/proxy/sources.js";
import { resolveProxyHost } from "../src/proxy/dns.js";
import { probeProxy } from "../src/proxy/protocol/index.js";

if (!process.argv.includes("--live")) {
  console.error("No network calls made. Pass --live to probe up to 60 published feed candidates.");
  process.exit(2);
}
const limitOption = process.argv.find((arg) => arg.startsWith("--limit="));
const requestedLimit = Number(limitOption?.slice(8) ?? 30);
if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 60) {
  console.error("--limit must be an integer from 1 to 60.");
  process.exit(2);
}

const socketErrorCodes = {};
function connect({ hostname, port }) {
  const socket = createConnection({ host: hostname, port });
  const streams = Duplex.toWeb(socket);
  const opened = new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", (error) => {
      const code = /^[A-Z][A-Z0-9_]{1,40}$/.test(error?.code || "") ? error.code : "OTHER";
      socketErrorCodes[code] = (socketErrorCodes[code] || 0) + 1;
      reject(error);
    });
  });
  const closed = new Promise((resolve) => socket.once("close", resolve));
  return { ...streams, opened, closed, close() { socket.destroy(); } };
}

const start = Date.now();
const collection = await collectSources();
const candidates = collection.candidates.slice(0, requestedLimit);
console.log(JSON.stringify({
  event: "sources", candidate_count: collection.candidates.length,
  sources: collection.observations.map(({ id, status, candidate_count }) => ({ id, status, candidate_count })),
}));
if (!candidates.length) {
  console.error("No candidates available. This environment or the public feeds may be unavailable; no proxy status was inferred.");
  process.exit(1);
}

let cursor = 0;
const statuses = {}, reasons = {}, transports = {}, levels = {};
const workers = Array.from({ length: Math.min(3, candidates.length) }, async () => {
  while (cursor < candidates.length) {
    const candidate = candidates[cursor++];
    const result = await probeProxy(candidate, {
      connect, timeoutMs: 6000,
      resolveHost: resolveProxyHost,
    });
    statuses[result.status] = (statuses[result.status] || 0) + 1;
    reasons[result.reason_code] = (reasons[result.reason_code] || 0) + 1;
    levels[result.check_level] = (levels[result.check_level] || 0) + 1;
    const transport = transports[candidate.transport] ??= { checked: 0, active: 0 };
    transport.checked++;
    if (result.status === "active") transport.active++;
  }
});
await Promise.all(workers);
console.log(JSON.stringify({
  event: "results", checked: candidates.length, elapsed_ms: Date.now() - start,
  statuses, reasons, check_levels: levels, transports, socket_error_codes: socketErrorCodes,
  note: "One monitoring location; unsuccessful checks do not prove worldwide unavailability. No Telegram account or Bot API request was used.",
}));
process.exitCode = statuses.active ? 0 : 1;
