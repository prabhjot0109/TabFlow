import assert from "node:assert/strict";
import test from "node:test";

import { CaptureThrottle } from "../src/background/utils/capture-throttle.ts";

// Fake clock: time only advances when a sleep is awaited, so the tests assert
// on scheduling decisions rather than on wall-clock timing.
function createFakeClock(startAt = 1_000) {
  let current = startAt;
  const sleeps = [];
  return {
    sleeps,
    now: () => current,
    sleep: async (ms) => {
      sleeps.push(ms);
      current += ms;
    },
    advance: (ms) => {
      current += ms;
    },
  };
}

test("first reservation is granted without waiting", async () => {
  const clock = createFakeClock();
  const throttle = new CaptureThrottle(500, clock);

  assert.equal(await throttle.reserve(1000), true);
  assert.deepEqual(clock.sleeps, []);
});

test("back-to-back reservations wait one interval each", async () => {
  const clock = createFakeClock();
  const throttle = new CaptureThrottle(500, clock);

  await throttle.reserve(1000);
  await throttle.reserve(1000);
  await throttle.reserve(1000);

  assert.deepEqual(clock.sleeps, [500, 500]);
});

test("reservation is refused when the wait exceeds the caller's budget", async () => {
  const clock = createFakeClock();
  const throttle = new CaptureThrottle(500, clock);

  await throttle.reserve(1000);
  // Next slot is 500ms out, but this caller will only wait 100ms.
  assert.equal(await throttle.reserve(100), false);
  assert.deepEqual(clock.sleeps, []);
});

test("a refused reservation does not consume the slot", async () => {
  const clock = createFakeClock();
  const throttle = new CaptureThrottle(500, clock);

  await throttle.reserve(1000);
  await throttle.reserve(0); // refused
  // The slot refused above must still be available to a caller who will wait.
  assert.equal(await throttle.reserve(1000), true);
  assert.deepEqual(clock.sleeps, [500]);
});

test("an idle period does not bank up extra slots", async () => {
  const clock = createFakeClock();
  const throttle = new CaptureThrottle(500, clock);

  await throttle.reserve(1000);
  clock.advance(10_000);

  // Long idle: immediate grant, but only one — the next still waits.
  assert.equal(await throttle.reserve(0), true);
  assert.equal(await throttle.reserve(0), false);
  assert.deepEqual(clock.sleeps, []);
});

test("concurrent reservations are queued rather than racing the quota", async () => {
  const clock = createFakeClock();
  const throttle = new CaptureThrottle(500, clock);

  const results = await Promise.all([
    throttle.reserve(5000),
    throttle.reserve(5000),
    throttle.reserve(5000),
  ]);

  assert.deepEqual(results, [true, true, true]);
  // Each wait is measured from the previous grant, so two equal one-interval
  // waits means the three captures land 500ms apart rather than all at once.
  assert.deepEqual(clock.sleeps, [500, 500]);
});
