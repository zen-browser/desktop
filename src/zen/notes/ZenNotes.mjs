// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var gZenNotes = new (class extends nsZenMultiWindowFeature {
  constructor() {
    super();
    this.notes = new Map();
    this.activeNote = null;
    XPCOMUtils.defineLazyPreferenceGetter(this, 'notesEnabled', 'zen.notes.enabled', true);
    console.log('[ZenNotes] Constructor called');
  }

  async init() {
    console.log('[ZenNotes] Init called');
    if (!this.notesEnabled) {
      console.log('[ZenNotes] Notes disabled, returning');
      return;
    }
    this.ownerWindow = window;
    console.log('[ZenNotes] Initialized successfully');
  }

  openNoteCreation() {
    console.log('[ZenNotes] openNoteCreation called');
    
    // Try using the browser chrome namespace instead
    const noteURL = 'chrome://browser/content/zen-notes/note.xhtml';
    
    // Get the system principal for chrome URLs
    const systemPrincipal = Services.scriptSecurityManager.getSystemPrincipal();
    
    const newTab = window.gBrowser.addTab(noteURL, {
      triggeringPrincipal: systemPrincipal,
      relatedToCurrent: true
    });
    
    // Switch to the new tab
    window.gBrowser.selectedTab = newTab;
    
    console.log('[ZenNotes] Note tab opened:', noteURL);
  }

  // ... rest of implementation will come later
});

console.log('[ZenNotes] Module loaded, gZenNotes created');
