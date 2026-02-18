# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `./bin/bd onboard` to get started.

## Quick Reference

```bash
./bin/bd ready              # Find available work
./bin/bd show <id>          # View issue details
./bin/bd update <id> --status in_progress  # Claim work
./bin/bd close <id>         # Complete work (plays ~/.local/bin/play-wav on success)
./bin/bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   ./bin/bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
- After any UI task, ask the user to confirm the UI works as expected before finalizing the session and pushing to GitHub

## Environment Variable Rule (MVP)

- Always define runtime/config variables in env files (`.env.defaults`, `.env.example`, and/or `.env.local`).
- Never hardcode configurable values directly in source when they belong in env.
- For MVP in this project, values do not need to be secret-safe; prefer working defaults in env files so features run end-to-end locally.

## Runtime Parity Rule (General)

- After changing code that executes in any runtime process (API server, worker, container, queue consumer, cron, etc.), you MUST refresh that runtime before behavior testing.
- Do not assume "build succeeded" means the running process is using new code. Verify runtime/source parity explicitly.
- Required parity check before debugging behavior:
  1. Identify the process(es) that execute the changed code.
  2. Restart/recreate/redeploy those process(es) with cache-busting or force-recreate when applicable.
  3. Verify loaded code/config/version from inside the running process (for example: inspect file content, version endpoint, startup log commit hash, or checksum).
  4. Only then run functional tests and interpret results.
- If runtime/source parity is not proven, stop and fix parity first; do not continue feature debugging.

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
./bin/bd ready --json
```

**Create new issues:**

```bash
./bin/bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
./bin/bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
./bin/bd update bd-42 --status in_progress --json
./bin/bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
./bin/bd close bd-42 --reason "Completed" --json
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

1. **Check ready work**: `./bin/bd ready` shows unblocked issues
2. **Claim your task**: `./bin/bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `./bin/bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `./bin/bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs with git:

- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `./bin/bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

<!-- END BEADS INTEGRATION -->
