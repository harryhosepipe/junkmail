# API Shared Application Boundary

## Owns

- Reusable orchestration logic used by multiple feature slices.
- Cross-feature workflows that should not be owned by a single feature.

## Invariants

- Shared use-cases remain HTTP-agnostic and are imported by feature application modules.
- Shared modules should stay small and move into a feature when they are no longer cross-cutting.

## Depends on

- `api/src/shared/domain` for shared result/entity types.
- `api/src/platform/*` for infra adapters.
- Feature-local modules when ownership is clear.

## Does not own

- HTTP status codes and response envelope formatting.
- Raw persistence table/schema ownership.
- Third-party SDK client construction.

## Tradeoffs

- Shared modules are intentionally limited to avoid recreating a monolithic services layer.
