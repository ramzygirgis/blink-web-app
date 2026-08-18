import "./style.css";
import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { startCamera } from "./camera";
import { createFaceLandmarker } from "./faceLandmarker";
import { BlinkDetector, DEFAULT_BLINK_DETECTOR_OPTIONS } from "./blinkDetector";
import { AlertPlayer } from "./alertPlayer";
import { AlertScheduler, DEFAULT_ALERT_STAGES } from "./alertScheduler";

const startButton = document.querySelector<HTMLButtonElement>("#start-button")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const videoEl = document.querySelector<HTMLVideoElement>("#camera-feed")!;
const blinkLeftBar = document.querySelector<HTMLProgressElement>("#blink-left")!;
const blinkRightBar = document.querySelector<HTMLProgressElement>("#blink-right")!;
const blinkLeftValue = document.querySelector<HTMLSpanElement>("#blink-left-value")!;
const blinkRightValue = document.querySelector<HTMLSpanElement>("#blink-right-value")!;
const blinkCombinedBar = document.querySelector<HTMLProgressElement>("#blink-combined")!;
const blinkCombinedValue = document.querySelector<HTMLSpanElement>("#blink-combined-value")!;
const blinkCountValueEl = document.querySelector<HTMLSpanElement>("#blink-count-value")!;
const timeSinceBlinkValueEl = document.querySelector<HTMLSpanElement>("#time-since-blink-value")!;

const tabButtons = document.querySelectorAll<HTMLButtonElement>(".nav-button");
const views: Record<string, HTMLElement> = {
  monitor: document.querySelector<HTMLElement>("#view-monitor")!,
  settings: document.querySelector<HTMLElement>("#view-settings")!,
};

const enterThresholdInput = document.querySelector<HTMLInputElement>("#setting-enter-threshold")!;
const enterThresholdValue = document.querySelector<HTMLSpanElement>("#setting-enter-threshold-value")!;
const exitThresholdInput = document.querySelector<HTMLInputElement>("#setting-exit-threshold")!;
const exitThresholdValue = document.querySelector<HTMLSpanElement>("#setting-exit-threshold-value")!;
const minDurationInput = document.querySelector<HTMLInputElement>("#setting-min-duration")!;
const minDurationValue = document.querySelector<HTMLSpanElement>("#setting-min-duration-value")!;
const stage1Input = document.querySelector<HTMLInputElement>("#setting-stage1")!;
const stage1Value = document.querySelector<HTMLSpanElement>("#setting-stage1-value")!;
const stage2Input = document.querySelector<HTMLInputElement>("#setting-stage2")!;
const stage2Value = document.querySelector<HTMLSpanElement>("#setting-stage2-value")!;
const stage3Input = document.querySelector<HTMLInputElement>("#setting-stage3")!;
const stage3Value = document.querySelector<HTMLSpanElement>("#setting-stage3-value")!;
const volumeInput = document.querySelector<HTMLInputElement>("#setting-volume")!;
const volumeValue = document.querySelector<HTMLSpanElement>("#setting-volume-value")!;
const showCameraInput = document.querySelector<HTMLInputElement>("#setting-show-camera")!;
const resetDefaultsButton = document.querySelector<HTMLButtonElement>("#reset-defaults-button")!;
const resetDialog = document.querySelector<HTMLDialogElement>("#reset-confirm-dialog")!;
const resetCancelButton = document.querySelector<HTMLButtonElement>("#reset-cancel-button")!;
const resetConfirmButton = document.querySelector<HTMLButtonElement>("#reset-confirm-button")!;

const blinkDetector = new BlinkDetector(DEFAULT_BLINK_DETECTOR_OPTIONS);
const alertPlayer = new AlertPlayer();
const alertScheduler = new AlertScheduler(DEFAULT_ALERT_STAGES);
let blinkCount = 0;
let lastFrameMs: number | null = null;
let elapsedSinceBlinkMs = 0;

