#!/usr/bin/env python3
# Simple workflow YAML validator for local sanity checks.

from __future__ import annotations

import glob
import re
from pathlib import Path

import yaml


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    workflows_dir = root / ".github" / "workflows"
    workflow_files = sorted(
        Path(p) for p in glob.glob(str(workflows_dir / "**" / "*.yml"), recursive=True)
    )

    issues: list[tuple[str, str]] = []

    # Common GitHub Actions expression footgun:
    # inputs.release-branch (hyphen) is parsed like subtraction.
    hyphenated_inputs = re.compile(r"\binputs\.[A-Za-z0-9_]+-[A-Za-z0-9_-]+\b")

    for path in workflow_files:
        rel = str(path.relative_to(root)).replace("\\", "/")
        try:
            text = path.read_text(encoding="utf-8")
        except Exception as e:
            issues.append((rel, f"READ_ERROR: {e}"))
            continue

        try:
            data = yaml.safe_load(text)
        except Exception as e:
            issues.append((rel, f"YAML_PARSE_ERROR: {e}"))
            continue

        if not isinstance(data, dict):
            issues.append((rel, "YAML_SCHEMA: top-level document is not a mapping/object"))
            continue

        # NOTE: Many YAML parsers (YAML 1.1) treat the key `on` as boolean true.
        # PyYAML still does this by default, so accept either "on" or True.
        if "on" not in data and True not in data:
            issues.append((rel, "WORKFLOW_SCHEMA: missing top-level 'on'"))

        jobs = data.get("jobs")
        if not isinstance(jobs, dict) or not jobs:
            issues.append((rel, "WORKFLOW_SCHEMA: missing or empty top-level 'jobs'"))
            continue

        for job_id, job in jobs.items():
            if not isinstance(job, dict):
                issues.append((rel, f"JOB_SCHEMA: job '{job_id}' is not a mapping/object"))
                continue

            strat = job.get("strategy")
            if isinstance(strat, dict) and "matrix" not in strat:
                issues.append(
                    (rel, f"JOB_SCHEMA: job '{job_id}' has 'strategy' without required 'matrix'")
                )

        m = hyphenated_inputs.search(text)
        if m:
            issues.append(
                (
                    rel,
                    f"EXPRESSION: uses '{m.group(0)}' (hyphenated input access); use inputs['...']",
                )
            )

    if not issues:
        print("OK: No YAML parse errors or flagged schema issues found.")
        return 0

    print("FOUND_PROBLEMS:")
    for rel, msg in issues:
        print(f"- {rel}: {msg}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

