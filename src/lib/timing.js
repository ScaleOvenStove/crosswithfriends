export const MAX_CLOCK_INCREMENT = 1000 * 60;

// The game clock's persisted portion (clock.totalTime) is accumulated from
// server-stamped event timestamps, and the live portion is the time elapsed
// since clock.lastUpdated — also a server timestamp. Measuring that elapsed
// time with a raw local Date.now() would display the device's own clock skew
// as solve time (a device 30s fast would show 00:30 the instant the clock
// started), so we track the offset between server and local time and read
// "now" through it.
//
// Estimating that offset comes down to one question per sample: how long did
// this timestamp take to reach us? A sample is `serverStamp - Date.now()`, so
// any delay in between lands entirely in the local term — network, the database
// write that precedes the broadcast, a throttled or suspended tab draining its
// callback queue. Every sample is therefore `trueOffset - delay`: a lower bound,
// never an over-estimate.
//
// That asymmetry decides everything. A sample ABOVE the current estimate cannot
// be explained by delay, so it is trustworthy on sight. A sample BELOW it is
// ambiguous — either the device clock moved, or that event was slow — and no
// amount of squinting at a one-way sample resolves which. Two earlier attempts
// here tried and failed: adopting any sample once the estimate went stale, and
// then requiring two lower samples to agree. Both broke on a suspended tab,
// which delivers a batch of queued events whose delays are near-identical, so
// batch-mates corroborate each other into a badly rewound clock.
//
// So one-way samples may only ever raise the estimate. Lowering it requires
// evidence of freshness, which only a measured round trip provides.
let serverTimeOffset = 0;
let hasSample = false;

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

// Beyond this the network round trip tells us too little about the delay to be
// worth trusting in the downward direction.
const MAX_TRUSTED_ROUND_TRIP_MS = 10 * 1000;

// A one-way sample: a server-stamped timestamp off a broadcast event, whose
// delay is unbounded. Raises the estimate, never lowers it.
export const recordServerTimestamp = (serverTimestamp) => {
  if (!isFiniteNumber(serverTimestamp)) return;
  const sample = serverTimestamp - Date.now();
  if (!hasSample || sample > serverTimeOffset) {
    serverTimeOffset = sample;
    hasSample = true;
  }
};

// A timed exchange — the join_game ack, which reports both when the server
// received our request and when it answered. Four timestamps make this the only
// evidence that can lower the estimate:
//
//   sentAt ──────► serverReceivedAt ··· serverSentAt ──────► receivedAt
//
// The two middle values bracket the server's own processing, which can be
// slow (a moderation cache miss goes to the database) and is not flight time.
// Halving the whole duration instead — the obvious shortcut — charges that
// processing to the outbound flight and overestimates the offset by roughly
// half of it, which then sticks, because one-way samples can only raise. So
// take each direction separately and average, leaving only the asymmetry
// between the two network paths:
//
//   offset      = ((serverReceivedAt - sentAt) + (serverSentAt - receivedAt)) / 2
//   networkTrip = (receivedAt - sentAt) - (serverSentAt - serverReceivedAt)
//
// An older server sends no serverReceivedAt; without it the split is unknowable,
// so the stamp degrades to an ordinary one-way sample rather than being guessed.
export const recordServerTimeExchange = ({sentAt, serverReceivedAt, serverSentAt, receivedAt}) => {
  if (!isFiniteNumber(serverSentAt)) return;
  if (!isFiniteNumber(serverReceivedAt) || !isFiniteNumber(sentAt) || !isFiniteNumber(receivedAt)) {
    recordServerTimestamp(serverSentAt);
    return;
  }
  const serverProcessing = serverSentAt - serverReceivedAt;
  const networkTrip = receivedAt - sentAt - serverProcessing;
  if (serverProcessing < 0 || networkTrip < 0 || networkTrip > MAX_TRUSTED_ROUND_TRIP_MS) {
    recordServerTimestamp(serverSentAt);
    return;
  }
  serverTimeOffset = (serverReceivedAt - sentAt + (serverSentAt - receivedAt)) / 2;
  hasSample = true;
};

export const getServerTimeOffset = () => serverTimeOffset;

// Local Date.now() translated into the server's clock.
export const serverNow = () => Date.now() + serverTimeOffset;

// Test seam — the offset is module-level state shared by every game in the tab.
export const resetServerTimeOffset = () => {
  serverTimeOffset = 0;
  hasSample = false;
};
