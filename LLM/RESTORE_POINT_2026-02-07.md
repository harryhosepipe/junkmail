# Restore Point - 2026-02-07

This repository has a remote backup of `main` at:

- Commit: `def327b06ed2a215a784868ba3b29b674618a85d`
- Backup branch: `backup/main-2026-02-07`
- Backup tag: `backup-main-2026-02-07`

## Verify Backup Exists

```bash
git fetch origin --tags
git branch -r | rg 'backup/main-2026-02-07'
git tag | rg '^backup-main-2026-02-07$'
```

## Restore `main` to This Exact Point

Warning: this rewrites `main` history on the remote.

```bash
git checkout main
git fetch origin --tags
git reset --hard backup/main-2026-02-07
git push --force-with-lease origin main
```

## Alternative Restore Using Tag

```bash
git checkout main
git fetch origin --tags
git reset --hard backup-main-2026-02-07
git push --force-with-lease origin main
```

## Safer Non-Destructive Recovery

If you do not want to force-push `main`, create a new recovery branch:

```bash
git checkout -b recovery/from-backup-main-2026-02-07 backup/main-2026-02-07
git push -u origin recovery/from-backup-main-2026-02-07
```
