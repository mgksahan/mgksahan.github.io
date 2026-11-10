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
  const t = Date.now();
  setRest({ start: t, end: t + sec * 1000, total: sec });
}
export const useRest = () => useSyncExternalStore(
  fn => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getRest,
);
