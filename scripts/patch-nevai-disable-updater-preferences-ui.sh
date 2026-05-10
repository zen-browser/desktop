#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRIVACY="$ROOT/engine/browser/components/preferences/privacy.js"
CARD="$ROOT/engine/browser/components/preferences/widgets/security-privacy/security-privacy-card/security-privacy-card.mjs"

if [ ! -f "$PRIVACY" ]; then
  echo "Missing $PRIVACY"
  exit 1
fi

if [ ! -f "$CARD" ]; then
  echo "Missing $CARD"
  exit 1
fi

cd "$ROOT"

python3 - <<'PY'
from pathlib import Path

NO_UPDATER_STATUS = "1"  # AppUpdater.STATUS.NO_UPDATER

privacy = Path("engine/browser/components/preferences/privacy.js")
text = privacy.read_text()

old = '''ChromeUtils.defineESModuleGetters(this, {
  AppUpdater: "resource://gre/modules/AppUpdater.sys.mjs",
  DoHConfigController: "moz-src:///toolkit/components/doh/DoHConfig.sys.mjs",
'''

new = '''ChromeUtils.defineESModuleGetters(this, {
  ...(AppConstants.MOZ_UPDATER
    ? { AppUpdater: "resource://gre/modules/AppUpdater.sys.mjs" }
    : {}),
  DoHConfigController: "moz-src:///toolkit/components/doh/DoHConfig.sys.mjs",
'''

if old in text:
    text = text.replace(old, new)
elif new not in text:
    raise SystemExit("privacy.js: could not find AppUpdater getter block")

old = '''      cachedValue: AppUpdater.STATUS.NO_UPDATER,
'''

new = f'''      cachedValue: AppConstants.MOZ_UPDATER
        ? AppUpdater.STATUS.NO_UPDATER
        : {NO_UPDATER_STATUS}, // AppUpdater.STATUS.NO_UPDATER fallback for alpha builds without updater.
'''

if old in text:
    text = text.replace(old, new)
elif new not in text:
    raise SystemExit("privacy.js: could not find appUpdateStatus cachedValue line")

privacy.write_text(text)
print("Patched privacy.js")


card = Path("engine/browser/components/preferences/widgets/security-privacy/security-privacy-card/security-privacy-card.mjs")
text = card.read_text()

old = '''const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  AppUpdater: "resource://gre/modules/AppUpdater.sys.mjs",
});
'''

new = '''const { AppConstants } = ChromeUtils.importESModule(
  "resource://gre/modules/AppConstants.sys.mjs"
);

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  ...(AppConstants.MOZ_UPDATER
    ? { AppUpdater: "resource://gre/modules/AppUpdater.sys.mjs" }
    : {}),
});

const NevaiAppUpdaterStatus = AppConstants.MOZ_UPDATER
  ? lazy.AppUpdater.STATUS
  : {
      NEVER_CHECKED: 0,
      NO_UPDATER: 1,
      UPDATE_DISABLED_BY_POLICY: 2,
      OTHER_INSTANCE_HANDLING_UPDATES: 3,
      UNSUPPORTED_SYSTEM: 4,
      MANUAL_UPDATE: 5,
      CHECKING: 6,
      NO_UPDATES_FOUND: 7,
      DOWNLOADING: 8,
      DOWNLOAD_FAILED: 9,
      DOWNLOAD_AND_INSTALL: 10,
      STAGING: 11,
      READY_FOR_RESTART: 12,
      INTERNAL_ERROR: 13,
      CHECKING_FAILED: 14,
    };
'''

if old in text:
    text = text.replace(old, new)
elif "const NevaiAppUpdaterStatus =" not in text:
    raise SystemExit("security privacy card: could not find AppUpdater getter block")

text = text.replace("lazy.AppUpdater.STATUS.", "NevaiAppUpdaterStatus.")

card.write_text(text)
print("Patched security-privacy-card.mjs")
PY

echo "Patched updater Preferences UI for Nevai alpha."
