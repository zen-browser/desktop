<!--
   - This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/.
   -->
<!-- TODO: Get a job -->
<img src="./docs/assets/zen-dark.svg" width="100px" align="left">

### `Zen Browser`

[![Downloads](https://img.shields.io/github/downloads/zen-browser/desktop/total.svg)](https://github.com/zen-browser/desktop/releases)
[![Crowdin](https://badges.crowdin.net/zen-browser/localized.svg)](https://crowdin.com/project/zen-browser)
[![Zen Release builds](https://github.com/zen-browser/desktop/actions/workflows/build.yml/badge.svg?branch=stable)](https://github.com/zen-browser/desktop/actions/workflows/build.yml)

Zen is a firefox-based browser with the aim of pushing your productivity to a new level!

<div flex="true">
  <a href="https://zen-browser.app/download">
    Download
  </a>
  •
  <a href="https://zen-browser.app">
    Website
  </a>
  •
  <a href="https://docs.zen-browser.app">
    Documentation
  </a>
  •
  <a href="https://zen-browser.app/release-notes/latest">
    Release Notes
  </a>
</div>

### Firefox Versions

- [`Release`](https://zen-browser.app/download) - Is currently built using Firefox version `149.0.2`! 🚀
- [`Twilight`](https://zen-browser.app/download?twilight) - Is currently built using Firefox version `RC 149.0.2`!

### Contributing

If you'd like to report a bug, please do so on our [GitHub Issues page](https://github.com/zen-browser/desktop/issues/) and for feature requests, you can use [Github Discussions](https://github.com/zen-browser/desktop/discussions).

Zen is an open-source project, and we welcome contributions from the community! Please take a look at the [contribution guidelines](./docs/contribute.md) before getting started!

### Linux (Ubuntu) install quality

If you're using the unpacked Linux archive and want proper launcher/taskbar support:

1. Extract the Zen archive so you have a folder containing the `zen` executable.
2. Run:

  `bash scripts/install-linux-desktop-entry.sh --zen-dir /path/to/zen`

This installs a user-level desktop entry and icon so Zen shows correctly in launchers and can be pinned to the dock/taskbar.

For release automation, this repository now also builds Debian packages (`.deb`) for `x86_64` and `aarch64` in CI and publishes them as release artifacts.

#### Partners

Thanks to all the partners of Zen for their support and contributions:

<a href="https://blacksmith.sh">
  <img src="./docs/assets/blacksmith-yellow.png" width="350px"/>
</a>
