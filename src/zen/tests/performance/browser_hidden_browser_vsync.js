/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_hidden_sidebar() {
  let b = document.createXULElement("browser");
  for (let [k, v] of Object.entries({
    type: "content",
    disablefullscreen: "true",
    disablehistory: "true",
    flex: "1",
    style: "min-width: 300px",
    message: "true",
    remote: "true",
    maychangeremoteness: "true",
  })) {
    b.setAttribute(k, v);
  }
  let mainBrowser = gBrowser.selectedBrowser;
  let panel = gBrowser.getPanel(mainBrowser);
  panel.append(b);
  let loaded = BrowserTestUtils.browserLoaded(b);
  BrowserTestUtils.startLoadingURIString(
    b,
    `data:text/html,<!doctype html><style>
  @keyframes fade-in {
   from {
     opacity: .25;
   }
   to {
     opacity: 1;
   }
  </style>
  <div style="
    animation-name: fade-in;
    animation-direction: alternate;
    animation-duration: 1s;
    animation-iteration-count: infinite;
    animation-timing-function: ease-in-out;
    background-color: red;
    height: 500px;
    width: 100%;
  "></div>`
  );
  await loaded;
  ok(b, "Browser was created.");
  await SpecialPowers.spawn(b, [], async () => {
    await new Promise(r =>
      content.requestAnimationFrame(() => content.requestAnimationFrame(r))
    );
  });
  b.hidden = true;
  ok(b.hidden, "Browser should be hidden.");
  // Now the framework will test to see vsync goes away
});
