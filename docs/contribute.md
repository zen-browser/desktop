<!--
   - This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/.
   -->

# Branch Structure

The repository is structured as follows:

```
dev (main branch)
 | |
 | \--->-- stable (release branch)
 |   ^
 ^   |
 |   \-<- Hotfix (hotfixes directly from stable)
 |
 \-<- (features branches)
```

The `dev` branch is the main branch of the repository, and it is the default branch for the repository. The `twilight` branch is the feature branch, and it is branched off from the `dev` branch. The `stable` branch is the release branch, and it is branched off from the `dev` branch.

The `stable` branch may have hotfixes directly from the `stable` branch, and the `twilight` branch may have feature branches branched off from the `twilight` branch. This is done so that we can apply hotfixes like security patches directly to the `stable` branch without having to merge the changes from the `twilight` branch.

# Local Development Setup

Before you set up your local development environment, **read our [Building Guidelines](https://docs.zen-browser.app/guides/building)**. Skipping them can lead to avoidable build errors.

For changes to window session restoration, cover both full window sync and
pinned-only/disabled sync. Individually closed fully synced windows remain in
the undo history but should not reopen on startup; windows still open when
quitting, the last normal window, and crash recovery must remain restorable.
The focused regression is
`npm test -- window_sync/browser_closed_window_restore.js`.

# Code Of Conduct

Please read our [Code of Conduct](../CODE_OF_CONDUCT.md) before contributing.
