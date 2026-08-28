/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Collection, WBORecord } = ChromeUtils.importESModule(
  "resource://services-sync/record.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

function recordRange(lim, offset, total) {
  let res = [];
  for (let i = offset; i < Math.min(lim + offset, total); ++i) {
    res.push({ id: String(i), payload: "test:" + i });
  }
  return res;
}

function get_test_collection_info({
  totalRecords,
  batchSize,
  lastModified,
  throwAfter = Infinity,
  interruptedAfter = Infinity,
}) {
  let coll = new Collection("http://example.com/test/", WBORecord, Service);
  coll.full = true;
  let requests = [];
  let responses = [];
  coll.get = async function () {
    let limit = +this.limit;
    let offset = 0;
    if (this.offset) {
      equal(this.offset.slice(0, 6), "foobar");
      offset = +this.offset.slice(6);
    }
    requests.push({
      limit,
      offset,
      spec: this.spec,
      headers: Object.assign({}, this.headers),
    });
    if (--throwAfter === 0) {
      throw new Error("Some Network Error");
    }
    let body = recordRange(limit, offset, totalRecords);
    let response = {
      obj: body,
      success: true,
      status: 200,
      headers: {},
    };
    if (--interruptedAfter === 0) {
      response.success = false;
      response.status = 412;
      response.body = "";
    } else if (offset + limit < totalRecords) {
      // Ensure we're treating this as an opaque string, since the docs say
      // it might not be numeric.
      response.headers["x-weave-next-offset"] = "foobar" + (offset + batchSize);
    }
    response.headers["x-last-modified"] = lastModified;
    responses.push(response);
    return response;
  };
  return { responses, requests, coll };
}

add_task(async function test_success() {
  const totalRecords = 11;
  const batchSize = 2;
  const lastModified = "111111";
  let { responses, requests, coll } = get_test_collection_info({
    totalRecords,
    batchSize,
    lastModified,
  });
  let { response, records } = await coll.getBatched(batchSize);

  equal(requests.length, Math.ceil(totalRecords / batchSize));

  equal(records.length, totalRecords);
  checkRecordsOrder(records);

  // ensure we're returning the last response
  equal(responses[responses.length - 1], response);

  // check first separately since its a bit of a special case
  ok(!requests[0].headers["x-if-unmodified-since"]);
  ok(!requests[0].offset);
  equal(requests[0].limit, batchSize);
  let expectedOffset = 2;
  for (let i = 1; i < requests.length; ++i) {
    let req = requests[i];
    equal(req.headers["x-if-unmodified-since"], lastModified);
    equal(req.limit, batchSize);
    if (i !== requests.length - 1) {
      equal(req.offset, expectedOffset);
    }

    expectedOffset += batchSize;
  }

  // ensure we cleaned up anything that would break further
  // use of this collection.
  ok(!coll._headers["x-if-unmodified-since"]);
  ok(!coll.offset);
  ok(!coll.limit || coll.limit == Infinity);
});

add_task(async function test_total_limit() {
  _("getBatched respects the (initial) value of the limit property");
  const totalRecords = 100;
  const recordLimit = 11;
  const batchSize = 2;
  const lastModified = "111111";
  let { requests, coll } = get_test_collection_info({
    totalRecords,
    batchSize,
    lastModified,
  });
  coll.limit = recordLimit;
  let { records } = await coll.getBatched(batchSize);
  checkRecordsOrder(records);

  equal(requests.length, Math.ceil(recordLimit / batchSize));
  equal(records.length, recordLimit);

  for (let i = 0; i < requests.length; ++i) {
    let req = requests[i];
    if (i !== requests.length - 1) {
      equal(req.limit, batchSize);
    } else {
      equal(req.limit, recordLimit % batchSize);
    }
  }

  equal(coll._limit, recordLimit);
});

add_task(async function test_412() {
  _("We shouldn't record records if we get a 412 in the middle of a batch");
  const totalRecords = 11;
  const batchSize = 2;
  const lastModified = "111111";
  let { responses, requests, coll } = get_test_collection_info({
    totalRecords,
    batchSize,
    lastModified,
    interruptedAfter: 3,
  });
  let { response, records } = await coll.getBatched(batchSize);

  equal(requests.length, 3);
  equal(records.length, 0); // we should not get any records

  // ensure we're returning the last response
  equal(responses[responses.length - 1], response);

  ok(!response.success);
  equal(response.status, 412);
});

add_task(async function test_get_throws() {
  _("getBatched() should throw if a get() throws");
  const totalRecords = 11;
  const batchSize = 2;
  const lastModified = "111111";
  let { requests, coll } = get_test_collection_info({
    totalRecords,
    batchSize,
    lastModified,
    throwAfter: 3,
  });

  await Assert.rejects(coll.getBatched(batchSize), /Some Network Error/);

  equal(requests.length, 3);
});

function checkRecordsOrder(records) {
  ok(!!records.length);
  for (let i = 0; i < records.length; i++) {
    equal(records[i].id, String(i));
    equal(records[i].payload, "test:" + i);
  }
}
