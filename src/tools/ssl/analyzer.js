import { parseHsts } from "./parser.js";

/**
 * Build structured HTTPS analysis from observable probe data only.
 */
export function analyzeHttpsConfig({
  httpsProbe,
  httpProbe,
  httpsError,
  httpError,
}) {
  const httpsAvailable = Boolean(httpsProbe && !httpsError);
  const finalProtocol = httpsProbe
    ? httpsProbe.protocol
    : httpProbe
      ? httpProbe.protocol
      : null;

  const hsts = parseHsts(httpsProbe ? httpsProbe.hstsRaw : null);

  const redirectAnalysis = analyzeRedirects(
    httpsProbe?.redirectChain || [],
    httpProbe?.redirectChain || []
  );

  // HTTP→HTTPS: from optional HTTP probe
  let httpToHttps = {
    checked: Boolean(httpProbe || httpError),
    redirectsToHttps: false,
    finalProtocol: httpProbe ? httpProbe.protocol : null,
    status: httpProbe ? httpProbe.status : null,
  };
  if (httpProbe) {
    httpToHttps.redirectsToHttps =
      httpProbe.protocol === "https:" ||
      (httpProbe.redirectChain || []).some(
        (h) => h.fromProtocol === "http:" && h.toProtocol === "https:"
      );
  }

  return {
    https: {
      available: httpsAvailable,
      status: httpsProbe ? httpsProbe.status : null,
      statusText: httpsProbe ? httpsProbe.statusText : null,
      finalUrl: httpsProbe ? httpsProbe.finalUrl : null,
      protocol: httpsProbe ? httpsProbe.protocol : null,
      responseTimeMs: httpsProbe ? httpsProbe.responseTimeMs : null,
      error: httpsError
        ? { code: httpsError.code, message: httpsError.message }
        : null,
    },
    httpUpgrade: httpToHttps,
    hsts,
    redirects: redirectAnalysis,
    tlsCertificate: notObservableBlock(),
  };
}

function analyzeRedirects(httpsChain, httpChain) {
  const chain = [...httpChain, ...httpsChain];
  let httpsToHttp = false;
  let httpToHttps = false;
  for (const hop of chain) {
    if (hop.fromProtocol === "https:" && hop.toProtocol === "http:") {
      httpsToHttp = true;
    }
    if (hop.fromProtocol === "http:" && hop.toProtocol === "https:") {
      httpToHttps = true;
    }
  }
  return {
    httpsToHttpDowngrade: httpsToHttp,
    httpToHttpsUpgrade: httpToHttps,
    hopCount: chain.length,
  };
}

/**
 * Explicit unsupported surface for Pages Functions / standard fetch.
 */
export function notObservableBlock() {
  const reason =
    "Cloudflare Pages Functions fetch() does not expose outbound TLS handshake details (certificate, chain, SANs, expiry, TLS version, or cipher) to application code.";
  return {
    observable: false,
    reason,
    properties: {
      issuer: { status: "not_observable", reason },
      subject: { status: "not_observable", reason },
      san: { status: "not_observable", reason },
      notBefore: { status: "not_observable", reason },
      notAfter: { status: "not_observable", reason },
      fingerprint: { status: "not_observable", reason },
      chain: { status: "not_observable", reason },
      tlsVersion: { status: "not_observable", reason },
      cipher: { status: "not_observable", reason },
      hostnameMatch: {
        status: "not_observable",
        reason:
          "Hostname verification is performed by the runtime during fetch, but the result is not exposed as structured certificate data. A successful HTTPS fetch implies the runtime accepted the connection; it is not a full independent audit.",
      },
    },
  };
}
