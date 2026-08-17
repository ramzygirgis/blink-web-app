import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const INSTALLED_VERSION = "1.0.1";
const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${INSTALLED_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export async function createFaceLandmarker(): Promise<FaceLandmarker> {
  const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE_URL);

  return FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
  });
}
