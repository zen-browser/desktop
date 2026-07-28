# Assembles the patched Firefox source tree for the Zen fork (tree-style-tabs).
# Mirrors nixpkgs PR #496647 (Hythera) — drives the Zen `import` steps by hand
# (no `surfer`) so everything runs offline inside the build sandbox.
#
# Fork-specific deltas from the upstream recipe:
#   * Firefox base version is read from surfer.json (`.version.version`) so it
#     always matches the version the Zen patches target. A hard-coded pin that
#     lagged surfer.json (we pinned 152.0 while the patches moved to 152.0.4,
#     which changed UrlbarUtils.sys.mjs) fails patchPhase with "patch does not
#     apply". Only `firefox-src.hash` is pinned now: when the base version bumps,
#     the build fails with a clear hash mismatch that prints the correct sha512
#     to paste below — get it with
#     `nix store prefetch-file --hash-type sha512 <firefox-<ver>.source.tar.xz>`.
#   * `zen-src` is the fork tree itself (`zen-src-tree` = the flake `self`),
#     not a tagged github release — so the tree-style-tabs feature (extra
#     src/ files + new *.patch files) is picked up generically.
#   * Linux-only: the macOS-only external patches are excluded.
{
  branding ? "release",
  fetchurl,
  gitMinimal,
  rsync,
  rustPlatform,
  writeText,
  zen-src-tree,
}:
let
  zen-src = zen-src-tree;

  assets = import ./assets.nix { inherit branding surfer-config writeText; };

  ffprefs = rustPlatform.buildRustPackage {
    cargoHash = "sha256-DZMwxeulQiIiSATU0MoyqiUMA0USZq6umhkr67hZH1Q=";
    pname = "ffprefs";
    postPatch = ''
      substituteInPlace src/main.rs \
        --replace-fail "../engine/" "../"
    '';
    src = "${zen-src}/tools/ffprefs";
    version = zen-version;
  };

  firefox-src = fetchurl {
    url = "mirror://mozilla/firefox/releases/${firefox-version}/source/firefox-${firefox-version}.source.tar.xz";
    hash = "sha512-oa9YZuHJpzKBgSPy8EG/1Zk9CT6W3XQ7WDMS+xHSs51CnfdQ+ewi3tZLWKIJux7KvHqvcwV9emTHNJ5NoEPWbQ==";
  };

  # Read from surfer.json so the fetched Firefox source always matches the base
  # the Zen patches target (see the header comment). Only the hash above is
  # pinned manually.
  firefox-version =
    (builtins.fromJSON (builtins.readFile "${zen-src}/surfer.json")).version.version;

  # Hard-coded from the fork's surfer.json (kept in sync manually; these values
  # change very rarely). Drives the branding strings in assets.nix.
  surfer-config = {
    name = "Zen Browser";
    vendor = "Zen OSS Team";
    appId = "zen";
    brands = {
      release = {
        backgroundColor = "#282A33";
        brandShorterName = "Zen";
        brandShortName = "Zen";
        brandFullName = "Zen Browser";
      };
      twilight = {
        backgroundColor = "#282A33";
        brandShorterName = "Zen";
        brandShortName = "Twilight";
        brandFullName = "Zen Twilight";
      };
    };
  };

  # Zen's own version lives in the release tag rather than a tracked file
  # (package.json is a placeholder 1.0.0), so this is hand-maintained and
  # wants bumping alongside a release. It only names the store path and the
  # reported application version; the Firefox base above is read from
  # surfer.json and stays correct on its own.
  zen-version = "1.21.9b";
