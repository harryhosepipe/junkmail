# API Convex Adapter Boundary

## Owns

- Typed Convex function references and call wrappers used by the API.
- Normalization of Convex client calls into app-local adapter functions.

## Invariants

- Callers use verb-based adapter functions for state transitions.
- Convex URL/admin key resolution remains centralized in adapter core.

## Depends on

- Convex JS client and generated API contracts.
- API env loader for runtime connection configuration.

## Does not own

- Domain workflow decisions.
- HTTP mapping logic.
- Storage/queue side effects.

## Tradeoffs

- Adapter functions are intentionally explicit to keep callsites readable.
- Backward-compat adapter names were removed after migration to verb commands.
