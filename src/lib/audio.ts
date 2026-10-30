/**
 * 极轻微的机械键盘音效（WebAudio 合成，无外部音频资源）。
 * 需求：可关闭；默认开启；音量极低。
 */
let audioContext: AudioContext | null = null;
let muted = false;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

export function setSoundEnabled(enabled: boolean): void {
  muted = !enabled;
}

type SoundKind = 'key' | 'toggle' | 'success' | 'error';

const RECIPES: Record<SoundKind, { freq: number; duration: number; gain: number; type: OscillatorType }> = {
  key: { freq: 1850, duration: 0.035, gain: 0.012, type: 'triangle' },
  toggle: { freq: 980, duration: 0.06, gain: 0.02, type: 'sine' },
  success: { freq: 1320, duration: 0.09, gain: 0.022, type: 'sine' },
  error: { freq: 240, duration: 0.1, gain: 0.02, type: 'sawtooth' },
};

export function playSound(kind: SoundKind = 'key'): void {
  if (muted) return;
  const ctx = getContext();
  if (!ctx) return;
  const recipe = RECIPES[kind];
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  oscillator.type = recipe.type;
  oscillator.frequency.setValueAtTime(recipe.freq, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, recipe.freq * 0.55), now + recipe.duration);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(recipe.gain, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + recipe.duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + recipe.duration + 0.02);
}
