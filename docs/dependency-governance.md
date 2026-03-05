# Dependency Governance and Security Cadence

This policy defines how we keep dependencies current without destabilizing delivery.

## Scope

- Workspaces: `web`, `api`, `packages/config`, root tooling.
- Sources of truth: `package.json` manifests and `bun.lock`.

## Cadence

- Weekly (automated): Dependabot opens dependency update PRs.
- Weekly (CI): dependency guardrails run on push/PR and on schedule.
- Monthly (manual): dependency maintainer reviews major version candidates and stale allowlist entries.
- Quarterly (manual): full dependency/security review and cleanup of temporary exceptions.

## PR Rules for Dependency Changes

- Keep dependency-only changes isolated from feature work when possible.
- Prefer patch/minor updates first, then major updates with explicit rollout notes.
- Include evidence in PR description:
  - `bun run check`
  - `bun run test`
  - `bun run check:deps`

## Security Review Checklist

For each dependency PR or monthly review:

- Is this dependency still needed?
- Is there a maintained upstream with recent releases?
- Does it add runtime attack surface (network parsing, auth, file I/O, image processing)?
- Are advisories present in `bun audit` output?
- If advisory cannot be fixed immediately:
  - Add a temporary allowlist entry in `.github/security/audit-allowlist.json`.
  - Include `trackingIssue` and `reviewBy` date.
  - Confirm exposure and compensating controls in the linked issue.

## Guardrails

- `bun run check:deps` enforces:
  - high/critical vulnerabilities must be fixed or explicitly allowlisted,
  - allowlist entries must include a reason, tracking issue, and non-expired review date,
  - stale allowlist entries fail CI and must be removed.
- `bun install --frozen-lockfile` is required in CI to ensure lockfile integrity.

## Ownership

- Primary owner: `pablo@renderbros.com`.
- Temporary exceptions must link to a `bd` issue and stay time-boxed.
