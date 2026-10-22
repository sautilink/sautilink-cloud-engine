/** Keep feed provenance in the monitor store, outside the public directory. */
export function publicDirectoryView(snapshot) {
  const { sources, proxies, discovery, ...fields } = snapshot;
  const feeds = Array.isArray(sources) ? sources : null;
  const lastFetched = feeds?.map(feed => Date.parse(feed.last_fetched_at))
    .filter(value => Number.isFinite(value) && value > 0).sort((a, b) => b - a)[0];
  const summary = feeds ? {
    feeds: feeds.length,
    available: feeds.filter(feed => feed.status === "ok").length,
    last_fetched_at: lastFetched ? new Date(lastFetched).toISOString() : null,
  } : {
    feeds: count(discovery?.feeds),
    available: Math.min(count(discovery?.available), count(discovery?.feeds)),
    last_fetched_at: validTimestamp(discovery?.last_fetched_at),
  };
  return {
    ...fields,
    discovery: summary,
    proxies: (Array.isArray(proxies) ? proxies : []).map(row => {
      if (!row || typeof row !== "object") return row;
      const { source, ...proxy } = row;
      return proxy;
    }),
  };
}

function count(value) { return Number.isInteger(value) && value >= 0 && value <= 100 ? value : 0; }
function validTimestamp(value) {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time > 0 ? new Date(time).toISOString() : null;
}
