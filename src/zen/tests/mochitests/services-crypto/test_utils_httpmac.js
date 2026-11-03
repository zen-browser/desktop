/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { CryptoUtils } = ChromeUtils.importESModule(
  "moz-src:///services/crypto/modules/utils.sys.mjs"
);

add_test(function setup() {
  initTestLogging();
  run_next_test();
});

add_task(async function test_sha1() {
  _("Ensure HTTP MAC SHA1 generation works as expected.");

  let id = "vmo1txkttblmn51u2p3zk2xiy16hgvm5ok8qiv1yyi86ffjzy9zj0ez9x6wnvbx7";
  let key = "b8u1cc5iiio5o319og7hh8faf2gi5ym4aq0zwf112cv1287an65fudu5zj7zo7dz";
  let ts = 1329181221;
  let method = "GET";
  let nonce = "wGX71";
  let uri = CommonUtils.makeURI("http://10.250.2.176/alias/");

  let result = await CryptoUtils.computeHTTPMACSHA1(id, key, method, uri, {
    ts,
    nonce,
  });

  Assert.equal(btoa(result.mac), "jzh5chjQc2zFEvLbyHnPdX11Yck=");

  Assert.equal(
    result.getHeader(),
    'MAC id="vmo1txkttblmn51u2p3zk2xiy16hgvm5ok8qiv1yyi86ffjzy9zj0ez9x6wnvbx7", ' +
      'ts="1329181221", nonce="wGX71", mac="jzh5chjQc2zFEvLbyHnPdX11Yck="'
  );

  let ext = "EXTRA DATA; foo,bar=1";

  result = await CryptoUtils.computeHTTPMACSHA1(id, key, method, uri, {
    ts,
    nonce,
    ext,
  });
  Assert.equal(btoa(result.mac), "bNf4Fnt5k6DnhmyipLPkuZroH68=");
  Assert.equal(
    result.getHeader(),
    'MAC id="vmo1txkttblmn51u2p3zk2xiy16hgvm5ok8qiv1yyi86ffjzy9zj0ez9x6wnvbx7", ' +
      'ts="1329181221", nonce="wGX71", mac="bNf4Fnt5k6DnhmyipLPkuZroH68=", ' +
      'ext="EXTRA DATA; foo,bar=1"'
  );
});

add_task(async function test_nonce_length() {
  _("Ensure custom nonce lengths are honoured.");

  function get_mac(length) {
    let uri = CommonUtils.makeURI("http://example.com/");
    return CryptoUtils.computeHTTPMACSHA1("foo", "bar", "GET", uri, {
      nonce_bytes: length,
    });
  }

  let result = await get_mac(12);
  Assert.equal(12, atob(result.nonce).length);

  result = await get_mac(2);
  Assert.equal(2, atob(result.nonce).length);

  result = await get_mac(0);
  Assert.equal(8, atob(result.nonce).length);

  result = await get_mac(-1);
  Assert.equal(8, atob(result.nonce).length);
});
