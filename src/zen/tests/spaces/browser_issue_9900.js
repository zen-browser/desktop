/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Invalid_Workspace_Name() {
  const fakeWorkspace = {
    name: "",
  };
  const icon = gZenWorkspaces.getWorkspaceIcon(fakeWorkspace);
  Assert.equal(icon, fakeWorkspace.icon, "Test should not have crashed");
});

add_task(async function test_Invalid_Workspace_Emoji() {
  const fakeWorkspace = {
    name: "👍 test test",
  };
  const icon = gZenWorkspaces.getWorkspaceIcon(fakeWorkspace);
  Assert.equal(
    icon,
    "👍",
    "Emoji icon should match the first character of the workspace name"
  );
});

add_task(async function test_Invalid_Workspace_Name() {
  const fakeWorkspace = {
    name: "my workspace",
  };
  const icon = gZenWorkspaces.getWorkspaceIcon(fakeWorkspace);
  Assert.equal(
    icon,
    "M",
    "Icon should match the first character of the workspace name"
  );
});

add_task(async function test_Invalid_Workspace_Name() {
  const fakeWorkspace = {
    name: "my workspace",
    icon: "👍",
  };
  const icon = gZenWorkspaces.getWorkspaceIcon(fakeWorkspace);
  Assert.equal(icon, "👍", "Icon should be from the workspace icon");
});
