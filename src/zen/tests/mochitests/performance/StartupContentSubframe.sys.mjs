/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * test helper JSWindowActors used by the browser_startup_content_subframe.js test.
 */

export class StartupContentSubframeParent extends JSWindowActorParent {
  receiveMessage(msg) {
    // Tell the test about the data we received from the content process.
    Services.obs.notifyObservers(
      msg.data,
      "startup-content-subframe-loaded-scripts"
    );
  }
}

export class StartupContentSubframeChild extends JSWindowActorChild {
  async handleEvent() {
    // When the remote subframe is loaded, an event will be fired to this actor,
    // which will cause us to send the `LoadedScripts` message to the parent
    // process.
    // Wait a spin of the event loop before doing so to ensure we don't
    // miss any scripts loaded immediately after the load event.
    await new Promise(resolve => Services.tm.dispatchToMainThread(resolve));

    const Cm = Components.manager;
    Cm.QueryInterface(Ci.nsIServiceManager);
    const { AppConstants } = ChromeUtils.importESModule(
      "resource://gre/modules/AppConstants.sys.mjs"
    );
    let collectStacks = AppConstants.NIGHTLY_BUILD || AppConstants.DEBUG;

    let modules = new Map();
    for (let module of Cu.loadedESModules) {
      modules.set(module, collectStacks ? Cu.getModuleImportStack(module) : "");
    }

    let services = new Map();
    for (let contractID of Object.keys(Cc)) {
      try {
        if (Cm.isServiceInstantiatedByContractID(contractID, Ci.nsISupports)) {
          services.set(contractID, "");
        }
      } catch (e) {}
    }
    this.sendAsyncMessage("LoadedScripts", {
      modules,
      services,
    });
  }
}
