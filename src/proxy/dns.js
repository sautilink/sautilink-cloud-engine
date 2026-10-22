import { checkHostnameBlocked } from "../tools/http-status/ssrf.js";
import { isBlockedIpLiteral, parseIPv4, parseIPv6 } from "../utils/ip.js";
import { readLimitedText } from "./sources.js";

function failure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

/** Resolve once, then the protocol layer connects to the validated literal IP. */
export async function resolveProxyHost(host, { fetchFn = fetch, signal } = {}) {
  if (signal?.aborted) throw failure("DNS_TIMEOUT");
  if (checkHostnameBlocked(host).blocked) throw failure("PRIVATE_ADDRESS_BLOCKED");
  if (parseIPv4(host) !== null || parseIPv6(host)) return [host];
  for (const type of [1, 28]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    try {
      const url = new URL("https://cloudflare-dns.com/dns-query");
      url.searchParams.set("name", host);
      url.searchParams.set("type", String(type));
      const response = await fetchFn(url, { headers: { Accept: "application/dns-json" }, signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal, redirect: "error" });
      if (!response.ok) throw failure("DNS_UNAVAILABLE");
      const data = JSON.parse(await readLimitedText(response, 65_536));
      if (data.Status === 3) return [];
      if (data.Status !== 0) throw failure("DNS_UNAVAILABLE");
      const addresses = (Array.isArray(data.Answer) ? data.Answer : [])
        .filter(answer => answer.type === type && typeof answer.data === "string")
        .map(answer => answer.data.replace(/\.$/, ""));
      if (addresses.some(ip => isBlockedIpLiteral(ip) || (parseIPv4(ip) === null && !parseIPv6(ip)))) throw failure("PRIVATE_ADDRESS_BLOCKED");
      if (addresses.length) return [...new Set(addresses)].slice(0, 8);
    } catch (error) {
      if (error?.name === "AbortError") throw failure("DNS_TIMEOUT");
      throw error?.code ? error : failure("DNS_UNAVAILABLE");
    } finally { clearTimeout(timer); }
  }
  return [];
}
