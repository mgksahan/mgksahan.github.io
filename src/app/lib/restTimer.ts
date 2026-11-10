import { useSyncExternalStore } from 'react';

// The rest timer lives outside the workout screen so it keeps running when you go back to the plan view
// (or reload). It is stored as absolute times, so no ticking is needed to keep it correct.
export interface RestState { start: number; end: number; total: number }

const KEY = 'peak_rest_timer';
const STALE_MS = 30 * 60 * 1000; // a timer that ended over 30 minutes ago is not worth showing

let state: RestState | null = null;
try {
  const s = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (s && Date.now() - s.end < STALE_MS) state = s;
} catch { state = null; }

const listeners = new Set<() => void>();

export const getRest = () => state;
export function setRest(next: RestState | null | ((cur: RestState | null) => RestState | null)) {
  state = typeof next === 'function' ? next(state) : next;
  try { if (state) localStorage.setItem(KEY, JSON.stringify(state)); else localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach(l => l());
}
export function startRest(sec: number) {
  unlockAudio();
  const t = Date.now();
  setRest({ start: t, end: t + sec * 1000, total: sec });
}
export const useRest = () => useSyncExternalStore(
  fn => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getRest,
);

// --- "rest over" sound ---
// Phones only allow audio after a tap, so the audio context is created/resumed on the first touch of the page
// (and every time a rest starts, which is itself a tap on a set tick).
let ctx: AudioContext | null = null;
export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* no audio */ }
}
if (typeof document !== 'undefined') document.addEventListener('pointerdown', unlockAudio, { passive: true });

// Three short rising beeps
export function playRestDone() {
  unlockAudio();
  if (!ctx) return;
  const c = ctx;
  const t0 = c.currentTime + 0.02;
  [880, 880, 1175].forEach((hz, i) => {
    const t = t0 + i * 0.28;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  });
}
