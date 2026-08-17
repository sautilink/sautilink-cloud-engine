# SautiLink Cloud Engine Web Experience

## Product role

The web experience is the flagship SautiLink Cloud Engine surface. Telegram remains a companion client for fast, guided checks. Both interfaces consume the same Cloud Engine analyzer APIs and must not fork scoring, SSRF, validation, or diagnostic contracts.

## Web-first capabilities

The web may expose capabilities that are impractical in chat, including:

- richer visual reports and longer findings
- multi-tool workflows
- comparison views
- exports and printable reports
- saved workspaces when an explicit privacy model is approved
- broader tool coverage than the Telegram client

Telegram does not need to mirror every web-only feature.

## Phase 8A foundation

Phase 8A turns the homepage from a marketing/tool-directory page into a workspace shell:

- Full Audit command bar as the primary entry point
- quick-launch shortcuts for live diagnostics
- searchable tool catalog
- live engine health indicator
- browser-local recent targets, limited to five entries
- explicit Web + Telegram product positioning
- responsive mobile-first layout using the Cloud Engine Manrope typography contract

### Browser-local recent targets

Recent targets are stored only in browser `localStorage` under `sautilink.cloudengine.recentTargets.v1`.

- maximum five targets
- clearable from the homepage
- no server-side durable write
- not part of the Telegram preference profile
- failure or denial of local storage never blocks diagnostics

## Phase 8B Full Audit workspace

The Full Audit page is the primary detailed report surface for the web product. It presents the existing `/api/audit` response as an interactive workspace without adding extra analyzer calls when the user changes views or filters.

The workspace includes:

- unified score gauge, grade, audited target and execution summary
- priority issue, recommendation, analyzer-health and duration metrics
- category drill-down for Security, SEO, Mobile, Infrastructure, Email, HTTPS and Technical scoring
- Overview, Findings, Recommendations and Analyzers report tabs
- client-side finding severity filters for error, warning, info and success signals
- category-scoped findings and recommendations using the categories already returned by `/api/audit`
- analyzer status cards showing execution state, duration and sanitized analyzer error information
- copyable audit URL that re-runs the same public target rather than storing a report snapshot
- the same browser-local recent-target key used by the Phase 8A homepage
- responsive layout optimized for desktop, tablet and small mobile screens

### Phase 8B boundaries

- changing category, report tab or severity filter performs no additional network request
- the analyzer orchestrator, scoring model, category weights, SSRF checks, deadlines and API contract remain server-owned and unchanged
- no report history or diagnostic snapshot is persisted server-side in Phase 8B
- the copied audit link contains only the public target URL and causes a fresh audit when opened
- analyzer errors shown in the web report are limited to target-facing error code/message data already returned by the audit API

## Phase 8C Compare + Export v1

Phase 8C adds web-only productivity tools to the Full Audit workspace without creating a server-side report store.

### Comparison

- the current Full Audit response remains the primary report in browser memory
- the user may explicitly run one fresh `/api/audit` request for a second public target
- unified and category scores are compared side by side
- score deltas are calculated in the browser as comparison minus primary
- priority issue and recommendation counts are summarized for both targets
- the comparison target is added only to the existing browser-local recent-target list
- comparison state is not persisted server-side

### Export

- JSON export contains the current in-memory audit response plus export metadata
- CSV export contains the target, unified score and category-level summary fields
- exports are generated with browser `Blob` APIs and are not uploaded to SautiLink storage
- Print / Save PDF uses the browser print flow and a report-focused print stylesheet
- export actions do not re-run the primary audit

### Phase 8C boundaries

- no `/api/reports`, history table, saved-report table or durable comparison record is introduced
- no database schema change is required
- the comparison action is the only additional audit request and happens only after explicit user action
- analyzer, scoring, SSRF, deadline, authorization and Telegram preference behavior remain unchanged

## Phase 8D Focused DNS & Email Tools

Phase 8D turns capabilities that already exist inside the DNS and email engines into first-class standalone web tools:

- MX Record Checker
- SPF Checker
- DMARC Checker
- DKIM Checker
- Nameserver Lookup

The five pages share one browser renderer and one responsive stylesheet. They are deliberately focused: each page explains only the selected protocol, presents only the relevant result fields, and links back to the broader Email Infrastructure Checker or DNS Lookup when a wider investigation is needed.

### Focused email orchestration

The standalone MX, SPF, DMARC, and DKIM pages call `/api/email-check` with a strict `check` allowlist. That route does not clone the analyzer implementations. Instead it invokes the existing MX/SPF/DMARC/DKIM modules and performs only the DNS query work needed for the selected check.

- MX requests MX records only
- SPF requests TXT records for the domain only
- DMARC requests TXT records at `_dmarc.<domain>` only
- DKIM checks the supplied selector or uses the existing bounded heuristic selector discovery
- Nameserver Lookup continues to use the existing `/api/dns` response and reads only its NS result in the focused web UI

This avoids making a simple MX lookup execute the full email-security suite just to render one card.

### Phase 8D boundaries

- no duplicate scoring model is introduced
- the existing full `/api/email` endpoint remains unchanged
- no report history, user profile, saved target, or database schema is added
- public UI remains SautiLink-first and does not expose provider-specific infrastructure
- DKIM remains DNS public-key inspection; it does not claim to verify a signature from a specific message

## Web ↔ Telegram bridge

The signed handoff bridge remains planned, but implementation is deferred while Telegram feature work is intentionally paused. When Telegram development resumes, the bridge should use short-lived, signed handoff identifiers; an opaque representation may be used internally, but raw diagnostic state or sensitive values must never be placed in Telegram callback data.

Proposed flow:

1. A user runs a diagnostic in Web or Telegram.
2. The originating client requests a short-lived handoff identifier from Cloud Engine.
3. The identifier references only a minimal, allowlisted handoff payload and expires quickly.
4. The receiving channel redeems it through Cloud Engine and continues the workflow.
5. Analyzer behavior remains server-defined and shared between both channels.

The handoff must not expose SautiLink infrastructure, secrets, provider details, internal topology, or arbitrary callback payloads.

## Product boundaries

- Web is allowed to be more capable than Telegram.
- Telegram remains useful even when the web adds richer workflows.
- Neither channel owns analyzer truth; Cloud Engine APIs do.
- Provider-specific SautiLink architecture is not part of normal public UX.
- Technical information about the inspected target may remain visible when useful.
