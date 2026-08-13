/**
 * Robots.txt Analyzer — public tool module.
 */

import { prepareUrl } from "../http-status/url.js";
import { fetchRobotsTxt, robotsUrlFromSite } from "./fetch.js";
import { parseRobotsTxt } from "./parser.js";
import { analyzeRobots } from "./analyzer.js";
import { calculateRobotsScore } from "./score.js";

/**
 * @param {string} input - site URL
 * @returns {Promise<object>}
 */
export async function analyzeRobotsTxt(input) {
  const prepared = prepareUrl(input);
  if (prepared.error) {
    throw {
      code: prepared.error.code,
      message: prepared.error.message,
      httpStatus: 400,
    };
  }

  const siteUrl = prepared.url;
  const robotsUrl = robotsUrlFromSite(siteUrl);
  const fetchResult = await fetchRobotsTxt(robotsUrl);

  let parsed = null;
  if (fetchResult.found && fetchResult.body != null) {
    parsed = parseRobotsTxt(fetchResult.body);
  }

  const analysis = analyzeRobots(fetchResult, parsed);
  const score = calculateRobotsScore(fetchResult, parsed, analysis);

  return {
    url: siteUrl.origin + "/",
    robotsUrl: fetchResult.robotsUrl,
    finalUrl: fetchResult.finalUrl,
    status: fetchResult.status,
    statusText: fetchResult.statusText,
    responseTimeMs: fetchResult.responseTimeMs,
    redirected: fetchResult.redirected,
    redirectCount: fetchResult.redirectCount,
    robots: {
      found: Boolean(fetchResult.found),
      forbidden: Boolean(fetchResult.forbidden),
      contentType: fetchResult.contentType,
      bodyBytes: fetchResult.bodyBytes || 0,
      groups: parsed ? parsed.groups : [],
      sitemaps: parsed ? parsed.sitemaps : [],
      hosts: parsed ? parsed.hosts : [],
      unknownDirectives: parsed ? parsed.unknownDirectives : [],
      malformedLines: parsed ? parsed.malformedLines : [],
      summary: analysis.summary,
    },
    score,
  };
}
