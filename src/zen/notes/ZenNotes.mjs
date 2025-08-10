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
    // For MVP: Just show a simple alert
    // Later: Create a proper note creation dialog
    alert('Note creation coming soon! This is the MVP version.');
    
    // TODO: Implement proper note creation
    // 1. Show note creation dialog
    // 2. Create note in sidebar
    // 3. Save note to storage
  }

  // ... rest of implementation will come later
});

console.log('[ZenNotes] Module loaded, gZenNotes created');
