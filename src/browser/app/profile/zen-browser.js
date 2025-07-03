# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

#ifdef XP_UNIX
  #ifndef XP_MACOSX
    #define UNIX_BUT_NOT_MAC
  #endif
#endif

# Dont download the multilingual dictionary
pref("intl.multilingual.downloadEnabled", false);

#ifdef XP_WIN
  #include windows.inc
#endif

#ifdef UNIX_BUT_NOT_MAC
  #include linux.inc
#endif

#ifdef XP_MACOSX
  #include macos.inc
#endif

#include urlbar.inc
#include newtab.inc
#include pdf.inc
#include extensions.inc
#include privacy.inc
#include media.inc
#include browser.inc

#include features.inc

#ifndef XP_MACOSX
  #include smoothscroll.inc
#endif

#include performance.inc
#include pip.inc
