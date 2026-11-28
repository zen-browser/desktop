/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* This test sync IPC done on the main thread during startup. */

"use strict";

// Shortcuts for conditions.
const LINUX = AppConstants.platform == "linux";
const WIN = AppConstants.platform == "win";
const MAC = AppConstants.platform == "macosx";
const WEBRENDER = window.windowUtils.layerManagerType.startsWith("WebRender");
const SKELETONUI = Services.prefs.getBoolPref(
  "browser.startup.preXulSkeletonUI",
  false
);
// GPUPROCESS is approximate; any check for this should have "ignoreIfUnused: true".
const GPUPROCESS =
  ((WIN || LINUX || MAC) &&
    Services.prefs.getBoolPref("layers.gpu-process.enabled")) ||
  Services.prefs.getBoolPref("layers.gpu-process.force-enabled");

/*
 * Specifying 'ignoreIfUnused: true' will make the test ignore unused entries;
 * without this the test is strict and will fail if a list entry isn't used.
 */
const startupPhases = {
  // Anything done before or during app-startup must have a compelling reason
  // to run before we have even selected the user profile.
  "before profile selection": [],

  "before opening first browser window": [],

  // We reach this phase right after showing the first browser window.
  // This means that any I/O at this point delayed first paint.
  "before first paint": [
    {
      name: "PLayerTransaction::Msg_GetTextureFactoryIdentifier",
      condition: (MAC || LINUX) && !WEBRENDER,
      maxCount: 1,
    },
    {
      name: "PLayerTransaction::Msg_GetTextureFactoryIdentifier",
      condition: WIN && !WEBRENDER,
      maxCount: 3,
    },
    {
      name: "PWebRenderBridge::Msg_EnsureConnected",
      condition: WIN && WEBRENDER,
      maxCount: 3,
    },
    {
      name: "PWebRenderBridge::Msg_EnsureConnected",
      condition: (MAC || LINUX) && WEBRENDER,
      maxCount: 1,
    },
    {
      // bug 1373773
      name: "PCompositorBridge::Msg_NotifyChildCreated",
      condition: !GPUPROCESS,
      ignoreIfUnused: true,
      maxCount: 1,
    },
    {
      // bug 1373773
      name: "PCompositorBridge::Msg_NotifyChildCreated",
      condition: GPUPROCESS,
      ignoreIfUnused: true,
      maxCount: 2,
    },
    {
      name: "PCompositorBridge::Msg_MapAndNotifyChildCreated",
      condition: GPUPROCESS,
      ignoreIfUnused: true,
      maxCount: 2,
    },
    {
      name: "PCompositorBridge::Msg_FlushRendering",
      condition: MAC,
      maxCount: 1,
    },
    {
      name: "PCompositorBridge::Msg_FlushRendering",
      condition: WIN,
      ignoreIfUnused: true, // Only on Win7 32
      maxCount: 1,
    },
    {
      name: "PCompositorBridge::Msg_Initialize",
      condition: GPUPROCESS,
      ignoreIfUnused: true,
      maxCount: 3,
    },
    {
      name: "PCompositorWidget::Msg_Initialize",
      condition: WIN,
      ignoreIfUnused: true, // Only on Win10 64
      maxCount: 3,
    },
    {
      name: "PGPU::Msg_AddLayerTreeIdMapping",
      condition: GPUPROCESS,
      ignoreIfUnused: true,
      maxCount: 5,
    },
    {
      name: "PCompositorBridge::Msg_MakeSnapshot",
      condition: WIN && !WEBRENDER,
      ignoreIfUnused: true, // Only on Win10 64
      maxCount: 1,
    },
    {
      name: "PWebRenderBridge::Msg_GetSnapshot",
      condition: WIN && WEBRENDER,
      ignoreIfUnused: true, // Sometimes in the next phase on Windows10 QR
      maxCount: 1,
    },
    {
      name: "PCompositorBridge::Msg_WillClose",
      condition: WIN,
      ignoreIfUnused: true, // Only on Win10 64
      maxCount: 2,
    },
    {
      name: "PAPZInputBridge::Msg_ProcessUnhandledEvent",
      condition: WIN,
      ignoreIfUnused: true, // Only on Win10 64
      maxCount: 2,
    },
    {
      name: "PGPU::Msg_GetDeviceStatus",
      // bug 1553740 might want to drop the WEBRENDER clause here.
      // Additionally, the skeleton UI causes us to attach "before first paint" to a
      // later event, which lets this sneak in.
      condition: WIN && (WEBRENDER || SKELETONUI),
      // If Init() completes before we call EnsureGPUReady we won't send GetDeviceStatus
      // so we can safely ignore if unused.
      ignoreIfUnused: true,
      maxCount: 1,
    },
    {
      // bug 1784869
      // We use Resume signal to propagate correct XWindow/wl_surface
      // to EGL compositor.
      name: "PCompositorBridge::Msg_Resume",
      condition: LINUX,
      ignoreIfUnused: true, // intermittently occurs in "before handling user events"
      maxCount: 1,
    },
  ],

  // We are at this phase once we are ready to handle user events.
  // Any IO at this phase or before gets in the way of the user
  // interacting with the first browser window.
  "before handling user events": [
    {
      name: "PCompositorBridge::Msg_FlushRendering",
      condition: MAC,
      ignoreIfUnused: true,
      maxCount: 1,
    },
    {
      name: "PCompositorBridge::Msg_FlushRendering",
      condition: LINUX,
      ignoreIfUnused: true, // intermittently occurs in "before becoming idle"
      maxCount: 2,
    },
    {
      name: "PLayerTransaction::Msg_GetTextureFactoryIdentifier",
      condition: (!MAC && !WEBRENDER) || (WIN && WEBRENDER),
      ignoreIfUnused: true, // intermittently occurs in "before becoming idle"
      maxCount: 1,
    },
    {
      name: "PCompositorBridge::Msg_Initialize",
      condition: WIN,
      ignoreIfUnused: true, // Only on Win10 64
      maxCount: 1,
    },
    {
      name: "PCompositorWidget::Msg_Initialize",
      condition: WIN,
      ignoreIfUnused: true, // Only on Win10 64
      maxCount: 1,
    },
    {
      name: "PCompositorBridge::Msg_WillClose",
      condition: WIN,
      ignoreIfUnused: true, // Only on Win7 32
      maxCount: 2,
    },
    {
      name: "PCompositorBridge::Msg_MakeSnapshot",
      condition: WIN,
      ignoreIfUnused: true, // Only on Win7 32
      maxCount: 1,
    },
    {
      name: "PWebRenderBridge::Msg_GetSnapshot",
      condition: WIN && WEBRENDER,
      ignoreIfUnused: true, // Sometimes in the next phase on Windows10 QR
      maxCount: 1,
    },
    {
      name: "PAPZInputBridge::Msg_ProcessUnhandledEvent",
      condition: WIN,
      ignoreIfUnused: true, // intermittently occurs in "before becoming idle"
      maxCount: 1,
    },
    {
      name: "PAPZInputBridge::Msg_ReceiveMouseInputEvent",
      condition: WIN,
      ignoreIfUnused: true, // intermittently occurs in "before becoming idle"
      maxCount: 1,
    },
    {
      name: "PWebRenderBridge::Msg_EnsureConnected",
      condition: WIN && WEBRENDER,
      ignoreIfUnused: true,
      maxCount: 1,
    },
    {
      name: "PContent::Reply_BeginDriverCrashGuard",
      condition: WIN,
      ignoreIfUnused: true, // Bug 1660590 - found while running test on windows hardware
      maxCount: 1,
    },
    {
      name: "PContent::Reply_EndDriverCrashGuard",
      condition: WIN,
      ignoreIfUnused: true, // Bug 1660590 - found while running test on windows hardware
      maxCount: 1,
    },
    {
      // bug 1784869
      // We use Resume signal to propagate correct XWindow/wl_surface
      // to EGL compositor.
      name: "PCompositorBridge::Msg_Resume",
      condition: LINUX,
      ignoreIfUnused: true, // intermittently occurs in "before first paint"
      maxCount: 1,
    },
  ],

  // Things that are expected to be completely out of the startup path
  // and loaded lazily when used for the first time by the user should
  // be listed here.
  "before becoming idle": [
    {
      // bug 1373773
      name: "PCompositorBridge::Msg_NotifyChildCreated",
      ignoreIfUnused: true,
      maxCount: 1,
    },
    {
      name: "PAPZInputBridge::Msg_ProcessUnhandledEvent",
      condition: WIN,
      ignoreIfUnused: true, // Only on Win10 64
      maxCount: 1,
    },
    {
      name: "PAPZInputBridge::Msg_ReceiveMouseInputEvent",
      condition: WIN,
      ignoreIfUnused: true, // Only on Win10 64
      maxCount: 1,
    },
    {
      // bug 1554234
      name: "PLayerTransaction::Msg_GetTextureFactoryIdentifier",
      condition: WIN || LINUX,
      ignoreIfUnused: true, // intermittently occurs in "before handling user events"
      maxCount: 1,
    },
    {
      name: "PWebRenderBridge::Msg_EnsureConnected",
      condition: (WIN || LINUX) && WEBRENDER,
      ignoreIfUnused: true,
      maxCount: 1,
    },
    {
      name: "PCompositorBridge::Msg_Initialize",
      condition: WIN,
      ignoreIfUnused: true, // Intermittently occurs in "before handling user events"
      maxCount: 1,
    },
    {
      name: "PCompositorWidget::Msg_Initialize",
      condition: WIN,
      ignoreIfUnused: true, // Intermittently occurs in "before handling user events"
      maxCount: 1,
    },
    {
      name: "PCompositorBridge::Msg_MapAndNotifyChildCreated",
      condition: WIN,
      ignoreIfUnused: true,
      maxCount: 1,
    },
    {
      name: "PCompositorBridge::Msg_FlushRendering",
      condition: MAC || SKELETONUI,
      ignoreIfUnused: true,
      maxCount: 1,
    },
    {
      name: "PCompositorBridge::Msg_FlushRendering",
      condition: LINUX,
      ignoreIfUnused: true, // intermittently occurs in "before handling user events"
      maxCount: 1,
    },
    {
      name: "PWebRenderBridge::Msg_GetSnapshot",
      condition: WIN && WEBRENDER,
      ignoreIfUnused: true,
      maxCount: 1,
    },
    {
      name: "PCompositorBridge::Msg_MakeSnapshot",
      condition: WIN,
      ignoreIfUnused: true,
      maxCount: 1,
    },
    {
      name: "PCompositorBridge::Msg_WillClose",
      condition: WIN,
      ignoreIfUnused: true,
      maxCount: 2,
    },
    // Added for the search-detection built-in add-on.
    {
      name: "PGPU::Msg_AddLayerTreeIdMapping",
      condition: GPUPROCESS,
      ignoreIfUnused: true,
      maxCount: 1,
    },
  ],
};

