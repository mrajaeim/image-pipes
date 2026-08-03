---
name: full-release
description: >-
  Run a full release: update CHANGELOG, commit remaining work with incremental
  conventional commits, prepare an annotated v* tag, and give the user manual
  push commands. Use when the user asks to release, cut a version, tag a
  release, sync commits and tags, or update the changelog for a version.
disable-model-invocation: true
---

# Full Release

End-to-end release for this repo: changelog → commits → **manual push** → tag → **manual push tag**.

## Preconditions

Confirm with the user before tagging:

1. **Version** — e.g. `0.2.1` (tag will be `v0.2.1`)
2. **Branch** — usually `main`, clean enough to release

Do **not** move or delete a tag that already exists on the remote / has a GitHub Release. If the release is already cut, bump to the next patch/minor instead.

Follow `.cursor/rules/incremental-commits.mdc` for any commits. Prefer small conventional commits; do not dump unrelated WIP into the release commit.

## Push policy (manual)

**The agent never pushes.** This environment often lacks GitHub SSH/HTTPS credentials.

After commits (and optional local tag), print copy-paste commands for the user. Wait for them to say they pushed, then verify.

## Workflow

Copy and track:

```
Release Progress:
- [ ] 1. Inspect state
- [ ] 2. Update CHANGELOG.md
- [ ] 3. Commit remaining release files
- [ ] 4. Quality gates (if code changed)
- [ ] 5. Create annotated tag locally
- [ ] 6. Give user push commands (commits + tag)
- [ ] 7. After user confirms push — verify
```

### 1. Inspect state

```bash
git status -sb
git fetch origin --tags
git log --oneline origin/main..HEAD
git tag -l "v*"
git describe --tags --abbrev=0
```

If `git fetch` fails (auth), continue with local state and note that remote verification may be limited.

Note uncommitted files, unpushed commits, and whether `vX.Y.Z` already exists locally or on origin.

### 2. Update CHANGELOG.md

Keep a Changelog + SemVer. File: `CHANGELOG.md`.

1. Move `[Unreleased]` notes into a new section:

```markdown
## [Unreleased]

## [X.Y.Z] - YYYY-MM-DD

### Added
### Changed
### Fixed
### Removed
```

2. Write bullets from `git log <previous-tag>..HEAD` (group by Added / Changed / Fixed / Removed / Documentation). Prefer user-facing language over raw commit subjects.
3. Update compare links at the bottom:

```markdown
[Unreleased]: https://github.com/mrajaeim/image-pipes/compare/vX.Y.Z...HEAD
[X.Y.Z]: https://github.com/mrajaeim/image-pipes/releases/tag/vX.Y.Z
[previous]: https://github.com/mrajaeim/image-pipes/releases/tag/vPREV
```

Leave `[Unreleased]` empty (heading only) after cutting the release.

### 3. Commit remaining release files

Commit only what belongs in the release (changelog, version-sync script, workflow tweaks, docs). Use incremental conventional commits, for example:

```text
docs: finalize vX.Y.Z changelog
chore(desktop): sync installer version from git tag
```

Do not stage secrets or unrelated dirty files.

### 4. Quality gates

If backend/frontend code changed in this release slice:

- Backend: `uv run ruff check` and `uv run pytest` from `backend/`
- Frontend: `npm run typecheck` and `npm run lint` from `frontend/`

Skip full gates when the only change is `CHANGELOG.md` / docs.

### 5. Create annotated tag locally

Tag the commit that includes the changelog:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
```

Rules:

- Tag format: `v` + semver (`v0.2.1`)
- Annotated tags only (`-a`)
- Never retag / force-push an existing published tag
- Creating the tag locally is fine; **pushing** it is the user's job

### 6. Give user push commands

Print a ready-to-run block (fill in the real version). Do not run `git push` yourself.

```bash
# Push commits
git push -u origin HEAD

# Push tag (triggers desktop release CI)
git push origin vX.Y.Z
```

If the tag was not created yet, include create + push:

```bash
git push -u origin HEAD
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

Tell the user: after pushing, reply so verification can run.

Pushing `v*` triggers `.github/workflows/desktop.yml` (build + GitHub Release). Desktop installer version is synced from the tag inside `scripts/build-desktop.mjs` (`v0.2.1` → `0.2.1`).

### 7. Verify (after user confirms push)

```bash
git status -sb
git log -1 --oneline
git show vX.Y.Z --oneline -s
git fetch origin --tags   # if auth works
```

Report:

- Changelog section version + date
- Commit SHA
- Tag name
- Whether `main` matches `origin/main` (when fetch works)
- Release URL: `https://github.com/mrajaeim/image-pipes/releases/tag/vX.Y.Z`

## Desktop version notes

- `electron-builder` reads `desktop/package.json` `version`
- Tag builds: `scripts/build-desktop.mjs` sets that version from `GITHUB_REF` / nearest tag / `IMAGE_PIPES_VERSION`
- Do **not** hand-edit `desktop/package.json` version for tagged releases unless the user asks

## Anti-patterns

- Agent running `git push` (always manual)
- Force-updating a tag that already has a GitHub Release
- Mixing feature WIP with the release/changelog commit
- Empty or missing changelog section for the new version
- Lightweight tags (`git tag vX.Y.Z` without `-a`)
