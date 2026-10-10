/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

let { PostQueue } = ChromeUtils.importESModule(
  "resource://services-sync/record.sys.mjs"
);

function makeRecord(nbytes) {
  return {
    toJSON: () => ({ payload: "x".repeat(nbytes) }),
  };
}

// Note: This is 14 bytes. Tests make assumptions about this (even if it's just
// in setting config.max_request_bytes to a specific value).
makeRecord.nonPayloadOverhead = JSON.stringify(makeRecord(0).toJSON()).length;

// Gives how many encoded bytes a request with the given payload
// sizes will be (assuming the records were created by makeRecord)
// requestBytesFor([20]) => 22, requestBytesFor([20, 20]) => 43
function requestBytesFor(recordPayloadByteCounts) {
  let requestBytes = 1;
  for (let size of recordPayloadByteCounts) {
    requestBytes += size + 1 + makeRecord.nonPayloadOverhead;
  }
  return requestBytes;
}

function makePostQueue(config, lastModTime, responseGenerator) {
  let stats = {
    posts: [],
    batches: [],
  };
  let poster = (data, headers, batch, commit) => {
    let payloadBytes = 0;
    let numRecords = 0;
    for (let record of JSON.parse(data)) {
      if (config.max_record_payload_bytes) {
        less(
          record.payload.length,
          config.max_record_payload_bytes,
          "PostQueue should respect max_record_payload_bytes"
        );
      }
      payloadBytes += record.payload.length;
      ++numRecords;
    }

    let thisPost = {
      nbytes: data.length,
      batch,
      commit,
      payloadBytes,
      numRecords,
    };

    if (headers.length) {
      thisPost.headers = headers;
    }

    // check that we respected the provided limits for the post
    if (config.max_post_records) {
      lessOrEqual(
        numRecords,
        config.max_post_records,
        "PostQueue should respect max_post_records"
      );
    }

    if (config.max_post_bytes) {
      less(
        payloadBytes,
        config.max_post_bytes,
        "PostQueue should respect max_post_bytes"
      );
    }

    if (config.max_request_bytes) {
      less(
        thisPost.nbytes,
        config.max_request_bytes,
        "PostQueue should respect max_request_bytes"
      );
    }

    stats.posts.push(thisPost);

    // Call this now so we can check if there's a batch id in it.
    // Kind of cludgey, but allows us to have the correct batch id even
    // before the next post is made.
    let nextResponse = responseGenerator.next().value;

    // Record info for the batch.

    let curBatch = stats.batches[stats.batches.length - 1];
    // If there's no batch, it committed, or we requested a new one,
    // then we need to start a new one.
    if (!curBatch || batch == "true" || curBatch.didCommit) {
      curBatch = {
        posts: 0,
        payloadBytes: 0,
        numRecords: 0,
        didCommit: false,
        batch,
        serverBatch: false,
      };
      if (nextResponse.obj && nextResponse.obj.batch) {
        curBatch.batch = nextResponse.obj.batch;
        curBatch.serverBatch = true;
      }
      stats.batches.push(curBatch);
    }

    // If we provided a batch id, it must be the same as the current batch
    if (batch && batch != "true") {
      equal(curBatch.batch, batch);
    }

    curBatch.posts += 1;
    curBatch.payloadBytes += payloadBytes;
    curBatch.numRecords += numRecords;
    curBatch.didCommit = commit;

    // if this is an actual server batch (or it's a one-shot batch), check that
    // we respected the provided total limits
    if (commit && (batch == "true" || curBatch.serverBatch)) {
      if (config.max_total_records) {
        lessOrEqual(
          curBatch.numRecords,
          config.max_total_records,
          "PostQueue should respect max_total_records"
        );
      }

      if (config.max_total_bytes) {
        less(
          curBatch.payloadBytes,
          config.max_total_bytes,
          "PostQueue should respect max_total_bytes"
        );
      }
    }

    return Promise.resolve(nextResponse);
  };

  let done = () => {};
  let pq = new PostQueue(poster, lastModTime, config, getTestLogger(), done);
  return { pq, stats };
}

