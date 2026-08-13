// ============================================================================
// CAPTURE THROTTLE
// Chrome caps chrome.tabs.captureVisibleTab at roughly two calls per second and
// rejects the call outright past that. This hands out time slots so concurrent
// callers queue against the quota instead of racing it.
// ============================================================================

export interface Clock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class CaptureThrottle {
  private intervalMs: number;
  private clock: Clock;
  private nextAvailableAt: number;

  constructor(intervalMs: number, clock: Clock = systemClock) {
    this.intervalMs = intervalMs;
    this.clock = clock;
    this.nextAvailableAt = 0;
  }

  // Reserve the next capture slot. Resolves true once the caller may capture.
  // Resolves false when the wait would exceed maxWaitMs — no slot is consumed,
  // so the caller should skip this capture rather than delay the user.
  async reserve(maxWaitMs: number): Promise<boolean> {
    const now = this.clock.now();
    const startAt = Math.max(now, this.nextAvailableAt);
    const waitMs = startAt - now;

    if (waitMs > maxWaitMs) return false;

    // Claim the slot before awaiting so concurrent callers queue behind it.
    this.nextAvailableAt = startAt + this.intervalMs;
    if (waitMs > 0) await this.clock.sleep(waitMs);
    return true;
  }
}
