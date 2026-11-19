_("Make sure notify sends out the right notifications");
add_task(async function run_test() {
  let ret, rightThis, didCall;
  let obj = {
    notify: Utils.notify("foo:"),
    _log: {
      trace() {},
    },

    func() {
      return this.notify("bar", "baz", async function () {
        rightThis = this == obj;
        didCall = true;
        return 5;
      })();
    },

    throwy() {
      return this.notify("bad", "one", async function () {
        rightThis = this == obj;
        didCall = true;
        throw new Error("covfefe");
      })();
    },
  };

  let state = 0;
  let makeObs = function (topic) {
    let obj2 = {
      observe(subject, obsTopic, data) {
        this.state = ++state;
        this.subject = subject;
        this.topic = obsTopic;
        this.data = data;
      },
    };

    Svc.Obs.add(topic, obj2);
    return obj2;
  };

  _("Make sure a normal call will call and return with notifications");
  rightThis = didCall = false;
  let fs = makeObs("foo:bar:start");
  let ff = makeObs("foo:bar:finish");
  let fe = makeObs("foo:bar:error");
  ret = await obj.func();
  Assert.equal(ret, 5);
  Assert.ok(rightThis);
  Assert.ok(didCall);

  Assert.equal(fs.state, 1);
  Assert.equal(fs.subject, undefined);
  Assert.equal(fs.topic, "foo:bar:start");
  Assert.equal(fs.data, "baz");

  Assert.equal(ff.state, 2);
  Assert.equal(ff.subject, 5);
  Assert.equal(ff.topic, "foo:bar:finish");
  Assert.equal(ff.data, "baz");

  Assert.equal(fe.state, undefined);
  Assert.equal(fe.subject, undefined);
  Assert.equal(fe.topic, undefined);
  Assert.equal(fe.data, undefined);

  _("Make sure a throwy call will call and throw with notifications");
  ret = null;
  rightThis = didCall = false;
  let ts = makeObs("foo:bad:start");
  let tf = makeObs("foo:bad:finish");
  let te = makeObs("foo:bad:error");
  try {
    ret = await obj.throwy();
    do_throw("throwy should have thrown!");
  } catch (ex) {
    Assert.equal(ex.message, "covfefe");
  }
  Assert.equal(ret, null);
  Assert.ok(rightThis);
  Assert.ok(didCall);

  Assert.equal(ts.state, 3);
  Assert.equal(ts.subject, undefined);
  Assert.equal(ts.topic, "foo:bad:start");
  Assert.equal(ts.data, "one");

  Assert.equal(tf.state, undefined);
  Assert.equal(tf.subject, undefined);
  Assert.equal(tf.topic, undefined);
  Assert.equal(tf.data, undefined);

  Assert.equal(te.state, 4);
  Assert.equal(te.subject.message, "covfefe");
  Assert.equal(te.topic, "foo:bad:error");
  Assert.equal(te.data, "one");
});
