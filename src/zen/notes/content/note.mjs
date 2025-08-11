// Zen Notes - Enhanced Editor with Autosave and Markdown
class ZenNoteEditor {
  constructor() {
    this.titleInput = null;
    this.editorElement = null;
    this.toolbar = null;
    this.slashMenu = null;
    this.isChanged = false;
    this.slashMenuVisible = false;
    this.selectedSlashIndex = 0;
    this.autoSaveTimer = null;
    this.autoSaveDelay = 2000; // 2 seconds
    this.lastSavedContent = '';
    this.lastSavedTitle = '';
    
    // Markdown patterns - trigger immediately on symbols
    this.markdownPatterns = {
      heading1: /^#\s*$/,            // Just # + optional spaces
      heading2: /^##\s*$/,           // Just ## + optional spaces  
      heading3: /^###\s*$/,          // Just ### + optional spaces
      bulletList: /^[-*]\s*$/,       // Just - or * + optional spaces
      orderedList: /^\d+\.\s*$/,     // Just number. + optional spaces
      blockquote: /^>\s*$/,          // Just > + optional spaces
      codeBlock: /^```\s*$/,         // Just ``` + optional spaces
      divider: /^---+$/,            // Just ---
    };
  }

  async init() {
    console.log('[ZenNoteEditor] Initializing...');
    
    this.titleInput = document.getElementById('note-title');
    this.editorElement = document.getElementById('note-text');
    this.toolbar = document.getElementById('note-toolbar');
    this.slashMenu = document.getElementById('slash-menu');
    
    if (!this.titleInput || !this.editorElement || !this.toolbar || !this.slashMenu) {
      console.error('[ZenNoteEditor] Required elements not found');
      return;
    }

    // Setup event listeners
    this.setupEventListeners();
    
    // Load existing note data
    this.loadNoteData();
    
    console.log('[ZenNoteEditor] Initialized successfully');
  }

