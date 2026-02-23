# API Domain Boundary

## Owns

- Domain result and entity types used by application workflows.
- Domain language for workflow outcomes independent of HTTP shape.

## Invariants

- Domain models do not include HTTP transport concerns.
- Domain result variants are explicit (`kind`-based) for stable branching.

## Depends on

- TypeScript type system and shared primitives.
- No runtime dependency on infra SDKs.

## Does not own

- Persistence queries/mutations.
- HTTP request/response mapping.
- Queue or storage clients.

## Tradeoffs

- Domain layer is intentionally small and grows with concrete workflow needs.
- Transitional overlap exists while older service return types are migrated.
