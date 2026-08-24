const base64url =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";

function run_test() {
  _("Make sure makeGUID makes guids of the right length/characters");
  _("Create a bunch of guids to make sure they don't conflict");
  let guids = [];
  for (let i = 0; i < 1000; i++) {
    let newGuid = Utils.makeGUID();
    _("Generated " + newGuid);

    // Verify that the GUID's length is correct, even when it's URL encoded.
    Assert.equal(newGuid.length, 12);
    Assert.equal(encodeURIComponent(newGuid).length, 12);

    // Verify that the GUID only contains base64url characters
    Assert.ok(
      Array.prototype.every.call(newGuid, function (chr) {
        return base64url.includes(chr);
      })
    );

    // Verify that Utils.checkGUID() correctly identifies them as valid.
    Assert.ok(Utils.checkGUID(newGuid));

    // Verify uniqueness within our sample of 1000. This could cause random
    // failures, but they should be extremely rare. Otherwise we'd have a
    // problem with GUID collisions.
    Assert.ok(
      guids.every(function (g) {
        return g != newGuid;
      })
    );
    guids.push(newGuid);
  }

  _("Make sure checkGUID fails for invalid GUIDs");
  Assert.ok(!Utils.checkGUID(undefined));
  Assert.ok(!Utils.checkGUID(null));
  Assert.ok(!Utils.checkGUID(""));
  Assert.ok(!Utils.checkGUID("blergh"));
  Assert.ok(!Utils.checkGUID("ThisGUIDisWayTooLong"));
  Assert.ok(!Utils.checkGUID("Invalid!!!!!"));
}
