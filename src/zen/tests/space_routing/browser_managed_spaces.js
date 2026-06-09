/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_parse_normalizes_entries() {
  await withManagedSpaces(
    [
      { name: "Work", icon: "briefcase", container: "Work", position: 0 },
      { name: "Personal", icon: "🏠" },
      { name: "  ", icon: "x" }, // skipped: empty name
    ],
    async () => {
      const spaces = gZenManagedSpaces.getManagedSpaces();
      Assert.equal(spaces.length, 2, "empty-name entry dropped");

      Assert.equal(spaces[0].name, "Work");
      Assert.equal(
        spaces[0].icon,
        "chrome://browser/skin/zen-icons/selectable/briefcase.svg",
        "bare icon name expanded to selectable svg URL"
      );
      Assert.equal(spaces[0].container, "Work");
      Assert.equal(spaces[0].position, 0);

      Assert.equal(spaces[1].icon, "🏠", "emoji kept as-is");
      Assert.equal(spaces[1].position, 1, "position falls back to array index");

      Assert.ok(gZenManagedSpaces.isManaged("Work"), "Work is managed");
      Assert.ok(!gZenManagedSpaces.isManaged("Nope"), "unknown not managed");
    }
  );
});

add_task(async function test_malformed_pref_is_noop() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.space-routing.managed-spaces", "not json"]],
  });
  Assert.deepEqual(
    gZenManagedSpaces.getManagedSpaces(),
    [],
    "malformed pref yields no managed spaces and does not throw"
  );
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_resolve_container_by_name() {
  const created = ContextualIdentityService.create(
    "ZMS Test Container",
    "fingerprint",
    "blue"
  );
  registerCleanupFunction(() =>
    ContextualIdentityService.remove(created.userContextId)
  );

  Assert.equal(
    gZenManagedSpaces.resolveContainerId("ZMS Test Container"),
    created.userContextId,
    "container name resolves to its userContextId"
  );
  Assert.equal(
    gZenManagedSpaces.resolveContainerId("Does Not Exist"),
    0,
    "unknown container name resolves to 0 (no container)"
  );
  Assert.equal(
    gZenManagedSpaces.resolveContainerId(created.userContextId),
    created.userContextId,
    "a numeric userContextId is accepted directly"
  );
  Assert.equal(gZenManagedSpaces.resolveContainerId(null), 0, "null -> 0");
});

add_task(async function test_reconcile_creates_missing_space() {
  const before = gZenWorkspaces.getWorkspaces().length;
  await withManagedSpaces(
    [{ name: "ZMS Created", icon: "briefcase" }],
    async () => {
      gZenManagedSpaces.reconcile(window);

      const space = gZenWorkspaces
        .getWorkspaces()
        .find(w => w.name === "ZMS Created");
      Assert.ok(space, "a managed Space was created for the missing name");
      Assert.equal(
        space.icon,
        "chrome://browser/skin/zen-icons/selectable/briefcase.svg",
        "created Space uses the resolved icon URL"
      );
      Assert.equal(
        gZenWorkspaces.getWorkspaces().length,
        before + 1,
        "exactly one Space created"
      );

      // cleanup
      gZenWorkspaces.removeWorkspace(space.uuid);
    }
  );
});
