.PHONY: help ship cleanup prune status infra-up infra-down infra-ps

help:
	@printf "%s\n" "Targets:" \
		"  infra-up   - Start local infra (docker compose)" \
		"  infra-down - Stop local infra (docker compose)" \
		"  infra-ps   - Infra status (docker compose)" \
		"  ship    - Session-end workflow (git pull --rebase, bd sync, git push, status)" \
		"  cleanup - Safe cleanup (prune remote-tracking branches, show stashes)" \
		"  status  - Repo status summary"

infra-up:
	@docker compose up -d

infra-down:
	@docker compose down

infra-ps:
	@docker compose ps

ship:
	@git pull --rebase
	@bd sync
	@git push
	@git status -sb

cleanup: prune
	@git stash list || true

prune:
	@git remote prune origin

status:
	@git status -sb
	@git stash list || true
