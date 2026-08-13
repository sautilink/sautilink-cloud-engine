# Architecture

SSL tool: `src/tools/ssl/*` → `functions/api/ssl.js`. Uses `fetch` only; no Node `tls`. Certificate properties are explicitly unsupported on this runtime.
