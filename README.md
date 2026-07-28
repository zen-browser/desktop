<!--
  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at https://mozilla.org/MPL/2.0/.
-->

<div align="center">

# Astra Browser

### A modern, focused and privacy-minded browser built for a better web.

Astra is an open-source desktop browser built in India on Mozilla Firefox technology and the open-source foundation of Zen Browser.

It combines a clean vertical workspace, privacy-focused tools, compact controls and thoughtful features designed to make everyday browsing feel calmer and more productive.

<br />

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL%202.0-5B5BD6.svg)](./LICENSE)
[![Build Status](https://github.com/Hrishikeshmind/astradesktop/actions/workflows/build.yml/badge.svg?branch=dev)](https://github.com/Hrishikeshmind/astradesktop/actions/workflows/build.yml)
[![Latest Release](https://img.shields.io/github/v/release/Hrishikeshmind/astradesktop?include_prereleases\&label=release)](https://github.com/Hrishikeshmind/astradesktop/releases)
[![Downloads](https://img.shields.io/github/downloads/Hrishikeshmind/astradesktop/total?label=downloads)](https://github.com/Hrishikeshmind/astradesktop/releases)
[![GitHub Stars](https://img.shields.io/github/stars/Hrishikeshmind/astradesktop?style=flat)](https://github.com/Hrishikeshmind/astradesktop/stargazers)
[![Open Issues](https://img.shields.io/github/issues/Hrishikeshmind/astradesktop)](https://github.com/Hrishikeshmind/astradesktop/issues)
[![Contributors](https://img.shields.io/github/contributors/Hrishikeshmind/astradesktop)](https://github.com/Hrishikeshmind/astradesktop/graphs/contributors)

<br />

[Download Astra](https://github.com/Hrishikeshmind/astradesktop/releases)
 • 
[Report a Bug](https://github.com/Hrishikeshmind/astradesktop/issues/new)
 • 
[Request a Feature](https://github.com/Hrishikeshmind/astradesktop/discussions)
 • 
[View Source](https://github.com/Hrishikeshmind/astradesktop)

</div>

---

> [!IMPORTANT]
> **Astra is currently in Public Beta.**
>
> You may encounter bugs, unfinished features or visual changes between releases. Automatic updates may not be available in every beta build, so users may occasionally need to download the latest installer manually.
>
> Download Astra only from this official repository or the official Astra website when it becomes available.

## About Astra

Astra is an independent, community-driven browser project focused on creating a cleaner and more enjoyable desktop browsing experience.

Modern browsers are powerful, but their interfaces can become crowded and distracting. Astra approaches the browser as a workspace rather than just a row of tabs.

It provides a vertical browsing layout, compact controls, useful side panels, built-in privacy tools and a visual identity designed to feel modern without getting in the user's way.

Astra is not developing a new browser engine from scratch. It builds on the open web platform and browser engine maintained by Mozilla Firefox while extending the interface and product experience through the Zen Browser architecture.

Our goal is simple:

> Build a browser that feels personal, focused, open and enjoyable to use every day.

## Core principles

| Principle           | What it means                                                                          |
| ------------------- | -------------------------------------------------------------------------------------- |
| **Calm by default** | Reduce unnecessary interface noise and give websites more room.                        |
| **Privacy-minded**  | Provide understandable protection controls and strong content-blocking options.        |
| **Productive**      | Make large browsing sessions easier to organize through vertical tabs and side panels. |
| **Open source**     | Develop transparently with public source code, issues and contributions.               |
| **User driven**     | Improve Astra based on real feedback rather than assumptions.                          |
| **Independent**     | Support the open web and browser-engine diversity.                                     |
| **Built in India**  | Create an Indian open-source product with global ambition.                             |

## Features

### Vertical tabs

Astra uses a vertical tab workspace that makes it easier to view and manage many open tabs without reducing the width of the current webpage.

### Compact Mode

Compact Mode hides selected browser controls when they are not needed and reveals them when the user moves toward the browser edge.

The goal is to provide a distraction-free browsing view without making important controls difficult to access.

### Built-in content blocking

Astra integrates powerful content-blocking capabilities powered by uBlock Origin.

This can help reduce intrusive advertisements, trackers and unnecessary page resources.

### Astra Suraksha

Astra Suraksha is Astra's privacy and protection interface.

It is being developed to help users understand site protections, tracking prevention and important privacy controls without requiring advanced technical knowledge.

> Astra Suraksha is still evolving during the Public Beta period.

### AI Sidebar

The AI Sidebar allows supported AI tools to be accessed without constantly switching between tabs.

AI is treated as an optional productivity tool rather than the center of the browser experience.

### App Hub

App Hub provides quick access to frequently used websites and web applications from within the browser workspace.

### Transparent Mode

Astra includes an optional transparent interface mode for supported Windows environments.

The feature is designed to visually integrate the browser with the desktop while maintaining readability and usability.

### Spaces and organization

Astra's workspace features help separate browsing activities such as study, development, entertainment and personal work.

### Firefox foundation

Because Astra is based on Firefox technology, it benefits from:

* Mozilla's independent Gecko browser engine
* Broad web-platform support
* Firefox-compatible extensions
* Mature browser security architecture
* Open-source development
* Reduced dependency on Chromium-based browser engines

## Screenshots

Product screenshots will be added as the Public Beta interface is finalized.

Recommended screenshot structure:

```text
docs/
└── assets/
    └── screenshots/
        ├── astra-main.png
        ├── astra-compact-mode.png
        ├── astra-sidebar.png
        └── astra-onboarding.png
```

After adding the images, use:

```html
<p align="center">
  <img
    src="./docs/assets/screenshots/astra-main.png"
    alt="Astra Browser main interface"
    width="90%"
  />
</p>
```

## Download Astra

Official beta releases are available from:

### GitHub Releases

[Download the latest Astra release](https://github.com/Hrishikeshmind/astradesktop/releases)

### Supported platforms

| Platform      | Current status               |
| ------------- | ---------------------------- |
| Windows x64   | Primary Public Beta platform |
| Windows ARM64 | Experimental                 |
| Linux         | Development and testing      |
| macOS         | Development and testing      |

Platform availability may differ between releases. Check the release notes before downloading.

> [!WARNING]
> Early Astra beta installers may display a Microsoft Defender SmartScreen notice while trusted Windows code signing is being implemented.
>
> Never disable Windows security protections globally. Confirm that the installer was downloaded from the official Astra repository before proceeding.

## Public Beta status

Astra is currently being shared as an open Public Beta so that more users can test the browser and help improve it.

| Area                    | Status              |
| ----------------------- | ------------------- |
| Core browsing           | Beta                |
| Windows installation    | Beta                |
| Vertical tabs           | Active development  |
| Compact Mode            | Active development  |
| AI Sidebar              | Beta                |
| Astra Suraksha          | Active development  |
| App Hub                 | Active development  |
| Transparent Mode        | Beta                |
| Automatic updates       | Under development   |
| Windows code signing    | Planned/in progress |
| Linux and macOS support | Experimental        |
| Public feedback         | Open                |

Astra should not yet be treated as a finished enterprise, government, financial or security-critical browser.

## Share feedback

Astra is being developed with direct feedback from its users.

We would like to know:

* What you liked
* What you did not like
* Which feature you used most
* Which part felt confusing
* Whether Astra crashed or stopped responding
* Which feature you want next
* Whether you would use Astra as your main browser
* Whether you would recommend Astra to someone else

### Astra Beta Feedback Form

[Share your Astra feedback](PASTE_YOUR_GOOGLE_FORM_LINK_HERE)

Replace `PASTE_YOUR_GOOGLE_FORM_LINK_HERE` with the real Google Form link before publishing the README.

### Technical reports

Use GitHub for reproducible technical problems:

* [Report a bug](https://github.com/Hrishikeshmind/astradesktop/issues/new)
* [View existing issues](https://github.com/Hrishikeshmind/astradesktop/issues)
* [Request a feature](https://github.com/Hrishikeshmind/astradesktop/discussions)

When reporting a bug, include:

1. Astra version
2. Operating-system version
3. Steps needed to reproduce the problem
4. Expected behavior
5. Actual behavior
6. Screenshot or screen recording
7. Relevant Browser Console logs, when available

## Installation notes

### Installing a new version

During the Public Beta period, automatic updates may not be available in every release.

To update manually:

1. Download the latest installer from GitHub Releases.
2. Close running Astra windows.
3. Run the new installer over the existing installation.
4. Do not uninstall Astra unless the release notes specifically request it.
5. Open Astra and verify the version from the About page.

Normal updates should preserve the existing browser profile, including bookmarks, history, extensions and settings.

Users should still keep important browser data backed up during the beta period.

## Development

Astra uses the Zen Surfer build system to manage Firefox source synchronization, product configuration, branding, patches and packaging.

Building a Firefox-based browser is resource intensive. A development machine needs sufficient storage, memory and platform-specific compiler dependencies.

### Prerequisites

The project currently expects tools including:

* Git
* Node.js
* Python
* Rust
* Mozilla platform build dependencies
* A supported C and C++ compiler toolchain
* Sufficient storage and memory

Use the versions defined in the repository configuration and CI workflows wherever possible.

### Clone the repository

Development work should normally start from the `dev` branch:

```bash
git clone --branch dev https://github.com/Hrishikeshmind/astradesktop.git
cd astradesktop
```

### Install dependencies

```bash
npm ci
```

### Initialize the browser source

```bash
npm run init
```

This process prepares the upstream Firefox source and applies the configuration and source changes required by Astra.

### Build Astra

```bash
npm run build
```

### Open the build interface

```bash
npm run build:ui
```

### Run the local browser build

```bash
npm run start
```

### Create a distributable package

```bash
npm run package
```

### Run tests

```bash
npm test
```

### Run lint checks

```bash
npm run lint
```

Build commands may evolve as Astra and the upstream projects change. Review `package.json`, the project documentation and GitHub Actions workflows for the current build process.

## Repository structure

```text
astradesktop/
├── .github/
│   ├── ISSUE_TEMPLATE/       # Bug and feature templates
│   └── workflows/            # Build, test and release workflows
├── branding/                 # Astra branding resources
├── build/                    # Build configuration and utilities
├── configs/                  # Browser and platform configuration
├── docs/                     # Project and contributor documentation
├── locales/                  # Localization resources
├── prefs/                    # Browser preference definitions
├── scripts/                  # Build, update and maintenance scripts
├── src/                      # Astra source code and upstream patches
├── tools/                    # Development tools
├── CODE_OF_CONDUCT.md        # Community behavior guidelines
├── CONTRIBUTING.md           # Contribution instructions, when present
├── LICENSE                   # Mozilla Public License 2.0
├── README.md                 # Project overview
├── SECURITY.md               # Security reporting policy
├── package.json              # Development commands and dependencies
└── surfer.json               # Product and release configuration
```

The exact structure may change as the project evolves.

## Branch model

Astra currently follows a development-focused branch model:

```text
feature or fix branch
          │
          ▼
         dev
          │
          ▼
        stable
```

### `dev`

The primary development branch.

New features, fixes and improvements should normally target `dev`.

### `stable`

Reserved for changes that have been tested and are ready for stable or broader public distribution.

### Hotfix branches

Critical issues affecting a released build may use focused hotfix branches.

Do not combine unrelated changes in the same pull request.

## Contributing

Astra welcomes contributions from developers, designers, testers, technical writers and translators.

Useful contributions include:

* Bug fixes
* Performance improvements
* Accessibility improvements
* UI and UX refinements
* Documentation
* Tests
* Localization
* Build-system improvements
* Security hardening
* Reproducible bug reports
* Feature proposals

### Contribution process

1. Read the project's contribution and conduct guidelines.
2. Search existing issues and discussions.
3. Create a focused branch from `dev`.
4. Make one logically focused change.
5. Test the change locally.
6. Run relevant lint and test commands.
7. Open a pull request targeting `dev`.
8. Explain what changed and how it was verified.
9. Include screenshots for visible UI changes.

Large features should be discussed before implementation to avoid conflicting with the project direction.

## Community standards

Everyone participating in Astra is expected to communicate respectfully and constructively.

Please read:

* [Code of Conduct](./CODE_OF_CONDUCT.md)
* [Security Policy](./SECURITY.md)
* Project contribution guidance

Harassment, discrimination, threats, spam and intentionally harmful contributions are not acceptable.

## Roadmap

Astra's current priorities include:

* Improving Public Beta stability
* Completing reliable Windows application updates
* Introducing trusted Windows code signing
* Improving the first-run and onboarding experience
* Hardening Compact Mode behavior
* Improving vertical-tab reliability
* Refining Astra Suraksha
* Improving App Hub
* Expanding accessibility
* Reducing memory and performance overhead
* Improving browser customization
* Adding more translations
* Expanding Linux and macOS testing
* Publishing transparent release notes
* Building a user-feedback process
* Preparing Astra's first stable release

The roadmap may change based on user feedback, technical limitations, security requirements and upstream Firefox or Zen changes.

## Security

Do not publicly disclose a potentially serious security vulnerability before maintainers have had a reasonable opportunity to investigate it.

Follow the instructions in:

[SECURITY.md](./SECURITY.md)

Only download Astra binaries from:

* The official Astra GitHub repository
* The official Astra website when published

The project will never ask users to:

* Permanently disable Microsoft Defender
* Permanently disable SmartScreen
* Disable antivirus protection globally
* Download an official build from an unknown file-hosting service
* Share passwords or sensitive browser data

## Privacy

Astra aims to make privacy controls easier to understand and use.

However, a browser alone cannot guarantee complete privacy or anonymity.

Websites, extensions, search providers, AI services and third-party applications may process data under their own policies.

Astra does not claim that:

* Users become anonymous simply by using Astra
* Every tracker can always be blocked
* Every website interaction remains private
* Third-party extensions are controlled by Astra

A detailed privacy policy should be published before the wider stable release.

## Release integrity

Official Astra builds are produced through the project's public GitHub Actions workflows.

The project is working toward:

* Authenticode signing for Windows executables
* Signed Windows installers
* Cryptographically signed application updates
* Public release checksums
* Fail-closed update publishing
* Clear release provenance
* Documented release procedures
* Consistent versioning

Until trusted signing is fully implemented, users should verify that downloads originate from an official Astra source.

## Automatic updates

Astra uses Mozilla's native application-update architecture.

During the beta period, automatic updates may still be under development or disabled for safety.

A production-ready update system must ensure that:

* Update packages are generated correctly
* Update manifests reference real release assets
* File hashes and sizes match
* Update assets are published before manifests
* Failed releases do not reach users
* Update packages are signed and verified
* Browser profiles remain intact across updates

Until this pipeline is fully tested, manual installer updates may be used for Public Beta releases.

## Built on open source

Astra exists because of the work of many open-source communities.

Special thanks to:

* [Mozilla Firefox](https://www.mozilla.org/firefox/) for the Gecko browser engine and browser platform
* [Zen Browser](https://zen-browser.app/) for its open-source browser experience and Surfer architecture
* [uBlock Origin](https://github.com/gorhill/uBlock) for its content-blocking technology
* Mozilla contributors
* Zen Browser contributors
* Open-source dependency maintainers
* Astra testers and contributors

Astra preserves applicable third-party copyright and license notices.

This acknowledgement does not imply sponsorship, partnership or endorsement.

## Independent project notice

Astra Browser is an independent open-source project.

Astra is not currently sponsored by, partnered with or officially endorsed by Mozilla, Zen Browser, uBlock Origin or any other organization unless explicitly announced through an official Astra channel.

Mozilla, Firefox and related names and logos are trademarks of the Mozilla Foundation.

Zen Browser and its branding belong to their respective owners.

Any references to upstream projects describe Astra's technical foundation and do not imply an official commercial relationship.

## License

Astra source code is distributed under the [Mozilla Public License 2.0](./LICENSE), except where individual files or bundled third-party components state different license terms.

The MPL-2.0 allows users to:

* Use the covered source code
* Study it
* Modify it
* Distribute it
* Include it within a larger project
* Use it commercially, subject to the license conditions

When MPL-covered files are modified and distributed, the source form of those covered files must remain available under the MPL-2.0.

Existing license, copyright, patent and attribution notices must not be improperly removed.

## Branding and trademarks

The MPL-2.0 license applies to covered source code. It does not automatically grant unrestricted rights to project names, logos, artwork or trademarks.

The Astra name, Astra logo, visual identity and official artwork may be governed by separate branding rules.

Forks should use their own identity and should not mislead users into believing they are official Astra releases.

## Maintainer

Astra Browser is currently led and maintained by:

* [Hrishikesh Gade](https://github.com/Hrishikeshmind)

Community contributions, testing, documentation improvements, translations and thoughtful feature proposals are welcome.

## Support Astra

The best ways to support the project are:

* Star the repository
* Download and test the Public Beta
* Share honest feedback
* Report reproducible bugs
* Improve documentation
* Contribute code
* Help with translations
* Share Astra with users who may genuinely benefit from it

Please do not create fake reviews, fake download statistics or misleading performance and security claims.

Real user feedback and transparent development are more valuable than artificial numbers.

---

<div align="center">

## Help build a calmer and more open browser.

[Download Astra](https://github.com/Hrishikeshmind/astradesktop/releases)
 • 
[Star the Repository](https://github.com/Hrishikeshmind/astradesktop)
 • 
[Report a Bug](https://github.com/Hrishikeshmind/astradesktop/issues/new)

<br />

**Made with care in India.**

</div>