in
{
  inherit
    ffprefs
    firefox-src
    firefox-version
    zen-version
    ;

  extraNativeBuildInputs = [
    gitMinimal
    rsync
  ];

  extraPostPatch = ''
    # Compile the Zen pref YAMLs into the engine's static/dynamic pref files.
    # --chmod=u+w: the source is a read-only Nix store path, and plain `rsync -r`
    # would recreate its directories read-only, so the nested mkdir/copy fails
    # ("Permission denied"). Force user-write on everything we copy in.
    rsync -r --chmod=u+w ${zen-src}/prefs/ prefs
    ${ffprefs}/bin/ffprefs .

    # Copy the Zen source overlay in, then apply every Zen *.patch against the
    # Firefox tree with `git apply -p1` — the same tool upstream's `surfer` uses.
    # We deliberately avoid GNU `patch`: it rejects hunks whose trailing context
    # is a bare struct-closing `}` with no anchor after it (e.g. allow_backdrop's
    # init.rs hunk — "Hunk #1 FAILED at 204", fails even at -F3), which git apply
    # and surfer apply cleanly. git apply also requires exact context, so a
    # Firefox-base drift surfaces as a clean failure rather than a silent fuzz.
    # Skip the two external webrender backports that already landed upstream in
    # Firefox ${firefox-version} (their code is present in the pristine source, so
    # re-applying fails as "already applied"). Re-check this skip list whenever the
    # pinned Firefox version changes.
    rsync -r --chmod=u+w --exclude "*.patch" "${zen-src}/src/" .

    find "${zen-src}/src" -type f -name "*.patch" \
      ! -name "bug_2013682_allow_stacking_contexts_to_be_promoted.patch" \
      ! -name "gh-12979_clip_dirty_rect_to_device_size.patch" \
      | sort | while read -r patch_name; do
      git apply -p1 "$patch_name"
    done

    # Locales: en-US plus every supported language (mapped through language-maps).
    rsync -r --chmod=u+w "${zen-src}/locales/en-US/browser/" browser/locales/en-US/
    for language in $(cat ${zen-src}/locales/supported-languages); do
      loc="$(grep -m1 "^$language:" "${zen-src}/locales/language-maps" | cut -d: -f2 || true)"
      loc="''${loc:-$language}"
      rsync -r --chmod=u+w "${zen-src}/locales/$language/." browser/locales/$loc
    done

    # Branding: seed from Firefox's unofficial branding, then overlay Zen's.
    rsync -r --exclude='branding.nsi' browser/branding/unofficial/. browser/branding/${branding}

    cp -r ${zen-src}/configs/branding/${branding} browser/branding
    for size in 16 22 24 32 48 64 128 256 512; do
      cp ${zen-src}/configs/branding/${branding}/logo"$size".png browser/branding/${branding}/default"$size".png
    done

    rsync ${assets.brandDtd} browser/branding/${branding}/locales/en-US/brand.dtd
    rsync ${assets.brandFtl} browser/branding/${branding}/locales/en-US/brand.ftl
    rsync ${assets.brandProperties} browser/branding/${branding}/locales/en-US/brand.properties
    rsync ${assets.brandingNsi} browser/branding/${branding}/branding.nsi
    rsync ${assets.configureSh} browser/branding/${branding}/configure.sh
    rsync ${assets.firefox-brandingJs} browser/branding/${branding}/pref/firefox-branding.js

    find "browser/branding/${branding}" -type f -name "*.css" | while read -r style; do
      echo ":root { --theme-bg: ${surfer-config.brands.${branding}.backgroundColor} }" >> $style
      sed -i -E 's/#130829|hsla\(235, 43%, 10%, 0\.5\)/var(--theme-bg)/g' $style
    done

    # Point the in-app updater at Zen's update host (no-op for us: updates are
    # policy-disabled, so warn-don't-fail if the upstream string drifts).
    substituteInPlace build/application.ini.in \
      --replace-warn 'URL=https://@MOZ_APPUPDATE_HOST@/update/6/%PRODUCT%/%VERSION%/%BUILD_ID%/%BUILD_TARGET%/%LOCALE%/%CHANNEL%/%OS_VERSION%/%SYSTEM_CAPABILITIES%/%DISTRIBUTION%/%DISTRIBUTION_VERSION%/update.xml' 'URL=https://@MOZ_APPUPDATE_HOST@/updates/browser/%BUILD_TARGET%/%CHANNEL%/update.xml'

    substituteInPlace browser/installer/windows/nsis/shared.nsh \
      --replace-warn '"Publisher" "Mozilla"' '"Publisher" "${surfer-config.vendor}"'

    # Merge the vendored remote-settings dumps into the engine offline. Copy the
    # scripts out of the read-only store, then rewrite the two folder constants
    # (the source folder -> the vendored configs/dumps; the engine folder ->
    # relative, since we are already at the Firefox source root).
    scripts="$(mktemp -d)"
    cp -r "${zen-src}/scripts/." "$scripts"
    # Rewrite the folder constants without relying on hard-coded line numbers.
    sed -i \
      -e '/^DUMPS_FOLDER =/,/^)$/c\DUMPS_FOLDER = "${zen-src}/configs/dumps"' \
      -e '/^ENGINE_DUMPS_FOLDER =/,/^)$/c\ENGINE_DUMPS_FOLDER = "services/settings/dumps/main"' \
      "$scripts/update_service_dumps.py"

    python $scripts/update_service_dumps.py

    for file in browser/config/version.txt browser/config/version_display.txt; do
      echo "${zen-version}" > $file
    done
  '';
}
