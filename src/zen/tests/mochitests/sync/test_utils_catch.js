const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

add_task(async function run_test() {
  _("Make sure catch when copied to an object will correctly catch stuff");
  let ret, rightThis, didCall, didThrow, wasCovfefe, wasLocked;
  let obj = {
    _catch: Utils.catch,
    _log: {
      debug(str) {
        didThrow = str.search(/^Exception/) == 0;
      },
      info(str) {
        wasLocked = str.indexOf("Cannot start sync: already syncing?") == 0;
      },
    },

    func() {
      return this._catch(async function () {
        rightThis = this == obj;
        didCall = true;
        return 5;
      })();
    },

    throwy() {
      return this._catch(async function () {
        rightThis = this == obj;
        didCall = true;
        throw new Error("covfefe");
      })();
    },

    callbacky() {
      return this._catch(
        async function () {
          rightThis = this == obj;
          didCall = true;
          throw new Error("covfefe");
        },
        async function (ex) {
          wasCovfefe = ex && ex.message == "covfefe";
        }
      )();
    },

    lockedy() {
      return this._catch(async function () {
        rightThis = this == obj;
        didCall = true;
        Utils.throwLockException(null);
      })();
    },

    lockedy_chained() {
      return this._catch(async function () {
        rightThis = this == obj;
        didCall = true;
        Utils.throwLockException(null);
      })();
    },
  };

  _("Make sure a normal call will call and return");
  rightThis = didCall = didThrow = wasLocked = false;
  ret = await obj.func();
  Assert.equal(ret, 5);
  Assert.ok(rightThis);
  Assert.ok(didCall);
  Assert.ok(!didThrow);
  Assert.equal(wasCovfefe, undefined);
  Assert.ok(!wasLocked);

  _(
    "Make sure catch/throw results in debug call and caller doesn't need to handle exception"
  );
  rightThis = didCall = didThrow = wasLocked = false;
  ret = await obj.throwy();
  Assert.equal(ret, undefined);
  Assert.ok(rightThis);
  Assert.ok(didCall);
  Assert.ok(didThrow);
  Assert.equal(wasCovfefe, undefined);
  Assert.ok(!wasLocked);

  _("Test callback for exception testing.");
  rightThis = didCall = didThrow = wasLocked = false;
  ret = await obj.callbacky();
  Assert.equal(ret, undefined);
  Assert.ok(rightThis);
  Assert.ok(didCall);
  Assert.ok(didThrow);
  Assert.ok(wasCovfefe);
  Assert.ok(!wasLocked);

  _("Test the lock-aware catch that Service uses.");
  obj._catch = Service._catch;
  rightThis = didCall = didThrow = wasLocked = false;
  wasCovfefe = undefined;
  ret = await obj.lockedy();
  Assert.equal(ret, undefined);
  Assert.ok(rightThis);
  Assert.ok(didCall);
  Assert.ok(didThrow);
  Assert.equal(wasCovfefe, undefined);
  Assert.ok(wasLocked);

  _("Test the lock-aware catch that Service uses with a chained promise.");
  rightThis = didCall = didThrow = wasLocked = false;
  wasCovfefe = undefined;
  ret = await obj.lockedy_chained();
  Assert.equal(ret, undefined);
  Assert.ok(rightThis);
  Assert.ok(didCall);
  Assert.ok(didThrow);
  Assert.equal(wasCovfefe, undefined);
  Assert.ok(wasLocked);
});
