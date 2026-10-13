<!--
   - This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/.
   -->

<div align="center">

# 🌿 Peppermint

**A calm, productive Firefox-based browser. Built for focus, not noise.**

[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)
[![Firefox Version](https://img.shields.io/badge/Firefox-157.0.1-orange.svg)](https://www.mozilla.org/firefox/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/AstroDevCompany/desktop/actions)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/AstroDevCompany/desktop/releases)

[📥 Download Latest Release](https://github.com/AstroDevCompany/desktop/releases/latest) • [🐛 Report Bug](https://github.com/AstroDevCompany/desktop/issues/new?template=bug_report.md) • [💡 Request Feature](https://github.com/AstroDevCompany/desktop/issues/new?template=feature_request.md) • [📖 Documentation](https://github.com/AstroDevCompany/desktop/wiki)

</div>

---

## ✨ Why Peppermint?

Modern browsers are cluttered; Endless toolbars, telemetry, sponsored shortcuts, and UI that fights for your attention. **Peppermint strips it all away.**

|       🎯 **Focus First**        |      🛡️ **Privacy by Default**      |  ⚡ **Performance Tuned**  |
| :-----------------------------: | :---------------------------------: | :------------------------: |
|     Zen-inspired minimal UI     | No telemetry, no studies, no pocket | Optimized startup & memory |
|   Vertical tabs that breathe    |   Hardened `user.js` preferences    |  PGO/LTO optimized builds  |
| Command palette for power users |       uBlock Origin built-in        |  Native vertical tab bar   |

---

## Highlight features

- Sophisticated Ad-Blocker (standard + video)
- Cookie blocker & auto-refusal
- Custom temporary markdown editor (MD Notepad) with integrated encrypted saving
- Temporary permissions
- URL Snippets
- Underpowered mode
- Rich homepage
- Light & Fast
- More secure Ghost mode
- Polished frosted glass UI
- No telemetry

### Improved upon Zen

- All General Features
- More organized settings
- More consistent panels colors & design
- Additional settings
- Minor QoL features
- Default themes & settings

## 🖼️ Screenshots

Coming soon...

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 20.10.0
- **Python** ≥ 3.11
- **Rust** ≥ 1.78 (for `ffprefs` tool)
- **Git** with LFS support
- Platform build tools:
  - **Windows**: Visual Studio 2022 + Windows 10 SDK
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `build-essential`, `pkg-config`, `gtk3-devel`, `libasound2-dev`

### One-Command Setup

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/AstroDevCompany/desktop.git peppermint
cd peppermint

# Guided first build (macOS/Linux)
./scripts/run-macos.sh

# Or Windows
.\scripts\run-windows.ps1
```

### Manual Build

```bash
# Install dependencies
npm ci

# Download Firefox source + apply patches
npm run init

# Development build (fast, unoptimized)
npm run build:ui

# Production build (optimized, PGO)
npm run build

# Run from source
npm start
```

---

## 🏗️ Architecture

```
peppermint/
├── engine/                 # Firefox source tree (git submodule)
├── src/
│   ├── browser/            # Peppermint frontend (React + TypeScript)
│   │   ├── components/     # UI components (newtab, toolbar, tabs, etc.)
│   │   ├── themes/         # Theme system (light/dark/auto + custom)
│   │   └── styles/         # Global styles & CSS variables
│   ├── external-patches/   # Upstream patches (LibreWolf, Firefox)
│   └── preferences/        # Hardened user.js defaults
├── prefs/                  # Preference definitions & schemas
├── scripts/                # Build, sync, and utility scripts
├── surfer.json             # Brand & build configuration
└── package.json            # Node workspace & scripts
```

### Key Technologies

| Layer            | Technology                                               |
| ---------------- | -------------------------------------------------------- |
| **Engine**       | Firefox 157 (Gecko)                                      |
| **UI Framework** | React 18 + TypeScript                                    |
| **Styling**      | CSS Variables + Custom Properties                        |
| **Build System** | [Surfer](https://github.com/zen-browser/surfer) (custom) |
| **Patching**     | Quilt-style patch stacks                                 |
| **Preferences**  | `ffprefs` (Rust) + JSON schemas                          |

---

## 🎨 Features Deep Dive

### Vertical Tab Bar (Native)

Not a sidebar extension, but a **native C++ implementation** integrated into the browser chrome. Smooth animations, collapsible groups, and keyboard-first navigation.

### Command Palette (`Ctrl/Cmd + K`)

Fuzzy-search everything: tabs, history, bookmarks, settings, and custom actions. Extensible via `browser.commands` API.

### Theme System

- **Light / Dark / Auto** (system preference)
- **Custom themes** via CSS variables
- **Accent colors** with live preview
- **Compact / Comfortable / Spacious** density modes

### Hardened Preferences (`prefs/`)

```javascript
// Telemetry & studies (disabled)
"datareporting.healthreport.uploadEnabled": false,
"toolkit.telemetry.enabled": false,
"app.shield.studies.enabled": false,

// Privacy (strengthened)
"network.cookie.cookieBehavior": 4,        // Total cookie protection
"privacy.trackingprotection.enabled": true,
"dom.security.https_only_mode": true,

// Performance
"browser.sessionstore.interval": 120000,   // Less frequent session saves
"config.trim_on_minimize": true,           // Release memory when minimized
```

### Built-in uBlock Origin

Manifest V3 compatible, auto-updated, zero-config. Toggle per-site from the toolbar.

### Live Folders (Experimental)

Smart bookmark folders that auto-populate from queries: `tag:work`, `domain:github.com`, `visited:>7d`.

---

## 🔄 Release Channels

| Channel      | Branch     | Version  | Update Frequency               |
| ------------ | ---------- | -------- | ------------------------------ |
| **Release**  | `stable`   | `1.23.x` | ~6 weeks (Firefox ESR cadence) |
| **Twilight** | `twilight` | `1.24t`  | Weekly (cutting edge)          |

```bash
# Switch channels (rebuild required)
git checkout stable    # Release
git checkout twilight  # Twilight
npm run init && npm run build
```

---

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](docs/contribute.md) and [Code of Conduct](CODE_OF_CONDUCT.md) first.

### Good First Issues

- [🏷️ `good first issue`](https://github.com/AstroDevCompany/desktop/labels/good%20first%20issue)
- [🐛 `bug`](https://github.com/AstroDevCompany/desktop/labels/bug)
- [📝 `documentation`](https://github.com/AstroDevCompany/desktop/labels/documentation)

### Development Workflow

```bash
# 1. Fork & clone
git clone https://github.com/YOUR_FORK/desktop.git
cd desktop

# 2. Create feature branch
git checkout -b feat/amazing-feature dev

# 3. Make changes, test locally
npm run build:ui && npm start

# 4. Lint & format
npm run lint:fix

# 5. Submit PR to `dev` branch
```

### Branch Strategy

```
dev (main) ◄──────────────────────────────────────┐
  │                                               │
  ├── feat/* (feature branches)                   │
  │                                               │
  ▼                                               │
twilight (feature integration)                    │
  │                                               │
  ▼                                               │
stable (release) ──── Hotfixes ──────────────────┘
```

---

## 🔧 Advanced Configuration

### Adding Custom Patches

```bash
# 1. Create patch file
mkdir -p src/external-patches/my-feature
# Add .patch files here

# 2. Register in surfer.json "patches" array
# 3. Rebuild
npm run import && npm run build
```

---

## 📦 Distribution (CS...)

### Official Builds

- **Windows**: `.exe` installer + `.mar` updates
- **macOS**: `.dmg` (universal) + `.mar` updates
- **Linux**: `.tar.xz` + `.mar` updates + Flatpak (community)

### Self-Hosted Updates

Configure `updateHostname` in `surfer.json` and deploy MAR files to your server.

---

## 🛡️ Security

- **Security Policy**: [SECURITY.md](SECURITY.md)
- **Report Vulnerabilities**: [security@peppermint.invalid](mailto:security@peppermint.invalid) (PGP key in SECURITY.md)
- **Dependencies**: Audited via `npm audit` + `cargo audit` in CI

---

## 📄 License

**Mozilla Public License 2.0**; see [LICENSE](LICENSE) or [MPL-2.0](https://www.mozilla.org/MPL/2.0/).

> This project incorporates code from:
>
> - [Mozilla Firefox](https://github.com/mozilla/gecko-dev) (MPL-2.0)
> - [Zen Browser](https://github.com/zen-browser/desktop) (MPL-2.0)
> - [LibreWolf](https://gitlab.com/librewolf-community/browser) (MPL-2.0)
> - [arkenfox user.js](https://github.com/arkenfox/user.js) (Unlicense)

---

## 🙏 Acknowledgments

<div align="center">

| Project                                         | Contribution                               |
| ----------------------------------------------- | ------------------------------------------ |
| [Mozilla](https://mozilla.org/)                 | Firefox engine & platform                  |
| [Zen Browser](https://zen-browser.app/)         | Upstream fork base & Surfer build system   |
| [LibreWolf](https://librewolf.net/)             | Privacy patches & hardened prefs reference |
| [arkenfox](https://github.com/arkenfox/user.js) | Privacy preference templates               |
| [uBlock Origin](https://ublockorigin.com/)      | Built-in content blocking                  |

</div>

---