add_task(async function test_simple() {
  let config = {
    max_request_bytes: 1000,
    max_record_payload_bytes: 1000,
  };

  const time = 11111111;

  function* responseGenerator() {
    yield {
      success: true,
      status: 200,
      headers: {
        "x-weave-timestamp": time + 100,
        "x-last-modified": time + 100,
      },
    };
  }

  let { pq, stats } = makePostQueue(config, time, responseGenerator());
  await pq.enqueue(makeRecord(10));
  await pq.flush(true);

  deepEqual(stats.posts, [
    {
      nbytes: requestBytesFor([10]),
      payloadBytes: 10,
      numRecords: 1,
      commit: true, // we don't know if we have batch semantics, so committed.
      headers: [["x-if-unmodified-since", time]],
      batch: "true",
    },
  ]);
  deepEqual(stats.batches, [
    {
      posts: 1,
      payloadBytes: 10,
      numRecords: 1,
      didCommit: true,
      batch: "true",
      serverBatch: false,
    },
  ]);
});

// Test we do the right thing when we need to make multiple posts when there
// are no batch semantics
add_task(async function test_max_request_bytes_no_batch() {
  let config = {
    max_request_bytes: 50,
    max_record_payload_bytes: 50,
  };

  const time = 11111111;
  function* responseGenerator() {
    yield {
      success: true,
      status: 200,
      headers: {
        "x-weave-timestamp": time + 100,
        "x-last-modified": time + 100,
      },
    };
    yield {
      success: true,
      status: 200,
      headers: {
        "x-weave-timestamp": time + 200,
        "x-last-modified": time + 200,
      },
    };
  }

  let { pq, stats } = makePostQueue(config, time, responseGenerator());
  let payloadSize = 20 - makeRecord.nonPayloadOverhead;
  await pq.enqueue(makeRecord(payloadSize)); // total size now 22 bytes - "[" + record + "]"
  await pq.enqueue(makeRecord(payloadSize)); // total size now 43 bytes - "[" + record + "," + record + "]"
  await pq.enqueue(makeRecord(payloadSize)); // this will exceed our byte limit, so will be in the 2nd POST.
  await pq.flush(true);
  deepEqual(stats.posts, [
    {
      nbytes: 43, // 43 for the first part
      payloadBytes: payloadSize * 2,
      numRecords: 2,
      commit: false,
      headers: [["x-if-unmodified-since", time]],
      batch: "true",
    },
    {
      nbytes: 22,
      payloadBytes: payloadSize,
      numRecords: 1,
      commit: false, // we know we aren't in a batch, so never commit.
      headers: [["x-if-unmodified-since", time + 100]],
      batch: null,
    },
  ]);
  equal(stats.batches.filter(x => x.didCommit).length, 0);
  equal(pq.lastModified, time + 200);
});

add_task(async function test_max_record_payload_bytes_no_batch() {
  let config = {
    max_request_bytes: 100,
    max_record_payload_bytes: 50,
  };

  const time = 11111111;

  function* responseGenerator() {
    yield {
      success: true,
      status: 200,
      headers: {
        "x-weave-timestamp": time + 100,
        "x-last-modified": time + 100,
      },
    };
  }

  let { pq, stats } = makePostQueue(config, time, responseGenerator());
  // Should trigger when the record really is too large to fit
  let { enqueued } = await pq.enqueue(makeRecord(51));
  ok(!enqueued);
  // Shouldn't trigger when the encoded record is too big
  ok(
    (await pq.enqueue(makeRecord(50 - makeRecord.nonPayloadOverhead))).enqueued
  ); // total size now 52 bytes - "[" + record + "]"
  ok(
    (await pq.enqueue(makeRecord(46 - makeRecord.nonPayloadOverhead))).enqueued
  ); // total size now 99 bytes - "[" + record0 + "," + record1 + "]"

  await pq.flush(true);

  deepEqual(stats.posts, [
    {
      nbytes: 99,
      payloadBytes: 50 + 46 - makeRecord.nonPayloadOverhead * 2,
      numRecords: 2,
      commit: true, // we know we aren't in a batch, so never commit.
      batch: "true",
      headers: [["x-if-unmodified-since", time]],
    },
  ]);

  deepEqual(stats.batches, [
    {
      posts: 1,
      payloadBytes: 50 + 46 - makeRecord.nonPayloadOverhead * 2,
      numRecords: 2,
      didCommit: true,
      batch: "true",
      serverBatch: false,
    },
  ]);

  equal(pq.lastModified, time + 100);
});

// Batch tests.

// Test making a single post when batch semantics are in place.

