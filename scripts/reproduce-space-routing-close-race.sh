#!/usr/bin/env bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
engine="$repo_root/engine"
tabbrowser="$engine/browser/components/tabbrowser/content/tabbrowser.js"
test_path="zen/tests/space_routing/browser_space_routing_click_repro.js"
artifacts="$engine/artifacts/space-routing-close-race"
variant=${1:-both}
headless=${ZEN_REPRO_HEADLESS:-1}

if [[ "$variant" != "baseline" && "$variant" != "fixed" && "$variant" != "both" ]]; then
  echo "usage: $0 [baseline|fixed|both]" >&2
  exit 2
fi
if [[ "$headless" != "0" && "$headless" != "1" ]]; then
  echo "ZEN_REPRO_HEADLESS must be 0 or 1" >&2
  exit 2
fi
if [[ ! -f "$tabbrowser" ]]; then
  echo "missing built engine file: $tabbrowser" >&2
  echo "complete a normal Zen development build first" >&2
  exit 1
fi

browser_args=()
keep_open=0
if [[ "$headless" == "1" ]]; then
  browser_args+=(--headless)
else
  browser_args+=(--keep-open)
  keep_open=1
fi

mkdir -p "$artifacts"
lock_dir="$artifacts/.runner-lock"
if ! mkdir "$lock_dir" 2>/dev/null; then
  lock_pid=$(cat "$lock_dir/pid" 2>/dev/null || true)
  if [[ -n "$lock_pid" ]] && ! kill -0 "$lock_pid" 2>/dev/null; then
    rm -rf "$lock_dir"
    mkdir "$lock_dir"
  else
    echo "another space-routing repro is already running${lock_pid:+ (pid $lock_pid)}" >&2
    exit 1
  fi
fi
printf '%s\n' "$$" > "$lock_dir/pid"

original=$(mktemp "${TMPDIR:-/tmp}/zen-tabbrowser.XXXXXX")
cp "$tabbrowser" "$original"
cleanup() {
  cp "$original" "$tabbrowser"
  rm -f "$original"
  rm -rf "$lock_dir"
}
trap cleanup EXIT INT TERM

prepare_baseline() {
  python3 - "$tabbrowser" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()
fixed = '''      const shouldDeferRoutedTabSelection =
        beforeRouteResult.isRouteFound &&
        beforeRouteResult.targetRoute !== gZenWorkspaces.activeWorkspace &&
        window === Services.wm.getMostRecentWindow("navigator:browser");
      if (!inBackground && !shouldDeferRoutedTabSelection) {
        this.selectedTab = t;
      }
'''
baseline = '''      if (!inBackground) {
        this.selectedTab = t;
      }
'''
if source.count(fixed) != 1:
    raise SystemExit("could not find the routed-tab selection fix exactly once")
source = source.replace(fixed, baseline)

fixed = '''      if (this.selectedTab === aTab) {
        let replacementTab = this.visibleTabs.find(
          tab => tab !== aTab && !tab.closing && tab.linkedBrowser
        );
        if (!replacementTab) {
          replacementTab = this.tabs.find(
            tab => tab !== aTab && !tab.closing && tab.linkedBrowser
          );
        }
        if (replacementTab) {
          this.tabbox.selectedTab = replacementTab;
        }
      }

'''
if source.count(fixed) != 1:
    raise SystemExit("could not find the selected-tab removal fix exactly once")
path.write_text(source.replace(fixed, ""))
PY
}

run_variant() {
  local name=$1
  local log="$artifacts/$name.log"
  local result_file="$artifacts/$name-result.txt"
  rm -f "$log" "$result_file"
  cp "$original" "$tabbrowser"
  if [[ "$name" == "baseline" ]]; then
    prepare_baseline
  fi

  printf 'variant=%s\ncommit=%s\n' \
    "$name" \
    "$(git -C "$repo_root" rev-parse HEAD)" \
    > "$artifacts/$name-environment.txt"
  shasum -a 256 "$tabbrowser" >> "$artifacts/$name-environment.txt"

  echo "Running $name with a fresh browser-chrome harness profile"
  if [[ "$keep_open" == "1" ]]; then
    echo "The browser will remain open with the repro state. Close it or press Ctrl-C here when done."
  fi
  set +e
  (
    cd "$engine"
    env \
      -u AS -u CC -u CXX -u CPP -u LD -u AR -u NM -u RANLIB -u STRIP \
      -u SDKROOT -u MACOSX_DEPLOYMENT_TARGET \
      -u CFLAGS -u CXXFLAGS -u LDFLAGS \
      ZEN_REPRO_KEEP_OPEN="$keep_open" \
      ./mach test "$test_path" "${browser_args[@]}" --timeout 90 --log-tbpl "$log"
  )
  local harness_status=$?
  set -e

  local result
  local fluent_flake=false
  local unexpected_fixed_failure=""
  if grep -Fq "[fluent] Couldn't find a message: menu-bookmark-tab" "$log"; then
    fluent_flake=true
  fi
  if [[ "$name" == "fixed" ]]; then
    unexpected_fixed_failure=$(
      grep -F 'TEST-UNEXPECTED-' "$log" |
        grep -Fv "[fluent] Couldn't find a message: menu-bookmark-tab" |
        grep -Fv ' | finished in ' || true
    )
  fi

  if [[ "$name" == "baseline" ]]; then
    if grep -Fq 'requestedTab.linkedBrowser is null' "$log" &&
       grep -Fq 'Space B retains a selected tab with a live browser - null == true' "$log"; then
      result=reproduced
    else
      result=not-reproduced
    fi
  else
    if ! grep -Fq 'requestedTab.linkedBrowser is null' "$log" &&
       grep -Fq "The routed tab uses Space A's container" "$log" &&
       grep -Fq 'Space B retains a selected tab with a live browser' "$log" &&
       grep -Fq 'AsyncTabSwitcher does not reference a tab without a browser' "$log" &&
       grep -Fq 'Another tab is selectable after returning to Space B' "$log" &&
       ! grep -Fq 'FAIL test_click_route_close_and_return_to_source_space - The routed tab uses' "$log" &&
       ! grep -Fq 'FAIL test_click_route_close_and_return_to_source_space - Space B retains' "$log" &&
       ! grep -Fq 'FAIL test_click_route_close_and_return_to_source_space - AsyncTabSwitcher' "$log" &&
       ! grep -Fq 'FAIL test_click_route_close_and_return_to_source_space - Another tab is selectable' "$log" &&
       [[ -z "$unexpected_fixed_failure" ]]; then
      result=passed
    else
      result=failed
    fi
  fi

  printf 'variant=%s\nresult=%s\nharness_status=%s\nknown_fluent_flake=%s\nheadless=%s\nkeep_open=%s\nlog=%s\n' \
    "$name" "$result" "$harness_status" "$fluent_flake" "$headless" "$keep_open" "$log" \
    > "$result_file"
  echo "$name result: $result (harness status: $harness_status, known Fluent flake: $fluent_flake)"

  [[ "$result" == "reproduced" || "$result" == "passed" ]]
}

case "$variant" in
  baseline)
    run_variant baseline
    ;;
  fixed)
    run_variant fixed
    ;;
  both)
    run_variant baseline
    run_variant fixed
    ;;
esac

echo "Artifacts: $artifacts"
