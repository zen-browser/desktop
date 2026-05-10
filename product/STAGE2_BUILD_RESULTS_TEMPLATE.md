# Stage 2 Build Results Template

Use this template when pasting Linux or Windows build output back to Codex.

## Platform

- OS:
- OS version:
- CPU architecture:
- Machine type: local / VM / GitHub Actions / other
- Free disk before build:
- Shell:

## Branch And Commit

```bash
git status --short --branch
git log --oneline -3
```

## Commands Run

```bash
./scripts/check-nevai-stage2-source.sh
npm ci
npm run download
npm run bootstrap
npm run import
npm run surfer -- build --skip-patch-check
```

## Result

- Passed source smoke: yes/no
- Passed npm install: yes/no
- Passed download: yes/no
- Passed bootstrap: yes/no
- Passed import: yes/no
- Passed build: yes/no
- Artifact/output directory exists: yes/no

## First Failure

Command:

```text
paste command here
```

First error block:

```text
paste first meaningful error here
```

Last 80 lines:

```text
paste last 80 lines here
```

## Notes

- Did updater appear enabled?
- Any visible `Nightly` branding?
- Any visible user-facing `Zen` branding?
- Any actor load errors?
- Any platform identity issues?
