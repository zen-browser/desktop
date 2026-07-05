<!--
   - This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/.
   -->
<!-- TODO: Get a job -->

<p align="center">
  <img src="./docs/assets/zen-dark.svg" width="120px" alt="Nixo Browser Logo">
</p>

<h1 align="center">🔮 Nixo Browser</h1>

<p align="center">
  <strong>A gorgeous, productivity-oriented fork of Zen Browser, built on top of Firefox.</strong>
</p>

<p align="center">
  <a href="https://github.com/nixo-browser/nixo/releases">
    <img src="https://img.shields.io/github/downloads/nixo-browser/nixo/total.svg?style=flat-square&color=8A2BE2" alt="Downloads">
  </a>
  <a href="https://crowdin.com/project/nixo-browser">
    <img src="https://badges.crowdin.net/nixo-browser/localized.svg" alt="Crowdin Status">
  </a>
  <a href="https://github.com/nixo-browser/nixo/actions/workflows/build.yml">
    <img src="https://github.com/nixo-browser/nixo/actions/workflows/build.yml/badge.svg?branch=stable" alt="Nixo Release Builds">
  </a>
  <a href="https://github.com/nixo-browser/nixo/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/nixo-browser/nixo?style=flat-square&color=blue" alt="License">
  </a>
</p>

<p align="center">
  <a href="https://nixo.app/download">🚀 Download</a>
  •
  <a href="https://nixo.app">🌐 Website</a>
  •
  <a href="https://docs.nixo.app">📖 Documentation</a>
  •
  <a href="https://nixo.app/release-notes/latest">📝 Release Notes</a>
</p>

---

## 🌟 What is Nixo?

**Nixo** is an open-source, community-driven web browser built as a fork of the revolutionary **Zen Browser** (which is built on top of the robust and privacy-centric **Mozilla Firefox** engine). 

Our mission is to deliver the absolute best browsing experience: **beautifully simple**, **inherently private**, and **highly productive**. With vertical tab layout, workspaces, and powerful sidebar features, Nixo is designed to keep you focused and organized.

---

## ✨ Core Features

| Feature | Description |
| :--- | :--- |
| **🌐 Sidebar-First Navigation** | A gorgeous, collapsible vertical sidebar for tabs and workspaces, freeing up your vertical screen space. |
| **🛡️ Privacy Redefined** | No tracking, no telemetry, and out-of-the-box ad blocking capabilities. You are in control of your data. |
| **🎨 Extravagant Customization** | Built-in theme store and user-CSS support. Control colors, borders, fonts, and behaviors down to the pixel. |
| **⚡ Blazing Fast Engine** | Leverages the hardened Firefox engine with optimized compiler flags and memory management. |
| **📦 Add-on Compatibility** | Access thousands of extensions from the Mozilla Firefox Add-ons library out of the box. |
| **📁 Smart Workspaces** | Organize tabs into dedicated context groups (e.g., *Work*, *Personal*, *Project X*) with one-click toggles. |

---

## 🚀 Firefox Alignment

Nixo stays fully aligned with Firefox release cycles to ensure you always have the latest stability and security updates.

*   **Stable Channel:** Built using Firefox **`152.0.4`** 🚀
*   **Twilight Channel:** Built using Firefox **`RC 152.0.4`** 🧪

---

## 🛠️ Building Nixo from Source

We welcome developers who want to tinker with the code! Because Nixo compiles a complete web browser engine, the build system has specific requirements.

### 📋 Prerequisites

Ensure your system meets these specifications:
*   **Disk Space:** At least **30 GB** of free space (compiling a browser requires substantial storage).
*   **Node.js:** Version **`v21+`** (LTS/latest recommended).
*   **Python:** Version **`3.10+`** (required by Firefox's build system `mach`).
*   **Rust & Cargo:** Necessary for compiling Rust-based backend modules.

### 💻 Step-by-Step Build Guide

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/nixo-browser/nixo.git
   cd nixo
   ```

2. **Install Node Dependencies:**
   ```bash
   npm install
   ```

3. **Initialize the Environment:**
   Nixo uses `@zen-browser/surfer` to automatically download browser engines, apply system patches, and bootstrap the build environment:
   ```bash
   npm run init
   ```

4. **Build UI and Assets:**
   ```bash
   npm run build
   ```

5. **Launch Nixo Browser:**
   Run the newly compiled browser instance:
   ```bash
   npm run start
   ```

---

## 🌿 Branch & Development Structure

Nixo's branches are structured to facilitate stable development and rapid security patching:

```
dev (Main development branch)
 │
 ├───> stable (Release branch)
 │       ^
 │       └─── Hotfix (Direct hotfixes for stable releases)
 │
 └───> twilight (Experimental features branch)
```

*   `dev`: The main branch. All features start here.
*   `stable`: The release branch containing production-grade code.
*   `twilight`: The experimental branch for previewing features before they land in stable.

---

## 🌐 Localization and Translations

Help us localize Nixo Browser into your language! We use Crowdin to make translations accessible and community-friendly.

👉 **[Join the Nixo Crowdin Project](https://crowdin.com/project/nixo-browser)**

---

## 🤝 Contributing

We love contributions! If you're ready to jump in:
1. Please read our [Contribution Guidelines](./docs/contribute.md).
2. Read the [Code of Conduct](./CODE_OF_CONDUCT.md).
3. Open an issue on the [GitHub Issues](https://github.com/nixo-browser/nixo/issues) board for bugs or feature requests.

---

## 💖 Special Thanks & Partners

A massive thank you to our partners and the open-source community who support Nixo's development:

<a href="https://blacksmith.sh">
  <img src="./docs/assets/blacksmith-yellow.png" width="300px" alt="Blacksmith Logo"/>
</a>

---

## 📄 License

This project is licensed under the **Mozilla Public License 2.0 (MPL-2.0)**. Refer to the [LICENSE](./LICENSE) file for more information.
