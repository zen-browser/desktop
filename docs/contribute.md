
# Branch Structure

The repository is structured as follows:

```
main (default branch) 
  |
  ├── twilight (beta testing branch)
  |
  ├── alpha (stable branch)
  |
  └── ... (other branches)
```

You, as a contributor, should create a pull request to the `main` branch. The pull request will be reviewed and merged into the `twilight` branch. After the beta testing phase, the `twilight` branch will be merged into the `stable` branch.

This way, we can push changes to the `stable` branch with quick fixes without having new features that are not tested yet, in case an emergency fix is needed.
