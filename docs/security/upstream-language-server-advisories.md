# Upstream Advisory Tracking: Language-Server Toolchain

This note tracks moderate advisories that currently come from the Astro language-server dependency chain:

- `@astrojs/check` -> `@astrojs/language-server`
- `@astrojs/language-server` -> `volar-service-yaml`
- `volar-service-yaml` -> `yaml-language-server`

Current advisory sources in `bun audit`:

- `ajv` (`GHSA-2g4f-4pwh-qvx6`) via `yaml-language-server` constraints
- `lodash` (`GHSA-xxjr-mmjv-4gpg`) pinned by `yaml-language-server`

## Why this is tracked separately

- We have removed all `high`/`critical` advisories from runtime/developer dependencies.
- These remaining moderates are currently constrained by upstream package ranges in latest published versions.
- Local overrides were tested and are not reliably honored for this chain in Bun lock resolution.

## Automated tracking

Run:

```bash
bun run check:deps:upstream
```

Behavior:

- Exits `0` while upstream is still unresolved.
- Exits `1` when upstream ranges resolve to patched versions (`ajv >= 8.18.0` and `lodash >= 4.17.23`), signaling that dependency/lock refresh work should be done and tracking issue can be closed.

This check is also run weekly in CI by `dependency-guardrails.yml` (schedule/workflow_dispatch path).

## Issue linkage

- Tracking issue: `junkmail-x4i`
