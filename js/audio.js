import { settings } from "./state.js";

let sharedAudioContext = null;

function getAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioCtx();
  }

  return sharedAudioContext;
}

function scheduleTone(ctx, frequency, startTime, duration, peakGain = 0.16) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.05);
}

/** Soft ascending chime used when a routine is completed. */
export function playCompletionSound({ force = false } = {}) {
  if (!force && !settings.completionSound) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const start = () => {
      const now = ctx.currentTime;
      scheduleTone(ctx, 523.25, now, 0.18, 0.14);
      scheduleTone(ctx, 659.25, now + 0.12, 0.2, 0.15);
      scheduleTone(ctx, 783.99, now + 0.26, 0.32, 0.17);
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(start).catch(() => {});
      return;
    }

    start();
  } catch {
    // Ignore audio failures (blocked autoplay, missing Web Audio, etc.).
  }
}
