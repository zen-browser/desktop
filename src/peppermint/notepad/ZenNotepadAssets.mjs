/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/** Same icon as the urlbar notepad suggestion (tab.svg). */
export const TAB_ICON_CHROME = "chrome://browser/skin/zen-icons/tab.svg";

const ICON_DOWNLOAD = `<path fill="currentColor" d="M15.25 11a.75.75 0 0 1 .75.75v1.5A2.75 2.75 0 0 1 13.25 16h-8.5A2.75 2.75 0 0 1 2 13.25v-1.5a.75.75 0 0 1 1.5 0v1.5c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25v-1.5a.75.75 0 0 1 .75-.75"/><path fill="currentColor" d="M9 2a.75.75 0 0 1 .75.75v5.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.8.8 0 0 1-.244.162q-.048.02-.098.03l-.04.012-.016.003a.8.8 0 0 1-.265 0l-.016-.003-.04-.011q-.05-.012-.098-.03-.044-.02-.083-.045a.8.8 0 0 1-.16-.118l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V2.75A.75.75 0 0 1 9 2"/>`;

const ICON_SHARE = `<path fill="currentColor" d="M6 6.5A.75.75 0 0 1 6 8H4.25C3.56 8 3 8.56 3 9.25v4.5c0 .69.56 1.25 1.25 1.25h9.5c.69 0 1.25-.56 1.25-1.25v-4.5C15 8.56 14.44 8 13.75 8H12a.75.75 0 0 1 0-1.5h1.75a2.75 2.75 0 0 1 2.75 2.75v4.5a2.75 2.75 0 0 1-2.75 2.75h-9.5a2.75 2.75 0 0 1-2.75-2.75v-4.5A2.75 2.75 0 0 1 4.25 6.5z"/><path fill="currentColor" d="m9.026.501.019.001a1 1 0 0 1 .114.016q.038.009.074.022a.75.75 0 0 1 .297.18l3 3a.75.75 0 0 1-1.06 1.06L9.75 3.06v9.69a.75.75 0 0 1-1.5 0V3.06L6.53 4.78a.75.75 0 1 1-1.06-1.06l3-3 .056-.052q.016-.012.033-.022a.8.8 0 0 1 .255-.12q.04-.011.08-.018l.011-.002A1 1 0 0 1 9 .5z"/>`;

const ICON_TAB = `<path fill="currentColor" d="M13.75 2a2.75 2.75 0 0 1 2.75 2.75v8.5A2.75 2.75 0 0 1 13.75 16h-9.5a2.75 2.75 0 0 1-2.75-2.75v-8.5A2.75 2.75 0 0 1 4.25 2zm-9.5 1.5C3.56 3.5 3 4.06 3 4.75v8.5c0 .69.56 1.25 1.25 1.25h9.5c.69 0 1.25-.56 1.25-1.25V7H6.75A.75.75 0 0 1 6 6.25V3.5zm7.75 2h3v-.75c0-.69-.56-1.25-1.25-1.25H12zm-4.5 0h3v-2h-3z"/>`;

function iconSvg(paths) {
  return `<svg class="mint-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" aria-hidden="true">${paths}</svg>`;
}

export const NOTEPAD_FAVICON_LINK = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18">${ICON_TAB}</svg>`
)}">`;

export const NOTEPAD_TOOLBAR_ACTIONS = `    <div class="mint-note-actions">
      <button type="button" class="mint-icon-button" id="mint-note-save" title="Save" aria-label="Save">${iconSvg(ICON_DOWNLOAD)}</button>
      <button type="button" class="mint-icon-button" id="mint-note-export" title="Export" aria-label="Export">${iconSvg(ICON_SHARE)}</button>
    </div>`;
