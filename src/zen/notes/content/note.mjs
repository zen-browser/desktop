// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

class NoteEditor {
    constructor() {
      this.noteTitle = document.getElementById('note-title');
      this.noteText = document.getElementById('note-text');
      this.init();
    }
  
    init() {
      console.log('[NoteEditor] Initializing note editor');
      
      // Set page title
      document.title = "New Note";
      
      // Add event listeners
      this.noteTitle.addEventListener('input', this.handleTitleChange.bind(this));
      this.noteText.addEventListener('input', this.handleTextChange.bind(this));
      
      // Focus on title
      this.noteTitle.focus();
    }
  
    handleTitleChange(event) {
      const title = event.target.value || "Untitled Note";
      document.title = title;
      console.log('[NoteEditor] Title changed:', title);
    }
  
    handleTextChange(event) {
      console.log('[NoteEditor] Text changed, length:', event.target.value.length);
    }
  }
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[NoteEditor] DOM ready, creating editor');
    window.noteEditor = new NoteEditor();
  });
  
  console.log('[NoteEditor] Module loaded');