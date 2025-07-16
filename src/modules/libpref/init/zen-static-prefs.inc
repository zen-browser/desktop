
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

#if defined(XP_MACOSX)
- name: zen.widget.macos.window-material
  type: uint32_t
  value: 1
  mirror: always
  rust: false
#endif