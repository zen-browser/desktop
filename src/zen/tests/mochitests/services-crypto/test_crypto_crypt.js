const { WeaveCrypto } = ChromeUtils.importESModule(
  "moz-src:///services/crypto/modules/WeaveCrypto.sys.mjs"
);

var cryptoSvc = new WeaveCrypto();

add_task(async function test_key_memoization() {
  let cryptoGlobal = cryptoSvc._getCrypto();
  let oldImport = cryptoGlobal.subtle.importKey;
  if (!oldImport) {
    _("Couldn't swizzle crypto.subtle.importKey; returning.");
    return;
  }

  let iv = cryptoSvc.generateRandomIV();
  let key = await cryptoSvc.generateRandomKey();
  let c = 0;
  cryptoGlobal.subtle.importKey = function (
    format,
    keyData,
    algo,
    extractable,
    usages
  ) {
    c++;
    return oldImport.call(
      cryptoGlobal.subtle,
      format,
      keyData,
      algo,
      extractable,
      usages
    );
  };

  // Encryption should cause a single counter increment.
  Assert.equal(c, 0);
  let cipherText = await cryptoSvc.encrypt("Hello, world.", key, iv);
  Assert.equal(c, 1);
  cipherText = await cryptoSvc.encrypt("Hello, world.", key, iv);
  Assert.equal(c, 1);

  // ... as should decryption.
  await cryptoSvc.decrypt(cipherText, key, iv);
  await cryptoSvc.decrypt(cipherText, key, iv);
  await cryptoSvc.decrypt(cipherText, key, iv);
  Assert.equal(c, 2);

  // Un-swizzle.
  cryptoGlobal.subtle.importKey = oldImport;
});

// Just verify that it gets populated with the correct bytes.
add_task(async function test_makeUint8Array() {
  ChromeUtils.importESModule("resource://gre/modules/ctypes.sys.mjs");

  let item1 = cryptoSvc.makeUint8Array("abcdefghi", false);
  Assert.ok(item1);
  for (let i = 0; i < 8; ++i) {
    Assert.equal(item1[i], "abcdefghi".charCodeAt(i));
  }
});