add_task(async function test_single_batch() {
  let config = {
    max_post_bytes: 1000,
    max_post_records: 100,
    max_total_records: 200,
    max_record_payload_bytes: 1000,
  };
  const time = 11111111;
  function* responseGenerator() {
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: { "x-last-modified": time, "x-weave-timestamp": time + 100 },
    };
  }

  let { pq, stats } = makePostQueue(config, time, responseGenerator());
  ok((await pq.enqueue(makeRecord(10))).enqueued);
  await pq.flush(true);

  deepEqual(stats.posts, [
    {
      nbytes: requestBytesFor([10]),
      numRecords: 1,
      payloadBytes: 10,
      commit: true, // we don't know if we have batch semantics, so committed.
      batch: "true",
      headers: [["x-if-unmodified-since", time]],
    },
  ]);

  deepEqual(stats.batches, [
    {
      posts: 1,
      payloadBytes: 10,
      numRecords: 1,
      didCommit: true,
      batch: 1234,
      serverBatch: true,
    },
  ]);
});

// Test we do the right thing when we need to make multiple posts due to
// max_post_bytes when there are batch semantics in place.
add_task(async function test_max_post_bytes_batch() {
  let config = {
    max_post_bytes: 50,
    max_post_records: 4,
    max_total_bytes: 5000,
    max_total_records: 100,
    max_record_payload_bytes: 50,
    max_request_bytes: 4000,
  };

  const time = 11111111;
  function* responseGenerator() {
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: { "x-last-modified": time, "x-weave-timestamp": time + 100 },
    };
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: {
        "x-last-modified": time + 200,
        "x-weave-timestamp": time + 200,
      },
    };
  }

  let { pq, stats } = makePostQueue(config, time, responseGenerator());
  ok((await pq.enqueue(makeRecord(20))).enqueued); // 20
  ok((await pq.enqueue(makeRecord(20))).enqueued); // 40
  // 60 would overflow, so post
  ok((await pq.enqueue(makeRecord(20))).enqueued); // 20
  await pq.flush(true);

  deepEqual(stats.posts, [
    {
      nbytes: requestBytesFor([20, 20]),
      payloadBytes: 40,
      numRecords: 2,
      commit: false,
      batch: "true",
      headers: [["x-if-unmodified-since", time]],
    },
    {
      nbytes: requestBytesFor([20]),
      payloadBytes: 20,
      numRecords: 1,
      commit: true,
      batch: 1234,
      headers: [["x-if-unmodified-since", time]],
    },
  ]);

  deepEqual(stats.batches, [
    {
      posts: 2,
      payloadBytes: 60,
      numRecords: 3,
      didCommit: true,
      batch: 1234,
      serverBatch: true,
    },
  ]);

  equal(pq.lastModified, time + 200);
});

// Test we do the right thing when we need to make multiple posts due to
// max_request_bytes when there are batch semantics in place.
add_task(async function test_max_request_bytes_batch() {
  let config = {
    max_post_bytes: 60,
    max_post_records: 40,
    max_total_bytes: 5000,
    max_total_records: 100,
    max_record_payload_bytes: 500,
    max_request_bytes: 100,
  };

  const time = 11111111;
  function* responseGenerator() {
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: { "x-last-modified": time, "x-weave-timestamp": time + 100 },
    };
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: {
        "x-last-modified": time + 200,
        "x-weave-timestamp": time + 200,
      },
    };
  }

  let { pq, stats } = makePostQueue(config, time, responseGenerator());
  ok((await pq.enqueue(makeRecord(10))).enqueued); // post: 10, request: 26 (10 + 14 + 2)
  ok((await pq.enqueue(makeRecord(10))).enqueued); // post: 20, request: 51 (10 + 14 + 1) * 2 + 1
  ok((await pq.enqueue(makeRecord(10))).enqueued); // post: 30, request: 76 (10 + 14 + 1) * 3 + 1
  // 1 more would be post: 40 (fine), request: 101, So we should post.
  ok((await pq.enqueue(makeRecord(10))).enqueued);
  await pq.flush(true);

  deepEqual(stats.posts, [
    {
      nbytes: requestBytesFor([10, 10, 10]),
      payloadBytes: 30,
      numRecords: 3,
      commit: false,
      batch: "true",
      headers: [["x-if-unmodified-since", time]],
    },
    {
      nbytes: requestBytesFor([10]),
      payloadBytes: 10,
      numRecords: 1,
      commit: true,
      batch: 1234,
      headers: [["x-if-unmodified-since", time]],
    },
  ]);

  deepEqual(stats.batches, [
    {
      posts: 2,
      payloadBytes: 40,
      numRecords: 4,
      didCommit: true,
      batch: 1234,
      serverBatch: true,
    },
  ]);

  equal(pq.lastModified, time + 200);
});

