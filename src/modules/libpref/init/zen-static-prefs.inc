
# Dummy pref to always generate StaticPrefs_zen.h in every OS
- name: zen.browser.is-cool
  type: bool
  value: true
  mirror: never

#ifdef XP_MACOSX
- name: zen.widget.macos.window-material
  type: uint32_t
  value: 1
  mirror: always
#endif

- name: zen.haptic-feedback.enabled
  type: bool
  value: true
  mirror: always
