export class AlertPlayer {
  private audioCtx: AudioContext | null = null;

  /** Must be called synchronously inside a user gesture (e.g. a click handler). */
  unlock(): void {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === "suspended") {
      void this.audioCtx.resume();
    }
  }

  playBeeps(count: number, frequencyHz: number, volume: number): void {
    const ctx = this.audioCtx;
    if (!ctx) return;

    const beepDuration = 0.12;
    const gap = 0.08;

    for (let i = 0; i < count; i++) {
      const startTime = ctx.currentTime + i * (beepDuration + gap);
      this.playTone(ctx, startTime, beepDuration, frequencyHz, volume);
    }
  }

  private playTone(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    frequencyHz: number,
    volume: number,
  ): void {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequencyHz;

    // Ramp gain in/out instead of stepping straight to volume/0, which would
    // otherwise produce an audible click/pop at the start and end of each tone.
    const attack = 0.01;
    const release = 0.03;
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + attack);
    gainNode.gain.setValueAtTime(volume, startTime + duration - release);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }
}
