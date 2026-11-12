/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_invalid_ids_are_rejected() {
  await useStore("store");

  for (const modId of ["../escape", "a/b", "", "has space", ".hidden"]) {
    await Assert.rejects(
      gZenModsManager.fetchStoreMod(modId),
      /Invalid mod id/,
      `"${modId}" is not a valid mod id`
    );
  }
});

add_task(async function test_store_must_answer_with_the_requested_id() {
  await useStore("store-untrusted");

  await Assert.rejects(
    gZenModsManager.fetchStoreMod("zen-test-wrong-id"),
    /Unexpected mod id/,
    "A mod that claims another id is rejected"
  );
});

add_task(async function test_untrusted_urls_are_rejected() {
  await useStore("store-untrusted");

  const cases = [
    ["zen-test-bad-http", /non-HTTPS/, "plain HTTP"],
    ["zen-test-bad-host", /outside the store/, "another host"],
    ["zen-test-bad-redirect", /non-HTTPS/, "a redirect to plain HTTP"],
  ];

  for (const [modId, error, description] of cases) {
    const mod = await gZenModsManager.fetchStoreMod(modId);

    await Assert.rejects(
      gZenModsManager.installMod(mod),
      error,
      `Styles from ${description} are refused`
    );
    ok(
      !(await gZenModsManager.isModInstalled(modId)),
      `A mod with styles from ${description} is not installed`
    );
  }
});
