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
let serverTimeOffset = 0;

// Records a server-stamped timestamp from a just-received live event. The
// estimate is short by the one-way network latency (tens of ms), which is far
// below the clock skew this exists to cancel out.
export const recordServerTimestamp = (serverTimestamp) => {
  if (typeof serverTimestamp !== 'number' || !Number.isFinite(serverTimestamp)) return;
  serverTimeOffset = serverTimestamp - Date.now();
};

export const getServerTimeOffset = () => serverTimeOffset;

// Local Date.now() translated into the server's clock.
export const serverNow = () => Date.now() + serverTimeOffset;

// Test seam — the offset is module-level state shared by every game in the tab.
export const resetServerTimeOffset = () => {
  serverTimeOffset = 0;
};
