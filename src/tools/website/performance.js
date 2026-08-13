/**
 * Server/request-level performance only — not Lighthouse / CWV.
 */
export function analyzePerformance(fetchResult) {
  return {
    label: "server/request-level performance",
    responseTimeMs: fetchResult.responseTimeMs,
    status: fetchResult.status,
    contentType: fetchResult.contentType,
    contentLength: fetchResult.contentLength,
    bodySizeBytes: fetchResult.bodyBytes,
    truncated: Boolean(fetchResult.truncated),
    protocol: fetchResult.protocol,
    redirected: fetchResult.redirected,
    redirectCount: fetchResult.redirectCount,
  };
}
