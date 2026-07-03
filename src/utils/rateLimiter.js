// Serializes async work behind a sliding-window cap so a free-tier API key
// (e.g. football-data.org's 10 requests/minute) is never exceeded, no matter
// how many commands or poller ticks fire concurrently.
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.timestamps = [];
    this.tail = Promise.resolve();
  }

  schedule(fn) {
    const run = async () => {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
      if (this.timestamps.length >= this.maxRequests) {
        const waitMs = this.windowMs - (now - this.timestamps[0]) + 50;
        await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 0)));
      }
      this.timestamps.push(Date.now());
      return fn();
    };
    this.tail = this.tail.then(run, run);
    return this.tail;
  }
}

module.exports = { RateLimiter };
