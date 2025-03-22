#!/usr/bin/env bash
RELEASE_NOTES_URL="https://raw.githubusercontent.com/zen-browser/www/refs/heads/main/src/release-notes/stable.json"

if [ "$RELEASE_BRANCH" = "release" ]; then
  RELEASE_TYPE="Stable"

  echo "Fetching release notes from GitHub..."
  RELEASE_NOTES_JSON=$(curl -s "$RELEASE_NOTES_URL")

  if [ -z "$RELEASE_NOTES_JSON" ]; then
    echo "Error: Failed to fetch release notes from GitHub"
    exit 1
  fi

  LATEST_RELEASE=$(echo "$RELEASE_NOTES_JSON" | jq -r 'last')
  EXTRA_NOTES=$(echo "$LATEST_RELEASE" | jq -r '.extra // ""')
else
  RELEASE_TYPE="Twilight"
fi

cat << EOF > "release_notes.md"
# Zen ${RELEASE_TYPE} Release
EOF

if [ "$RELEASE_BRANCH" = "release" ]; then
  echo "${EXTRA_NOTES}" >> "release_notes.md"

  if echo "$LATEST_RELEASE" | jq -e 'has("features")' > /dev/null; then
    cat << EOF >> "release_notes.md"

## New Features
$(echo "$LATEST_RELEASE" | jq -r '.features[] | "- " + .')
EOF
  fi

  if echo "$LATEST_RELEASE" | jq -e 'has("fixes")' > /dev/null; then
    cat << EOF >> "release_notes.md"

## Fixes
EOF
    echo "$LATEST_RELEASE" | jq -r '.fixes[] | if type=="object" then "- " + .description + " ([#" + (.issue|tostring) + "](" + "https://github.com/zen-browser/desktop/issues/" + (.issue|tostring) + "))" else "- " + . end' >> "release_notes.md"
  fi

  if echo "$LATEST_RELEASE" | jq -e 'has("breakingChanges")' > /dev/null; then
    cat << EOF >> "release_notes.md"

## Breaking Changes
EOF
    echo "$LATEST_RELEASE" | jq -r '.breakingChanges[] | if type=="string" then "- " + . else "- " + .description + " [Learn more](" + .link + ")" end' >> "release_notes.md"
  fi

  if echo "$LATEST_RELEASE" | jq -e 'has("themeChanges")' > /dev/null; then
    cat << EOF >> "release_notes.md"

## Theme Changes
$(echo "$LATEST_RELEASE" | jq -r '.themeChanges[] | "- " + .')
EOF
  fi
fi

cat << EOF >> "release_notes.md"

<details>
<summary>File Checksums (SHA-256)</summary>

\`\`\`
EOF

generate_checksum() {
  local pattern=$1
  echo "Generating checksum for $pattern"
  sha256sum $pattern 2> /dev/null | awk '{sub(".*/", "", $2); print $1 "  " $2}' >> "release_notes.md"
  if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "Warning: No files found matching $pattern, skipping checksum."
  fi
}

files=(
  "./zen.source.tar.zst/*"
  "./zen.linux-x86_64.tar.xz/*"
  "./zen.linux-aarch64.tar.xz/*"
  "./zen-x86_64.AppImage/*"
  "./zen-x86_64.AppImage.zsync/*"
  "./zen-aarch64.AppImage/*"
  "./zen-aarch64.AppImage.zsync/*"
  "./.github/workflows/object/windows-x64-signed-x86_64/zen.win-x86_64.zip"
  "./zen.win-x86_64.zip/*"
  "./.github/workflows/object/windows-x64-signed-arm64/zen.win-arm64.zip"
  "./zen.win-arm64.zip/*"
  "./linux.mar/*"
  "./linux-aarch64.mar/*"
  "./.github/workflows/object/windows-x64-signed-x86_64/windows.mar"
  "./windows.mar/*"
  "./.github/workflows/object/windows-x64-signed-arm64/windows-arm64.mar"
  "./windows-arm64.mar/*"
  "./macos.mar/*"
  "./.github/workflows/object/windows-x64-signed-x86_64/zen.installer.exe"
  "./zen.installer.exe/*"
  "./.github/workflows/object/windows-x64-signed-arm64/zen.installer-arm64.exe"
  "./zen.installer-arm64.exe/*"
  "./zen.macos-universal.dmg/*"
)

for file in "${files[@]}"; do
  generate_checksum "$file"
done

cat << EOF >> "release_notes.md"
\`\`\`
</details>
EOF

echo "Release notes generated: release_notes.md"
