function test() {
  ShellService.setDefaultBrowser(false);
  ok(
    ShellService.isDefaultBrowser(true, false),
    "we got here and are the default browser"
  );
  ok(
    ShellService.isDefaultBrowser(true, true),
    "we got here and are the default browser"
  );
}
