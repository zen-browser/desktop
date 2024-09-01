cask("zen-browser") do
  arch(arm: "aarch64", intel: "x64")
  version("1.0.0-a.34")
  sha256(arm: "6cc6e72c4a6a11d0139489d438ccf811715e170eebc01da739da32ace2580747", intel: "b9cb48f21a4ee39f3f3ae2361b9b0a55ae7219638cf798e1483c0eb8cf4660a6")

  url("https://github.com/zen-browser/desktop/releases/download/#{version}/zen.macos-#{arch}.dmg")
  name("Zen Browser")
  desc("Beautifully designed, privacy-focused browser packed with awesome features")
  homepage("https://zen-browser.app/")

  livecheck do
    url(:stable)
    regex(/[0-9].*-a.[0-9]*/i)
  end

  zap trash: [
    "~/Library/Preferences/org.mozilla.com.zen.browser.plist",
    "~/Library/Saved Application State/org.mozilla.com.zen.browser.savedState"
  ]

  app("Zen Browser.app")

  postflight do
    system("xattr -c '/Applications/Zen Browser.app/'")
  end
end