let faceLandmarkerInstance: FaceLandmarker | null = null;
let mediaStream: MediaStream | null = null;
let detectionIntervalId: number | null = null;
let isMonitoring = false;

startButton.addEventListener("click", () => {
  if (isMonitoring) {
    pauseMonitoring();
  } else {
    alertPlayer.unlock();
    startMonitoring();
  }
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.view!;
    tabButtons.forEach((b) => b.setAttribute("aria-current", String(b === button)));
    for (const [name, el] of Object.entries(views)) {
      el.hidden = name !== target;
    }
  });
});

function applyBlinkDetectorSettings(): void {
  const enter = Number(enterThresholdInput.value);
  const exit = Number(exitThresholdInput.value);
  const minDuration = Number(minDurationInput.value);

  enterThresholdValue.textContent = enter.toFixed(2);
  exitThresholdValue.textContent = exit.toFixed(2);
  minDurationValue.textContent = String(minDuration);

  blinkDetector.setOptions({
    enterClosedThreshold: enter,
    exitClosedThreshold: exit,
    minClosedDurationMs: minDuration,
  });
}

function applyAlertSettings(): void {
  const afterMsValues = [Number(stage1Input.value), Number(stage2Input.value), Number(stage3Input.value)]
    .map((seconds) => seconds * 1000)
    .sort((a, b) => a - b);
  const volumeMultiplier = Number(volumeInput.value);

  stage1Value.textContent = stage1Input.value;
  stage2Value.textContent = stage2Input.value;
  stage3Value.textContent = stage3Input.value;
  volumeValue.textContent = `${Math.round(volumeMultiplier * 100)}%`;

  const stages = DEFAULT_ALERT_STAGES.map((stage, i) => ({
    ...stage,
    afterMs: afterMsValues[i],
    volume: stage.volume * volumeMultiplier,
  }));

  alertScheduler.setStages(stages);
}

for (const input of [enterThresholdInput, exitThresholdInput, minDurationInput]) {
  input.addEventListener("input", applyBlinkDetectorSettings);
}
for (const input of [stage1Input, stage2Input, stage3Input, volumeInput]) {
  input.addEventListener("input", applyAlertSettings);
}

showCameraInput.addEventListener("change", () => {
  videoEl.classList.toggle("camera-hidden", !showCameraInput.checked);
});

resetDefaultsButton.addEventListener("click", () => {
  resetDialog.showModal();
});

resetCancelButton.addEventListener("click", () => {
  resetDialog.close();
});

resetConfirmButton.addEventListener("click", () => {
  enterThresholdInput.value = String(DEFAULT_BLINK_DETECTOR_OPTIONS.enterClosedThreshold);
  exitThresholdInput.value = String(DEFAULT_BLINK_DETECTOR_OPTIONS.exitClosedThreshold);
  minDurationInput.value = String(DEFAULT_BLINK_DETECTOR_OPTIONS.minClosedDurationMs);
  applyBlinkDetectorSettings();

  stage1Input.value = String(DEFAULT_ALERT_STAGES[0].afterMs / 1000);
  stage2Input.value = String(DEFAULT_ALERT_STAGES[1].afterMs / 1000);
  stage3Input.value = String(DEFAULT_ALERT_STAGES[2].afterMs / 1000);
  volumeInput.value = "1";
  applyAlertSettings();

  showCameraInput.checked = true;
  videoEl.classList.remove("camera-hidden");

  resetDialog.close();
});

async function startMonitoring() {
  try {
    startButton.disabled = true;
    statusEl.textContent = "Requesting camera access…";

    const landmarkerPromise = faceLandmarkerInstance
      ? Promise.resolve(faceLandmarkerInstance)
      : createFaceLandmarker();

    const [, faceLandmarker] = await Promise.all([
      startCamera(videoEl).then(() => waitForVideoReady(videoEl)),
      landmarkerPromise,
    ]);

    faceLandmarkerInstance = faceLandmarker;
    mediaStream = videoEl.srcObject as MediaStream;
    isMonitoring = true;
    startButton.textContent = "Pause monitoring";
    startButton.disabled = false;
    statusEl.textContent = "Detecting…";
    detectionIntervalId = detectLoop(faceLandmarker);
  } catch (err) {
    statusEl.textContent = describeError(err);
    startButton.disabled = false;
  }
}