// Test we do the right thing when the batch bytes limit is exceeded.
add_task(async function test_max_total_bytes_batch() {
  let config = {
    max_post_bytes: 50,
    max_post_records: 20,
    max_total_bytes: 70,
    max_total_records: 100,
    max_record_payload_bytes: 50,
    max_request_bytes: 500,
  };

  const time0 = 11111111;
  const time1 = 22222222;
  function* responseGenerator() {
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: { "x-last-modified": time0, "x-weave-timestamp": time0 + 100 },
    };
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: { "x-last-modified": time1, "x-weave-timestamp": time1 },
    };
    yield {
      success: true,
      status: 202,
      obj: { batch: 5678 },
      headers: { "x-last-modified": time1, "x-weave-timestamp": time1 + 100 },
    };
    yield {
      success: true,
      status: 202,
      obj: { batch: 5678 },
      headers: {
        "x-last-modified": time1 + 200,
        "x-weave-timestamp": time1 + 200,
      },
    };
  }

  let { pq, stats } = makePostQueue(config, time0, responseGenerator());

  ok((await pq.enqueue(makeRecord(20))).enqueued); // payloads = post: 20, batch: 20
  ok((await pq.enqueue(makeRecord(20))).enqueued); // payloads = post: 40, batch: 40

  // this will exceed our POST byte limit, so will be in the 2nd POST - but still in the first batch.
  ok((await pq.enqueue(makeRecord(20))).enqueued); // payloads = post: 20, batch: 60

  // this will exceed our batch byte limit, so will be in a new batch.
  ok((await pq.enqueue(makeRecord(20))).enqueued); // payloads = post: 20, batch: 20
  ok((await pq.enqueue(makeRecord(20))).enqueued); // payloads = post: 40, batch: 40
  // This will exceed POST byte limit, so will be in the 4th post, part of the 2nd batch.
  ok((await pq.enqueue(makeRecord(20))).enqueued); // payloads = post: 20, batch: 60
  await pq.flush(true);

  deepEqual(stats.posts, [
    {
      nbytes: requestBytesFor([20, 20]),
      payloadBytes: 40,
      numRecords: 2,
      commit: false,
      batch: "true",
      headers: [["x-if-unmodified-since", time0]],
    },
    {
      nbytes: requestBytesFor([20]),
      payloadBytes: 20,
      numRecords: 1,
      commit: true,
      batch: 1234,
      headers: [["x-if-unmodified-since", time0]],
    },
    {
      nbytes: requestBytesFor([20, 20]),
      payloadBytes: 40,
      numRecords: 2,
      commit: false,
      batch: "true",
      headers: [["x-if-unmodified-since", time1]],
    },
    {
      nbytes: requestBytesFor([20]),
      payloadBytes: 20,
      numRecords: 1,
      commit: true,
      batch: 5678,
      headers: [["x-if-unmodified-since", time1]],
    },
  ]);

  deepEqual(stats.batches, [
    {
      posts: 2,
      payloadBytes: 60,
      numRecords: 3,
      didCommit: true,
      batch: 1234,
      serverBatch: true,
    },
    {
      posts: 2,
      payloadBytes: 60,
      numRecords: 3,
      didCommit: true,
      batch: 5678,
      serverBatch: true,
    },
  ]);

  equal(pq.lastModified, time1 + 200);
});

