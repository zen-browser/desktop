/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
  nsRssLiveFolderProvider: "resource:///modules/zen/RssLiveFolder.sys.mjs",
});

function getRssProviderForTest(sandbox, customState = {}) {
  const defaultState = {
    url: "https://example.com/feed.xml",
    interval: 60,
    maxItems: 10,
    timeRange: 24 * 60 * 60 * 1000, // 24 Hours
    lastFetched: 0,
    ...customState,
  };

  const mockManager = {
    saveState: sandbox.spy(),
  };

  const instance = new nsRssLiveFolderProvider({
    id: "test-rss",
    state: defaultState,
    manager: mockManager,
  });

  sandbox.stub(instance, "fetch");
  sandbox.stub(instance, "getMetadata").resolves({});

  return instance;
}

add_task(async function test_rss_parsing() {
  info("should parse standard RSS 2.0 feeds correctly");

  let sandbox = sinon.createSandbox();
  let instance = getRssProviderForTest(sandbox);

  const rssXml = `
    <rss version="2.0">
      <channel>
        <title>Tech News</title>
        <item>
          <title>Mozilla Releases Zen</title>
          <link>https://mozilla.org/zen</link>
          <guid>guid-123</guid>
          <pubDate>${new Date().toUTCString()}</pubDate>
        </item>
        <item>
          <title>Another Article</title>
          <link>https://example.com/article</link>
          <pubDate>${new Date().toUTCString()}</pubDate>
        </item>
      </channel>
    </rss>
  `;

  instance.fetch.resolves({
    text: rssXml,
  });

  const items = await instance.fetchItems();
  Assert.equal(items.length, 2, "Should find 2 items");

  // Check mapping
  Assert.equal(items[0].title, "Mozilla Releases Zen");
  Assert.equal(items[0].url, "https://mozilla.org/zen");
  Assert.equal(items[0].id, "guid-123");

  // Check fallback for ID
  // In the second item, no guid is present, but <link> is.
  Assert.equal(items[1].title, "Another Article");
  Assert.equal(items[1].id, "https://example.com/article");

  sandbox.restore();
});

add_task(async function test_atom_parsing() {
  info("should parse Atom feeds correctly");

  let sandbox = sinon.createSandbox();
  let instance = getRssProviderForTest(sandbox);

  const atomXml = `
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Atom Feed</title>
      <entry>
        <title>Atom Entry 1</title>
        <link href="https://example.com/atom1" />
        <id>urn:uuid:12345</id>
        <updated>${new Date().toISOString()}</updated>
      </entry>
    </feed>
  `;

  instance.fetch.resolves({
    text: atomXml,
  });

  const items = await instance.fetchItems();

  Assert.equal(items.length, 1);
  Assert.equal(items[0].title, "Atom Entry 1");
  Assert.equal(items[0].url, "https://example.com/atom1");
  Assert.equal(items[0].id, "urn:uuid:12345");

  sandbox.restore();
});

add_task(async function test_time_range_filtering() {
  info("should filter out items older than timeRange");

  let sandbox = sinon.createSandbox();

  const ONE_HOUR = 60 * 60 * 1000;
  let instance = getRssProviderForTest(sandbox, { timeRange: ONE_HOUR });

  const now = Date.now();
  const recentDate = new Date(now - 10 * 60 * 1000).toUTCString(); // 10 mins ago
  const oldDate = new Date(now - ONE_HOUR * 2).toUTCString(); // 2 hours ago

  const rssXml = `
    <rss version="2.0">
      <channel>
        <item>
          <title>Recent News</title>
          <pubDate>${recentDate}</pubDate>
          <link>http://a.com</link>
        </item>
        <item>
          <title>Old News</title>
          <pubDate>${oldDate}</pubDate>
          <link>http://b.com</link>
        </item>
      </channel>
    </rss>
  `;

  instance.fetch.resolves({
    text: rssXml,
  });

  const items = await instance.fetchItems();

  Assert.equal(items.length, 1, "Should only return 1 item");
  Assert.equal(items[0].title, "Recent News", "Should keep the recent item");

  sandbox.restore();
});

add_task(async function test_max_items_limit() {
  info("should respect maxItems limit");

  let sandbox = sinon.createSandbox();
  let instance = getRssProviderForTest(sandbox, { maxItems: 2 });

  const date = new Date().toUTCString();
  const rssXml = `
    <rss version="2.0">
      <channel>
        <item><title>1</title><link>1</link><pubDate>${date}</pubDate></item>
        <item><title>2</title><link>2</link><pubDate>${date}</pubDate></item>
        <item><title>3</title><link>3</link><pubDate>${date}</pubDate></item>
      </channel>
    </rss>
  `;

  instance.fetch.resolves({
    text: rssXml,
  });

  const items = await instance.fetchItems();

  Assert.equal(items.length, 2, "Should be capped at 2 items");
  Assert.equal(items[0].title, "1");
  Assert.equal(items[1].title, "2");

  sandbox.restore();
});

add_task(async function test_invalid_dates() {
  info("should ignore items with invalid dates");

  let sandbox = sinon.createSandbox();
  let instance = getRssProviderForTest(sandbox);

  const rssXml = `
    <rss version="2.0">
      <channel>
        <item>
          <title>Bad Date</title>
          <link>http://bad.com</link>
          <pubDate>ThisIsNotADate</pubDate>
        </item>
        <item>
          <title>No Date</title>
          <link>http://nodate.com</link>
        </item>
      </channel>
    </rss>
  `;

  instance.fetch.resolves({
    text: rssXml,
  });

  const items = await instance.fetchItems();

  Assert.equal(items.length, 0, "Items with invalid/missing dates should be filtered");
  sandbox.restore();
});

add_task(async function test_fetch_network_error() {
  info("should return empty array on network error");

  let sandbox = sinon.createSandbox();
  let instance = getRssProviderForTest(sandbox);

  instance.fetch.rejects(new Error("Network down"));

  const items = await instance.fetchItems();
  Assert.equal(items, "zen-live-folder-failed-fetch", "Should return an error on failed fetch");

  sandbox.restore();
});
