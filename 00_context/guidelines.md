# Maintainable Code Guidelines

These guidelines are the “governing rules” for how we structure code so it stays easy to change as the product evolves.

## Core goals

We optimize for:
- **Safe change** (behavior changes without breaking unrelated areas)
- **Low coupling / controlled dependencies**
- **Clear context** (why the code exists, what constraints it obeys)
- **Small blast radius** (a change should touch as few places as possible)
- **Optionality** (low-cost pathways to evolve architecture without overengineering)

---

## 1) Design for change by controlling blast radius

### Rule: Don’t “future-proof.” Contain change.
You can’t predict the future. Instead, prevent assumptions from leaking everywhere.

**Red flags (blast radius too big):**
- A change requires edits across UI + domain + persistence + random helpers + jobs + reports
- A third-party concept (e.g., vendor IDs, vendor nouns) appears across your core codebase
- “It’s complex” is used to excuse what is actually coupling

**Target state:**
- Integrations are **localized** to a narrow area (adapter/facade at the edge)
- Core concepts remain **yours**, not the vendor’s
- Domain logic and workflows remain stable when vendors change

---

## 2) Separate models: domain ≠ persistence ≠ API

### Rule: Your **domain model** is not your DB schema and not your HTTP resource model.
- The **domain model** expresses business concepts and invariants.
- The **data model** stores facts efficiently and reliably.
- The **resource model** is a public representation for clients.

**Guideline:**
- Avoid letting persistence or API shapes dictate your core domain objects.
- Avoid leaking internal IDs/fields from third parties into your domain and public API.

---

## 3) Define ownership: one authority per state

### Rule: Every piece of state has an owner.
Only the owning boundary/module is allowed to change its state.

**Why:**
- Prevents “How did we even get into this state?” incidents.
- Ensures data consistency and valid transitions.

**Practice:**
- Expose a clear **contract** (API/module interface) with:
  - **Commands** (state changes)
  - **Queries** (read-only lookups)

**No free-for-all:**
- No “any module can update any table/entity anytime”
- No “shared mutable” domain data across unrelated modules

---

## 4) Be explicit: prefer workflows and verbs over CRUD

### Rule: Make behavior obvious from names and boundaries.
CRUD hides intent and forces you to infer “why” from changed data.

**Prefer:**
- `DispatchOrder`, `RecordPickup`, `MarkPaymentFailed`, `RenewSubscription`
over:
- `UpdateOrder`, `UpdateShipment`, `PatchSubscription`

**Benefits:**
- Clear code navigation
- Easier to derive events and audit trails
- Less accidental coupling between unrelated “updates”

---

## 5) Manage coupling (especially in the AI era)

### Rule: Coupling is the main enemy of long-term change.
AI makes producing code faster, but it also makes creating coupling easier and cheaper—so we must actively constrain it.

**We preserve context by:**
- Clear domain language
- Clear module boundaries
- Constrained dependency directions
- Documented invariants and tradeoffs (see “Context” section)

---

## 6) Avoid useless indirection and premature abstractions

### Rule: Don’t add layers “because best practice.”
Indirection makes code harder to trace and increases cognitive load.

**Abstractions are justified when:**
- They simplify the API surface for a repeated use case
- There are multiple implementations or a strong likelihood of needing them
- They reduce blast radius by localizing change to an edge

**Smell tests (likely useless abstraction):**
- Interface with a single implementation “just in case”
- Generic repository / generic service layers that add no constraints or clarity
- Multiple “pass-through” layers that do little more than rename methods

**Guideline:**
- Start direct and simple.
- Introduce abstractions only when there is demonstrated reuse OR coupling needs to be contained.

---

## 7) Build optionality, not frameworks

### Rule: Provide low-cost options to evolve later without committing upfront.
Optionality is not overengineering: it’s small structural choices that allow evolution.

**Example: synchronous today, async later**
- Design workflow steps so they can be executed in isolation.
- You don’t need Kafka/RabbitMQ on day 1.
- You *do* want code shapes that make moving steps async feasible later.

**Avoid:**
- Building a generic “billing framework” prematurely
- Creating shared libraries that become distributed monolith starter kits

---

## 8) Treat workflows as workflows (not giant procedural blocks)

### Rule: A workflow is multiple steps with failure modes.
If you implement it as one large linear procedure, error handling becomes a maze.

