export interface AlertStage {
  afterMs: number;
  repeatIntervalMs: number;
  beepCount: number;
  frequencyHz: number;
  volume: number;
}

export const DEFAULT_ALERT_STAGES: AlertStage[] = [
  { afterMs: 8_000, repeatIntervalMs: 4_000, beepCount: 1, frequencyHz: 600, volume: 0.15 },
  { afterMs: 15_000, repeatIntervalMs: 2_500, beepCount: 2, frequencyHz: 750, volume: 0.25 },
  { afterMs: 25_000, repeatIntervalMs: 1_200, beepCount: 3, frequencyHz: 900, volume: 0.35 },
];

export class AlertScheduler {
  private stages: AlertStage[];
  private currentStageIndex = -1;
  private lastTriggerMs: number | null = null;

  constructor(stages: AlertStage[]) {
    this.stages = stages;
  }

  /** Call every frame. Returns the stage to sound an alert for, or null if nothing to play. */
  update(msSinceLastBlink: number, nowMs: number): AlertStage | null {
    const stageIndex = this.findStageIndex(msSinceLastBlink);

    if (stageIndex === -1) {
      this.currentStageIndex = -1;
      this.lastTriggerMs = null;
      return null;
    }

    const stage = this.stages[stageIndex];

    if (stageIndex !== this.currentStageIndex) {
      this.currentStageIndex = stageIndex;
      this.lastTriggerMs = nowMs;
      return stage;
    }

    if (this.lastTriggerMs === null || nowMs - this.lastTriggerMs >= stage.repeatIntervalMs) {
      this.lastTriggerMs = nowMs;
      return stage;
    }

    return null;
  }

  reset(): void {
    this.currentStageIndex = -1;
    this.lastTriggerMs = null;
  }

  private findStageIndex(msSinceLastBlink: number): number {
    for (let i = this.stages.length - 1; i >= 0; i--) {
      if (msSinceLastBlink >= this.stages[i].afterMs) return i;
    }
    return -1;
  }
}
