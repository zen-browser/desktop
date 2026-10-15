function test() {
  var startup_info = Services.startup.getStartupInfo();
  // No .process info on mac

  Assert.lessOrEqual(
    startup_info.process,
    startup_info.main,
    "process created before main is run " + uneval(startup_info)
  );

  // on linux firstPaint can happen after everything is loaded (especially with remote X)
  if (startup_info.firstPaint) {
    Assert.lessOrEqual(
      startup_info.main,
      startup_info.firstPaint,
      "main ran before first paint " + uneval(startup_info)
    );
  }

  Assert.less(
    startup_info.main,
    startup_info.sessionRestored,
    "Session restored after main " + uneval(startup_info)
  );
}