**Guideline:**
- Break workflows into explicit steps.
- Each step should be independently testable.
- Use clear failure handling paths.
- Prefer event-driven or queued execution when it reduces coupling and improves resilience (only when needed).

---

## 9) Project structure guidelines (separation of concerns)

### Rule: Organize by boundaries/features, not technical layers alone.
Either approach can work, but we must preserve boundaries and prevent “everything depends on everything.”

**Recommended approach (feature/boundary first):**
- `src/<boundary>/...`
  - `domain/` (core concepts, invariants)
  - `application/` (use cases: commands/queries)
  - `infra/` (DB, HTTP clients, queues)
  - `ui/` (if applicable)

**Allowed alternatives:**
- A layered structure is OK if boundaries are still enforced (no cross-boundary domain writes).

**Hard rules:**
- Domain should not depend on infrastructure details.
- Third-party SDKs should not be imported in core domain.
- Integration code should be centralized at edges (reduce blast radius).

---

## 10) Environment variables and configuration

### Rule: Configuration must be centralized, typed/validated, and non-duplicated.

**Guideline:**
- One configuration entrypoint (e.g., `config/` or `env.ts`).
- Validate required vars at startup.
- Do not scatter `process.env.X` across the codebase.
- Avoid duplicated variable definitions or subtly different defaults.

**Separation:**
- “Runtime configuration” (env vars) ≠ “application constants” ≠ “feature flags”
- Group configuration by boundary/concern (e.g., `payments`, `email`, `db`).

---

## 11) Duplication rules (what to DRY and what not to)

### Rule: DRY behavior, not incidental structure.
Duplication is sometimes cheaper than premature generalization.

**Prefer duplication when:**
- Two flows look similar but are likely to diverge
- Extracting would create a generic “what-if” abstraction

**Prefer extraction when:**
- A concept is stable and used repeatedly
- The extracted unit reduces coupling and clarifies intent
- The extraction produces a clearer API for a use case

---

## 12) “Context is king” documentation

### Rule: Every non-trivial module should make its context discoverable.
Code is not just syntax—it encodes tradeoffs.

**Minimum expectations:**
- Each boundary/module has a short README (or doc comment) stating:
  - What it owns
  - What invariants it enforces
  - What it depends on (and why)
  - Known tradeoffs (what we intentionally did *not* do)

**When adding a new concept:**
- Prefer explicit names reflecting domain language and intent.
- Avoid generic “Manager”, “Helper”, “Processor” when a domain verb/noun exists.

---

## 13) Refactoring strategy: small changes, big results

### Rule: Refactor incrementally and continuously.
We do not attempt a “massive rewrite.” We reduce blast radius step by step.

**Suggested sequence (repeat per boundary):**
1. Identify coupling hotspots (places where change forces many edits)
2. Localize integrations to edges (facades/adapters)
3. Introduce explicit commands/use cases
4. Enforce ownership of state
5. Remove useless indirection
6. Consolidate configuration
7. Add small tests at boundaries/use cases
8. Iterate

---

## 14) Review checklist (use in PRs)

**Blast radius**
- Does this change touch more areas than expected? If yes, why?
- Are we leaking vendor concepts into core code?

**Boundaries + ownership**
- Is the owning module the only writer of its state?
- Are writes performed via explicit commands/use cases?

**Explicitness**
- Are names verbs/actions rather than CRUD updates?
- Does the code tell the story of what happened and why?

**Indirection**
- Did we add an abstraction? If yes: how many real consumers? multiple implementations?
- Can a reader trace the call path without jumping through layers?

**Configuration**
- Are env vars used via a single validated config layer?
- Any duplicated config or defaults?

**Workflow**
- Are failure paths clear and testable?
- Can steps be isolated or made async later if needed?

---

## 15) Practical “smells” to fix over time

- “UpdateX” endpoints/services that hide business intent
- Third-party IDs/nouns sprinkled across domain and API responses
- Generic repositories/services everywhere
- Helper/util dumping grounds used as dependency shortcuts
- Cross-boundary writes or “shared mutable state”
- Long procedural workflows with nested error branches
- Environment variables read from random files throughout the codebase
- “It’s complex” areas that are actually just tightly coupled

---

## Guiding principle

**If change hurts, reduce coupling.  
If code is hard to understand, increase explicitness and context.  
If flexibility is needed, build optionality—not frameworks.**
