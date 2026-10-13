# Peppermint Browser

Peppermint is a Firefox-based browser maintained as a fork of Zen (zen-browser/desktop). It builds with Surfer (`engine/` is the Firefox source, `src/` is copied or symlinked into it). Zen is merged in every day, so Zen's files must stay identical to upstream and everything Peppermint adds lives in its own layer.

## Commands

- `npm run import`: generate prefs, apply Zen patches (adapted to the pinned Firefox when needed), apply Peppermint overlay patches, copy locale packs. Run it after every change and fix any error.
- `npm run build:ui`: rebuild the UI only. `npm run build`: full rebuild (needed for C++, `moz.build` or new `.patch` changes).
- `npm test -- <suite> --headless`: run `peppermint/tests/<suite>` or `zen/tests/<suite>`. Suites that leave adblock enabled need network access; add `--setpref=zen.adblock.enabled=false` to run them offline.
- `npm run pm:record -- <engine path> <feature>`: save an edit to a Zen or Firefox file as an overlay patch.
- `npm run pm:verify`: compare the engine with the pre-restructure snapshot (differences are expected after intentional changes).
- `npm run lint`: lint `zen` and `peppermint`.

## Where new changes and features go

Never edit a file that exists in zen-browser/desktop (except the paths in `peppermint/owned-paths.json`). The pre-commit hook and the PR test reject it, and also reject added exec bits.

- New feature or file: `src/peppermint/<feature>/`, with its own `moz.build` (and `jar.inc.mn` for chrome files), registered in `src/peppermint/moz.build` and `src/peppermint/jar.inc.mn`. Keep existing `resource:///modules/zen/...` URLs; Peppermint-only `moz-src` files use `moz-src:///peppermint/...`.
- Start-up work: `src/peppermint/common/PeppermintStartup.mjs` (`early()` before layout, `late(window)` after). Never touch `ZenStartup.mjs`.
- Tests: `src/peppermint/tests/<suite>/`, listed in `src/peppermint/tests/moz.build`.
- New pref: `prefs/peppermint/additions.yaml`. Changed default of a Zen or Firefox pref: same `name` (and `condition`) in `prefs/peppermint/overrides.yaml`. Never edit `prefs/zen/` or `prefs/firefox/`.
- Strings: `peppermint/locales/en-US/browser/...`, mirroring the path under `locales/en-US/browser/`; a message with the same id replaces Zen's. Never edit `locales/`. User-visible "Zen" text is rebranded by `peppermint/l10n-rebrand.json`.
- Change to an existing Zen or Firefox file: edit it under `engine/`, then `npm run pm:record -- <engine path> <feature>`. This writes `peppermint/patches/<feature>/<path>.patch` (binaries go to `peppermint/files/`) and restores Zen's copy. Never commit such an edit in `src/`.
- Brand assets: `configs/branding/`. Brand identity fields: `peppermint/identity.json`.
- Do not rename internal `gZen*`, `zen.*` or `nsZen*` names; only user-visible brand text changes.

## Branches and upstream merges

- `mine` is the only long-lived branch and the GitHub default. Use short-lived feature branches and PRs into `mine`; releases build from `mine`. `dev` is unused, do not commit to it.
- `.github/workflows/sync-zen-firefox.yml` (daily) or `node peppermint/scripts/sync-upstream.mjs --check-import` merges Zen into `sync/upstream-<date>` and opens a PR into `mine`.
- Merge sync PRs with a merge commit, never squash or rebase.
- A failed overlay patch in a sync PR means Zen changed lines Peppermint edits: fix the file under `engine/`, run `pm:record`, push to the sync branch.
- Patches in `peppermint/compat-patches.txt` are Zen patches rewritten by `npm run import` for the pinned Firefox. After a merge, take Zen's copy and re-run the import.

## Working rules

- Suggest a clear commit message in chat after every implementation.
- Tell the user after every change whether a full rebuild, a UI rebuild or nothing is needed.
- Ensure general OS stability after every build.
- Plan for the most efficient long-term option and fix the general problem, not a single case.
- Every UI element follows the existing design and color palette and supports all themes.
- Keep the project organized. Close leftover terminals and processes when done.
- Never replace local files with upstream versions without explicit per-file consent.
- Never use the em dash character; use ";", "," or parentheses instead.
