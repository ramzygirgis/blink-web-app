export type BlinkState = "open" | "closed";

export interface BlinkDetectorOptions {
  enterClosedThreshold: number;
  exitClosedThreshold: number;
  minClosedDurationMs: number;
}

export const DEFAULT_BLINK_DETECTOR_OPTIONS: BlinkDetectorOptions = {
  enterClosedThreshold: 0.70,
  exitClosedThreshold: 0.4,
  minClosedDurationMs: 50,
};

export class BlinkDetector {
  private state: BlinkState = "open";
  private closedSinceMs: number | null = null;
  private options: BlinkDetectorOptions;

  constructor(options: BlinkDetectorOptions) {
    this.options = options;
  }

  /** Feed one frame's combined eye-closed score. Returns true if a blink was just confirmed. */
  update(combinedScore: number, timestampMs: number): boolean {
    if (this.state === "open") {
      if (combinedScore >= this.options.enterClosedThreshold) {
        this.state = "closed";
        this.closedSinceMs = timestampMs;
      }
      return false;
    }

    if (combinedScore <= this.options.exitClosedThreshold) {
      const closedDuration = timestampMs - (this.closedSinceMs ?? timestampMs);
      this.state = "open";
      this.closedSinceMs = null;
      return closedDuration >= this.options.minClosedDurationMs;
    }

    return false;
  }

  getState(): BlinkState {
    return this.state;
  }

  setOptions(options: BlinkDetectorOptions): void {
    this.options = options;
  }

  reset(): void {
    this.state = "open";
    this.closedSinceMs = null;
  }
}
