<div align="center">
<picture>
    <img src="./docs/assets/zen-black.svg" width="128px">
</picture>
</div>
<h1 align="center">
Zen Browser
</h1>

Experience tranquillity while browsing the web without people tracking you!

- [Website](https://zen-browser.app)
- [Download](https://zen-browser.app/download)
- [Release Notes](https://zen-browser.app/release-notes/latest)

[![Downloads](https://img.shields.io/github/downloads/zen-browser/desktop/total.svg)](https://github.com/zen-browser/desktop/releases)
[![Crowdin](https://badges.crowdin.net/zen-browser/localized.svg)](https://crowdin.com/project/zen-browser)

[![Flathub](https://flathub.org/api/badge?locale=en)](https://flathub.org/apps/io.github.zen_browser.zen)

[![Patreon](https://c5.patreon.com/external/logo/become_a_patron_button.png)](https://www.patreon.com/zen_browser)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/zen_browser)

# Compatibility

Zen is currently built using firefox version `131.0.2`!

- Check out the latest [release notes](https://zen-browser.app/release-notes)!

# Performance

Zen is built with performance in mind, and we have optimized the browser to be as fast as possible!

- Checkout the latest [performance benchmarks](https://docs.zen-browser.app/benchmarks)!

# Installation

## Supported Operating Systems

Zen is available for Linux, macOS, and Windows. You can download the latest version from the official website at [zen-browser.app](https://zen-browser.app/download), or from the [GitHub Releases](https://github.com/zen-browser/desktop/releases) page.

### Windows

#### Winget

- Generic

```
winget install --id Zen-Team.Zen-Browser
```

- Optimized

```
winget install --id Zen-Team.Zen-Browser.Optimized
```

####

### macOS

- Requires macOS 10.15 or later
- Available for ARM and Intel architectures

You can also install Zen using Homebrew:

```
brew install --cask zen-browser
```

### Linux

#### AppImage

- `zsync` is required for the Update feature of the script below

```
bash <(curl https://updates.zen-browser.app/appimage.sh)
```

#### Flatpak

```
flatpak install flathub io.github.zen_browser.zen
```

#### CachyOS
##### Generic
```
sudo pacman -S zen-browser-bin
```

##### Optimized 
```
sudo pacman -S zen-browser-avx2-bin
```

To upgrade the browser to a newer version, use the embedded update functionality in `About Zen`.

# Core Components

Some components used by @zen-browser as an attempt to make firefox forks a better place. You can find them [here](https://github.com/zen-browser/components).

## 🚀 Run Locally

Clone the project

```bash
git clone https://github.com/zen-browser/desktop.git --recurse-submodules
cd desktop
```

Install dependencies

```bash
pnpm install
```

Download and bootstrap the browser

```bash
pnpm run init
```

Copy a language pack

```bash
sh scripts/update-en-US-packs.sh
```

Start building the browser

```bash
pnpm run build
```

Finally, run the browser!

```bash
pnpm start
```

### Development

To view changes you've made, run

```bash
pnpm build:ui && pnpm start
```

## Special Thanks

- [IAmJafeth](https://github.com/IAmJafeth) (For sponsoring the domain)
- [Donno 🐒](https://www.onnno.nl/) (For making the logo)
- [ptr1337](https://github.com/ptr1337) (AUR Packages and optimization flags)
- [nitro](https://github.com/n7itro) (For the amazing work on the browser)

## Third Party Code

Zen couldn't be in its current state without the help of these amazing projects!

- Zen's default preferences are based on [BetterFox](https://github.com/yokoffing/Betterfox)

## License

[MPL LICENSE](./LICENSE)

## Star History

<a href="https://star-history.com/#zen-browser/desktop&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=zen-browser/desktop&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=zen-browser/desktop&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=zen-browser/desktop&type=Date" />
 </picture>
</a>
