/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  NetUtil: "resource://gre/modules/NetUtil.sys.mjs",
});

export var PerfTestHelpers = {
  /**
   * Maps the entries in the given iterable to the given
   * promise-returning task function, and waits for all returned
   * promises to have resolved. At most `limit` promises may remain
   * unresolved at a time. When the limit is reached, the function will
   * wait for some to resolve before spawning more tasks.
   */
  async throttledMapPromises(iterable, task, limit = 64) {
    let pending = new Set();
    let promises = [];
    for (let data of iterable) {
      while (pending.size >= limit) {
        await Promise.race(pending);
      }

      let promise = task(data);
      promises.push(promise);
      if (promise) {
        promise.finally(() => pending.delete(promise));
        pending.add(promise);
      }
    }

    return Promise.all(promises);
  },

  /**
   * Returns a promise which resolves to true if the resource at the
   * given URI exists, false if it doesn't. This should only be used
   * with local resources, such as from resource:/chrome:/jar:/file:
   * URIs.
   */
  checkURIExists(uri) {
    return new Promise(resolve => {
      try {
        let channel = lazy.NetUtil.newChannel({
          uri,
          loadUsingSystemPrincipal: true,
          // Avoid crashing for non-existant files. If the file not existing
          // is bad, we can deal with it in the test instead.
          contentPolicyType: Ci.nsIContentPolicy.TYPE_FETCH,
        });

        channel.asyncOpen({
          onStartRequest(request) {
            resolve(Components.isSuccessCode(request.status));
            request.cancel(Cr.NS_BINDING_ABORTED);
          },

          onStopRequest(request, status) {
            // We should have already resolved from `onStartRequest`, but
            // we resolve again here just as a failsafe.
            resolve(Components.isSuccessCode(status));
          },
        });
      } catch (e) {
        if (
          e.result != Cr.NS_ERROR_FILE_NOT_FOUND &&
          e.result != Cr.NS_ERROR_NOT_AVAILABLE
        ) {
          throw e;
        }
        resolve(false);
      }
    });
  },
};
