export const MAX_CLOCK_INCREMENT = 1000 * 60;

// The game clock's persisted portion (clock.totalTime) is accumulated from
// server-stamped event timestamps, and the live portion is the time elapsed
// since clock.lastUpdated — also a server timestamp. Measuring that elapsed
// time with a raw local Date.now() would display the device's own clock skew
// as solve time (a device 30s fast would show 00:30 the instant the clock
// started), so we track the offset between server and local time and read
// "now" through it.
//
// Only live socket events are valid samples: an event from the initial history
// sync is legitimately old and would look like an enormous offset.
//
// Every sample is biased LOW, and by an unknown amount. A sample is
// `serverStamp - Date.now()`, so anything that delays the event between the
// server stamping it and us processing it — network, the database write that
// precedes the broadcast, a throttled background tab draining its callback
// queue — lands entirely in the local term: sample = trueOffset - delay. That
// makes each sample a lower bound on the true offset, so the best available
// estimate is the LARGEST recent sample. Taking the most recent one instead
// let a single late callback rewind serverNow() by the length of the delay,
// stalling the displayed clock and under-counting the recorded solve time.
//
// "Largest" alone would pin the estimate forever, so a lower sample can still
// win — but only with corroboration, never on its own. A single lower sample is
// ambiguous: it means either the device clock really moved, or that one event
// was delayed. Adopting it unconditionally once the estimate went stale would
// re-enable the very failure above, and at the worst possible moment, since a
// long tab suspension produces a stale estimate and a delayed sample together.
//
// So a lower estimate requires two consecutive lower samples that agree to
// within AGREEMENT_TOLERANCE_MS, plus a stale current estimate. Two independent
// delays rarely agree closely, while two samples taken after a real clock change
// agree exactly. The cost is that a genuine clock change takes up to
// OFFSET_WINDOW_MS to be believed — acceptable because the common recovery path
// is upward: a suspended tab's socket reconnects, and the join_game ack is a
// fresh, undelayed sample that wins immediately on the "largest" rule.
const OFFSET_WINDOW_MS = 5 * 60 * 1000;
const AGREEMENT_TOLERANCE_MS = 1000;

let serverTimeOffset = 0;
let hasSample = false;
let sampledAt = 0;
// Last lower-than-current sample, held as a candidate awaiting corroboration.
let candidate = null;

// Elapsed-time reference for the window. Monotonic where available so that a
// device clock change can't make the current estimate look fresher than it is.
const monotonicNow = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

// Records a server-stamped timestamp from a just-received live event or the
// join_game ack.
export const recordServerTimestamp = (serverTimestamp) => {
  if (typeof serverTimestamp !== 'number' || !Number.isFinite(serverTimestamp)) return;
  const sample = serverTimestamp - Date.now();
  const now = monotonicNow();

  // Delay can only bias a sample downward, so anything at or above the current
  // estimate is trustworthy on sight.
  if (!hasSample || sample >= serverTimeOffset) {
    serverTimeOffset = sample;
    sampledAt = now;
    hasSample = true;
    candidate = null;
    return;
  }

  // Lower than what we have. Believe it only if the previous lower sample
  // agrees and the estimate we'd be replacing has gone stale.
  const corroborated = candidate !== null && Math.abs(sample - candidate.value) <= AGREEMENT_TOLERANCE_MS;
  if (corroborated && now - sampledAt > OFFSET_WINDOW_MS) {
    serverTimeOffset = sample;
    sampledAt = now;
    candidate = null;
    return;
  }
  candidate = {value: sample, at: now};
};

export const getServerTimeOffset = () => serverTimeOffset;

// Local Date.now() translated into the server's clock.
export const serverNow = () => Date.now() + serverTimeOffset;

// Test seam — the offset is module-level state shared by every game in the tab.
export const resetServerTimeOffset = () => {
  serverTimeOffset = 0;
  hasSample = false;
  sampledAt = 0;
  candidate = null;
};
