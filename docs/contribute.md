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

# Code Of Conduct

Please read our [Code of Conduct](../CODE_OF_CONDUCT.md) before contributing.
