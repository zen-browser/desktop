# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

(New-Object System.Net.WebClient).DownloadFile("https://ftp.mozilla.org/pub/mozilla/libraries/win32/MozillaBuildSetup-Latest.exe", "C:\MozillaBuildSetup-Latest.exe")
C:\MozillaBuildSetup-Latest.exe /S | out-null

rustup target add aarch64-pc-windows-msvc
rustup target add x86_64-pc-windows-msvc

cd engine
./mach python --virtualenv build taskcluster/scripts/misc/get_vs.py build/vs/vs2022.yaml ../win-cross/vs2022
cd ..
