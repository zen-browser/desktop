/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { parseNoteURL } from "resource:///modules/zen/notepad/ZenNotepadMarkdown.mjs";
import {
  NOTEPAD_FAVICON_LINK,
  NOTEPAD_TOOLBAR_ACTIONS,
} from "resource:///modules/zen/notepad/ZenNotepadAssets.mjs";

const PROTOCOL_FLAGS =
  Ci.nsIProtocolHandler.URI_DANGEROUS_TO_LOAD |
  Ci.nsIProtocolHandler.URI_IS_LOCAL_RESOURCE |
  Ci.nsIProtocolHandler.URI_IS_POTENTIALLY_TRUSTWORTHY;

function buildNotePageHtml(css) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Notepad</title>
${NOTEPAD_FAVICON_LINK}
<style>
${css}</style>
</head>
<body>
<div class="mint-note">
  <header class="mint-note-toolbar">
    <h1 class="mint-note-title" id="mint-note-title" title="Double-click to rename">Notepad</h1>
    <p class="mint-note-status" id="mint-note-status" data-state="idle"></p>
${NOTEPAD_TOOLBAR_ACTIONS}
  </header>
  <div class="mint-note-scroll">
    <div class="mint-note-gutter" id="mint-note-gutter" aria-hidden="true"><div class="mint-gutter-line">1</div></div>
    <div id="mint-note-editor" class="mint-note-editor" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" aria-label="Note"><div class="mint-line" data-type="paragraph"><br></div></div>
  </div>
  <div id="mint-note-menu" class="mint-note-menu" role="listbox" hidden></div>
