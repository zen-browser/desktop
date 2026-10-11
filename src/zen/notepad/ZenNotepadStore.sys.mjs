/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { OSKeyStore } from "resource://gre/modules/OSKeyStore.sys.mjs";

import { isNoteId } from "resource:///modules/zen/notepad/ZenNotepadMarkdown.mjs";

const KEY_FILE = "key.bin";
const NOTE_SUFFIX = ".note";

let cachedKey = null;

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function notesDirectory() {
  return PathUtils.join(PathUtils.profileDir, "notepad");
}

export function noteFilePath(id) {
  if (!isNoteId(id)) {
    throw new Error("Invalid note id");
  }
  return PathUtils.join(notesDirectory(), `${id.toLowerCase()}${NOTE_SUFFIX}`);
}

async function ensureDirectory() {
  await IOUtils.makeDirectory(notesDirectory());
}

async function encryptionKey() {
  if (cachedKey) {
    return cachedKey;
  }
  await ensureDirectory();
  const keyPath = PathUtils.join(notesDirectory(), KEY_FILE);
  if (await IOUtils.exists(keyPath)) {
    const wrapped = await IOUtils.readUTF8(keyPath);
    const rawBase64 = await OSKeyStore.decrypt(wrapped, "zen-notepad");
    cachedKey = await crypto.subtle.importKey(
      "raw",
      base64ToBytes(rawBase64),
      "AES-GCM",
      false,
      ["encrypt", "decrypt"]
    );
    return cachedKey;
  }
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const wrapped = await OSKeyStore.encrypt(bytesToBase64(raw));
  await IOUtils.writeUTF8(keyPath, wrapped);
  cachedKey = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  return cachedKey;
}

export async function saveNote(id, markdown) {
  const path = noteFilePath(id);
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(markdown)
  );
  const payload = JSON.stringify({
    v: 1,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(cipher)),
  });
  await IOUtils.writeUTF8(path, payload);
}

export async function loadNote(id) {
  const path = noteFilePath(id);
  if (!(await IOUtils.exists(path))) {
    return null;
  }
  const payload = JSON.parse(await IOUtils.readUTF8(path));
  const key = await encryptionKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.data)
  );
  return new TextDecoder().decode(plain);
}

export async function writePlainMarkdown(path, markdown) {
  await IOUtils.writeUTF8(path, markdown);
}
