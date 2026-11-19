_(
  "Make sure various combinations of deferGetSet arguments correctly defer getting/setting properties to another object"
);

function run_test() {
  let base = function () {};
  base.prototype = {
    dst: {},

    get a() {
      return "a";
    },
    set b(val) {
      this.dst.b = val + "!!!";
    },
  };
  let src = new base();

  _("get/set a single property");
  Utils.deferGetSet(base, "dst", "foo");
  src.foo = "bar";
  Assert.equal(src.dst.foo, "bar");
  Assert.equal(src.foo, "bar");

  _("editing the target also updates the source");
  src.dst.foo = "baz";
  Assert.equal(src.dst.foo, "baz");
  Assert.equal(src.foo, "baz");

  _("handle multiple properties");
  Utils.deferGetSet(base, "dst", ["p1", "p2"]);
  src.p1 = "v1";
  src.p2 = "v2";
  Assert.equal(src.p1, "v1");
  Assert.equal(src.dst.p1, "v1");
  Assert.equal(src.p2, "v2");
  Assert.equal(src.dst.p2, "v2");

  _("make sure existing getter keeps its functionality");
  Utils.deferGetSet(base, "dst", "a");
  src.a = "not a";
  Assert.equal(src.dst.a, "not a");
  Assert.equal(src.a, "a");

  _("make sure existing setter keeps its functionality");
  Utils.deferGetSet(base, "dst", "b");
  src.b = "b";
  Assert.equal(src.dst.b, "b!!!");
  Assert.equal(src.b, "b!!!");
}
