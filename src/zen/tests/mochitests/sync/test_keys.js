/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { Weave } = ChromeUtils.importESModule(
  "resource://services-sync/main.sys.mjs"
);
const { CollectionKeyManager, CryptoWrapper } = ChromeUtils.importESModule(
  "resource://services-sync/record.sys.mjs"
);

var collectionKeys = new CollectionKeyManager();

function do_check_keypair_eq(a, b) {
  Assert.equal(2, a.length);
  Assert.equal(2, b.length);
  Assert.equal(a[0], b[0]);
  Assert.equal(a[1], b[1]);
}

add_test(function test_set_invalid_values() {
  _("Ensure that setting invalid encryption and HMAC key values is caught.");

  let bundle = new BulkKeyBundle("foo");

  let thrown = false;
  try {
    bundle.encryptionKey = null;
  } catch (ex) {
    thrown = true;
    Assert.equal(ex.message.indexOf("Encryption key can only be set to"), 0);
  } finally {
    Assert.ok(thrown);
    thrown = false;
  }

  try {
    bundle.encryptionKey = ["trollololol"];
  } catch (ex) {
    thrown = true;
    Assert.equal(ex.message.indexOf("Encryption key can only be set to"), 0);
  } finally {
    Assert.ok(thrown);
    thrown = false;
  }

  try {
    bundle.hmacKey = Utils.generateRandomBytesLegacy(15);
  } catch (ex) {
    thrown = true;
    Assert.equal(ex.message.indexOf("HMAC key must be at least 128"), 0);
  } finally {
    Assert.ok(thrown);
    thrown = false;
  }

  try {
    bundle.hmacKey = null;
  } catch (ex) {
    thrown = true;
    Assert.equal(ex.message.indexOf("HMAC key can only be set to string"), 0);
  } finally {
    Assert.ok(thrown);
    thrown = false;
  }

  try {
    bundle.hmacKey = ["trollolol"];
  } catch (ex) {
    thrown = true;
    Assert.equal(ex.message.indexOf("HMAC key can only be set to"), 0);
  } finally {
    Assert.ok(thrown);
    thrown = false;
  }

  try {
    bundle.hmacKey = Utils.generateRandomBytesLegacy(15);
  } catch (ex) {
    thrown = true;
    Assert.equal(ex.message.indexOf("HMAC key must be at least 128"), 0);
  } finally {
    Assert.ok(thrown);
    thrown = false;
  }

  run_next_test();
});

