- Suggest a clear commit message in chat after every implementation.
- Ensure general OS stability after every build.
- Focus on optimization when planning. Every implementation must consider the most efficient long-term options.
- When planning fixes, never fix a single case, focus on fixing the general/broader issue, making sure any similar issues cannot happen again.
- Each UI element should strictly follow the general design & color palette and support all existing themes.
- Always keep the project well organized and structured.
- Always close leftover terminals & processes when done.
- When done implementing a change, always run "npm run import" to look for possible errors and fix them.
- Never blindly replace local files with the upstream without explicit per-file consent.
- After every change, tell the user if a full rebuild, a UI-rebuilt or none are needed to apply the changes.
- Never use "—"; Prefer ";", "," or parenthesis.

## Where new changes and features go

Peppermint is a layer on top of Zen (zen-browser/desktop), which is merged in every day. Zen's files must stay byte-identical to upstream so merges never conflict. Decide where a change goes with this list:

- New feature or new file of any kind: `src/peppermint/<feature>/` (symlinked to `engine/peppermint/`). Give it its own `moz.build` and, if it ships chrome files, a `jar.inc.mn`, then register both in `src/peppermint/moz.build` and `src/peppermint/jar.inc.mn`. Keep existing `resource:///modules/zen/...` URLs; Peppermint-only `moz-src` files use `moz-src:///peppermint/...`.
- Start-up work for a feature: `src/peppermint/common/PeppermintStartup.mjs` (`early()` before the layout, `late(window)` after). Never add start-up code to `ZenStartup.mjs`.
- Tests: `src/peppermint/tests/<suite>/` and list the `browser.toml` in `src/peppermint/tests/moz.build`. Run with `npm test -- <suite> --headless`.
- New pref: `prefs/peppermint/additions.yaml` (or a new yaml file in `prefs/peppermint/`). Changing the default of a Zen or Firefox pref: add the same `name` (and `condition`) to `prefs/peppermint/overrides.yaml`. Never edit `prefs/zen/` or `prefs/firefox/`.
- New or changed English string: `peppermint/locales/en-US/browser/...`, mirroring the path under `locales/en-US/browser/` (message by message; a message with the same id replaces Zen's). Never edit `locales/`. User-visible "Zen" text is rebranded automatically by `peppermint/l10n-rebrand.json`.
- Change to an existing Zen or Firefox file (JS, CSS, XHTML, moz.build, jar, and so on): edit it under `engine/`, then run `npm run pm:record -- <engine path> <feature>`. This stores `peppermint/patches/<feature>/<path>.patch` (binary files go to `peppermint/files/`) and restores Zen's copy. `npm run import` re-applies every overlay patch. Never commit an edit to a Zen file in `src/`.
- New Firefox patch (a new `.patch` file under `src/`): allowed, because it is a new file. Prefer an overlay patch when the target file is also patched by Zen.
- Branding assets: `configs/branding/` (kept on merges). Brand identity fields: `peppermint/identity.json`.
- The only Zen files that may be edited in place are listed in `peppermint/owned-paths.json`. The pre-commit hook (`peppermint/scripts/check-owned.mjs`) and the PR test enforce this, and also reject added exec bits.
- Do not rename internal `gZen*`, `zen.*` or `nsZen*` names; only user-visible brand text changes.

## Branches and upstream merges

- `mine` is the only long-lived branch and the GitHub default. Work on short-lived feature branches and open PRs into `mine`. Releases are built from `mine`.
- Zen is merged in by `.github/workflows/sync-zen-firefox.yml` (daily) or locally with `node peppermint/scripts/sync-upstream.mjs --check-import`. It opens a PR from `sync/upstream-<date>` into `mine`.
- Merge sync PRs with a merge commit, never squash or rebase, so git keeps track of what is already merged.
- If the sync PR reports a failed overlay patch, Zen changed lines Peppermint edits: fix the file under `engine/`, run `npm run pm:record -- <engine path> <feature>`, and push to the sync branch.
- Patches listed in `peppermint/compat-patches.txt` are Zen patches that `npm run import` adapts to the pinned Firefox. After a merge, take Zen's copy and let the import regenerate them.
- `dev` is not used. Do not commit to it.

## Commands

- `npm run import`: ffprefs, dumps, Zen patches (adapted when needed), overlay patches, locale packs. Run after every change.
- `npm run build:ui`: rebuild the UI only. `npm run build`: full rebuild (needed for C++, moz.build or new `.patch` changes).
- `npm test -- <suite> --headless`: run `peppermint/tests/<suite>` or `zen/tests/<suite>`. Suites that leave adblock enabled need network access; pass `--setpref=zen.adblock.enabled=false` to run them offline.
- `npm run pm:record -- <engine path> <feature>`: save an edit to a Zen or Firefox file as an overlay patch.
- `npm run pm:verify`: compare the engine with the snapshot taken before the restructure (differences are expected after intentional changes).
- `npm run lint`: lint `zen` and `peppermint`.
