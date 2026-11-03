/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { CollectionKeyManager, CryptoWrapper } = ChromeUtils.importESModule(
  "resource://services-sync/record.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

var cryptoWrap;

function crypted_resource_handler(metadata, response) {
  let obj = {
    id: "resource",
    modified: cryptoWrap.modified,
    payload: JSON.stringify(cryptoWrap.payload),
  };
  return httpd_basic_auth_handler(JSON.stringify(obj), metadata, response);
}

function prepareCryptoWrap(collection, id) {
  let w = new CryptoWrapper();
  w.cleartext.stuff = "my payload here";
  w.collection = collection;
  w.id = id;
  return w;
}

add_task(async function test_records_crypto() {
  let server;

  await configureIdentity({ username: "john@example.com" });
  let keyBundle = Service.identity.syncKeyBundle;

  try {
    let log = Log.repository.getLogger("Test");
    Log.repository.rootLogger.addAppender(new Log.DumpAppender());

    log.info("Setting up server and authenticator");

    server = httpd_setup({ "/steam/resource": crypted_resource_handler });

    log.info("Creating a record");

    cryptoWrap = prepareCryptoWrap("steam", "resource");

    log.info("cryptoWrap: " + cryptoWrap.toString());

    log.info("Encrypting a record");

    await cryptoWrap.encrypt(keyBundle);
    log.info("Ciphertext is " + cryptoWrap.ciphertext);
    Assert.notEqual(cryptoWrap.ciphertext, null);

    let firstIV = cryptoWrap.IV;

    log.info("Decrypting the record");

    let payload = await cryptoWrap.decrypt(keyBundle);
    Assert.equal(payload.stuff, "my payload here");
    Assert.notEqual(payload, cryptoWrap.payload); // wrap.data.payload is the encrypted one

    log.info("Make sure multiple decrypts cause failures");
    let error = "";
    try {
      payload = await cryptoWrap.decrypt(keyBundle);
    } catch (ex) {
      error = ex;
    }
    Assert.equal(error.message, "No ciphertext: nothing to decrypt?");

    log.info("Re-encrypting the record with alternate payload");

    cryptoWrap.cleartext.stuff = "another payload";
    await cryptoWrap.encrypt(keyBundle);
    let secondIV = cryptoWrap.IV;
    payload = await cryptoWrap.decrypt(keyBundle);
    Assert.equal(payload.stuff, "another payload");

    log.info("Make sure multiple encrypts use different IVs");
    Assert.notEqual(firstIV, secondIV);

    log.info(await "Make sure differing ids cause failures");
    await cryptoWrap.encrypt(keyBundle);
    cryptoWrap.data.id = "other";
    error = "";
    try {
      await cryptoWrap.decrypt(keyBundle);
    } catch (ex) {
      error = ex;
    }
    Assert.equal(error.message, "Record id mismatch: resource != other");

    log.info("Make sure wrong hmacs cause failures");
    await cryptoWrap.encrypt(keyBundle);
    cryptoWrap.hmac = "foo";
    error = "";
    try {
      await cryptoWrap.decrypt(keyBundle);
    } catch (ex) {
      error = ex;
    }
    Assert.equal(
      error.message.substr(0, 42),
      "Record SHA256 HMAC mismatch: should be foo"
    );

    // Checking per-collection keys and default key handling.

    await generateNewKeys(Service.collectionKeys);
    let bookmarkItem = prepareCryptoWrap("bookmarks", "foo");
    await bookmarkItem.encrypt(
      Service.collectionKeys.keyForCollection("bookmarks")
    );
    log.info("Ciphertext is " + bookmarkItem.ciphertext);
    Assert.notEqual(bookmarkItem.ciphertext, null);
    log.info("Decrypting the record explicitly with the default key.");
    Assert.equal(
      (await bookmarkItem.decrypt(Service.collectionKeys._default)).stuff,
      "my payload here"
    );

    // Per-collection keys.
    // Generate a key for "bookmarks".
    await generateNewKeys(Service.collectionKeys, ["bookmarks"]);
    bookmarkItem = prepareCryptoWrap("bookmarks", "foo");
    Assert.equal(bookmarkItem.collection, "bookmarks");

    // Encrypt. This'll use the "bookmarks" encryption key, because we have a
    // special key for it. The same key will need to be used for decryption.
    await bookmarkItem.encrypt(
      Service.collectionKeys.keyForCollection("bookmarks")
    );
    Assert.notEqual(bookmarkItem.ciphertext, null);

    // Attempt to use the default key, because this is a collision that could
    // conceivably occur in the real world. Decryption will error, because
    // it's not the bookmarks key.
    let err;
    try {
      await bookmarkItem.decrypt(Service.collectionKeys._default);
    } catch (ex) {
      err = ex;
    }
    Assert.equal("Record SHA256 HMAC mismatch", err.message.substr(0, 27));

    // Explicitly check that it's using the bookmarks key.
    // This should succeed.
    Assert.equal(
      (
        await bookmarkItem.decrypt(
          Service.collectionKeys.keyForCollection("bookmarks")
        )
      ).stuff,
      "my payload here"
    );

    Assert.ok(Service.collectionKeys.hasKeysFor(["bookmarks"]));

    // Add a key for some new collection and verify that it isn't the
    // default key.
    Assert.ok(!Service.collectionKeys.hasKeysFor(["forms"]));
    Assert.ok(!Service.collectionKeys.hasKeysFor(["bookmarks", "forms"]));
    let oldFormsKey = Service.collectionKeys.keyForCollection("forms");
    Assert.equal(oldFormsKey, Service.collectionKeys._default);
    let newKeys = await Service.collectionKeys.ensureKeysFor(["forms"]);
    Assert.ok(newKeys.hasKeysFor(["forms"]));
    Assert.ok(newKeys.hasKeysFor(["bookmarks", "forms"]));
    let newFormsKey = newKeys.keyForCollection("forms");
    Assert.notEqual(newFormsKey, oldFormsKey);

    // Verify that this doesn't overwrite keys
    let regetKeys = await newKeys.ensureKeysFor(["forms"]);
    Assert.equal(regetKeys.keyForCollection("forms"), newFormsKey);

    const emptyKeys = new CollectionKeyManager();
    payload = {
      default: Service.collectionKeys._default.keyPairB64,
      collections: {},
    };
    // Verify that not passing `modified` doesn't throw
    emptyKeys.setContents(payload, null);

    log.info("Done!");
  } finally {
    await promiseStopServer(server);
  }
});
