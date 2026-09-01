export async function playFocusChime() {
  let context;
  try {
    const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContext) return;
    context = new AudioContext();
    if (context.state === 'suspended') await context.resume();
    const startAt = context.currentTime;
    for (const [offset, frequency] of [[0, 523.25], [0.16, 659.25]]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt + offset);
      gain.gain.setValueAtTime(0.0001, startAt + offset);
      gain.gain.exponentialRampToValueAtTime(0.08, startAt + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt + offset);
      oscillator.stop(startAt + offset + 0.2);
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 420));
  } catch {
    // Audio feedback is optional; focus state has already been persisted.
  } finally {
    try {
      await context?.close?.();
    } catch {
      // Closing a blocked context can fail independently.
    }
  }
}
