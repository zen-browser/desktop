# Stage 2 Pause Note

Stage 2 is not cancelled. It is parked when runner capacity is the active blocker.

## Why Stage 2 Is Paused

The repo has already proven lightweight cross-platform source checks. The remaining Stage 2 work requires full Linux and Windows browser builds, which are expensive and runner-dependent.

Prior Linux attempts reached real Firefox/Zen compile work. The failures so far have not proven a Nevai source bug.

## What Is Safe To Do While Paused

- product roadmap cleanup
- public-alpha documentation
- release note templates
- privacy and attribution drafts
- issue workflow cleanup
- signing/update strategy planning
- mobile repo planning

## What Is Not Safe To Claim

- Stage 2 complete
- Linux artifact complete
- Windows artifact complete
- cross-platform alpha ready
- public release ready

## Resume Criteria

Resume Stage 2 when one of these is available:

- a GitHub-hosted runner completes the Linux build
- a stronger Linux runner is available
- a Windows discovery/import result is available
- a Windows cross-compile path is selected from the existing release workflow

## Resume Commands

Linux:

```bash
gh workflow run nevai-linux-discovery.yml \
  --repo ali-ezz/nevai-browser-desktop \
  --ref nevai/stage2-linux-discovery
```

Windows import discovery:

```bash
gh workflow run nevai-windows-real-build-discovery.yml \
  --repo ali-ezz/nevai-browser-desktop \
  --ref nevai/stage2-linux-discovery \
  -f scope=through-import
```

Windows full build discovery:

```bash
gh workflow run nevai-windows-real-build-discovery.yml \
  --repo ali-ezz/nevai-browser-desktop \
  --ref nevai/stage2-linux-discovery \
  -f scope=full-build
```
