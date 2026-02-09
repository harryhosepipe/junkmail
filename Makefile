.PHONY: help ship cleanup prune status

help:
	@printf "%s\n" "Targets:" \
		"  ship    - Session-end workflow (git pull --rebase, bd sync, git push, status)" \
		"  cleanup - Safe cleanup (prune remote-tracking branches, show stashes)" \
		"  status  - Repo status summary"

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
