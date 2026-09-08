let client;

async function createRecords(records) {
  await client.db.importChanges(
    {},
    42,
    records.map((record, i) => ({
      id: `record-${i}`,
      ...record,
    })),
    {
      clear: true,
    }
  );
}

add_setup(() => {
  client = RemoteSettings("some-key");
});

add_task(async function test_returns_all_without_target() {
  await createRecords([
    {
      passwordSelector: "#pass-signin",
    },
    {
      filter_expression: null,
    },
    {
      filter_expression: "",
    },
  ]);

  const list = await client.get();
  equal(list.length, 3);
});

add_task(async function test_filters_can_be_disabled() {
  const c = RemoteSettings("no-jexl", { filterCreator: null });
  await c.db.importChanges({}, 42, [
    {
      id: "abc",
      filter_expression: "1 == 2",
    },
  ]);

  const list = await c.get();
  equal(list.length, 1);
});

add_task(async function test_returns_entries_where_jexl_is_true() {
  await createRecords([
    {
      willMatch: true,
      filter_expression: "1",
    },
    {
      willMatch: true,
      filter_expression: "[42]",
    },
    {
      willMatch: true,
      filter_expression: "1 == 2 || 1 == 1",
    },
    {
      willMatch: true,
      filter_expression: 'env.appinfo.ID == "xpcshell@tests.mozilla.org"',
    },
    {
      willMatch: false,
      filter_expression: "env.version == undefined",
    },
    {
      willMatch: true,
      filter_expression: "env.unknown == undefined",
    },
    {
      willMatch: false,
      filter_expression: "1 == 2",
    },
  ]);

  const list = await client.get();
  equal(list.length, 5);
  ok(list.every(e => e.willMatch));
});

add_task(async function test_ignores_entries_where_jexl_is_invalid() {
  await createRecords([
    {
      filter_expression: "true === true", // JavaScript Error: "Invalid expression token: ="
    },
    {
      filter_expression: "Objects.keys({}) == []", // Token ( (openParen) unexpected in expression
    },
  ]);

  const list = await client.get();
  equal(list.length, 0);
});

add_task(async function test_support_of_date_filters() {
  await createRecords([
    {
      willMatch: true,
      filter_expression: '"1982-05-08"|date < "2016-03-22"|date',
    },
    {
      willMatch: false,
      filter_expression: '"2000-01-01"|date < "1970-01-01"|date',
    },
  ]);

  const list = await client.get();
  equal(list.length, 1);
  ok(list.every(e => e.willMatch));
});

add_task(async function test_support_of_preferences_filters() {
  await createRecords([
    {
      willMatch: true,
      filter_expression: '"services.settings.last_etag"|preferenceValue == 42',
    },
    {
      willMatch: true,
      filter_expression:
        '"services.settings.poll_interval"|preferenceExists == true',
    },
    {
      willMatch: true,
      filter_expression:
        '"services.settings.poll_interval"|preferenceIsUserSet == false',
    },
    {
      willMatch: true,
      filter_expression:
        '"services.settings.last_etag"|preferenceIsUserSet == true',
    },
  ]);

  // Set a pref for the user.
  Services.prefs.setIntPref("services.settings.last_etag", 42);

  const list = await client.get();
  equal(list.length, 4);
  ok(list.every(e => e.willMatch));
});

add_task(async function test_support_of_intersect_operator() {
  await createRecords([
    {
      willMatch: true,
      filter_expression: '{foo: 1, bar: 2}|keys intersect ["foo"]',
    },
    {
      willMatch: true,
      filter_expression: '(["a", "b"] intersect ["a", 1, 4]) == "a"',
    },
    {
      willMatch: false,
      filter_expression: '(["a", "b"] intersect [3, 1, 4]) == "c"',
    },
    {
      willMatch: true,
      filter_expression: `
      [1, 2, 3]
        intersect
      [3, 4, 5]
    `,
    },
  ]);

  const list = await client.get();
  equal(list.length, 3);
  ok(list.every(e => e.willMatch));
});

add_task(async function test_support_of_samples() {
  await createRecords([
    {
      willMatch: true,
      filter_expression: '"always-true"|stableSample(1)',
    },
    {
      willMatch: false,
      filter_expression: '"always-false"|stableSample(0)',
    },
    {
      willMatch: true,
      filter_expression: '"turns-to-true-0"|stableSample(0.5)',
    },
    {
      willMatch: false,
      filter_expression: '"turns-to-false-1"|stableSample(0.5)',
    },
    {
      willMatch: true,
      filter_expression: '"turns-to-true-0"|bucketSample(0, 50, 100)',
    },
    {
      willMatch: false,
      filter_expression: '"turns-to-false-1"|bucketSample(0, 50, 100)',
    },
  ]);

  const list = await client.get();
  equal(list.length, 3);
  ok(list.every(e => e.willMatch));
});