add_task(async function test_encrypt_decrypt() {
  // First, do a normal run with expected usage... Generate a random key and
  // iv, encrypt and decrypt a string.
  var iv = cryptoSvc.generateRandomIV();
  Assert.equal(iv.length, 24);

  var key = await cryptoSvc.generateRandomKey();
  Assert.equal(key.length, 44);

  var mySecret = "bacon is a vegetable";
  var cipherText = await cryptoSvc.encrypt(mySecret, key, iv);
  Assert.equal(cipherText.length, 44);

  var clearText = await cryptoSvc.decrypt(cipherText, key, iv);
  Assert.equal(clearText.length, 20);

  // Did the text survive the encryption round-trip?
  Assert.equal(clearText, mySecret);
  Assert.notEqual(cipherText, mySecret); // just to be explicit

  // Do some more tests with a fixed key/iv, to check for reproducable results.
  key = "St1tFCor7vQEJNug/465dQ==";
  iv = "oLjkfrLIOnK2bDRvW4kXYA==";

  _("Testing small IV.");
  mySecret = "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=";
  let shortiv = "YWJj";
  let err;
  try {
    await cryptoSvc.encrypt(mySecret, key, shortiv);
  } catch (ex) {
    err = ex;
  }
  Assert.ok(!!err);

  _("Testing long IV.");
  let longiv = "gsgLRDaxWvIfKt75RjuvFWERt83FFsY2A0TW+0b2iVk=";
  try {
    await cryptoSvc.encrypt(mySecret, key, longiv);
  } catch (ex) {
    err = ex;
  }
  Assert.ok(!!err);

  // Test small input sizes
  mySecret = "";
  cipherText = await cryptoSvc.encrypt(mySecret, key, iv);
  clearText = await cryptoSvc.decrypt(cipherText, key, iv);
  Assert.equal(cipherText, "OGQjp6mK1a3fs9k9Ml4L3w==");
  Assert.equal(clearText, mySecret);

  mySecret = "x";
  cipherText = await cryptoSvc.encrypt(mySecret, key, iv);
  clearText = await cryptoSvc.decrypt(cipherText, key, iv);
  Assert.equal(cipherText, "96iMl4vhOxFUW/lVHHzVqg==");
  Assert.equal(clearText, mySecret);

  mySecret = "xx";
  cipherText = await cryptoSvc.encrypt(mySecret, key, iv);
  clearText = await cryptoSvc.decrypt(cipherText, key, iv);
  Assert.equal(cipherText, "olpPbETRYROCSqFWcH2SWg==");
  Assert.equal(clearText, mySecret);

  mySecret = "xxx";
  cipherText = await cryptoSvc.encrypt(mySecret, key, iv);
  clearText = await cryptoSvc.decrypt(cipherText, key, iv);
  Assert.equal(cipherText, "rRbpHGyVSZizLX/x43Wm+Q==");
  Assert.equal(clearText, mySecret);

  mySecret = "xxxx";
  cipherText = await cryptoSvc.encrypt(mySecret, key, iv);
  clearText = await cryptoSvc.decrypt(cipherText, key, iv);
  Assert.equal(cipherText, "HeC7miVGDcpxae9RmiIKAw==");
  Assert.equal(clearText, mySecret);

  // Test non-ascii input
  // ("testuser1" using similar-looking glyphs)
  mySecret = String.fromCharCode(355, 277, 349, 357, 533, 537, 101, 345, 185);
  cipherText = await cryptoSvc.encrypt(mySecret, key, iv);
  clearText = await cryptoSvc.decrypt(cipherText, key, iv);
  Assert.equal(cipherText, "Pj4ixByXoH3SU3JkOXaEKPgwRAWplAWFLQZkpJd5Kr4=");
  Assert.equal(clearText, mySecret);

  // Tests input spanning a block boundary (AES block size is 16 bytes)
  mySecret = "123456789012345";
  cipherText = await cryptoSvc.encrypt(mySecret, key, iv);
  clearText = await cryptoSvc.decrypt(cipherText, key, iv);
  Assert.equal(cipherText, "e6c5hwphe45/3VN/M0bMUA==");
  Assert.equal(clearText, mySecret);

  mySecret = "1234567890123456";
  cipherText = await cryptoSvc.encrypt(mySecret, key, iv);
  clearText = await cryptoSvc.decrypt(cipherText, key, iv);
  Assert.equal(cipherText, "V6aaOZw8pWlYkoIHNkhsP1JOIQF87E2vTUvBUQnyV04=");
  Assert.equal(clearText, mySecret);

  mySecret = "12345678901234567";
  cipherText = await cryptoSvc.encrypt(mySecret, key, iv);
  clearText = await cryptoSvc.decrypt(cipherText, key, iv);
  Assert.equal(cipherText, "V6aaOZw8pWlYkoIHNkhsP5GvxWJ9+GIAS6lXw+5fHTI=");
  Assert.equal(clearText, mySecret);

  key = "iz35tuIMq4/H+IYw2KTgow==";
  iv = "TJYrvva2KxvkM8hvOIvWp3==";
  mySecret = "i like pie";

  cipherText = await cryptoSvc.encrypt(mySecret, key, iv);
  clearText = await cryptoSvc.decrypt(cipherText, key, iv);
  Assert.equal(cipherText, "DLGx8BWqSCLGG7i/xwvvxg==");
  Assert.equal(clearText, mySecret);

  key = "c5hG3YG+NC61FFy8NOHQak1ZhMEWO79bwiAfar2euzI=";
  iv = "gsgLRDaxWvIfKt75RjuvFW==";
  mySecret = "i like pie";

  cipherText = await cryptoSvc.encrypt(mySecret, key, iv);
  clearText = await cryptoSvc.decrypt(cipherText, key, iv);
  Assert.equal(cipherText, "o+ADtdMd8ubzNWurS6jt0Q==");
  Assert.equal(clearText, mySecret);

  key = "St1tFCor7vQEJNug/465dQ==";
  iv = "oLjkfrLIOnK2bDRvW4kXYA==";
  mySecret = "does thunder read testcases?";
  cipherText = await cryptoSvc.encrypt(mySecret, key, iv);
  Assert.equal(cipherText, "T6fik9Ros+DB2ablH9zZ8FWZ0xm/szSwJjIHZu7sjPs=");

  var badkey = "badkeybadkeybadkeybadk==";
  var badiv = "badivbadivbadivbadivbad=";
  var badcipher = "crapinputcrapinputcrapinputcrapinputcrapinp=";
  var failure;

  try {
    failure = false;
    clearText = await cryptoSvc.decrypt(cipherText, badkey, iv);
  } catch (e) {
    failure = true;
  }
  Assert.ok(failure);

  try {
    failure = false;
    clearText = await cryptoSvc.decrypt(cipherText, key, badiv);
  } catch (e) {
    failure = true;
  }
  Assert.ok(failure);

  try {
    failure = false;
    clearText = await cryptoSvc.decrypt(cipherText, badkey, badiv);
  } catch (e) {
    failure = true;
  }
  Assert.ok(failure);

  try {
    failure = false;
    clearText = await cryptoSvc.decrypt(badcipher, key, iv);
  } catch (e) {
    failure = true;
  }
  Assert.ok(failure);
});