// Test we split up the posts when we exceed the record limit when batch semantics
// are in place.
add_task(async function test_max_post_records_batch() {
  let config = {
    max_post_bytes: 1000,
    max_post_records: 2,
    max_total_bytes: 5000,
    max_total_records: 100,
    max_record_payload_bytes: 1000,
    max_request_bytes: 1000,
  };

  const time = 11111111;
  function* responseGenerator() {
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: { "x-last-modified": time, "x-weave-timestamp": time + 100 },
    };
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: {
        "x-last-modified": time + 200,
        "x-weave-timestamp": time + 200,
      },
    };
  }

  let { pq, stats } = makePostQueue(config, time, responseGenerator());
  ok((await pq.enqueue(makeRecord(20))).enqueued);
  ok((await pq.enqueue(makeRecord(20))).enqueued);

  // will exceed record limit of 2, so will be in 2nd post.
  ok((await pq.enqueue(makeRecord(20))).enqueued);

  await pq.flush(true);

  deepEqual(stats.posts, [
    {
      nbytes: requestBytesFor([20, 20]),
      numRecords: 2,
      payloadBytes: 40,
      commit: false,
      batch: "true",
      headers: [["x-if-unmodified-since", time]],
    },
    {
      nbytes: requestBytesFor([20]),
      numRecords: 1,
      payloadBytes: 20,
      commit: true,
      batch: 1234,
      headers: [["x-if-unmodified-since", time]],
    },
  ]);

  deepEqual(stats.batches, [
    {
      posts: 2,
      payloadBytes: 60,
      numRecords: 3,
      batch: 1234,
      serverBatch: true,
      didCommit: true,
    },
  ]);

  equal(pq.lastModified, time + 200);
});

// Test we do the right thing when the batch record limit is exceeded.
add_task(async function test_max_records_batch() {
  let config = {
    max_post_bytes: 1000,
    max_post_records: 3,
    max_total_bytes: 10000,
    max_total_records: 5,
    max_record_payload_bytes: 1000,
    max_request_bytes: 10000,
  };

  const time0 = 11111111;
  const time1 = 22222222;
  function* responseGenerator() {
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: { "x-last-modified": time0, "x-weave-timestamp": time0 + 100 },
    };
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: { "x-last-modified": time1, "x-weave-timestamp": time1 },
    };
    yield {
      success: true,
      status: 202,
      obj: { batch: 5678 },
      headers: { "x-last-modified": time1, "x-weave-timestamp": time1 + 100 },
    };
    yield {
      success: true,
      status: 202,
      obj: { batch: 5678 },
      headers: {
        "x-last-modified": time1 + 200,
        "x-weave-timestamp": time1 + 200,
      },
    };
  }

  let { pq, stats } = makePostQueue(config, time0, responseGenerator());

  ok((await pq.enqueue(makeRecord(20))).enqueued);
  ok((await pq.enqueue(makeRecord(20))).enqueued);
  ok((await pq.enqueue(makeRecord(20))).enqueued);

  ok((await pq.enqueue(makeRecord(20))).enqueued);
  ok((await pq.enqueue(makeRecord(20))).enqueued);

  ok((await pq.enqueue(makeRecord(20))).enqueued);
  ok((await pq.enqueue(makeRecord(20))).enqueued);
  ok((await pq.enqueue(makeRecord(20))).enqueued);

  ok((await pq.enqueue(makeRecord(20))).enqueued);

  await pq.flush(true);

  deepEqual(stats.posts, [
    {
      // 3 records
      nbytes: requestBytesFor([20, 20, 20]),
      payloadBytes: 60,
      numRecords: 3,
      commit: false,
      batch: "true",
      headers: [["x-if-unmodified-since", time0]],
    },
    {
      // 2 records -- end batch1
      nbytes: requestBytesFor([20, 20]),
      payloadBytes: 40,
      numRecords: 2,
      commit: true,
      batch: 1234,
      headers: [["x-if-unmodified-since", time0]],
    },
    {
      // 3 records
      nbytes: requestBytesFor([20, 20, 20]),
      payloadBytes: 60,
      numRecords: 3,
      commit: false,
      batch: "true",
      headers: [["x-if-unmodified-since", time1]],
    },
    {
      // 1 record -- end batch2
      nbytes: requestBytesFor([20]),
      payloadBytes: 20,
      numRecords: 1,
      commit: true,
      batch: 5678,
      headers: [["x-if-unmodified-since", time1]],
    },
  ]);

  deepEqual(stats.batches, [
    {
      posts: 2,
      payloadBytes: 100,
      numRecords: 5,
      batch: 1234,
      serverBatch: true,
      didCommit: true,
    },
    {
      posts: 2,
      payloadBytes: 80,
      numRecords: 4,
      batch: 5678,
      serverBatch: true,
      didCommit: true,
    },
  ]);

  equal(pq.lastModified, time1 + 200);
});

