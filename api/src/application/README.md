# API Application Boundary

## Owns

- Orchestration-level use cases that execute workflows (for example image delete and vote submit).
- Coordination across domain/services/infra boundaries without HTTP payload shaping.

## Invariants

- One entrypoint per use case (command/query) for route handlers.
- Use cases express intent as verbs and keep side effects localized.

## Depends on

- `api/src/domain` result types and boundary contracts.
- `api/src/services` for lower-level workflow logic.
- Infra adapters via dedicated modules (for example `api/src/convex`, `api/src/storage`).

## Does not own

- HTTP status codes and response envelope formatting.
- Raw persistence table/schema ownership.
- Third-party SDK client construction.

## Tradeoffs

- Thin use-case wrappers are intentionally explicit even when they currently delegate.
- Some workflows still call legacy service modules and are being incrementally moved.
