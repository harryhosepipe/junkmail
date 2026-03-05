# API Shared Domain Boundary

## Owns

- Cross-feature domain/result types used by multiple slices.
- Shared domain language independent of HTTP transport.

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

- Shared domain remains minimal; feature-specific types stay in `features/*/domain`.