// Test we do the right thing when the limits are met but not exceeded.
add_task(async function test_packed_batch() {
  let config = {
    max_post_bytes: 41,
    max_post_records: 4,

    max_total_bytes: 81,
    max_total_records: 8,

    max_record_payload_bytes: 20 + makeRecord.nonPayloadOverhead + 1,
    max_request_bytes: requestBytesFor([10, 10, 10, 10]) + 1,
  };

  const time = 11111111;
  function* responseGenerator() {
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: { "x-last-modified": time, "x-weave-timestamp": time + 100 },
    };
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: {
        "x-last-modified": time + 200,
        "x-weave-timestamp": time + 200,
      },
    };
  }

  let { pq, stats } = makePostQueue(config, time, responseGenerator());
  ok((await pq.enqueue(makeRecord(10))).enqueued);
  ok((await pq.enqueue(makeRecord(10))).enqueued);
  ok((await pq.enqueue(makeRecord(10))).enqueued);
  ok((await pq.enqueue(makeRecord(10))).enqueued);

  ok((await pq.enqueue(makeRecord(10))).enqueued);
  ok((await pq.enqueue(makeRecord(10))).enqueued);
  ok((await pq.enqueue(makeRecord(10))).enqueued);
  ok((await pq.enqueue(makeRecord(10))).enqueued);

  await pq.flush(true);

  deepEqual(stats.posts, [
    {
      nbytes: requestBytesFor([10, 10, 10, 10]),
      numRecords: 4,
      payloadBytes: 40,
      commit: false,
      batch: "true",
      headers: [["x-if-unmodified-since", time]],
    },
    {
      nbytes: requestBytesFor([10, 10, 10, 10]),
      numRecords: 4,
      payloadBytes: 40,
      commit: true,
      batch: 1234,
      headers: [["x-if-unmodified-since", time]],
    },
  ]);

  deepEqual(stats.batches, [
    {
      posts: 2,
      payloadBytes: 80,
      numRecords: 8,
      batch: 1234,
      serverBatch: true,
      didCommit: true,
    },
  ]);

  equal(pq.lastModified, time + 200);
});

// Tests that check that a single record fails to enqueue for the provided config
async function test_enqueue_failure_case(failureLimit, config) {
  const time = 11111111;
  function* responseGenerator() {
    yield {
      success: true,
      status: 202,
      obj: { batch: 1234 },
      headers: {
        "x-last-modified": time + 100,
        "x-weave-timestamp": time + 100,
      },
    };
  }

  let { pq, stats } = makePostQueue(config, time, responseGenerator());
  // Check on empty postqueue
  let result = await pq.enqueue(makeRecord(failureLimit + 1));
  ok(!result.enqueued);
  notEqual(result.error, undefined);

  ok((await pq.enqueue(makeRecord(5))).enqueued);

  // check on nonempty postqueue
  result = await pq.enqueue(makeRecord(failureLimit + 1));
  ok(!result.enqueued);
  notEqual(result.error, undefined);

  // make sure that we keep working, skipping the bad record entirely
  // (handling the error the queue reported is left up to caller)
  ok((await pq.enqueue(makeRecord(5))).enqueued);

  await pq.flush(true);

  deepEqual(stats.posts, [
    {
      nbytes: requestBytesFor([5, 5]),
      numRecords: 2,
      payloadBytes: 10,
      commit: true,
      batch: "true",
      headers: [["x-if-unmodified-since", time]],
    },
  ]);

  deepEqual(stats.batches, [
    {
      posts: 1,
      payloadBytes: 10,
      numRecords: 2,
      batch: 1234,
      serverBatch: true,
      didCommit: true,
    },
  ]);

  equal(pq.lastModified, time + 100);
}

add_task(async function test_max_post_bytes_enqueue_failure() {
  await test_enqueue_failure_case(50, {
    max_post_bytes: 50,
    max_post_records: 100,

    max_total_bytes: 5000,
    max_total_records: 100,

    max_record_payload_bytes: 500,
    max_request_bytes: 500,
  });
});

add_task(async function test_max_request_bytes_enqueue_failure() {
  await test_enqueue_failure_case(50, {
    max_post_bytes: 500,
    max_post_records: 100,

    max_total_bytes: 5000,
    max_total_records: 100,

    max_record_payload_bytes: 500,
    max_request_bytes: 50,
  });
});

add_task(async function test_max_record_payload_bytes_enqueue_failure() {
  await test_enqueue_failure_case(50, {
    max_post_bytes: 500,
    max_post_records: 100,

    max_total_bytes: 5000,
    max_total_records: 100,

    max_record_payload_bytes: 50,
    max_request_bytes: 500,
  });
});
