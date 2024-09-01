latest_version="$(git describe --tags --abbrev=0)"
sed -i "s/version(.*)/version('${latest_version}')/" ./Casks/zen-browser.rb

sha_x64 = shasum -a 256 ./zen.macos-x64.dmg
sha_arm = shasum -a 256 ./zen.macos-aarch64.dmg

sed -i "s/sha256(.*)/sha256(arm:'${sha_arm}', intel:'${sha_x64}')/" ./Casks/zen-browser.rb


