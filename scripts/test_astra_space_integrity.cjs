#!/usr/bin/env node
/* Pure state tests for Astra Space integrity helpers (no browser runtime). */
"use strict";

const path = require("path");
const { pathToFileURL } = require("url");

async function main() {
  const integrityPath = pathToFileURL(
    path.resolve(__dirname, "../src/zen/spaces/AstraSpaceIntegrity.mjs")
  ).href;

  const {
    validateSpaceState,
    buildRepairPlan,
    sanitizeSpacePins,
    resolveLaunchSpace,
    chooseSafeActiveSpace,
    calculateRecoveredTabAssignments,
    classifyTabForIntegrity,
    isSpaceIntegrityReady,
    resolveRecoveredSpaceIdentity,
    nextSwitchGeneration,
    ownsSwitchGeneration,
    shouldRollbackSwitch,
    RECOVERED_TABS_SPACE_UUID,
    ASTRA_SPACE_ROLE_RECOVERED,
  } = await import(integrityPath);

  let failed = 0;
  const assert = (cond, msg) => {
    if (!cond) {
      failed += 1;
      console.error(`FAIL ${msg}`);
    } else {
      console.log(`OK  ${msg}`);
    }
  };

  const spaceA = "11111111-1111-4111-8111-111111111111";
  const spaceB = "22222222-2222-4222-8222-222222222222";

  // valid one-Space
  {
    const r = validateSpaceState({
      spaces: [{ uuid: spaceA, name: "A" }],
      activeSpaceId: spaceA,
      tabs: [{ id: "t1", workspaceId: spaceA, alive: true }],
    });
    assert(r.valid, "valid one-Space profile");
    assert(!r.repairPlan.needsRepair, "valid profile needs no repair");
  }

  // five valid Spaces
  {
    const spaces = Array.from({ length: 5 }, (_, i) => ({
      uuid: `22222222-2222-4222-8222-22222222222${i}`,
      name: `S${i}`,
    }));
    const r = validateSpaceState({
      spaces,
      activeSpaceId: spaces[2].uuid,
      tabs: spaces.map((s, i) => ({
        id: `t${i}`,
        workspaceId: s.uuid,
        alive: true,
      })),
    });
    assert(r.valid, "five valid Spaces");
  }

  // no Spaces
  {
    const r = validateSpaceState({ spaces: [], activeSpaceId: "" });
    assert(!r.valid, "no Spaces is invalid");
    assert(
      r.repairPlan.actions.some(a => a.type === "ensure-default-space"),
      "no Spaces plans default Space"
    );
  }

  // duplicate UUID
  {
    const id = "33333333-3333-4333-8333-333333333333";
    const r = validateSpaceState({
      spaces: [
        { uuid: id, name: "A" },
        { uuid: id, name: "B" },
      ],
      activeSpaceId: id,
    });
    assert(!r.valid, "duplicate UUID invalid");
    assert(r.duplicateSpaces.includes(id), "duplicate reported");
  }

  // invalid active
  {
    const id = "44444444-4444-4444-8444-444444444444";
    const r = validateSpaceState({
      spaces: [{ uuid: id, name: "A" }],
      activeSpaceId: "55555555-5555-4555-8555-555555555555",
    });
    assert(r.invalidActiveSpace, "invalid active Space detected");
    assert(
      r.repairPlan.actions.some(a => a.type === "set-active-space"),
      "plans set-active-space"
    );
  }

  // live orphan
  {
    const r = validateSpaceState({
      spaces: [{ uuid: spaceA, name: "A" }],
      activeSpaceId: spaceA,
      tabs: [{ id: "orphan", workspaceId: "dead-space", alive: true }],
    });
    assert(r.orphanTabs.length === 1, "one orphan tab");
    assert(
      r.repairPlan.actions.some(a => a.type === "ensure-recovered-tabs-space"),
      "plans Recovered Tabs Space"
    );
  }

  // classify categories
  {
    const ids = new Set([spaceA]);
    assert(
      classifyTabForIntegrity(
        { id: "o", workspaceId: "", alive: true },
        ids
      ).kind === "orphan-live",
      "live orphan classified"
    );
    assert(
      classifyTabForIntegrity(
        { id: "z", workspaceId: "x", alive: false },
        ids
      ).kind === "zombie-stale",
      "stale non-live zombie classified"
    );
    assert(
      classifyTabForIntegrity(
        { id: "c", workspaceId: "x", alive: true, closing: true },
        ids
      ).kind === "zombie-closing",
      "closing tab is zombie-closing"
    );
    assert(
      classifyTabForIntegrity(
        { id: "r", workspaceId: "", pending: true, alive: false },
        ids
      ).kind === "not-ready",
      "restoring tab not-ready"
    );
    assert(
      classifyTabForIntegrity(
        { id: "e", workspaceId: "x", essential: true, alive: true },
        ids
      ).kind === "skip-essential",
      "Essential skipped"
    );
    assert(
      classifyTabForIntegrity(
        {
          id: "s",
          workspaceId: spaceA,
          alive: true,
          splitView: true,
        },
        ids
      ).kind === "owned-split",
      "Split View owned"
    );
    assert(
      classifyTabForIntegrity(
        {
          id: "f",
          empty: true,
          pinned: true,
          hasGroup: false,
          alive: true,
        },
        ids
      ).kind === "zombie-empty-folder",
      "empty-folder zombie"
    );
  }

  // not-ready defers orphan repair
  {
    const r = validateSpaceState({
      spaces: [{ uuid: spaceA, name: "A" }],
      activeSpaceId: spaceA,
      tabs: [
        { id: "o", workspaceId: "", alive: true },
        { id: "r", workspaceId: "", restoring: true, alive: false },
      ],
    });
    assert(r.orphanTabs.length === 1, "orphan still reported while not-ready");
    assert(r.notReadyTabs.length === 1, "not-ready reported");
    assert(
      !r.repairPlan.actions.some(a => a.type === "assign-orphan-tabs"),
      "orphan assign deferred while not-ready"
    );
  }

  // 100 orphans
  {
    const tabs = Array.from({ length: 100 }, (_, i) => ({
      id: `o${i}`,
      workspaceId: "",
      alive: true,
    }));
    const r = validateSpaceState({
      spaces: [{ uuid: spaceA, name: "A" }],
      activeSpaceId: spaceA,
      tabs,
    });
    assert(r.orphanTabs.length === 100, "100 orphan tabs");
    const assign = calculateRecoveredTabAssignments(
      r.orphanTabs,
      RECOVERED_TABS_SPACE_UUID
    );
    assert(assign.length === 100, "100 recovered assignments");
    assert(
      assign.every(a => a.spaceId === RECOVERED_TABS_SPACE_UUID),
      "stable recovered UUID"
    );
  }

  // invalid folder
  {
    const r = validateSpaceState({
      spaces: [{ uuid: spaceA, name: "A" }],
      activeSpaceId: spaceA,
      folders: [{ id: "f1", workspaceId: "missing" }],
    });
    assert(r.invalidFolders.length === 1, "invalid folder owner");
  }

  // missing pin Space + unknown app
  {
    const r = validateSpaceState({
      spaces: [{ uuid: spaceA, name: "A" }],
      activeSpaceId: spaceA,
      spacePins: {
        [spaceB]: ["gmail"],
        [spaceA]: ["missing-app"],
      },
      knownAppIds: new Set(["gmail"]),
    });
    assert(r.invalidAppPins.length >= 2, "invalid app pins reported");
  }

  // validation purity: no input mutation + identical repeats
  {
    const tabs = [{ id: "t", workspaceId: "", alive: true }];
    const spaces = [{ uuid: spaceA, name: "A" }];
    const input = {
      spaces,
      activeSpaceId: "nope",
      tabs,
    };
    const before = JSON.stringify(input);
    const a = validateSpaceState(input);
    const b = validateSpaceState(input);
    assert(JSON.stringify(input) === before, "validate does not mutate input");
    assert(
      JSON.stringify(a.repairPlan.actions.map(x => x.type)) ===
        JSON.stringify(b.repairPlan.actions.map(x => x.type)),
      "repeated validate yields same plan types"
    );
    assert(tabs[0].workspaceId === "", "tab workspaceId unchanged");
  }

  // Recovered ID collision with user Space
  {
    const identity = resolveRecoveredSpaceIdentity([
      {
        uuid: RECOVERED_TABS_SPACE_UUID,
        name: "My Space",
        astraRole: "",
      },
    ]);
    assert(identity.collided === true, "reserved UUID collision detected");
    assert(identity.create === true, "collision requires create alternate");
    assert(
      identity.avoidUuid === RECOVERED_TABS_SPACE_UUID,
      "avoid reserved UUID"
    );

    const byRole = resolveRecoveredSpaceIdentity([
      {
        uuid: spaceB,
        name: "Recovered Tabs",
        astraRole: ASTRA_SPACE_ROLE_RECOVERED,
      },
      {
        uuid: RECOVERED_TABS_SPACE_UUID,
        name: "User",
      },
    ]);
    assert(
      byRole.spaceId === spaceB && !byRole.create,
      "role metadata wins over name/reserved UUID"
    );

    const byNameOnly = resolveRecoveredSpaceIdentity([
      { uuid: spaceA, name: "Recovered Tabs" },
    ]);
    assert(
      byNameOnly.create === true &&
        byNameOnly.spaceId === RECOVERED_TABS_SPACE_UUID,
      "localized name alone is not the recovered Space"
    );
  }

  // readiness gate
  {
    assert(
      !isSpaceIntegrityReady({
        spacesInitialized: true,
        sessionRestoreComplete: false,
        workspaceCacheReady: true,
        windowClosing: false,
      }),
      "not ready before session restore"
    );
    assert(
      isSpaceIntegrityReady({
        spacesInitialized: true,
        sessionRestoreComplete: true,
        workspaceCacheReady: true,
        windowClosing: false,
      }),
      "ready after restore + cache"
    );
    assert(
      !isSpaceIntegrityReady({
        spacesInitialized: true,
        sessionRestoreComplete: true,
        workspaceCacheReady: true,
        windowClosing: true,
      }),
      "not ready while window closing"
    );
  }

  // switch generation ownership (A→B→C)
  {
    let gen = 0;
    const a = (gen = nextSwitchGeneration(gen));
    const b = (gen = nextSwitchGeneration(gen));
    const c = (gen = nextSwitchGeneration(gen));
    assert(a === 1 && b === 2 && c === 3, "A→B→C generations increase");
    assert(!ownsSwitchGeneration(b, c), "stale B does not own after C");
    assert(ownsSwitchGeneration(c, c), "C owns current generation");
    assert(
      !shouldRollbackSwitch(b, c),
      "stale B must not rollback after C commits"
    );
    assert(
      shouldRollbackSwitch(c, c),
      "current owner may rollback on failure"
    );
  }

  // state changed between scan/apply — plan must be revalidated by apply
  {
    const scan = validateSpaceState({
      spaces: [{ uuid: spaceA, name: "A" }],
      activeSpaceId: spaceA,
      tabs: [{ id: "o1", workspaceId: "", alive: true }],
    });
    assert(
      scan.repairPlan.actions.some(a => a.type === "assign-orphan-tabs"),
      "scan plans orphan assign"
    );
    // After "reassignment", orphan gone — fresh validate needs no assign.
    const after = validateSpaceState({
      spaces: [{ uuid: spaceA, name: "A" }],
      activeSpaceId: spaceA,
      tabs: [{ id: "o1", workspaceId: spaceA, alive: true }],
    });
    assert(
      !after.repairPlan.actions.some(a => a.type === "assign-orphan-tabs"),
      "recomputed plan drops stale orphan assign"
    );
  }

  // sanitize pins
  {
    const clean = sanitizeSpacePins(
      {
        [spaceA]: ["gmail", "gmail", "nope"],
        bad: ["x"],
      },
      {
        validSpaceIds: new Set([spaceA]),
        knownAppIds: new Set(["gmail"]),
        maxPinsPerSpace: 24,
      }
    );
    assert(
      clean[spaceA]?.length === 1,
      "sanitizeSpacePins drops unknown/dupes"
    );
  }

  // resolve launch
  {
    const spaces = [
      { uuid: spaceA, name: "A" },
      { uuid: spaceB, name: "B" },
    ];
    assert(
      resolveLaunchSpace({
        explicitSpaceId: spaceB,
        activeSpaceId: spaceA,
        spaces,
      }).reason === "explicit",
      "explicit launch Space wins"
    );
    assert(
      resolveLaunchSpace({
        activeSpaceId: spaceA,
        spaces,
      }).reason === "current",
      "current Space default"
    );
  }

  // chooseSafeActiveSpace
  {
    const spaces = [
      {
        uuid: RECOVERED_TABS_SPACE_UUID,
        astraRole: "recovered-tabs",
        name: "R",
      },
      { uuid: spaceB, name: "N" },
    ];
    assert(
      chooseSafeActiveSpace(spaces).uuid === spaceB,
      "prefers non-recovered Space"
    );
  }

  // buildRepairPlan empty
  {
    const plan = buildRepairPlan({ spaces: [], invalidActiveSpace: true });
    assert(plan.needsRepair, "empty plan needs repair");
  }

  // private non-persistence is a policy of AppState.update — assert API surface
  {
    const appStateSrc = require("fs").readFileSync(
      path.resolve(__dirname, "../src/zen/spaces/AstraSpaceAppState.mjs"),
      "utf8"
    );
    assert(
      /privateWindow\s*=\s*false/.test(appStateSrc) &&
        /if\s*\(\s*privateWindow\s*\)/.test(appStateSrc),
      "AppState refuses private-window pin writes"
    );
  }

  // cross-window recovery creation race: identity resolver is deterministic
  {
    const emptyA = resolveRecoveredSpaceIdentity([]);
    const emptyB = resolveRecoveredSpaceIdentity([]);
    assert(
      emptyA.spaceId === emptyB.spaceId &&
        emptyA.spaceId === RECOVERED_TABS_SPACE_UUID,
      "two windows agree on reserved recovery UUID when free"
    );
  }

  if (failed) {
    console.error(`\n${failed} pure test failure(s)`);
    process.exit(1);
  }
  console.log("\nAll pure Space integrity tests passed.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
