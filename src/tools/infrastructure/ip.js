/**
 * IP and reverse-DNS helpers built on the existing DNS engine.
 */

import { prepareDomain, lookupDns } from "../dns/index.js";
import {
  parseIPv4,
  parseIPv6,
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6,
} from "../../utils/ip.js";

function fail(code, message) {
  throw { code, message };
}

export function preparePublicIp(input) {
  if (input === undefined || input === null || typeof input !== "string") {
    return { error: { code: "MISSING_IP", message: "Please provide an IP address." } };
  }

  let ip = input.trim().toLowerCase();
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
  if (!ip) return { error: { code: "MISSING_IP", message: "Please provide an IP address." } };

  const v4 = parseIPv4(ip);
  if (v4 != null) {
    if (isPrivateOrReservedIPv4(ip)) {
      return { error: { code: "PRIVATE_ADDRESS_BLOCKED", message: "Private or reserved IP addresses are not supported." } };
    }
    return { ip, version: 4 };
  }

  const v6 = parseIPv6(ip);
  if (v6) {
    if (isPrivateOrReservedIPv6(ip)) {
      return { error: { code: "PRIVATE_ADDRESS_BLOCKED", message: "Private or reserved IP addresses are not supported." } };
    }
    return { ip, version: 6 };
  }

  return { error: { code: "INVALID_IP", message: "Please provide a valid public IPv4 or IPv6 address." } };
}

export function reverseDnsName(ipInput) {
  const prepared = preparePublicIp(ipInput);
  if (prepared.error) return prepared;

  if (prepared.version === 4) {
    return {
      ip: prepared.ip,
      version: 4,
      reverseName: `${prepared.ip.split(".").reverse().join(".")}.in-addr.arpa`,
    };
  }

  const parts = parseIPv6(prepared.ip);
  const expanded = parts.map((part) => part.toString(16).padStart(4, "0")).join("");
  return {
    ip: prepared.ip,
    version: 6,
    reverseName: `${expanded.split("").reverse().join(".")}.ip6.arpa`,
  };
}

export async function reverseDnsLookup(ipInput) {
  const reverse = reverseDnsName(ipInput);
  if (reverse.error) fail(reverse.error.code, reverse.error.message);

  const dns = await lookupDns(reverse.reverseName, ["PTR"]);
  return {
    ip: reverse.ip,
    version: reverse.version,
    reverseName: reverse.reverseName,
    hostnames: dns.records.PTR || [],
  };
}

export async function lookupIp(queryInput) {
  if (queryInput === undefined || queryInput === null || typeof queryInput !== "string" || !queryInput.trim()) {
    fail("MISSING_QUERY", "Please provide a public domain or IP address.");
  }

  const raw = queryInput.trim();
  const directIp = preparePublicIp(raw);
  if (!directIp.error) {
    const reverse = await reverseDnsLookup(directIp.ip);
    return {
      kind: "ip",
      query: raw,
      ip: directIp.ip,
      version: directIp.version,
      reverse,
    };
  }

  // If it looks like an IP literal but failed validation, preserve the specific IP error.
  if (/^[0-9a-f:.\[\]]+$/i.test(raw) && (raw.includes(":") || /^\[?\d/.test(raw))) {
    fail(directIp.error.code, directIp.error.message);
  }

  const domain = prepareDomain(raw);
  if (domain.error) fail(domain.error.code, domain.error.message);

  const dns = await lookupDns(domain.domain, ["A", "AAAA"]);
  return {
    kind: "domain",
    query: raw,
    domain: domain.domain,
    ipv4: dns.records.A || [],
    ipv6: dns.records.AAAA || [],
  };
}