add_task(async function test_ensureLoggedIn() {
  let log = Log.repository.getLogger("Test");
  Log.repository.rootLogger.addAppender(new Log.DumpAppender());

  await configureIdentity();

  let keyBundle = Weave.Service.identity.syncKeyBundle;

  /*
   * Build a test version of storage/crypto/keys.
   * Encrypt it with the sync key.
   * Pass it into the CollectionKeyManager.
   */

  log.info("Building storage keys...");
  let storage_keys = new CryptoWrapper("crypto", "keys");
  let default_key64 = await Weave.Crypto.generateRandomKey();
  let default_hmac64 = await Weave.Crypto.generateRandomKey();
  let bookmarks_key64 = await Weave.Crypto.generateRandomKey();
  let bookmarks_hmac64 = await Weave.Crypto.generateRandomKey();

  storage_keys.cleartext = {
    default: [default_key64, default_hmac64],
    collections: { bookmarks: [bookmarks_key64, bookmarks_hmac64] },
  };
  storage_keys.modified = Date.now() / 1000;
  storage_keys.id = "keys";

  log.info("Encrypting storage keys...");

  // Use passphrase (sync key) itself to encrypt the key bundle.
  await storage_keys.encrypt(keyBundle);

  // Sanity checking.
  Assert.equal(null, storage_keys.cleartext);
  Assert.notEqual(null, storage_keys.ciphertext);

  log.info("Updating collection keys.");

  // updateContents decrypts the object, releasing the payload for us to use.
  // Returns true, because the default key has changed.
  Assert.ok(await collectionKeys.updateContents(keyBundle, storage_keys));
  let payload = storage_keys.cleartext;

  _("CK: " + JSON.stringify(collectionKeys._collections));

  // Test that the CollectionKeyManager returns a similar WBO.
  let wbo = collectionKeys.asWBO("crypto", "keys");

  _("WBO: " + JSON.stringify(wbo));
  _("WBO cleartext: " + JSON.stringify(wbo.cleartext));

  // Check the individual contents.
  Assert.equal(wbo.collection, "crypto");
  Assert.equal(wbo.id, "keys");
  Assert.equal(undefined, wbo.modified);
  Assert.equal(collectionKeys.lastModified, storage_keys.modified);
  Assert.ok(!!wbo.cleartext.default);
  do_check_keypair_eq(payload.default, wbo.cleartext.default);
  do_check_keypair_eq(
    payload.collections.bookmarks,
    wbo.cleartext.collections.bookmarks
  );

  Assert.ok("bookmarks" in collectionKeys._collections);
  Assert.equal(false, "tabs" in collectionKeys._collections);

  _("Updating contents twice with the same data doesn't proceed.");
  await storage_keys.encrypt(keyBundle);
  Assert.equal(
    false,
    await collectionKeys.updateContents(keyBundle, storage_keys)
  );

  /*
   * Test that we get the right keys out when we ask for
   * a collection's tokens.
   */
  let b1 = new BulkKeyBundle("bookmarks");
  b1.keyPairB64 = [bookmarks_key64, bookmarks_hmac64];
  let b2 = collectionKeys.keyForCollection("bookmarks");
  do_check_keypair_eq(b1.keyPair, b2.keyPair);

  // Check key equality.
  Assert.ok(b1.equals(b2));
  Assert.ok(b2.equals(b1));

  b1 = new BulkKeyBundle("[default]");
  b1.keyPairB64 = [default_key64, default_hmac64];

  Assert.ok(!b1.equals(b2));
  Assert.ok(!b2.equals(b1));

  b2 = collectionKeys.keyForCollection(null);
  do_check_keypair_eq(b1.keyPair, b2.keyPair);

  /*
   * Checking for update times.
   */
  let info_collections = {};
  Assert.ok(collectionKeys.updateNeeded(info_collections));
  info_collections.crypto = 5000;
  Assert.ok(!collectionKeys.updateNeeded(info_collections));
  info_collections.crypto = 1 + Date.now() / 1000; // Add one in case computers are fast!
  Assert.ok(collectionKeys.updateNeeded(info_collections));

  collectionKeys.lastModified = null;
  Assert.ok(collectionKeys.updateNeeded({}));

  /*
   * Check _compareKeyBundleCollections.
   */
  async function newBundle(name) {
    let r = new BulkKeyBundle(name);
    await r.generateRandom();
    return r;
  }
  let k1 = await newBundle("k1");
  let k2 = await newBundle("k2");
  let k3 = await newBundle("k3");
  let k4 = await newBundle("k4");
  let k5 = await newBundle("k5");
  let coll1 = { foo: k1, bar: k2 };
  let coll2 = { foo: k1, bar: k2 };
  let coll3 = { foo: k1, bar: k3 };
  let coll4 = { foo: k4 };
  let coll5 = { baz: k5, bar: k2 };
  let coll6 = {};

  let d1 = collectionKeys._compareKeyBundleCollections(coll1, coll2); // []
  let d2 = collectionKeys._compareKeyBundleCollections(coll1, coll3); // ["bar"]
  let d3 = collectionKeys._compareKeyBundleCollections(coll3, coll2); // ["bar"]
  let d4 = collectionKeys._compareKeyBundleCollections(coll1, coll4); // ["bar", "foo"]
  let d5 = collectionKeys._compareKeyBundleCollections(coll5, coll2); // ["baz", "foo"]
  let d6 = collectionKeys._compareKeyBundleCollections(coll6, coll1); // ["bar", "foo"]
  let d7 = collectionKeys._compareKeyBundleCollections(coll5, coll5); // []
  let d8 = collectionKeys._compareKeyBundleCollections(coll6, coll6); // []

  Assert.ok(d1.same);
  Assert.ok(!d2.same);
  Assert.ok(!d3.same);
  Assert.ok(!d4.same);
  Assert.ok(!d5.same);
  Assert.ok(!d6.same);
  Assert.ok(d7.same);
  Assert.ok(d8.same);

  Assert.deepEqual(d1.changed, []);
  Assert.deepEqual(d2.changed, ["bar"]);
  Assert.deepEqual(d3.changed, ["bar"]);
  Assert.deepEqual(d4.changed, ["bar", "foo"]);
  Assert.deepEqual(d5.changed, ["baz", "foo"]);
  Assert.deepEqual(d6.changed, ["bar", "foo"]);
});
