# SautiLink Cloud Engine Web Experience

## Product role

The web experience is the flagship SautiLink Cloud Engine surface. Telegram remains a companion client for fast, guided checks. Both interfaces consume the same Cloud Engine analyzer APIs and must not fork scoring, SSRF, validation, or diagnostic contracts.

## Web-first capabilities

The web may expose capabilities that are impractical in chat, including:

- richer visual reports and longer findings
- multi-tool workflows
- comparison views
- exports and shareable reports
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

## Web ↔ Telegram bridge

A future bridge should use short-lived, signed handoff identifiers rather than placing raw diagnostic state or sensitive values in Telegram callback data.

Proposed flow:

1. A user runs a diagnostic in Web or Telegram.
2. The originating client requests a short-lived handoff token from Cloud Engine.
3. The token references a minimal, allowlisted handoff payload and expires quickly.
4. The receiving channel redeems the token through Cloud Engine and continues the workflow.
5. Analyzer behavior remains server-defined and shared between both channels.

The handoff must not expose SautiLink infrastructure, secrets, provider details, internal topology, or arbitrary callback payloads.

## Product boundaries

- Web is allowed to be more capable than Telegram.
- Telegram remains useful even when the web adds richer workflows.
- Neither channel owns analyzer truth; Cloud Engine APIs do.
- Provider-specific SautiLink architecture is not part of normal public UX.
- Technical information about the inspected target may remain visible when useful.
