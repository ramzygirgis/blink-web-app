const SENSITIVITY_MIN_THRESHOLD = 0.6;
const SENSITIVITY_MAX_THRESHOLD = 0.8;

// Unequal bands: Min/Max are narrow slivers right at the extremes, Very
// Low/Very High are narrow bands just inside them, and Low/Mid/High share
// most of the range in the middle.
const SENSITIVITY_BANDS: { label: string; upperBound: number }[] = [
  { label: "Min", upperBound: 2 },
  { label: "Very Low", upperBound: 15 },
  { label: "Low", upperBound: 40 },
  { label: "Mid", upperBound: 60 },
  { label: "High", upperBound: 85 },
  { label: "Very High", upperBound: 98 },
  { label: "Max", upperBound: 100 },
];

export const SENSITIVITY_ADJECTIVES = SENSITIVITY_BANDS.map((band) => band.label);

/** sensitivity: 0 (least sensitive) to 100 (most sensitive) */
export function sensitivityToThreshold(sensitivity: number): number {
  const t = sensitivity / 100;
  return SENSITIVITY_MAX_THRESHOLD - t * (SENSITIVITY_MAX_THRESHOLD - SENSITIVITY_MIN_THRESHOLD);
}

export function thresholdToSensitivity(threshold: number): number {
  const t = (SENSITIVITY_MAX_THRESHOLD - threshold) / (SENSITIVITY_MAX_THRESHOLD - SENSITIVITY_MIN_THRESHOLD);
  return t * 100;
}

export function getSensitivityLabel(sensitivity: number): string {
  const band = SENSITIVITY_BANDS.find((b) => sensitivity <= b.upperBound);
  return (band ?? SENSITIVITY_BANDS[SENSITIVITY_BANDS.length - 1]).label;
}
