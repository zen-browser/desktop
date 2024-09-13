# Custom Keyboard Shortcuts

```json
{
  "<shortcut-id>": {
    "key": "<key>",
    "alt": false,
    "shift": false,
    "ctrl": false,
    "meta": false,
    "keycode": 0
  }
}
```

The `key` field is the key that will trigger the shortcut. The `alt`, `shift`, `ctrl`, and `meta` fields are booleans that indicate if the respective modifier key should be pressed when the shortcut is triggered.

The `keycode` field is the keycode of the key that will trigger the shortcut. This field is optional and can be used to specify the keycode of the key that will trigger the shortcut. If the `keycode` field is specified, the `key` field will be ignored.
