import assert from "node:assert/strict";
import test from "node:test";
import { parseCliArgs, parsePreferenceOverrides } from "../src/args.mjs";

test("parses a browser command and repeated preferences", () => {
  const parsed = parseCliArgs([
    "inspect",
    "mods/example",
    "--selector",
    ".example",
    "--pref",
    "feature.enabled=true",
    "--pref",
    "feature.delay=12",
    "--headed",
  ]);

  assert.equal(parsed.command, "inspect");
  assert.deepEqual(parsed.positionals, ["mods/example"]);
  assert.equal(parsed.options.selector, ".example");
  assert.equal(parsed.options.headed, true);
  assert.deepEqual(parsePreferenceOverrides(parsed.options.prefs), {
    "feature.delay": 12,
    "feature.enabled": true,
  });
});

test("rejects unknown options", () => {
  assert.throws(
    () => parseCliArgs(["doctor", "--wat"]),
    /Unknown option: --wat/
  );
});

test("rejects invalid preference overrides", () => {
  assert.throws(
    () => parsePreferenceOverrides(["missing-separator"]),
    /Invalid preference override/
  );
});
