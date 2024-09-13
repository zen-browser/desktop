# Workspaces Layout

```json
{
  "workspaces": [
    {
      "uuid": "uuid1",
      "name": "workspace1",
      "icon": "icon1",
      "default": true
    },
    ...
  ]
}
```

To save the tabs and identity them, they will contain a `zen-workspace-uuid` attribute with the workspace uuid.

We will make use of firefox's builtin session restore feature to save the tabs and windows after the user closes the browser.
