# Security

`/api/audit` applies the same `prepareUrl` + `assertUrlSafeToFetch` gate before fan-out. Private/localhost targets return 403 without launching analyzers.
