/* eslint no-tabs:"off" */

function run_test() {
  _("Normalize passphrase recognizes hyphens.");
  const pp = "26ect2thczm599m2ffqarbicjq";
  const hyphenated = "2-6ect2-thczm-599m2-ffqar-bicjq";
  Assert.equal(Utils.normalizePassphrase(hyphenated), pp);

  _("Skip whitespace.");
  Assert.equal(
    "aaaaaaaaaaaaaaaaaaaaaaaaaa",
    Utils.normalizePassphrase("aaaaaaaaaaaaaaaaaaaaaaaaaa  ")
  );
  Assert.equal(
    "aaaaaaaaaaaaaaaaaaaaaaaaaa",
    Utils.normalizePassphrase("	 aaaaaaaaaaaaaaaaaaaaaaaaaa")
  );
  Assert.equal(
    "aaaaaaaaaaaaaaaaaaaaaaaaaa",
    Utils.normalizePassphrase("    aaaaaaaaaaaaaaaaaaaaaaaaaa  ")
  );
  Assert.equal(
    "aaaaaaaaaaaaaaaaaaaaaaaaaa",
    Utils.normalizePassphrase("    a-aaaaa-aaaaa-aaaaa-aaaaa-aaaaa  ")
  );
  Assert.ok(Utils.isPassphrase("aaaaaaaaaaaaaaaaaaaaaaaaaa  "));
  Assert.ok(Utils.isPassphrase("	 aaaaaaaaaaaaaaaaaaaaaaaaaa"));
  Assert.ok(Utils.isPassphrase("    aaaaaaaaaaaaaaaaaaaaaaaaaa  "));
  Assert.ok(Utils.isPassphrase("    a-aaaaa-aaaaa-aaaaa-aaaaa-aaaaa  "));
  Assert.ok(!Utils.isPassphrase("    -aaaaa-aaaaa-aaaaa-aaaaa-aaaaa  "));

  _("Normalizing 20-char passphrases.");
  Assert.equal(
    Utils.normalizePassphrase("abcde-abcde-abcde-abcde"),
    "abcdeabcdeabcdeabcde"
  );
  Assert.equal(
    Utils.normalizePassphrase("a-bcde-abcde-abcde-abcde"),
    "a-bcde-abcde-abcde-abcde"
  );
  Assert.equal(
    Utils.normalizePassphrase(" abcde-abcde-abcde-abcde "),
    "abcdeabcdeabcdeabcde"
  );
}
