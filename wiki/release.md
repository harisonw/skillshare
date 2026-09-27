# Changelog and Release

Use when writing a version changelog, release notes, version bump, tag, announcement, or full release.

## Authorization Boundary

A changelog-only request does not authorize commits, tags, pushes, publication, or version bumps. A full release request authorizes preparation and explicitly included local Git actions, but pushing or publishing still requires user confirmation. Never mix unrelated working-tree changes into staging.

## Changelog

1. Determine the range from the requested version or tags, then collect commits with `git log <previous>..<current> --no-merges`.
2. Read the newest two or three `CHANGELOG.md` entries and follow the current style.
3. Categorize user-visible features, bug fixes, performance improvements, and breaking changes. Exclude test-only, CI-only, pure refactoring, and internal implementation noise.
4. Verify every feature claim against source and never fabricate links.
5. Add the entry at the top of `CHANGELOG.md` and insert the same release entry after the frontmatter/intro separator in `website/src/pages/changelog.md`.

Version headings use `[X.Y.Z]` without a `v` prefix and include the date. Feature bullets use a bold name, an em dash, and a real usage example. Create only sections that contain content.

## Full Release

Before starting:

- Confirm the requested version and branch.
- Use `git status` to separate task-owned changes from existing work.
- Run the complete `make check` inside the devcontainer and never skip a failure.

Then:

1. Generate and review the changelog.
2. For maintainer-only release notes, follow the newest `specs/RELEASE_NOTES_*.md` and write user-facing prose to `specs/RELEASE_NOTES_<version>.md`.
3. Verify the current version location from source before bumping it; do not assume a fixed field still exists.
4. Commit or tag only when explicitly requested. Stage only task-owned files and follow recent repository release commits.
5. Draft concise GitHub release notes and a social announcement.
6. Present tests, diffs, local-only artifacts, and commit/tag state; obtain confirmation before pushing or publishing.

Release notes are local maintainer artifacts by default. Never force-add an ignored file unless explicitly requested. Never infer authorization for credentials, registry login, or external publication.

## Verification and Report

Report actual test results, whether both changelog copies match, the verified version location, commit/tag state, and external actions not performed. If the working tree is dirty, list the unrelated changes that were preserved.
