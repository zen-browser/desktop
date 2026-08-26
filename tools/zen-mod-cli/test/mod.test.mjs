import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readMod } from "../src/mod.mjs";

async function withFixture(files, operation) {
  const root = await mkdtemp(path.join(os.tmpdir(), "zenmod-test-"));
  try {
    await Promise.all(
      Object.entries(files).map(([name, contents]) =>
        writeFile(path.join(root, name), contents)
      )
    );
    return await operation(root);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

test("reads a Sine local mod manifest", async () => {
  await withFixture(
    {
      "chrome.css": ".example { display: block; }",
      "preferences.json": JSON.stringify([
        {
          defaultValue: true,
          property: "example.enabled",
          type: "checkbox",
        },
      ]),
      "sine-mod.json": JSON.stringify({
        example: {
          name: "Example",
          preferences: "preferences.json",
          scripts: {
            "example.uc.js": {
              include: ["chrome://browser/content/browser.xhtml"],
            },
          },
          style: { chrome: "chrome.css" },
        },
      }),
      "example.uc.js": "window.__example = true;",
    },
    async root => {
      const mod = await readMod(root);

      assert.equal(mod.id, "example");
      assert.equal(mod.scripts.length, 1);
      assert.equal(path.basename(mod.stylePath), "chrome.css");
      assert.equal(mod.preferences[0].property, "example.enabled");
    }
  );
});

test("discovers conventional files without a manifest", async () => {
  await withFixture(
    {
      "chrome.css": "",
      "example.uc.js": "",
    },
    async root => {
      const mod = await readMod(root);

      assert.equal(mod.id, path.basename(root));
      assert.deepEqual(mod.scripts.map(script => path.basename(script)), [
        "example.uc.js",
      ]);
      assert.equal(path.basename(mod.stylePath), "chrome.css");
    }
  );
});

test("rejects manifest paths outside the mod", async () => {
  await withFixture(
    {
      "sine-mod.json": JSON.stringify({
        example: {
          scripts: {
            "../outside.uc.js": {},
          },
        },
      }),
    },
    async root => {
      await assert.rejects(() => readMod(root), /escapes its directory/);
    }
  );
});
