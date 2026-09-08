_("Make sure lock prevents calling with a shared lock");

// Utility that we only use here.

function do_check_begins(thing, startsWith) {
  if (!(thing && thing.indexOf && thing.indexOf(startsWith) == 0)) {
    do_throw(thing + " doesn't begin with " + startsWith);
  }
}

add_task(async function run_test() {
  let ret, rightThis, didCall;
  let state, lockState, lockedState, unlockState;
  let obj = {
    _lock: Utils.lock,
    lock() {
      lockState = ++state;
      if (this._locked) {
        lockedState = ++state;
        return false;
      }
      this._locked = true;
      return true;
    },
    unlock() {
      unlockState = ++state;
      this._locked = false;
    },

    func() {
      return this._lock("Test utils lock", async function () {
        rightThis = this == obj;
        didCall = true;
        return 5;
      })();
    },

    throwy() {
      return this._lock("Test utils lock throwy", async function () {
        rightThis = this == obj;
        didCall = true;
        return this.throwy();
      })();
    },
  };

  _("Make sure a normal call will call and return");
  rightThis = didCall = false;
  state = 0;
  ret = await obj.func();
  Assert.equal(ret, 5);
  Assert.ok(rightThis);
  Assert.ok(didCall);
  Assert.equal(lockState, 1);
  Assert.equal(unlockState, 2);
  Assert.equal(state, 2);

  _("Make sure code that calls locked code throws");
  ret = null;
  rightThis = didCall = false;
  try {
    ret = await obj.throwy();
    do_throw("throwy internal call should have thrown!");
  } catch (ex) {
    // Should throw an Error, not a string.
    do_check_begins(ex.message, "Could not acquire lock");
  }
  Assert.equal(ret, null);
  Assert.ok(rightThis);
  Assert.ok(didCall);
  _("Lock should be called twice so state 3 is skipped");
  Assert.equal(lockState, 4);
  Assert.equal(lockedState, 5);
  Assert.equal(unlockState, 6);
  Assert.equal(state, 6);
});