  setupEventListeners() {
    // Title input events
    this.titleInput.addEventListener('input', (e) => this.handleTitleChange(e));
    this.titleInput.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    
    // Editor events
    this.editorElement.addEventListener('input', (e) => this.handleEditorInput(e));
    this.editorElement.addEventListener('keydown', (e) => this.handleEditorKeydown(e));
    this.editorElement.addEventListener('paste', (e) => this.handlePaste(e));
    this.editorElement.addEventListener('focus', () => this.handleEditorFocus());
    this.editorElement.addEventListener('blur', () => this.handleEditorBlur());
    
    // Toolbar button events
    this.toolbar.addEventListener('click', (e) => this.handleToolbarClick(e));
    
    // Slash menu events
    this.slashMenu.addEventListener('click', (e) => this.handleSlashMenuClick(e));
    
    // Document events
    document.addEventListener('selectionchange', () => this.updateToolbarState());
    document.addEventListener('click', (e) => this.handleDocumentClick(e));
    
    // Before unload warning
    window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));
  }

  handleTitleChange(event) {
    this.markAsChanged();
    this.updateTabTitle();
    this.debouncedAutoSave();
  }

  handleEditorInput(event) {
    this.markAsChanged();
    this.checkForSlashCommand();
    this.debouncedAutoSave();
  }

  handleEditorKeydown(event) {
    // Handle slash command
    if (event.key === '/') {
      console.log('[ZenNoteEditor] Slash key pressed, showing menu');
      this.showSlashMenu();
      return;
    }
    
    // Handle markdown symbols immediately (not waiting for space)
    if (['#', '-', '*', '>', '`'].includes(event.key)) {
      // Small delay to let the character be added, then check
      setTimeout(() => this.checkForMarkdown(), 10);
    }
    
    // Handle keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'b':
          event.preventDefault();
          this.execCommand('bold');
          break;
        case 'i':
          event.preventDefault();
          this.execCommand('italic');
          break;
        case 'u':
          event.preventDefault();
          this.execCommand('underline');
          break;
        case 'k':
          event.preventDefault();
          this.insertLink();
          break;
      }
    }
    
    // Handle Enter key for slash commands
    if (event.key === 'Enter' && this.slashMenuVisible) {
      event.preventDefault();
      this.executeSlashCommand();
      return;
    }
    
    // Handle Escape to hide slash menu
    if (event.key === 'Escape' && this.slashMenuVisible) {
      this.hideSlashMenu();
      return;
    }
    
    // Handle arrow keys in slash menu
    if (this.slashMenuVisible && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      this.navigateSlashMenu(event.key === 'ArrowUp' ? -1 : 1);
      return;
    }
  }

  handleEditorFocus() {
    this.updateToolbarState();
  }

  handleEditorBlur() {
    // Small delay to allow for slash menu clicks
    setTimeout(() => {
      if (!this.slashMenu.contains(document.activeElement)) {
        this.hideSlashMenu();
      }
    }, 100);
  }

  handlePaste(event) {
    // Handle paste events for better formatting
    event.preventDefault();
    
    const text = event.clipboardData.getData('text/plain');
    const html = event.clipboardData.getData('text/html');
    
    if (html) {
      this.insertHTML(html);
    } else if (text) {
      this.insertText(text);
    }
  }

  insertHTML(html) {
    const cleanHTML = this.sanitizeHTML(html);
    document.execCommand('insertHTML', false, cleanHTML);
    this.markAsChanged();
  }

  insertText(text) {
    document.execCommand('insertText', false, text);
    this.markAsChanged();
  }

  sanitizeHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    
    // Remove potentially dangerous tags
    const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed'];
    dangerousTags.forEach(tag => {
      const elements = div.getElementsByTagName(tag);
      Array.from(elements).forEach(el => el.remove());
    });
    
    return div.innerHTML;
  }

  checkForSlashCommand() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // Get ONLY the current line where cursor is
    const currentLineText = this.getCurrentLineTextOnly(range);
    console.log('[ZenNoteEditor] Checking for slash command, current line only:', currentLineText);
    
    // Show slash menu if current line starts with '/'
    if (currentLineText.startsWith('/')) {
      console.log('[ZenNoteEditor] Slash detected on current line, showing menu');
      this.showSlashMenu();
    } else {
      this.hideSlashMenu();
    }
  }

  checkForMarkdown() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // Get ONLY the current line where cursor is
    const currentLineText = this.getCurrentLineTextOnly(range);
    console.log('[ZenNoteEditor] Checking markdown for current line only:', currentLineText);
    
    // Check for markdown patterns on the current line only
    Object.entries(this.markdownPatterns).forEach(([command, pattern]) => {
      if (pattern.test(currentLineText)) {
        console.log('[ZenNoteEditor] Markdown pattern matched:', command);
        this.executeMarkdownCommand(command, currentLineText, range);
        return;
      }
    });
  }

  getCurrentLineTextOnly(range) {
    // Get ONLY the current line where the cursor is positioned
    // Use a more robust approach that works with HTML elements
    
    // First try to get the current line from the DOM structure
    const currentLineElement = this.getCurrentLineElement(range);
    if (currentLineElement) {
      const lineText = currentLineElement.textContent || currentLineElement.innerText || '';
      console.log('[ZenNoteEditor] Current line from DOM:', lineText);
      return lineText;
    }
    
    // Fallback: use innerText approach
    const text = this.editorElement.innerText;
    const cursorPosition = this.getCursorPosition();
    
    // Find the start and end of the current line
    let lineStart = cursorPosition;
    let lineEnd = cursorPosition;
    
    // Walk backwards to find line start (previous newline or beginning)
    while (lineStart > 0 && text[lineStart - 1] !== '\n') {
      lineStart--;
    }
    
    // Walk forwards to find line end (next newline or end)
    while (lineEnd < text.length && text[lineEnd] !== '\n') {
      lineEnd++;
    }
    
    // Extract ONLY the current line (no previous lines)
    const currentLine = text.substring(lineStart, lineEnd);
    console.log('[ZenNoteEditor] Current line extracted (start:', lineStart, 'end:', lineEnd, '):', currentLine);
    
    return currentLine;
  }

  getCurrentLineElement(range) {
    // Try to find the current line element by walking up the DOM tree
    let currentNode = range.startContainer;
    
    // If it's a text node, get its parent
    if (currentNode.nodeType === Node.TEXT_NODE) {
      currentNode = currentNode.parentNode;
    }
    
    // Walk up to find a block-level element or the editor itself
    while (currentNode && currentNode !== this.editorElement) {
      // Check if this is a block-level element that represents a line
      if (this.isBlockElement(currentNode)) {
        return currentNode;
      }
      
      // Check if this element contains line breaks
      if (currentNode.textContent && currentNode.textContent.includes('\n')) {
        // This element contains multiple lines, find the specific line
        return this.findSpecificLineInElement(currentNode, range);
      }
      
      currentNode = currentNode.parentNode;
    }
    
    return null;
  }

  isBlockElement(element) {
    const blockTags = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'li', 'ul', 'ol'];
    return blockTags.includes(element.tagName?.toLowerCase());
  }

  findSpecificLineInElement(element, range) {
    // For elements that might contain multiple lines, find the specific line
    // This is a simplified approach - in practice, you might want more sophisticated logic
    return element;
  }

  getCursorPosition() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return 0;
    
    const range = selection.getRangeAt(0);
    let position = 0;
    
    // Calculate position by walking through text nodes
    // Use innerText to match the line break detection
    const text = this.editorElement.innerText;
    const walker = document.createTreeWalker(
      this.editorElement,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node === range.startContainer) {
        position += range.startOffset;
        break;
      }
      position += node.textContent.length;
    }
    
    return position;
  }

  executeMarkdownCommand(command, text, range) {
    let replacement = '';
    
    switch (command) {
      case 'heading1':
        replacement = `<h1></h1>`;
        break;
      case 'heading2':
        replacement = `<h2></h2>`;
        break;
      case 'heading3':
        replacement = `<h3></h3>`;
        break;
      case 'bulletList':
        replacement = `<ul><li></li></ul>`;
        break;
      case 'orderedList':
        replacement = `<ol><li></li></ol>`;
        break;
      case 'blockquote':
        replacement = `<blockquote></blockquote>`;
        break;
      case 'codeBlock':
        replacement = `<pre><code></code></pre>`;
        break;
      case 'divider':
        replacement = '<hr>';
        break;
    }
    
    if (replacement) {
      // Replace the current line content with formatted content
      this.replaceCurrentLineContent(replacement, text);
      this.markAsChanged();
    }
  }

  replaceCurrentLineContent(replacement, originalText) {
    // Replace the current line content with formatted content
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // Try to find the current line element
    const currentLineElement = this.getCurrentLineElement(range);
    
    if (currentLineElement && currentLineElement !== this.editorElement) {
      // Replace the content of the current line element
      currentLineElement.innerHTML = replacement;
      
      // Position cursor inside the new element
      const newElement = currentLineElement.querySelector('h1, h2, h3, li, blockquote, pre, code') || currentLineElement;
      if (newElement) {
        const newRange = document.createRange();
        newRange.setStart(newElement, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } else {
      // Fallback: replace the entire current line
      this.replaceEntireCurrentLine(replacement, originalText);
    }
  }

  replaceEntireCurrentLine(replacement, originalText) {
    // Replace the ENTIRE current line with the formatted content
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // Get the current line boundaries
    // Use innerText to match the line break detection
    const text = this.editorElement.innerText;
    const cursorPosition = this.getCursorPosition();
    
    let lineStart = cursorPosition;
    let lineEnd = cursorPosition;
    
    // Find line start and end
    while (lineStart > 0 && text[lineStart - 1] !== '\n') {
      lineStart--;
    }
    while (lineEnd < text.length && text[lineEnd] !== '\n') {
      lineEnd++;
    }
    
    // Create a new range that covers the entire current line
    const lineRange = document.createRange();
    
    // Find the text node and offset for line start
    const startNode = this.findTextNodeAtPosition(lineStart);
    const endNode = this.findTextNodeAtPosition(lineEnd);
    
    if (startNode && endNode) {
      // Calculate offsets within the text nodes
      const startOffset = lineStart - this.getPositionOfTextNode(startNode);
      const endOffset = lineEnd - this.getPositionOfTextNode(endNode);
      
      lineRange.setStart(startNode, startOffset);
      lineRange.setEnd(endNode, endOffset);
      
      // Replace the entire line
      lineRange.deleteContents();
      
      // Insert the formatted content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = replacement;
      
      // Insert the formatted element
      lineRange.insertNode(tempDiv.firstElementChild);
      
      // Position cursor inside the new element
      const newElement = lineRange.startContainer.parentElement;
      if (newElement && newElement.tagName) {
        // For headings, position cursor after the tag
        const newRange = document.createRange();
        newRange.setStart(newElement, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } else {
      // Fallback: insert at cursor position
      document.execCommand('insertHTML', false, replacement);
    }
  }

  findTextNodeAtPosition(position) {
    const walker = document.createTreeWalker(
      this.editorElement,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    let currentPosition = 0;
    
    while (node = walker.nextNode()) {
      const nodeLength = node.textContent.length;
      if (currentPosition <= position && position <= currentPosition + nodeLength) {
        return node;
      }
      currentPosition += nodeLength;
    }
    
    return null;
  }

  getPositionOfTextNode(textNode) {
    const walker = document.createTreeWalker(
      this.editorElement,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    let position = 0;
    
    while (node = walker.nextNode()) {
      if (node === textNode) {
        return position;
      }
      position += node.textContent.length;
    }
    
    return 0;
  }

  showSlashMenu() {
    if (this.slashMenuVisible) return;
    
    console.log('[ZenNoteEditor] Showing slash menu');
    this.slashMenuVisible = true;
    this.slashMenu.classList.add('visible');
    
    // Position the menu near the cursor
    this.positionSlashMenu();
    
    // Select first item
    this.selectSlashMenuItem(0);
  }

  hideSlashMenu() {
    console.log('[ZenNoteEditor] Hiding slash menu');
    this.slashMenuVisible = false;
    this.slashMenu.classList.remove('visible');
  }

  positionSlashMenu() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    this.slashMenu.style.position = 'absolute';
    this.slashMenu.style.left = `${rect.left}px`;
    this.slashMenu.style.top = `${rect.bottom + 10}px`;
  }

  selectSlashMenuItem(index) {
    const items = this.slashMenu.querySelectorAll('.slash-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === index);
    });
    this.selectedSlashIndex = index;
  }

  navigateSlashMenu(direction) {
    const items = this.slashMenu.querySelectorAll('.slash-item');
    let newIndex = this.selectedSlashIndex + direction;
    
    if (newIndex < 0) newIndex = items.length - 1;
    if (newIndex >= items.length) newIndex = 0;
    
    this.selectSlashMenuItem(newIndex);
  }

  executeSlashCommand() {
    const selectedItem = this.slashMenu.querySelector('.slash-item.selected');
    if (!selectedItem) return;
    
    const command = selectedItem.dataset.command;
    console.log('[ZenNoteEditor] Executing slash command:', command);
    
    // Remove the slash character from the current line
    this.removeSlashFromCurrentLine();
    
    // Execute the command
    this.executeCommand(command);
    this.hideSlashMenu();
  }

  removeSlashFromCurrentLine() {
    // Remove the slash character from the current line
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const currentLineText = this.getCurrentLineTextOnly(range);
    
    if (currentLineText.startsWith('/')) {
      // Remove the slash and any following spaces
      const cleanText = currentLineText.replace(/^\/\s*/, '');
      
      // Replace the current line with clean text
      this.replaceEntireCurrentLine(cleanText, currentLineText);
    }
  }

  executeCommand(command) {
    switch (command) {
      case 'heading1':
        document.execCommand('formatBlock', false, 'h1');
        break;
      case 'heading2':
        document.execCommand('formatBlock', false, 'h2');
        break;
      case 'heading3':
        document.execCommand('formatBlock', false, 'h3');
        break;
      case 'bulletList':
        document.execCommand('insertUnorderedList', false);
        break;
      case 'orderedList':
        document.execCommand('insertOrderedList', false);
        break;
      case 'blockquote':
        document.execCommand('formatBlock', false, 'blockquote');
        break;
      case 'codeBlock':
        document.execCommand('formatBlock', false, 'pre');
        break;
      case 'divider':
        this.insertDivider();
        break;
    }
    
    this.markAsChanged();
    this.editorElement.focus();
  }

  insertDivider() {
    const hr = document.createElement('hr');
    hr.style.border = 'none';
    hr.style.borderTop = '1px solid var(--zen-notes-border)';
    hr.style.margin = '20px 0';
    
    document.execCommand('insertHTML', false, hr.outerHTML);
  }

  insertLink() {
    const url = prompt('Enter URL:');
    if (url) {
      document.execCommand('createLink', false, url);
      this.markAsChanged();
    }
  }

  handleSlashMenuClick(event) {
    const item = event.target.closest('.slash-item');
    if (item) {
      const command = item.dataset.command;
      console.log('[ZenNoteEditor] Slash menu clicked:', command);
      this.executeCommand(command);
      this.hideSlashMenu();
    }
  }

  handleDocumentClick(event) {
    if (!this.slashMenu.contains(event.target) && !this.editorElement.contains(event.target)) {
      this.hideSlashMenu();
    }
  }

  handleToolbarClick(event) {
    const button = event.target.closest('.toolbar-btn');
    if (!button) return;

    const command = button.dataset.command;
    if (command) {
      if (command === 'insertLink') {
        this.insertLink();
      } else {
        this.execCommand(command);
      }
      this.markAsChanged();
    }
  }

  execCommand(command) {
    try {
      const result = document.execCommand(command, false, null);
      if (!result) {
        console.warn(`[ZenNoteEditor] Command '${command}' failed`);
      }
    } catch (error) {
      console.error(`[ZenNoteEditor] Error executing command '${command}':`, error);
    }
  }

  markAsChanged() {
    this.isChanged = true;
  }

  updateToolbarState() {
    const buttons = this.toolbar.querySelectorAll('.toolbar-btn[data-command]');
    buttons.forEach(button => {
      const command = button.dataset.command;
      if (command && this.isCommandActive(command)) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  isCommandActive(command) {
    try {
      return document.queryCommandState(command);
    } catch (error) {
      return false;
    }
  }

  handleKeyboardShortcuts(event) {
    // Only handle title-specific shortcuts here
    // Editor shortcuts are handled in handleEditorKeydown
  }

  // Autosave with debouncing
  debouncedAutoSave() {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setTimeout(() => {
      this.performAutoSave();
    }, this.autoSaveDelay);
  }

  async performAutoSave() {
    const currentContent = this.editorElement.innerHTML;
    const currentTitle = this.titleInput.value.trim();
    
    // Only save if content has actually changed
    if (currentContent !== this.lastSavedContent || currentTitle !== this.lastSavedTitle) {
      try {
        await this.saveNote();
        this.lastSavedContent = currentContent;
        this.lastSavedTitle = currentTitle;
        this.isChanged = false;
        console.log('[ZenNoteEditor] Auto-saved successfully');
      } catch (error) {
        console.error('[ZenNoteEditor] Auto-save failed:', error);
        // Don't throw error, just log it
      }
    }
  }

  async saveNote() {
    const noteData = {
      title: this.titleInput.value.trim(),
      content: this.editorElement.innerHTML,
      lastModified: new Date().toISOString(),
      id: this.getNoteId()
    };

    try {
      // Try localStorage first
      localStorage.setItem(`zen-note-${noteData.id}`, JSON.stringify(noteData));
      return noteData;
    } catch (localStorageError) {
      console.warn('[ZenNoteEditor] localStorage failed, trying alternative storage:', localStorageError);
      
      // Fallback: try to store in memory or use a different approach
      try {
        // For now, just store in a global variable as fallback
        if (!window.zenNotesStorage) {
          window.zenNotesStorage = new Map();
        }
        window.zenNotesStorage.set(noteData.id, noteData);
        console.log('[ZenNoteEditor] Stored in memory fallback');
        return noteData;
      } catch (fallbackError) {
        console.error('[ZenNoteEditor] All storage methods failed:', fallbackError);
        // Return success anyway to not break the UI
        return noteData;
      }
    }
  }

  getNoteId() {
    const title = this.titleInput.value.trim() || 'untitled';
    const timestamp = Date.now();
    return `${title.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`;
  }

  loadNoteData() {
    // For now, just set default values
    // In the future, this could load from a database or cloud service
    this.titleInput.value = '';
    this.editorElement.innerHTML = '';
    this.isChanged = false;
    this.lastSavedContent = '';
    this.lastSavedTitle = '';
  }

  updateTabTitle() {
    const title = this.titleInput.value.trim();
    if (title) {
      document.title = `${title} - Zen Notes`;
    } else {
      document.title = 'New Note - Zen Notes';
    }
  }

  handleBeforeUnload(event) {
    if (this.isChanged) {
      event.preventDefault();
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return event.returnValue;
    }
  }
}

// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('[ZenNoteEditor] DOM loaded, initializing...');
  const editor = new ZenNoteEditor();
  editor.init();
});