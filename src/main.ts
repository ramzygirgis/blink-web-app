import "./style.css";
import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { startCamera } from "./camera";
import { createFaceLandmarker } from "./faceLandmarker";
import { BlinkDetector, DEFAULT_BLINK_DETECTOR_OPTIONS } from "./blinkDetector";

const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const videoEl = document.querySelector<HTMLVideoElement>("#camera-feed")!;
const blinkLeftBar = document.querySelector<HTMLProgressElement>("#blink-left")!;
const blinkRightBar = document.querySelector<HTMLProgressElement>("#blink-right")!;
const blinkLeftValue = document.querySelector<HTMLSpanElement>("#blink-left-value")!;
const blinkRightValue = document.querySelector<HTMLSpanElement>("#blink-right-value")!;
const blinkCombinedBar = document.querySelector<HTMLProgressElement>("#blink-combined")!;
const blinkCombinedValue = document.querySelector<HTMLSpanElement>("#blink-combined-value")!;
const blinkStatsEl = document.querySelector<HTMLParagraphElement>("#blink-stats")!;

const blinkDetector = new BlinkDetector(DEFAULT_BLINK_DETECTOR_OPTIONS);
let blinkCount = 0;

async function main() {
  try {
    statusEl.textContent = "Requesting camera access…";
    const [, faceLandmarker] = await Promise.all([
      startCamera(videoEl).then(() => waitForVideoReady(videoEl)),
      createFaceLandmarker(),
    ]);

    statusEl.textContent = "Detecting…";
    detectLoop(faceLandmarker);
  } catch (err) {
    statusEl.textContent = describeError(err);
  }
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
  });
}

function detectLoop(faceLandmarker: FaceLandmarker): void {
  let lastVideoTime = -1;

  function tick() {
    if (videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime;
      const now = performance.now();
      const result = faceLandmarker.detectForVideo(videoEl, now);
      updateBlendshapes(result, now);
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
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

  statusEl.textContent = categories.length > 0 ? "Face detected." : "No face detected.";

  if (categories.length > 0) {
    const blinked = blinkDetector.update(combined, timestampMs);
    if (blinked) blinkCount++;
  }

  blinkStatsEl.textContent = `State: ${blinkDetector.getState()} — Blinks: ${blinkCount}`;
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

main();
