/**
 * Email infrastructure checker — MX + SPF via shared DoH lookups.
 */

import { prepareDomain, lookupDns } from "../dns/index.js";
import { analyzeMx } from "./mx.js";
import { analyzeSpf } from "./spf.js";

export { prepareDomain };

/**
 * @param {string} input - raw domain query param
 * @returns {Promise<object>} data payload
 * @throws {{ code: string, message: string }}
 */
export async function checkEmailInfrastructure(input) {
  const prepared = prepareDomain(input);
  if (prepared.error) {
    throw {
      code: prepared.error.code,
      message: prepared.error.message,
    };
  }

  const domain = prepared.domain;

  let dnsResult;
  try {
    dnsResult = await lookupDns(domain, ["MX", "TXT"]);
  } catch (err) {
    if (err && err.code === "DNS_RESOLVER_ERROR") {
      throw {
        code: "DNS_LOOKUP_FAILED",
        message: err.message || "Unable to reach the DNS resolver.",
      };
    }
    throw err;
  }

  const mx = analyzeMx(dnsResult.records.MX || []);
  const spf = analyzeSpf(dnsResult.records.TXT || []);

  return {
    domain,
    mx,
    spf,
  };
}