function pauseMonitoring(): void {
  isMonitoring = false;

  if (detectionIntervalId !== null) {
    clearInterval(detectionIntervalId);
    detectionIntervalId = null;
  }

  if (mediaStream) {
    for (const track of mediaStream.getTracks()) track.stop();
    mediaStream = null;
  }
  videoEl.srcObject = null;

  blinkDetector.reset();
  alertScheduler.reset();
  blinkCount = 0;
  lastFrameMs = null;
  elapsedSinceBlinkMs = 0;

  startButton.textContent = "Start monitoring";
  statusEl.textContent = 'Click "Start monitoring" to begin.';
  blinkLeftBar.value = 0;
  blinkRightBar.value = 0;
  blinkCombinedBar.value = 0;
  blinkLeftValue.textContent = "0.00";
  blinkRightValue.textContent = "0.00";
  blinkCombinedValue.textContent = "0.00";
  blinkCountValueEl.textContent = "0";
  timeSinceBlinkValueEl.textContent = "0.0s";
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
  });
}

const DETECTION_INTERVAL_MS = 33;

function detectLoop(faceLandmarker: FaceLandmarker): number {
  let lastVideoTime = -1;

  // setInterval instead of requestAnimationFrame: rAF is tied to painting and
  // gets suspended in background tabs, which would silently stop blink
  // detection whenever this tab isn't focused.
  return setInterval(() => {
    if (videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime;
      const now = performance.now();
      const result = faceLandmarker.detectForVideo(videoEl, now);
      updateBlendshapes(result, now);
    }
  }, DETECTION_INTERVAL_MS);
}

function updateBlendshapes(result: FaceLandmarkerResult, timestampMs: number): void {
  const categories = result.faceBlendshapes[0]?.categories ?? [];
  const left = categories.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;
  const right = categories.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;
  const combined = Math.max(0, Math.min(left, right) - Math.abs(left - right));

  blinkLeftBar.value = left;
  blinkRightBar.value = right;
  blinkLeftValue.textContent = left.toFixed(2);
  blinkRightValue.textContent = right.toFixed(2);
  blinkCombinedBar.value = combined;
  blinkCombinedValue.textContent = combined.toFixed(2);

  const frameDelta = lastFrameMs === null ? 0 : timestampMs - lastFrameMs;
  lastFrameMs = timestampMs;

  if (categories.length > 0) {
    elapsedSinceBlinkMs += frameDelta;

    const blinked = blinkDetector.update(combined, timestampMs);
    if (blinked) {
      blinkCount++;
      elapsedSinceBlinkMs = 0;
      alertScheduler.reset();
    }

    const stage = alertScheduler.update(elapsedSinceBlinkMs, timestampMs);
    if (stage) {
      alertPlayer.playBeeps(stage.beepCount, stage.frequencyHz, stage.volume);
    }

    const eyeState = blinkDetector.getState() === "closed" ? "Eyes closed" : "Eyes open";
    statusEl.textContent = `Face detected — ${eyeState}`;
  } else {
    statusEl.textContent = "No face detected.";
  }

  blinkCountValueEl.textContent = String(blinkCount);
  timeSinceBlinkValueEl.textContent = `${(elapsedSinceBlinkMs / 1000).toFixed(1)}s`;
}

function describeError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
        return "Camera access was denied. Allow camera access and reload the page.";
      case "NotFoundError":
        return "No camera was found on this device.";
      case "NotReadableError":
        return "The camera is already in use by another application.";
      default:
        return `Camera error: ${err.name}`;
    }
  }
  return "Something went wrong loading the camera or face model.";
}
