/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

function run_test() {
  Assert.equal(
    Utils.encodeKeyBase32("foobarbafoobarba"),
    "mzxw6ytb9jrgcztpn5rgc4tcme"
  );
  Assert.equal(
    Utils.decodeKeyBase32("mzxw6ytb9jrgcztpn5rgc4tcme"),
    "foobarbafoobarba"
  );
  Assert.equal(
    Utils.encodeKeyBase32(
      "\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01"
    ),
    "aeaqcaibaeaqcaibaeaqcaibae"
  );
  Assert.equal(
    Utils.decodeKeyBase32("aeaqcaibaeaqcaibaeaqcaibae"),
    "\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01\x01"
  );
}
