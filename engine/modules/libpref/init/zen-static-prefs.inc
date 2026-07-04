
- name: zen.boosts.disable-on-anonymous-content
  type: bool
  value: true
  mirror: once
  rust: false

- name: zen.boosts.invert-channel-floor
  type: uint32_t
  value: 15
  mirror: once
  rust: false

- name: zen.haptic-feedback.enabled
  type: bool
  value: true
  mirror: always
  rust: false

- name: zen.swipe.is-fast-swipe
  type: bool
  value: true
  mirror: always
  rust: false

- name: zen.view.grey-out-inactive-windows
  type: bool
  value: true
  mirror: always
  rust: false

#if defined(XP_MACOSX)
- name: zen.widget.macos.window-material
  type: uint32_t
  value: 1
  mirror: always
  rust: false
#endif