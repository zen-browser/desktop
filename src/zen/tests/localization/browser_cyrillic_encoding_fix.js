/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

const { ZenCyrillicEncodingFix } = ChromeUtils.importESModule(
  'resource:///modules/ZenCyrillicEncodingFix.sys.mjs'
);

add_task(async function test_cyrillic_encoding_fix_known_sites() {
  // Test on the originally problematic sites
  await testCyrillicEncodingOnSite('https://nnmclub.to/forum/search.php');
  await testCyrillicEncodingOnSite('https://4pda.to/search/');
});

add_task(async function test_cyrillic_encoding_fix_any_site() {
  // Test that the fix works on any website with Cyrillic content
  await testCyrillicEncodingOnSite('https://example.com/search');
  await testCyrillicEncodingOnSite('https://test-site.ru/form');
  await testCyrillicEncodingOnSite('https://random-site.org/contact');
});

add_task(async function test_cyrillic_regex_detection() {
  // Test Cyrillic character detection
  ok(ZenCyrillicEncodingFix.CYRILLIC_REGEX.test('Привет'), 'Should detect Cyrillic characters');
  ok(ZenCyrillicEncodingFix.CYRILLIC_REGEX.test('Тест'), 'Should detect Cyrillic characters');
  ok(ZenCyrillicEncodingFix.CYRILLIC_REGEX.test('Поиск'), 'Should detect Cyrillic characters');
  ok(ZenCyrillicEncodingFix.CYRILLIC_REGEX.test('Москва'), 'Should detect Cyrillic characters');
  ok(!ZenCyrillicEncodingFix.CYRILLIC_REGEX.test('Hello'), 'Should not detect Latin characters');
  ok(!ZenCyrillicEncodingFix.CYRILLIC_REGEX.test('123'), 'Should not detect numbers');
  ok(!ZenCyrillicEncodingFix.CYRILLIC_REGEX.test(''), 'Should not detect empty string');
});

async function testCyrillicEncodingOnSite(url) {
  // Create a mock HTML page with a search form
  const mockHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="windows-1251">
      <title>Test Page</title>
    </head>
    <body>
      <form id="searchForm" method="post" action="/search">
        <input type="text" id="searchInput" name="query" value="">
        <textarea id="textArea" name="description"></textarea>
        <input type="search" id="searchField" name="search" value="">
        <input type="submit" value="Search">
      </form>
    </body>
    </html>
  `;

  await BrowserTestUtils.withNewTab({ gBrowser, url: 'about:blank' }, async (browser) => {
    // Load the mock HTML
    await SpecialPowers.spawn(browser, [mockHTML, url], async (html, testUrl) => {
      // Set the document URI to simulate being on any site
      Object.defineProperty(content.document, 'documentURI', {
        value: testUrl,
        writable: false,
      });

      content.document.documentElement.innerHTML = html;
    });

    // Test Cyrillic input handling
    await SpecialPowers.spawn(browser, [], async () => {
      const form = content.document.getElementById('searchForm');
      const input = content.document.getElementById('searchInput');
      const textarea = content.document.getElementById('textArea');
      const searchField = content.document.getElementById('searchField');

      // Test different Cyrillic texts
      const cyrillicTexts = ['Поиск тест', 'Привет мир', 'Русский текст'];

      for (let i = 0; i < cyrillicTexts.length; i++) {
        const cyrillicText = cyrillicTexts[i];

        // Test input field
        input.value = cyrillicText;
        textarea.value = `Описание: ${cyrillicText}`;
        searchField.value = cyrillicText;

        // Trigger the form submission handler
        const event = new content.Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(event);

        // Check if the encoding fix was applied
        Assert.equal(
          form.acceptCharset,
          'UTF-8',
          `Form should have UTF-8 accept-charset after Cyrillic input: ${cyrillicText}`
        );
        Assert.equal(
          input.getAttribute('accept-charset'),
          'UTF-8',
          `Input should have UTF-8 accept-charset after Cyrillic input: ${cyrillicText}`
        );
        Assert.equal(
          textarea.getAttribute('accept-charset'),
          'UTF-8',
          `Textarea should have UTF-8 accept-charset after Cyrillic input: ${cyrillicText}`
        );
        Assert.equal(
          searchField.getAttribute('accept-charset'),
          'UTF-8',
          `Search field should have UTF-8 accept-charset after Cyrillic input: ${cyrillicText}`
        );
      }
    });
  });
}

add_task(async function test_non_cyrillic_input_unchanged() {
  const mockHTML = `
    <!DOCTYPE html>
    <html>
    <body>
      <form id="testForm" method="post">
        <input type="text" id="testInput" name="query" value="English text">
        <input type="submit" value="Search">
      </form>
    </body>
    </html>
  `;

  await BrowserTestUtils.withNewTab({ gBrowser, url: 'about:blank' }, async (browser) => {
    await SpecialPowers.spawn(browser, [mockHTML], async (html) => {
      // Set URI to any site (global fix should work everywhere)
      Object.defineProperty(content.document, 'documentURI', {
        value: 'https://example.com/search',
        writable: false,
      });

      content.document.documentElement.innerHTML = html;

      const form = content.document.getElementById('testForm');
      const input = content.document.getElementById('testInput');

      // Store original values
      const originalAcceptCharset = form.acceptCharset;
      const originalInputCharset = input.getAttribute('accept-charset');

      // Trigger form submission with non-Cyrillic text
      const event = new content.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      // Verify that non-Cyrillic text doesn't trigger encoding changes
      Assert.equal(
        form.acceptCharset,
        originalAcceptCharset,
        'Form accept-charset should not change for non-Cyrillic text'
      );
      Assert.equal(
        input.getAttribute('accept-charset'),
        originalInputCharset,
        'Input accept-charset should not change for non-Cyrillic text'
      );
    });
  });
});

add_task(async function test_mixed_content_forms() {
  const mockHTML = `
    <!DOCTYPE html>
    <html>
    <body>
      <form id="mixedForm" method="post">
        <input type="text" id="englishInput" name="english" value="Hello">
        <input type="text" id="cyrillicInput" name="cyrillic" value="Привет">
        <input type="text" id="numberInput" name="numbers" value="12345">
        <input type="submit" value="Submit">
      </form>
    </body>
    </html>
  `;

  await BrowserTestUtils.withNewTab({ gBrowser, url: 'about:blank' }, async (browser) => {
    await SpecialPowers.spawn(browser, [mockHTML], async (html) => {
      Object.defineProperty(content.document, 'documentURI', {
        value: 'https://mixed-content-site.com/form',
        writable: false,
      });

      content.document.documentElement.innerHTML = html;

      const form = content.document.getElementById('mixedForm');
      const cyrillicInput = content.document.getElementById('cyrillicInput');

      // Trigger form submission
      const event = new content.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      // Should apply UTF-8 encoding because one field contains Cyrillic
      Assert.equal(
        form.acceptCharset,
        'UTF-8',
        'Form should have UTF-8 accept-charset when any field contains Cyrillic'
      );
      Assert.equal(
        cyrillicInput.getAttribute('accept-charset'),
        'UTF-8',
        'Cyrillic input should have UTF-8 accept-charset'
      );
    });
  });
});
