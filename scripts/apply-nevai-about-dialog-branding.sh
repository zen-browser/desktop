#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ABOUT_WORDMARK="$ROOT/engine/browser/branding/unofficial/content/about-wordmark.svg"
FIREFOX_WORDMARK="$ROOT/engine/browser/branding/unofficial/content/firefox-wordmark.svg"
ABOUT_FTL="$ROOT/engine/browser/locales/en-US/browser/aboutDialog.ftl"

for f in "$ABOUT_WORDMARK" "$FIREFOX_WORDMARK" "$ABOUT_FTL"; do
  if [ ! -f "$f" ]; then
    echo "Missing expected file: $f"
    echo "Run npm run init / surfer import first so engine/ exists."
    exit 1
  fi
done

cat > "$ABOUT_WORDMARK" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="48" viewBox="0 0 220 48" role="img" aria-label="Nevai">
  <text x="0" y="36"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="38"
        font-weight="700"
        fill="currentColor">Nevai</text>
</svg>
SVG

cp "$ABOUT_WORDMARK" "$FIREFOX_WORDMARK"

python3 - <<'PY'
from pathlib import Path

p = Path("engine/browser/locales/en-US/browser/aboutDialog.ftl")
text = p.read_text()

old_community_exp = 'community-exp = <label data-l10n-name="community-exp-mozillaLink">{ -vendor-short-name }</label> is a <label data-l10n-name="community-exp-creditsLink">global community</label> working together to keep the Web open, public and accessible to all.'
new_community_exp = 'community-exp = { -brand-short-name } is an independent browser based on Mozilla open-source technology and is not affiliated with or endorsed by Mozilla.'

old_community_2 = 'community-2 = { -brand-short-name } is designed by <label data-l10n-name="community-mozillaLink">{ -vendor-short-name }</label>, a <label data-l10n-name="community-creditsLink">global community</label> working together to keep the Web open, public and accessible to all.'
new_community_2 = 'community-2 = { -brand-short-name } is an independent browser based on Mozilla open-source technology and is not affiliated with or endorsed by Mozilla.'

for old, new in [(old_community_exp, new_community_exp), (old_community_2, new_community_2)]:
    if old in text:
        text = text.replace(old, new)
    elif new in text:
        pass
    else:
        raise SystemExit(f"Could not find expected old or new string in {p}: {old[:90]}...")

p.write_text(text)
print("Applied Nevai About dialog branding")
PY

python3 - <<'PY2'
from pathlib import Path

targets = [
    Path("engine/browser/base/content/aboutDialog.xhtml"),
    Path("engine/obj-aarch64-apple-darwin/dist/Nevai.app/Contents/Resources/browser/chrome/browser/content/browser/aboutDialog.xhtml"),
]

replacements = {
    'href="https://zen-browser.app/about"':
        'href="https://github.com/ali-ezz/nevai-browser-desktop"',
    'href="https://www.zen-browser.app/privacy-policy/"':
        'href="https://github.com/ali-ezz/nevai-browser-desktop"',
    'href="https://nevai.app/about"':
        'href="https://github.com/ali-ezz/nevai-browser-desktop"',
    'href="https://www.nevai.app/privacy-policy/"':
        'href="https://github.com/ali-ezz/nevai-browser-desktop"',
}

for target in targets:
    if not target.exists():
        print(f"Skipping missing About dialog file: {target}")
        continue

    data = target.read_text()
    old_data = data
    for old, new in replacements.items():
        data = data.replace(old, new)

    if data != old_data:
        target.write_text(data)
        print(f"Updated About dialog links in {target}")
PY2

echo "Done applying Nevai About dialog branding."
