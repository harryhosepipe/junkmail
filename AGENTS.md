# Repository Guidelines

## Project Structure & Module Organization

This is a Bun workspace monorepo:

- `web/`: Astro + Svelte frontend (`src/pages`, `src/components`, `src/lib`, `src/styles`).
- `api/`: Hono API, BullMQ worker, and Vitest tests (`src/routes`, `src/services`, `src/queue`, `src/**/*.test.ts`).
- `convex/`: Convex schema/functions and generated client types.
- `packages/config/`: Shared env loading and schema (`@repo/config`).
- `infra/`: Local infrastructure config (`docker-compose`, Caddy, cloudflared).
- `tools/`: Utility scripts (for example `tools/check-env-guardrails.mjs`).

## Build, Test, and Development Commands

- `bun run dev`: Start full local stack (Docker infra + API + web + worker).
- `bun run dev:infra`: Start only infra containers.
- `bun run dev:apps`: Start only app processes on host.
- `bun run dev:infra:init-storage`: Initialize MinIO bucket after first startup/reset.
- `bun run check`: Prettier, ESLint, env guardrails, and typechecks across workspaces.
- `bun run test`: Run API tests (Vitest).
- `bun run fmt`: Format the repo with Prettier.
- `bun run convex:codegen` / `bun run convex:check`: Refresh and validate Convex integration.

## Coding Style & Naming Conventions

- Language: TypeScript ESM across packages.
- Formatting: Prettier (`singleQuote: false`, `semi: true`, `trailingComma: all`, `printWidth: 100`).
- Linting: ESLint 9 flat config (`eslint.config.cjs`).
- Indentation: follow Prettier defaults (2 spaces).
- Naming: use descriptive file names by domain (`submitVote.ts`, `borderCrop.ts`); tests use `*.test.ts`.

## Testing Guidelines

- Framework: Vitest (`api` workspace).
- Location/pattern: co-locate tests under `api/src/**` with `*.test.ts`.
- Run locally: `bun run test` or `bun --cwd api test`.
- For route/service changes, add or update focused tests near the changed module.

## Commit & Pull Request Guidelines

- History favors short, imperative commit subjects, often Conventional Commit style (`refactor: ...`, `chore: ...`, `fix: ...`).
- Keep commits scoped and reviewable; avoid mixing infra, API, and UI refactors in one commit.
- PRs should include:
  - clear problem/solution summary,
  - linked issue or task ID,
  - test evidence (`bun run test`, `bun run check`),
  - screenshots/video for UI changes in `web/`.

<!-- BEGIN BEADS INTEGRATION -->

## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs with git:

- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

<!-- END BEADS INTEGRATION -->
Use 'bd' for task tracking
