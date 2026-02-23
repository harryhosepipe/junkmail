# Convex Boundary

## Owns

- Runtime data schema and authoritative state transitions for content/voting entities.
- Query/mutation contracts consumed by API adapters.

## Invariants

- Mutation names should express intent (workflow/state transition verbs).
- Entity transitions enforce guards in one owning module per concern.
- Public image states maintain rating projection readiness.

## Depends on

- Convex runtime (`mutation`, `query`, schema, indexes).
- Convex-local env loader for runtime mode validation.

## Does not own

- HTTP contracts and transport behavior.
- API authentication/session policy details.
- Storage object deletion side effects.

## Tradeoffs

- Maintains incremental compatibility aliases where needed in Convex modules.
- Prioritizes explicit transition commands over generic CRUD entrypoints.
