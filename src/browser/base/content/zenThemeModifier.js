
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

 "use strict";

/* INCLUDE THIS FILE AS:
 *   <script src="chrome://browser/content/zenThemeModifier.js"></script>
 *
 * FOR ANY WEBSITE THAT WOULD NEED TO USE THE ACCENT COLOR, ETC
 */

 {
  const kZenThemeAccentColorPref = "zen.theme.accent-color";

   /**
    * ZenThemeModifier controls the application of theme data to the browser,
    * for examplem, it injects the accent color to the document. This is used
    * because we need a way to apply the accent color without having to worry about
    * shadow roots not inheriting the accent color.
    * 
    * note: It must be a firefox builtin page with access to the browser's configuration
    *  and services.
    */
   const ZenThemeModifier = {
     /**
      * Listen for theming updates from the LightweightThemeChild actor, and
      * begin listening to changes in preferred color scheme.
      */
     init() {
      addEventListener("LightweightTheme:Set", this);
      Services.prefs.addObserver(kZenThemeAccentColorPref, this.handleEvent.bind(this));
      this.updateAllThemeBasics();
     },
 
     handleEvent(event) {
       // note: even might be undefined, but we shoudnt use it!
       this.updateAllThemeBasics();
     },

      /**
        * Update all theme basics, like the accent color.
        */
      updateAllThemeBasics() {
        this.updateAccentColor();
      },

      /**
       * Update the accent color.
       */
      updateAccentColor() {
        const accentColor = Services.prefs.getStringPref(kZenThemeAccentColorPref, "#0b57d0");
        document.documentElement.style.setProperty("--zen-primary-color", accentColor);
      },
 
   };
   ZenThemeModifier.init();
 }
 
