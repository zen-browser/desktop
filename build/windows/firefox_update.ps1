# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

Remove-Item -Recurse -Force engine
Remove-Item -Recurse -Force .surfer

npm run init

$job = Start-Job -ScriptBlock {
    npm run build
}

# Wait for job to complete with timeout (in seconds)
$job | Wait-Job -Timeout 5
