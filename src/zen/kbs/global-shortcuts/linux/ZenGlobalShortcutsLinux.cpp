/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenGlobalShortcuts.h"

#include "nsString.h"
#include "nsTArray.h"

#include <X11/Xlib.h>
#include <X11/keysym.h>
#include <gdk/gdk.h>
#include <gdk/gdkx.h>

namespace zen {
namespace {

struct LinuxGrab {
  uint32_t internalId;
  unsigned int keycode;
  unsigned int modmask;
};

bool gFilterInstalled = false;
GdkWindow* gFilterWindow = nullptr;
Display* gDisplay = nullptr;
Window gRootWindow = 0;

constexpr unsigned int kRelevantMask =
    ShiftMask | ControlMask | Mod1Mask | Mod4Mask;

constexpr unsigned int kIgnoredMods[] = {
    0,
    LockMask,
    Mod2Mask,
    LockMask | Mod2Mask,
};

nsTArray<LinuxGrab>& Grabs() {
  static nsTArray<LinuxGrab> sGrabs;
  return sGrabs;
}

GdkFilterReturn KeyEventFilter(GdkXEvent* aXEvent, GdkEvent*, gpointer) {
  XEvent* ev = static_cast<XEvent*>(aXEvent);
  if (ev->type != KeyPress) return GDK_FILTER_CONTINUE;

  unsigned int gotMask = ev->xkey.state & kRelevantMask;
  for (const auto& grab : Grabs()) {
    if (grab.keycode == ev->xkey.keycode && grab.modmask == gotMask) {
      ZenGlobalShortcuts::OnNativeShortcut(grab.internalId);
      return GDK_FILTER_REMOVE;
    }
  }
  return GDK_FILTER_CONTINUE;
}

bool EnsureFilter() {
  if (gFilterInstalled) return true;

  GdkDisplay* gdkDisp = gdk_display_get_default();
  if (!gdkDisp || !GDK_IS_X11_DISPLAY(gdkDisp)) {
    return false;
  }

  GdkWindow* root = gdk_get_default_root_window();
  if (!root) return false;

  gDisplay = GDK_WINDOW_XDISPLAY(root);
  gRootWindow = GDK_WINDOW_XID(root);
  if (!gDisplay) return false;

  gFilterWindow = static_cast<GdkWindow*>(g_object_ref(root));
  gdk_window_add_filter(gFilterWindow, KeyEventFilter, nullptr);
  gFilterInstalled = true;
  return true;
}

bool ResolveKey(const nsACString& aKey, KeySym& aOut) {
  if (aKey.Length() == 1) {
    char c = aKey[0];
    if (c >= 'a' && c <= 'z') c = char(c - 32);
    if (c >= 'A' && c <= 'Z') {
      aOut = XK_A + (c - 'A');
      return true;
    }
    if (c >= '0' && c <= '9') {
      aOut = XK_0 + (c - '0');
      return true;
    }
    return false;
  }
  if (aKey.LowerCaseEqualsLiteral("space")) {
    aOut = XK_space;
    return true;
  }
  if ((aKey.Length() == 2 || aKey.Length() == 3) &&
      (aKey[0] == 'F' || aKey[0] == 'f')) {
    int n = aKey[1] - '0';
    if (n < 0 || n > 9) return false;
    if (aKey.Length() == 3) {
      int d = aKey[2] - '0';
      if (d < 0 || d > 9) return false;
      n = n * 10 + d;
    }
    if (n >= 1 && n <= 12) {
      aOut = XK_F1 + (n - 1);
      return true;
    }
  }
  return false;
}

unsigned int ToX11Modifiers(uint32_t aMods) {
  unsigned int m = 0;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_SHIFT) m |= ShiftMask;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_CTRL)  m |= ControlMask;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_ALT)   m |= Mod1Mask;
  if (aMods & nsIZenGlobalShortcuts::MODIFIER_META)  m |= Mod4Mask;
  return m;
}

void UngrabAll(unsigned int aKeycode, unsigned int aModmask) {
  GdkDisplay* gdkDisp = gdk_display_get_default();
  gdk_x11_display_error_trap_push(gdkDisp);
  for (unsigned int extra : kIgnoredMods) {
    XUngrabKey(gDisplay, aKeycode, aModmask | extra, gRootWindow);
  }
  XSync(gDisplay, False);
  gdk_x11_display_error_trap_pop_ignored(gdkDisp);
}

}  // namespace

// static
nsresult ZenGlobalShortcuts::NativeRegister(Registration& aReg,
                                            const nsACString& aKey,
                                            uint32_t aModifiers) {
  if (!EnsureFilter()) return NS_ERROR_FAILURE;

  KeySym sym;
  if (!ResolveKey(aKey, sym)) return NS_ERROR_INVALID_ARG;

  unsigned int keycode = XKeysymToKeycode(gDisplay, sym);
  if (keycode == 0) return NS_ERROR_FAILURE;

  unsigned int modmask = ToX11Modifiers(aModifiers);

  GdkDisplay* gdkDisp = gdk_display_get_default();
  gdk_x11_display_error_trap_push(gdkDisp);
  for (unsigned int extra : kIgnoredMods) {
    XGrabKey(gDisplay, keycode, modmask | extra, gRootWindow, True,
             GrabModeAsync, GrabModeAsync);
  }
  XSync(gDisplay, False);
  if (gdk_x11_display_error_trap_pop(gdkDisp) != 0) {
    UngrabAll(keycode, modmask);
    return NS_ERROR_FAILURE;
  }

  Grabs().AppendElement(LinuxGrab{aReg.internalId, keycode, modmask});
  aReg.nativeHandle =
      reinterpret_cast<void*>(static_cast<uintptr_t>(aReg.internalId));
  return NS_OK;
}

// static
void ZenGlobalShortcuts::NativeUnregister(Registration& aReg) {
  if (!aReg.nativeHandle || !gDisplay) return;

  uint32_t internalId = static_cast<uint32_t>(
      reinterpret_cast<uintptr_t>(aReg.nativeHandle));

  auto& grabs = Grabs();
  for (size_t i = 0; i < grabs.Length(); ++i) {
    if (grabs[i].internalId == internalId) {
      const LinuxGrab g = grabs[i];
      UngrabAll(g.keycode, g.modmask);
      grabs.RemoveElementAt(i);
      break;
    }
  }
  aReg.nativeHandle = nullptr;
}

// static
void ZenGlobalShortcuts::NativeShutdown() {
  if (gFilterInstalled && gFilterWindow) {
    gdk_window_remove_filter(gFilterWindow, KeyEventFilter, nullptr);
    g_object_unref(gFilterWindow);
    gFilterWindow = nullptr;
  }
  gFilterInstalled = false;
  Grabs().Clear();
  gDisplay = nullptr;
  gRootWindow = 0;
}

}  // namespace zen
