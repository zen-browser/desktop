const { WeaveCrypto } = ChromeUtils.importESModule(
  "moz-src:///services/crypto/modules/WeaveCrypto.sys.mjs"
);

var cryptoSvc = new WeaveCrypto();

add_task(async function test_crypto_random() {
  if (this.gczeal) {
    _("Running crypto random tests with gczeal(2).");
    gczeal(2);
  }

  // Test salt generation.
  var salt;

  salt = cryptoSvc.generateRandomBytes(0);
  Assert.equal(salt.length, 0);
  salt = cryptoSvc.generateRandomBytes(1);
  Assert.equal(salt.length, 4);
  salt = cryptoSvc.generateRandomBytes(2);
  Assert.equal(salt.length, 4);
  salt = cryptoSvc.generateRandomBytes(3);
  Assert.equal(salt.length, 4);
  salt = cryptoSvc.generateRandomBytes(4);
  Assert.equal(salt.length, 8);
  salt = cryptoSvc.generateRandomBytes(8);
  Assert.equal(salt.length, 12);

  // sanity check to make sure salts seem random
  var salt2 = cryptoSvc.generateRandomBytes(8);
  Assert.equal(salt2.length, 12);
  Assert.notEqual(salt, salt2);

  salt = cryptoSvc.generateRandomBytes(1024);
  Assert.equal(salt.length, 1368);
  salt = cryptoSvc.generateRandomBytes(16);
  Assert.equal(salt.length, 24);

  // Test random key generation
  var keydata, keydata2, iv;

  keydata = await cryptoSvc.generateRandomKey();
  Assert.equal(keydata.length, 44);
  keydata2 = await cryptoSvc.generateRandomKey();
  Assert.notEqual(keydata, keydata2); // sanity check for randomness
  iv = cryptoSvc.generateRandomIV();
  Assert.equal(iv.length, 24);

  if (this.gczeal) {
    gczeal(0);
  }
});
