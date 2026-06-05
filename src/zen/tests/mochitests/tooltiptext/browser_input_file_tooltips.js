/* eslint-disable mozilla/no-arbitrary-setTimeout */

let tempFile;
add_setup(async function () {
  await SpecialPowers.pushPrefEnv({ set: [["ui.tooltip.delay_ms", 0]] });
  tempFile = createTempFile();
  registerCleanupFunction(function () {
    tempFile.remove(true);
  });
});

add_task(async function test_singlefile_selected() {
  await do_test({ value: true, result: "testfile_bug1251809" });
});

add_task(async function test_title_set() {
  await do_test({ title: "foo", result: "foo" });
});

add_task(async function test_nofile_selected() {
  await do_test({ result: "No file selected." });
});

add_task(async function test_multipleset_nofile_selected() {
  await do_test({ multiple: true, result: "No files selected." });
});

add_task(async function test_requiredset() {
  await do_test({ required: true, result: "Please select a file." });
});

async function do_test(test) {
  info(`starting test ${JSON.stringify(test)}`);

  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser);

  info("Moving mouse out of the way.");
  await EventUtils.synthesizeAndWaitNativeMouseMove(
    tab.linkedBrowser,
    300,
    300
  );

  info("creating input field");
  await SpecialPowers.spawn(tab.linkedBrowser, [test], async function (test) {
    let doc = content.document;
    let input = doc.createElement("input");
    doc.body.appendChild(input);
    input.id = "test_input";
    input.setAttribute("style", "position: absolute; top: 0; left: 0;");
    input.type = "file";
    if (test.title) {
      input.setAttribute("title", test.title);
    }
    if (test.multiple) {
      input.multiple = true;
    }
    if (test.required) {
      input.required = true;
    }
  });

  if (test.value) {
    info("Creating mock filepicker to select files");
    let MockFilePicker = SpecialPowers.MockFilePicker;
    MockFilePicker.init(window.browsingContext);
    MockFilePicker.returnValue = MockFilePicker.returnOK;
    MockFilePicker.displayDirectory = FileUtils.getDir("TmpD", []);
    MockFilePicker.setFiles([tempFile]);
    MockFilePicker.afterOpenCallback = MockFilePicker.cleanup;

    try {
      // Open the File Picker dialog (MockFilePicker) to select
      // the files for the test.
      await BrowserTestUtils.synthesizeMouseAtCenter(
        "#test_input",
        {},
        tab.linkedBrowser
      );
      info("Waiting for the input to have the requisite files");
      await SpecialPowers.spawn(tab.linkedBrowser, [], async function () {
        let input = content.document.querySelector("#test_input");
        await ContentTaskUtils.waitForCondition(
          () => input.files.length,
          "The input should have at least one file selected"
        );
        info(`The input has ${input.files.length} file(s) selected.`);
      });
    } catch (e) {}
  } else {
    info("No real file selection required.");
  }

  let awaitTooltipOpen = new Promise(resolve => {
    let tooltipId = Services.appinfo.browserTabsRemoteAutostart
      ? "remoteBrowserTooltip"
      : "aHTMLTooltip";
    let tooltip = document.getElementById(tooltipId);
    tooltip.addEventListener(
      "popupshown",
      function (event) {
        resolve(event.target);
      },
      { once: true }
    );
  });
  info("Initial mouse move");
  await EventUtils.synthesizeAndWaitNativeMouseMove(tab.linkedBrowser, 50, 5);
  info("Waiting");
  await new Promise(resolve => setTimeout(resolve, 400));
  info("Second mouse move");
  await EventUtils.synthesizeAndWaitNativeMouseMove(tab.linkedBrowser, 70, 5);
  info("Waiting for tooltip to open");
  let tooltip = await awaitTooltipOpen;

  is(
    tooltip.getAttribute("label"),
    test.result,
    "tooltip label should match expectation"
  );

  info("Closing tab");
  BrowserTestUtils.removeTab(tab);
}

function createTempFile() {
  let file = FileUtils.getDir("TmpD", []);
  file.append("testfile_bug1251809");
  file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0o644);
  return file;
}
