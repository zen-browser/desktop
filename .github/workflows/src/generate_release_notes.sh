#!/usr/bin/env bash
RELEASE_NOTES_URL="https://raw.githubusercontent.com/zen-browser/www/refs/heads/main/src/release-notes/stable.json"

if [ "$RELEASE_BRANCH" = "release" ]; then
  RELEASE_TYPE="Stable"

  echo "Fetching release notes from GitHub..."
  RELEASE_NOTES_JSON=$(curl -s --retry 5 --retry-delay 5 "$RELEASE_NOTES_URL")

  if [ -z "$RELEASE_NOTES_JSON" ]; then
    echo "Error: Failed to fetch release notes from GitHub"
    exit 1
  fi

  LATEST_RELEASE=$(echo "$RELEASE_NOTES_JSON" | jq -r 'last')
  EXTRA_NOTES=$(echo "$LATEST_RELEASE" | jq -r '.extra // ""')
else
  RELEASE_TYPE="Twilight"
fi

{
  echo "# Zen ${RELEASE_TYPE} Release"

  if [ "$RELEASE_TYPE" = "Twilight" ]; then
    echo
    echo "> [!NOTE]"
    echo "> You're currently in Twilight mode, this means you're downloading the latest experimental features and updates."
    echo ">"
    echo "> If you encounter any issues, please report them on the [issues page](https://github.com/zen-browser/desktop/issues)."
  fi

  if [ "$RELEASE_TYPE" = "Stable" ]; then
    echo "${EXTRA_NOTES}"

    if echo "$LATEST_RELEASE" | jq -e '.security != null and .security != ""' > /dev/null; then
      echo
      echo "## Security"
      echo "[Various security fixes]($(echo "$LATEST_RELEASE" | jq -r '.security'))"
    fi

    if echo "$LATEST_RELEASE" | jq -e '(.features // []) | length > 0' > /dev/null; then
      echo
      echo "## New Features"
      echo "$LATEST_RELEASE" | jq -r '.features[] | "- " + .'
    fi

    if echo "$LATEST_RELEASE" | jq -e '(.fixes // []) | length > 0' > /dev/null; then
      echo
      echo "## Fixes"
      echo "$LATEST_RELEASE" | jq -r '.fixes[] | if type=="object" then "- " + .description + " ([#" + (.issue|tostring) + "](" + "https://github.com/zen-browser/desktop/issues/" + (.issue|tostring) + "))" else "- " + . end'
    fi

    if echo "$LATEST_RELEASE" | jq -e '(.breakingChanges // []) | length > 0' > /dev/null; then
      echo
      echo "## Breaking Changes"
      echo "$LATEST_RELEASE" | jq -r '.breakingChanges[] | if type=="string" then "- " + . else "- " + .description + " [Learn more](" + .link + ")" end'
    fi

    if echo "$LATEST_RELEASE" | jq -e '(.themeChanges // []) | length > 0' > /dev/null; then
      echo
      echo "## Theme Changes"
      echo "$LATEST_RELEASE" | jq -r '.themeChanges[] | "- " + .'
    fi

    if echo "$LATEST_RELEASE" | jq -e '(.changes // []) | length > 0' > /dev/null; then
      echo
      echo "## Changes"
      echo "$LATEST_RELEASE" | jq -r '.changes[] | "- " + .'
    fi

    if echo "$LATEST_RELEASE" | jq -e '(.knownIssues // []) | length > 0' > /dev/null; then
      echo
      echo "## Known Issues"
      echo "$LATEST_RELEASE" | jq -r '.knownIssues[] | "- " + .'
    fi
  fi
} > "release_notes.md"

echo "Release notes generated: release_notes.md"
