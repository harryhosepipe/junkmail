# Web Boundary

## Owns

- Frontend pages/components/layouts and browser-side user flows.
- Consumption of API contracts for uploads, matchups, votes, and presentation.

## Invariants

- Web reads runtime config only through web env loader/astro config.
- UI assumes stable API response contracts and handles empty/error states.

## Depends on

- Astro + Svelte runtime and routing.
- API backend endpoints and asset proxy routes.

## Does not own

- Domain/business invariants for voting/image lifecycle.
- Persistence schema and backend state transitions.
- Queue/worker processing behavior.

## Tradeoffs

- Keeps frontend thin and contract-driven to reduce coupling to backend internals.
- Some contract assumptions are hardcoded and should evolve with shared DTO docs.
