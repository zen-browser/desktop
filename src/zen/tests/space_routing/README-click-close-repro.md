<!-- This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

# Cross-Space routed tab close reproduction

This browser-chrome reproduction creates two Zen Spaces backed by different
containers. A real button click in Space B navigates to an `example.org` page,
which Zen routes into Space A. The test then closes the routed tab with animation,
immediately returns to Space B, and tries to select another tab.

The browser-chrome harness creates a fresh temporary profile for every run. It
does not use an installed Zen application or an existing user profile.

## Checkout and build

Follow Zen's normal development setup and build instructions for this checkout.
At minimum, the generated Firefox tree and built test binary must exist under
`engine/`.

```sh
git clone https://github.com/zen-browser/desktop.git
cd desktop
npm ci
npm run init
npm run build
```

The exact setup dependencies are documented in Zen's building guide linked from
`docs/contribute.md`.

## Run the before-and-after reproduction

After checking out the commit containing this reproduction, run:

```sh
./scripts/reproduce-space-routing-close-race.sh both
```

The runner temporarily removes the two tab-lifecycle fix blocks from the
generated `engine/browser/components/tabbrowser/content/tabbrowser.js` for the
baseline run. It restores the original file before the fixed run and again on
exit, including interruption.

Expected result:

```text
baseline result: reproduced
fixed result: passed
```

Logs, source hashes, harness exit codes, and evaluated results are written to:

```text
engine/artifacts/space-routing-close-race/
```

A known local build-environment issue can make the harness exit non-zero because
`menu-bookmark-tab` is missing from installed Fluent resources. The runner
records this separately as `known_fluent_flake=true`; it still requires the
specific baseline failure signature and all fixed lifecycle assertions.

## Individual or visible runs

```sh
./scripts/reproduce-space-routing-close-race.sh baseline
./scripts/reproduce-space-routing-close-race.sh fixed
ZEN_REPRO_HEADLESS=0 ./scripts/reproduce-space-routing-close-race.sh fixed
```

The visible mode still uses the browser-chrome harness's disposable profile. It
keeps the browser open after the assertions and preserves both Spaces, their
separate containers, the routing rule, and the remaining tabs for manual
inspection. Close the test browser or press `Ctrl-C` in the runner terminal when
done; the runner then restores the generated engine file and removes the
temporary profile.

## Failure signature without the fix

The baseline is accepted only when the routed tab is destroyed while it is still
selected and Firefox's tab switcher references its missing browser. The primary
signature is:

```text
AsyncTabSwitcher.sys.mjs
requestedTab.linkedBrowser is null
```

The follow-up tab selection can also report `oldBrowser is null` and time out.
With the fix, the selected tab and `AsyncTabSwitcher.requestedTab` retain live
`linkedBrowser` values, and another Space B tab remains selectable.