add_task(async function () {
  if (
    !AppConstants.NIGHTLY_BUILD &&
    !AppConstants.MOZ_DEV_EDITION &&
    !AppConstants.DEBUG
  ) {
    ok(
      !("@mozilla.org/test/startuprecorder;1" in Cc),
      "the startup recorder component shouldn't exist in this non-nightly/non-devedition/" +
        "non-debug build."
    );
    return;
  }

  let startupRecorder =
    Cc["@mozilla.org/test/startuprecorder;1"].getService().wrappedJSObject;
  await startupRecorder.done;

  // Check for sync IPC markers in the startup profile.
  let profile = startupRecorder.data.profile.threads[0];

  let phases = {};
  {
    const nameCol = profile.markers.schema.name;
    const dataCol = profile.markers.schema.data;
    const startTimeCol = profile.markers.schema.startTime;

    let markersForCurrentPhase = [];
    for (let m of profile.markers.data) {
      let markerName = profile.stringTable[m[nameCol]];
      if (markerName.startsWith("startupRecorder:")) {
        phases[markerName.split("startupRecorder:")[1]] =
          markersForCurrentPhase;
        markersForCurrentPhase = [];
        continue;
      }

      let markerData = m[dataCol];
      if (
        !markerData ||
        markerData.category != "Sync IPC" ||
        !m[startTimeCol]
      ) {
        continue;
      }

      markersForCurrentPhase.push(markerName);
    }
  }

  for (let phase in startupPhases) {
    startupPhases[phase] = startupPhases[phase].filter(
      entry => !("condition" in entry) || entry.condition
    );
  }

  let shouldPass = true;
  for (let phase in phases) {
    let knownIPCList = startupPhases[phase];
    if (knownIPCList.length) {
      info(
        `known sync IPC ${phase}:\n` +
          knownIPCList
            .map(e => `  ${e.name} - at most ${e.maxCount} times`)
            .join("\n")
      );
    }

    let markers = phases[phase];
    for (let marker of markers) {
      let expected = false;
      for (let entry of knownIPCList) {
        if (marker == entry.name) {
          entry.useCount = (entry.useCount || 0) + 1;
          expected = true;
          break;
        }
      }
      if (!expected) {
        ok(false, `unexpected ${marker} sync IPC ${phase}`);
        shouldPass = false;
      }
    }

    for (let entry of knownIPCList) {
      // Make sure useCount has been defined.
      entry.useCount = entry.useCount || 0;
      let message = `sync IPC ${entry.name} `;
      if (entry.useCount == entry.maxCount) {
        message += "happened as many times as expected";
      } else if (entry.useCount < entry.maxCount) {
        message += `allowed ${entry.maxCount} but only happened ${entry.useCount} times`;
      } else {
        message += `happened ${entry.useCount} but max is ${entry.maxCount}`;
        shouldPass = false;
      }
      Assert.lessOrEqual(entry.useCount, entry.maxCount, `${message} ${phase}`);

      if (entry.useCount == 0 && !entry.ignoreIfUnused) {
        ok(false, `unused known IPC entry ${phase}: ${entry.name}`);
        shouldPass = false;
      }
    }
  }

  if (shouldPass) {
    ok(shouldPass, "No unexpected sync IPC during startup");
  } else {
    const filename = "profile_startup_syncIPC.json";
    let path = Services.env.get("MOZ_UPLOAD_DIR");
    let profilePath = PathUtils.join(path, filename);
    await IOUtils.writeJSON(profilePath, startupRecorder.data.profile);
    ok(
      false,
      `Unexpected sync IPC behavior during startup; open the ${filename} ` +
        "artifact in the Firefox Profiler to see what happened"
    );
  }
});
