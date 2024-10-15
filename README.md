<img src="./docs/assets/zen-black.svg" width="100px" align="left">

### `Zen Browser`

[![Downloads](https://img.shields.io/github/downloads/zen-browser/desktop/total.svg)](https://github.com/zen-browser/desktop/releases)
[![Crowdin](https://badges.crowdin.net/zen-browser/localized.svg)](https://crowdin.com/project/zen-browser)


Experience tranquillity while browsing the web without people tracking you! Zen is a privacy-focused browser that blocks trackers, ads, and other unwanted content while offering the best browsing experience!

- [Website](https://zen-browser.app)
- [Download](https://zen-browser.app/download)
- [Release Notes](https://zen-browser.app/release-notes/latest)

# Compatibility

Zen is currently built using firefox version `131.0.3`!

- Check out the latest [release notes](https://zen-browser.app/release-notes)!
- Part of our mission is to keep Zen up-to-date with the latest version of Firefox, so you can enjoy the latest features and security updates!

# Contribution

Zen is an open-source project, and we welcome contributions from the community! Please take a looka at the [contribution guidelines](./docs/contribute.md) before getting started!

# Performance

Zen is built with performance in mind, and we have optimized the browser to be as fast as possible! Checkout the latest [performance benchmarks](https://docs.zen-browser.app/benchmarks)!

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

#### Arch-based distributions

##### Generic

```
yay -S zen-browser-bin
```

##### Optimized 

```
yay -S zen-browser-avx2-bin
```

To upgrade the browser to a newer version, use the embedded update functionality in `About Zen`.

# Core Components

Some components used by @zen-browser as an attempt to make firefox forks a better place, and for other to enjoy the beauty of OSS. You can find them [here](https://github.com/zen-browser/components).

### 🚀 Run Locally

In order to download and run zen locally, please follow [these instructions](https://docs.zen-browser.app/contribute/desktop).

### Special Thanks

Special thanks to... EVERYONE 🎉! Checkout the team and contributors page [here](https://zen-browser.app/about)

### Third Party Code

Zen couldn't be in its current state without the help of these amazing projects!

- Zen's default preferences are based on [BetterFox](https://github.com/yokoffing/Betterfox)

### Comparison with other browsers

As you can see, chromium based browsers are the most popular browsers, help us change that by starring the project and spreading the word!

<a href="https://star-history.com/#zen-browser/desktop&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=zen-browser/desktop,chromium/chromium,brave/brave-browser&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=zen-browser/desktop,chromium/chromium,brave/brave-browser&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=chromium/chromium,zen-browser/desktop,brave/brave-browser&type=Date" />
 </picture>
</a>

## License

Zen browser is under the [MPL LICENSE](./LICENSE).
