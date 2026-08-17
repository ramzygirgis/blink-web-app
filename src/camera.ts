export async function startCamera(video: HTMLVideoElement): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia is not supported in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false,
  });

  video.srcObject = stream;
  await video.play();
}
