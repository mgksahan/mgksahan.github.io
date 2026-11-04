import { apiService } from '../../apiService';

// Workout logging that survives bad signal. Each exercise/day is one row in the cloud
// (POST /fitness replaces the whole row), so we always queue the LATEST full set list for that
// key. Retrying is safe: the same payload just overwrites itself. Anything that can't be sent
// stays in localStorage and goes out when the phone is back online.

export interface LogPayload {
  exercise_name: string;
  workout_date: string;
  raw_logs: string;
  set_types: string;
  one_rep_max_kg: number;
  one_rep_max_lbs: number;
  total_volume_lbs: number;
  source: 'peak';
}

interface Entry { payload: LogPayload; v: number }

const KEY = 'peak_pending_logs';
const LB_PER_KG = 2.2046226218;

export interface SyncStatus { pending: number; syncing: boolean; error: string | null }

let queue: Record<string, Entry> = {};
let syncing = false;
let error: string | null = null;
let counter = 0;
const listeners = new Set<() => void>();

try {
  queue = JSON.parse(localStorage.getItem(KEY) || '{}');
  counter = Math.max(0, ...Object.values(queue).map(e => e.v));
} catch { queue = {}; }

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(queue)); } catch { /* storage full or blocked: still in memory */ } };
const emit = () => listeners.forEach(l => l());

export const getSyncStatus = (): SyncStatus => ({ pending: Object.keys(queue).length, syncing, error });
export const subscribeSync = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export async function flushLogs(): Promise<void> {
  if (syncing || !Object.keys(queue).length) return;
  syncing = true; error = null; emit();
  try {
    for (const [key, entry] of Object.entries(queue)) {
      await apiService.createFitnessLog(entry.payload);
      // Only drop it if nothing newer was queued for the same key while we were sending
      if (queue[key]?.v === entry.v) delete queue[key];
      save();
      emit();
    }
  } catch (e: any) {
    error = navigator.onLine ? (e?.message || 'Sync failed') : 'Offline';
  } finally {
    syncing = false; emit();
  }
}

export function queueLog(payload: LogPayload) {
  queue[`${payload.exercise_name}|${payload.workout_date}`] = { payload, v: ++counter };
  save(); emit();
  void flushLogs();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushLogs());
  setInterval(() => { if (Object.keys(queue).length) void flushLogs(); }, 30000);
  setTimeout(() => void flushLogs(), 1500);
}

// --- building a row from what was entered ---

export type SetType = 'warm-up' | 'default' | 'drop' | 'failure';
export interface DraftSet { lb: number; reps: number; type: SetType; done: boolean }

export const lbToKg = (lb: number) => Math.round((lb / LB_PER_KG) * 100) / 100;

// Pull-ups: the app shows ADDED weight; Jefit and the cloud store total load (body + added)
export function buildPayload(exercise: string, date: string, sets: DraftSet[], opts: { isPullUp: boolean; bodyWeightLb: number }): LogPayload | null {
  const done = sets.filter(s => s.done && s.reps > 0);
  if (!done.length) return null;
  const total = (s: DraftSet) => (opts.isPullUp ? s.lb + opts.bodyWeightLb : s.lb);
  const best = Math.max(0, ...done.filter(s => s.type !== 'warm-up' && s.reps <= 10).map(s => lbToKg(total(s)) * (1 + s.reps / 30)));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    exercise_name: exercise,
    workout_date: date,
    raw_logs: done.map(s => `${lbToKg(total(s))}x${s.reps}`).join(','),
    set_types: done.map(s => s.type).join(','),
    one_rep_max_kg: r2(best),
    one_rep_max_lbs: r2(best * LB_PER_KG),
    total_volume_lbs: r2(done.reduce((sum, s) => sum + total(s) * s.reps, 0)),
    source: 'peak',
  };
}
