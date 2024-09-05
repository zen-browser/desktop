cask "zen-browser" do
  arch arm: "aarch64", intel: "x64"

  version "1.0.0-a.34"
  sha256 arm:   "6cc6e72c4a6a11d0139489d438ccf811715e170eebc01da739da32ace2580747",
         intel: "b9cb48f21a4ee39f3f3ae2361b9b0a55ae7219638cf798e1483c0eb8cf4660a6"

  url "https://github.com/zen-browser/desktop/releases/download/#{version}/zen.macos-#{arch}.dmg",
      verified: "github.com/zen-browser/desktop/"
  name "Zen Browser"
  desc "Beautifully designed, privacy-focused browser packed with awesome features"
  homepage "https://zen-browser.app/"

  auto_updates true
  depends_on macos: ">= :catalina"

  app "Zen Browser.app"

  postflight do
    system "xattr -d com.apple.quarantine '/Applications/Zen Browser.app/'"
  end

  zap trash: [
        "~/Library/Application Support/zen",
        "~/Library/Caches/Mozilla/updates/Applications/Zen Browser",
        "~/Library/Caches/zen",
        "~/Library/Preferences/org.mozilla.com.zen.browser.plist",
        "~/Library/Saved Application State/org.mozilla.com.zen.browser.savedState",
      ],
      rmdir: "~/Library/Caches/Mozilla"
end
