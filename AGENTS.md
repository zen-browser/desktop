# Repository Guidelines

## Project Structure & Module Organization
- `src/`: primary application code (TypeScript/JS, UI, and browser logic).
- `engine/`: Firefox engine subtree; used for local runs via `mach`.
- `tests/`: repository-level test assets; additional app tests live under `src/zen/tests/`.
- `scripts/`: Python and shell helpers for syncing, importing, and CI tasks.
- `configs/`, `prefs/`: build and product configuration.
- `locales/`: l10n resources and Crowdin outputs.
- `docs/`: contributor and project documentation.
- `tools/`: auxiliary tooling (e.g., eslint plugin, ffprefs).

## Build, Test, and Development Commands
- `npm run start`: run the browser locally (`engine/mach run --noprofile`).
- `npm run build`: build artifacts via Surfer; `npm run build:ui` builds UI only.
- `npm run init`: download, import, and bootstrap dependencies for a fresh setup.
- `npm run sync`: update Firefox sources; `npm run sync:l10n` updates localization only.
- `npm run test`: run the test suite (`python3 scripts/run_tests.py`).
- `npm run lint`: ESLint + Prettier checks; `npm run lint:fix` applies fixes.

## Coding Style & Naming Conventions
- Indentation: 2 spaces, LF, trim trailing whitespace (see `.editorconfig`).
- Formatting: Prettier for JS/TS and `autopep8` for Python (`npm run pretty`).
- Linting: ESLint (`eslint.config.mjs`); follow existing naming in nearby files.
- TypeScript config is in `tsconfig.json`; prefer typed APIs when available.

## Testing Guidelines
- Default runner: `python3 scripts/run_tests.py` (wrapped by `npm run test`).
- Debug: `npm run test:dbg` enables the JS debugger and stops on failures.
- Place new JS/TS tests near related code (often `src/zen/tests/`) and keep names descriptive.

## Commit & Pull Request Guidelines
- Commit format follows Formal Git: `{type}: {message}, b={bugId}, c={components}`  
  Example: `fix: correct tab restore, b=12345, c=ui`.
- Use `docs/contribute.md` for branch flow (`dev` main, `stable` release, `twilight` feature).
- PRs should include a clear summary, linked issues, and screenshots for UI changes.

## Security & Configuration Tips
- Security reporting guidance lives in `SECURITY.md`.
- Build configuration and presets are under `surfer.json` and `configs/`; avoid ad‑hoc flags.
