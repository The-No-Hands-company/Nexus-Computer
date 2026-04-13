# Nexus Systems Way Blueprint

This document turns the cloud-computer concept into a build strategy for Nexus Computer.

## Product Thesis

Nexus Computer is not "Zo clone but cheaper".
It is a sovereign personal AI computer that is:

- Owned by the user
- Verifiable in behavior
- Portable across hosts and providers
- Useful for daily work from day one

## The Nexus Systems Way

These are the product rules that should guide every feature decision.

1. Ownership over convenience
- Data in open formats.
- Full export/import path for files, settings, sessions, and automations.
- No lock-in architecture.

2. Privacy as default behavior
- Minimal telemetry.
- Local-first storage patterns.
- Clear permission boundaries for risky tools and actions.

3. Verifiable AI actions
- Every tool call should be logged with intent, input summary, result, and timestamp.
- Users should be able to answer: what happened, why, and what changed.

4. Calm power UX
- Fast feedback while work runs.
- Fewer magic behaviors.
- Clear system status, health, and recovery paths.

5. Open core, community leverage
- Public roadmap and voting loop.
- Plugin and skill model that is simple to review and share.

## Strategic Positioning

Nexus should win on trust and control, not hype.

- Zo style platforms: polished, managed experience.
- VPS + DIY agents: total control, high complexity.
- Nexus: managed-feeling UX plus real ownership and auditability.

## Current Foundation (Already Present)

- Streaming chat and tool execution loop.
- Workspace file APIs with path traversal safety.
- Search endpoint and file explorer.
- Session, account, plugin, and feature-request primitives.

This means the base shell is in place. The next step is to make it durable for real operator workflows.

## Architecture Direction

### 1. AI Provider Router (sovereign by design)

Goal: one interface, many providers, no product lock-in.

- Introduce provider adapters (Anthropic, OpenAI-compatible, local model gateway).
- Keep one internal message and tool-call schema.
- Add per-session model and provider selection.

### 2. Action Ledger (auditability)

Goal: every AI action is inspectable.

- Persist structured records for tool use:
  - run_id
  - session_id
  - user prompt summary
  - tool name
  - input (redacted where needed)
  - result status
  - duration
  - file/process diffs when available
- Expose via API and UI timeline.

### 3. Snapshots and Restore (safety)

Goal: fearless execution.

- Snapshot workspace + Nexus metadata.
- Restore by snapshot id.
- Surface diff preview before destructive restore.

### 4. Background Job Engine (always-on value)

Goal: make 24/7 automation real.

- Add job definitions, schedules, run history, and retry policy.
- Notify in-app first; optional external channels later.

### 5. Policy and Permission Layer (trust)

Goal: constrain destructive behavior by policy, not luck.

- Policy modes: monitor, confirm, allow.
- Rules by tool class and path scope.
- Explicit confirmations for delete, overwrite, external network operations.

## 90-Day Execution Plan

### Phase 1 (Weeks 1-3): Trust and Safety Core

Deliverables:
- Action ledger
- Snapshot/restore API
- Basic permission policy checks

Exit criteria:
- User can inspect recent agent actions.
- User can restore workspace from snapshot.
- Destructive actions require explicit policy allowance.

### Phase 2 (Weeks 4-6): Sovereign Model Layer

Deliverables:
- Provider abstraction
- Session-level model/provider config
- Fallback routing strategy

Exit criteria:
- Same chat flow works across at least two providers.
- Provider change requires no UI or endpoint changes.

### Phase 3 (Weeks 7-9): Always-On Workflows

Deliverables:
- Scheduled jobs
- Run history and retry controls
- Lightweight notification center

Exit criteria:
- User can schedule and monitor autonomous tasks.
- Failures are visible with enough context to recover.

### Phase 4 (Weeks 10-12): Community and Extensibility

Deliverables:
- Plugin runtime contract v1
- Plugin permission manifest
- Public roadmap + release notes discipline

Exit criteria:
- Third-party plugin can be installed with transparent permissions.
- Community requests map to shipped increments.

## First Sprint (Start Here)

Objective: ship safety and trust improvements without breaking current UX.

1. Add action ledger backend
- Create .nexus/actions.jsonl append-only log.
- Log each tool_use and tool_result event.
- Add GET /api/actions with pagination.

2. Add snapshots API
- POST /api/snapshots create
- GET /api/snapshots list
- POST /api/snapshots/{id}/restore

3. Add policy enforcement for file operations
- Add policy config in .nexus/policy.json.
- Enforce in write/delete endpoints and agent tool execution.

4. Surface trust UI
- Add an "Actions" panel with recent events and statuses.
- Add snapshots controls in account/system panel.

## File-Level Implementation Map

- backend/main.py
  - Add actions and snapshots endpoints.
  - Add policy read endpoint.

- backend/agent.py
  - Add event logging wrapper around tool execution.
  - Attach run_id and session context.

- backend/tools.py
  - Enforce policy in write and delete operations.
  - Reuse safe path guard for policy scope checks.

- frontend/src/App.jsx
  - Add Actions panel to workspace layout.

- frontend/src/components/
  - Add ActionsPanel.jsx and SnapshotPanel.jsx.

## Success Metrics

Track weekly:

- Reliability: failed tool calls per 100 actions
- Trust: percentage of actions with complete ledger metadata
- Recovery: average time to recover from bad run (with snapshots)
- Portability: time to migrate workspace to new host
- Community responsiveness: median days from top-voted request to shipped iteration

## Non-Negotiables

- No paywall on core ownership features (export, snapshots, policy controls)
- No hidden telemetry
- No opaque AI actions
- No locked formats for user data
