/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Make sure that we have a profile before initializing SessionFile.
do_get_profile();
const { SessionFile } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/SessionFile.sys.mjs"
);
const Paths = SessionFile.Paths;

// SessionFile.write() initializes SessionWriter, which accesses
// Paths.nextUpgradeBackup (uses Services.appinfo.platformBuildID).
const { updateAppInfo } = ChromeUtils.importESModule(
  "resource://testing-common/AppInfo.sys.mjs"
);
updateAppInfo({
  name: "SessionRestoreTest",
  ID: "{230de50e-4cd1-11dc-8314-0800200c9a66}",
  version: "1",
  platformVersion: "",
});

// The header IOUtils prepends to encrypted files: 'mozEnc0\0'.
const ENC_MAGIC = [0x6d, 0x6f, 0x7a, 0x45, 0x6e, 0x63, 0x30, 0x00];
const DEK_NAME_SESSIONSTORE = "sessionstore";
const ENCRYPTION_AVAILABLE_PREF = "browser.sessionstore.encryption.available";
const ENCRYPTION_PREF = "browser.sessionstore.encryption.enabled";

function generateFileContents(id) {
  let url = `https://example.com/test_encryption#${id}`;
  return { windows: [{ tabs: [{ entries: [{ url }], index: 1 }] }] };
}

function setEncryptionPref(value) {
  Services.prefs.getDefaultBranch("").setBoolPref(ENCRYPTION_PREF, value);
}

add_setup(async function () {
  Services.fog.initializeFOG();

  Services.prefs
    .getDefaultBranch("")
    .setBoolPref(ENCRYPTION_AVAILABLE_PREF, true);
  Services.prefs.lockPref(ENCRYPTION_AVAILABLE_PREF);
  Services.prefs.getDefaultBranch("").setBoolPref(ENCRYPTION_PREF, true);
  registerCleanupFunction(() => {
    Services.prefs.unlockPref(ENCRYPTION_AVAILABLE_PREF);
    Services.prefs.getDefaultBranch("").deleteBranch(ENCRYPTION_PREF);
    Services.prefs.getDefaultBranch("").deleteBranch(ENCRYPTION_AVAILABLE_PREF);
  });

  // Finish initialization of SessionFile (no session files yet -> empty).
  await SessionFile.read();
});

add_task(async function test_write_encrypts_and_round_trips() {
  await SessionFile.wipe();
  let content = generateFileContents("write-roundtrip");

  // First write: creates recovery.jsonlz4.
  await SessionFile.write(content);

  let recoveryRaw = await IOUtils.read(Paths.recovery, { maxBytes: 8 });
  Assert.deepEqual(
    Array.from(recoveryRaw.slice(0, ENC_MAGIC.length)),
    ENC_MAGIC,
    "recovery file has encryption header"
  );

  // IOUtils can decrypt + decompress back to the original state.
  let parsed = await IOUtils.readJSON(Paths.recovery, {
    decompress: true,
    decrypt: DEK_NAME_SESSIONSTORE,
  });
  Assert.deepEqual(parsed, content, "IOUtils decrypt round-trips");

  // SessionFile.read also transparently decrypts.
  let result = await SessionFile.read();
  Assert.deepEqual(result.parsed, content, "SessionFile.read round-trips");

  // Second write: rotates the encrypted recovery to recovery.baklz4.
  await SessionFile.write(content);

  let backupRaw = await IOUtils.read(Paths.recoveryBackup, { maxBytes: 8 });
  Assert.deepEqual(
    Array.from(backupRaw.slice(0, ENC_MAGIC.length)),
    ENC_MAGIC,
    "rotated recovery backup has encryption header"
  );
});

add_task(async function test_plaintext_readable_when_encryption_enabled() {
  await SessionFile.wipe();
  let content = generateFileContents("plaintext-compat");

  // Seed a plaintext compressed recovery file (simulating a session file
  // written before encryption was enabled).
  await IOUtils.writeUTF8(Paths.recovery, JSON.stringify(content), {
    compress: true,
  });

  // SessionFile.read passes decrypt: DEK_NAME_SESSIONSTORE, which
  // transparently passes through unencrypted files.
  let result = await SessionFile.read();
  Assert.deepEqual(
    result.parsed,
    content,
    "plaintext session file is readable when encryption is enabled"
  );
});

// The LZ4 header IOUtils prepends to compressed (non-encrypted) files.
const LZ4_MAGIC = [0x6d, 0x6f, 0x7a, 0x4c, 0x7a, 0x34, 0x30, 0x00];

add_task(async function test_new_writes_are_plaintext_when_pref_disabled() {
  await SessionFile.wipe();
  let content = generateFileContents("pref-off-write");

  // Seed an encrypted file to verify it remains readable.
  await IOUtils.writeUTF8(Paths.clean, JSON.stringify(content), {
    compress: true,
    encrypt: DEK_NAME_SESSIONSTORE,
  });

  // Disable encryption and trigger a write.
  setEncryptionPref(false);
  await SessionFile.write(content);

  // The encrypted seed file is still readable via transparent decrypt.
  let parsed = await IOUtils.readJSON(Paths.clean, {
    decompress: true,
    decrypt: DEK_NAME_SESSIONSTORE,
  });
  Assert.ok(
    parsed && parsed.windows,
    "previously encrypted file is still readable via transparent decrypt"
  );

  // The new recovery write uses the current pref (now off), so it must be
  // plaintext lz4, not encrypted.
  let recoveryRaw = await IOUtils.read(Paths.recovery, { maxBytes: 8 });
  Assert.deepEqual(
    Array.from(recoveryRaw.slice(0, LZ4_MAGIC.length)),
    LZ4_MAGIC,
    "new recovery write is plaintext lz4 when encryption is off"
  );

  await IOUtils.remove(Paths.clean, { ignoreAbsent: true });
});

add_task(async function test_corrupt_encrypted_file_records_telemetry() {
  await SessionFile.wipe();
  setEncryptionPref(true);
  Services.fog.testResetFOG();

  // Write a file with the encryption header but garbage ciphertext to the
  // first entry in the load order. This triggers the decryption error path.
  let corruptData = new Uint8Array([
    ...ENC_MAGIC,
    0xde,
    0xad,
    0xbe,
    0xef,
    0x00,
    0x01,
    0x02,
    0x03,
  ]);
  await IOUtils.write(Paths.clean, corruptData);

  let result = await SessionFile.read();
  Assert.equal(
    result.origin,
    "empty",
    "corrupt file was skipped, no backup available"
  );

  let events = Glean.sessionRestore.backupCanBeLoadedSessionFile.testGetValue();
  let cleanEvent = events.find(e => e.extra.path_key === "clean");
  Assert.ok(cleanEvent, "telemetry event recorded for corrupt file");
  Assert.equal(
    cleanEvent.extra.can_load,
    "false",
    "corrupt file reported as not loadable"
  );
  Assert.equal(
    cleanEvent.extra.loadfail_reason,
    "Decryption error",
    "failure reason is decryption error"
  );
});