</div>
</body>
</html>
`;
}

const NOTE_CSS = `:root {
  color-scheme: light dark;
  --mint-accent: var(--zen-primary-color, #14b8a6);
  --mint-ink: light-dark(#10211e, #e8f6f1);
  --mint-muted: light-dark(#5c726c, #9db5ad);
  --mint-paper: light-dark(#f7fbf8, #16302b);
  --mint-page: light-dark(#d5ebe4, #0c1f1c);
  --mint-line: light-dark(rgb(16 33 30 / 12%), rgb(232 246 241 / 14%));
  --mint-button: light-dark(#10211e, #e8f6f1);
  --mint-button-text: light-dark(#f7fbf8, #10211e);
  --mint-frosted-fill: light-dark(rgb(255 255 255 / 72%), rgb(255 255 255 / 10%));
  --mint-frosted-stroke: light-dark(rgb(0 0 0 / 12%), rgb(255 255 255 / 25%));
  --mint-frosted-hover: light-dark(rgb(0 0 0 / 6%), rgb(255 255 255 / 10%));
  --mint-frosted-backdrop: blur(24px) saturate(1.4);
}

html,
body {
  height: 100%;
  min-height: 100%;
  margin: 0;
  background: var(--mint-page);
  color: var(--mint-ink);
  font: 16px/1.5 system-ui, sans-serif;
}

.mint-note {
  box-sizing: border-box;
  min-height: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.mint-note-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--mint-page);
  color: var(--mint-ink);
}

.mint-note-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 650;
  max-width: min(40vw, 16rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
  border-radius: 0.35rem;
  padding: 0.1rem 0.35rem;
  margin-inline: -0.35rem;
}

.mint-note-title-editing {
  cursor: text;
  outline: 1px solid color-mix(in srgb, var(--mint-accent) 55%, transparent);
  outline-offset: 1px;
  background: color-mix(in srgb, var(--mint-paper) 88%, transparent);
  text-overflow: clip;
  overflow: visible;
  white-space: nowrap;
  max-width: min(60vw, 24rem);
}

.mint-note-status {
  margin: 0;
  margin-inline-end: auto;
  min-height: 1.2em;
  color: color-mix(in srgb, var(--mint-ink) 72%, transparent);
  font-size: 0.85rem;
}

.mint-note-status[data-state="error"] {
  color: light-dark(#ffb4b4, #ffb4b4);
}

.mint-note-actions {
  display: flex;
  gap: 0.35rem;
  margin-inline-start: auto;
}

.mint-icon-button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.125rem;
  height: 2.125rem;
  padding: 0;
  border: 1px solid var(--mint-frosted-stroke);
  border-radius: 10px;
  background: var(--mint-frosted-fill);
  backdrop-filter: var(--mint-frosted-backdrop);
  color: var(--mint-ink);
  cursor: pointer;
  box-shadow: 0 1px 2px color-mix(in srgb, black 6%, transparent);
}

@media (prefers-reduced-transparency: reduce) {
  .mint-icon-button {
    backdrop-filter: none;
    background: color-mix(in srgb, var(--mint-ink) 6%, var(--mint-paper));
  }
}

.mint-icon-button:hover {
  background: color-mix(in srgb, var(--mint-frosted-fill) 55%, var(--mint-frosted-hover));
}

.mint-icon-button:active {
  transform: scale(0.96);
}

.mint-icon {
  width: 1.125rem;
  height: 1.125rem;
  display: block;
  pointer-events: none;
}

.mint-note-scroll {
  flex: 1;
  min-height: 70vh;
  display: flex;
  overflow: auto;
  margin: 0 0.75rem 0.75rem;
  padding: 1rem 1.15rem 2rem 0.45rem;
  border-radius: 12px;
  background: var(--mint-paper);
  color: var(--mint-ink);
  box-shadow: 0 1px 0 var(--mint-line);
}

.mint-note-gutter {
  flex: 0 0 2rem;
  position: sticky;
  inset-inline-start: 0;
  user-select: none;
  text-align: end;
  padding-inline-end: 0.4rem;
  color: color-mix(in srgb, var(--mint-ink) 45%, transparent);
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
}

.mint-gutter-line {
  min-height: 1.6em;
}

.mint-note-editor {
  flex: 1;
  min-width: 0;
  outline: none;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.mint-line {
  position: relative;
  min-height: 1.6em;
  padding: 0.02rem 0;
}

.mint-line[data-type="h1"] { font-size: 1.9rem; font-weight: 700; line-height: 1.25; }
.mint-line[data-type="h2"] { font-size: 1.55rem; font-weight: 700; line-height: 1.3; }
.mint-line[data-type="h3"] { font-size: 1.3rem; font-weight: 650; line-height: 1.35; }
.mint-line[data-type="h4"] { font-size: 1.12rem; font-weight: 650; }
.mint-line[data-type="h5"] { font-size: 1rem; font-weight: 650; }
.mint-line[data-type="h6"] { font-size: 0.92rem; font-weight: 650; letter-spacing: 0.02em; }

.mint-line[data-type="bullet"],
.mint-line[data-type="numbered"],
.mint-line[data-type="task"] {
  padding-inline-start: 1.4rem;
}

.mint-line[data-type="bullet"]::before {
  content: "•";
  position: absolute;
  inset-inline-start: 0.15rem;
  color: var(--mint-accent);
}

.mint-line[data-type="numbered"]::before {
  content: attr(data-start) ". ";
  position: absolute;
  inset-inline-start: 0;
  color: var(--mint-accent);
  font-variant-numeric: tabular-nums;
}

.mint-line[data-type="quote"] {
  border-inline-start: 3px solid var(--mint-accent);
  padding-inline-start: 0.75rem;
  color: color-mix(in srgb, var(--mint-ink) 88%, transparent);
}

.mint-line[data-type="code"] {
  font-family: ui-monospace, monospace;
  font-size: 0.92rem;
  background: color-mix(in srgb, var(--mint-accent) 14%, transparent);
  padding-inline: 0.7rem;
}

.mint-line[data-type="code"] + .mint-line[data-type="code"] {
  margin-top: 0;
}

.mint-line[data-type="table"] {
  font-family: ui-monospace, monospace;
  font-size: 0.92rem;
  background: color-mix(in srgb, var(--mint-ink) 6%, transparent);
}

.mint-line[data-type="hr"] {
  min-height: 1.4rem;
  display: flex;
  align-items: center;
}

.mint-line[data-type="hr"] hr {
  width: 100%;
  border: 0;
  border-top: 1px solid var(--mint-line);
  margin: 0;
}

.mint-task {
  position: absolute;
  inset-inline-start: 0;
  top: 0.35rem;
  width: 0.95rem;
  height: 0.95rem;
  padding: 0;
  border-radius: 4px;
  border: 1px solid var(--mint-line);
  background: transparent;
  color: var(--mint-accent);
  cursor: pointer;
}

.mint-line[data-checked="true"] .mint-task {
  background: var(--mint-accent);
  border-color: transparent;
}

.mint-line[data-checked="true"] .mint-task::before {
  content: "✓";
  color: var(--mint-button-text);
  font-size: 0.75rem;
  line-height: 0.95rem;
}

.mint-note-menu {
  position: fixed;
  z-index: 5;
  min-width: 13rem;
  max-height: 16rem;
  overflow: auto;
  margin: 0;
  padding: 0.3rem;
  border-radius: 10px;
  background: var(--mint-page);
  border: 1px solid var(--mint-line);
  box-shadow: 0 10px 28px color-mix(in srgb, black 35%, transparent);
}

.mint-note-menu[hidden] {
  display: none;
}

.mint-note-option {
  display: block;
  width: 100%;
  text-align: start;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  border-radius: 7px;
  padding: 0.35rem 0.55rem;
  cursor: pointer;
}

.mint-note-option[aria-selected="true"],
.mint-note-option:hover {
  background: color-mix(in srgb, var(--mint-accent) 28%, transparent);
}

::highlight(md-bold) {
  font-weight: 700;
}

::highlight(md-italic) {
  font-style: italic;
}

::highlight(md-strike) {
  text-decoration: line-through;
}

::highlight(md-code) {
  font-family: ui-monospace, monospace;
  background-color: color-mix(in srgb, var(--mint-accent) 18%, transparent);
}

::highlight(md-link),
::highlight(md-image) {
  text-decoration: underline;
  text-decoration-color: var(--mint-accent);
}
`;

const PAGE_HTML = buildNotePageHtml(NOTE_CSS);

export class MintProtocolHandler {
  scheme = "mint";
  defaultPort = -1;
  protocolFlags = PROTOCOL_FLAGS;

  allowPort() {
    return false;
  }

  newChannel(uri, loadInfo) {
    if (!parseNoteURL(uri.spec)) {
      throw Components.Exception(
        `Unknown mint URL: ${uri.spec}`,
        Cr.NS_ERROR_MALFORMED_URI
      );
    }
    const input = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(
      Ci.nsIStringInputStream
    );
    input.setUTF8Data(PAGE_HTML);
    const channel = Cc["@mozilla.org/network/input-stream-channel;1"]
      .createInstance(Ci.nsIInputStreamChannel)
      .QueryInterface(Ci.nsIChannel);
    channel.setURI(uri);
    channel.loadInfo = loadInfo;
    channel.contentStream = input;
    channel.contentType = "text/html";
    channel.contentCharset = "UTF-8";
    return channel;
  }

  QueryInterface = ChromeUtils.generateQI(["nsIProtocolHandler"]);
}
