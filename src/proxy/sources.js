import { createHash } from "node:crypto";
import { normalizeProxy } from "./protocol/normalize.js";
import { SOURCES, SOURCE_INTERVAL_MS, MAX_FEED_BYTES, MAX_FEED_LINKS, DISCOVERY_WINDOW_SIZE } from "./config.js";

class SourceError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export async function candidateId(proxy) {
  const canonical = `${proxy.host}\n${proxy.port}\n${proxy.secret}`;
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

export async function readLimitedText(response, limit = MAX_FEED_BYTES) {
  if (Number(response.headers.get("content-length")) > limit) throw new SourceError("SOURCE_TOO_LARGE");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > limit) throw new SourceError("SOURCE_TOO_LARGE");
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function feedLinks(text) {
  const links = [];
  const matcher = /(?:https?:\/\/(?:t\.me|telegram\.me)\/proxy\?[^\s<>"'\\]+|tg:\/\/proxy\?[^\s<>"'\\]+)/gi;
  for (const match of String(text).replace(/&amp;/g, "&").matchAll(matcher)) {
    links.push(match[0]);
    if (links.length >= MAX_FEED_LINKS) break;
  }
  return links;
}

function parseWindow(links, normalize, offset = 0) {
  const unique = new Map();
  // Rotate before validation, so malformed entries do not cause an unbounded
  // search for enough valid endpoints or permanently hide later feed entries.
  for (let index = 0; index < Math.min(links.length, DISCOVERY_WINDOW_SIZE); index++) {
    const link = links[(offset + index) % links.length];
    try {
      const proxy = normalize(link);
      if (!proxy || !proxy.host || !proxy.secret) continue;
      unique.set(`${proxy.host}:${proxy.port}:${proxy.secret}`, proxy);
    } catch { /* Malformed and non-public candidates are never admitted. */ }
  }
  return [...unique.values()];
}

export function parseFeed(text, normalize = normalizeProxy) {
  return parseWindow(feedLinks(text), normalize);
}

export async function collectSources({ fetchFn = fetch, now = Date.now(), sources = SOURCES } = {}) {
  const observations = [];
  const pools = [];
  // Sequential source reads leave connection capacity for DNS and storage.
  for (const source of sources) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let phase = "fetch";
    let httpStatus = null;
    try {
      const response = await fetchFn(source.feed, {
        headers: { Accept: "text/plain", "User-Agent": "SautiLink-Cloud-Engine-Proxy-Monitor/1.0" },
        redirect: "error", signal: controller.signal,
      });
      if (Number.isInteger(response.status) && response.status >= 100 && response.status <= 599) httpStatus = response.status;
      if (!response.ok) throw new SourceError("SOURCE_HTTP_ERROR");
      phase = "read";
      const text = await readLimitedText(response);
      phase = "parse";
      const links = feedLinks(text);
      if (!links.length) throw new SourceError("SOURCE_EMPTY");
      const offset = (Math.floor(now / SOURCE_INTERVAL_MS) * DISCOVERY_WINDOW_SIZE) % links.length;
      const candidates = parseWindow(links, normalizeProxy, offset);
      pools.push({ source, candidates });
      observations.push({ id: source.id, name: source.name, url: source.url, status: "ok", last_fetched_at: new Date(now).toISOString(), candidate_count: candidates.length, feed_link_count: links.length, scanned_count: Math.min(links.length, DISCOVERY_WINDOW_SIZE) });
    } catch (error) {
      // Publish only codes owned by this module, never upstream error text or bodies.
      const reasonCode = controller.signal.aborted || error?.name === "AbortError" ? "SOURCE_TIMEOUT"
        : error instanceof SourceError ? error.code
        : phase === "fetch" ? "SOURCE_FETCH_ERROR"
        : phase === "read" ? "SOURCE_READ_ERROR" : "SOURCE_UNAVAILABLE";
      observations.push({ id: source.id, name: source.name, url: source.url, status: "unavailable", last_attempt_at: new Date(now).toISOString(), reason_code: reasonCode, ...(httpStatus === null ? {} : { http_status: httpStatus }) });
    } finally { clearTimeout(timer); }
  }
  const candidates = [];
  const seen = new Set();
  const limit = DISCOVERY_WINDOW_SIZE * SOURCES.length;
  // Round robin prevents the first large feed crowding out the second source.
  for (let index = 0; candidates.length < limit && pools.some(pool => index < pool.candidates.length); index++) {
    for (const pool of pools) {
      const proxy = pool.candidates[index];
      if (!proxy) continue;
      const key = `${proxy.host}\n${proxy.port}\n${proxy.secret}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const id = await candidateId(proxy);
      candidates.push({ ...proxy, id, source_id: pool.source.id, source_seen_at: now });
      if (candidates.length >= limit) break;
    }
  }
  return { candidates, observations };
}
