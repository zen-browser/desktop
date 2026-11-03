/**
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

const imgUrl =
  "https://example.com/browser/browser/base/content/test/browser-general/moz.png";
const URI =
  "data:text/html," +
  `<style type='text/css'>%23test-image,%23not-test-image {background-image: url('${imgUrl}?c');}</style>` +
  `<img src='${imgUrl}?b' height=300 width=350 alt=2 id='not-test-image'>` +
  `<img src='${imgUrl}?b' height=300 width=350 alt=2>` +
  `<img src='${imgUrl}?a' height=200 width=250>` +
  `<img src='${imgUrl}?b' height=200 width=250 alt=1>` +
  `<img src='${imgUrl}?b' height=100 width=150 alt=2 id='test-image'>`;

add_task(async function () {
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, URI);
  let browser = tab.linkedBrowser;

  let imageInfo = await SpecialPowers.spawn(browser, [], async () => {
    let testImg = content.document.getElementById("test-image");

    return {
      src: testImg.src,
      currentSrc: testImg.currentSrc,
      width: testImg.width,
      height: testImg.height,
      imageText: testImg.title || testImg.alt,
    };
  });

  let pageInfo = BrowserCommands.pageInfo(
    browser.currentURI.spec,
    "mediaTab",
    imageInfo
  );
  await BrowserTestUtils.waitForEvent(pageInfo, "page-info-mediapreview-load");

  let mediaBrowser = pageInfo.document.getElementById("mediaBrowser");
  let pageInfoImg = await SpecialPowers.spawn(mediaBrowser, [], () => {
    let previewImg = content.document.querySelector("img");

    return {
      src: previewImg.src,
      width: previewImg.width,
      height: previewImg.height,
    };
  });
  Assert.equal(
    pageInfoImg.src,
    imageInfo.src,
    "selected image has the correct source"
  );
  Assert.equal(
    pageInfoImg.width,
    imageInfo.width,
    "selected image has the correct width"
  );
  Assert.equal(
    pageInfoImg.height,
    imageInfo.height,
    "selected image has the correct height"
  );
  pageInfo.close();
  BrowserTestUtils.removeTab(tab);
});
