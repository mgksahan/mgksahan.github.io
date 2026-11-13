import { useSyncExternalStore } from 'react';
import { apiService } from '../../apiService';

// Time tracker data. Everything is saved in localStorage first, so the timer responds instantly and
// works offline. Each task, time entry, the running timer and the settings is one item in the cloud
// (TrackerItems table). Last write wins per item, compared by updatedAt. A delete leaves a tombstone
// so a device with an old copy cannot bring the item back.

export type Cat = 'work' | 'learn' | 'life';
export interface Task { id: string; title: string; cat: Cat; pts: number; due: string; done: boolean; doneAt?: number | null; updatedAt: number }
// Board: sticky-note cards in swim lanes. A card can be linked to a task so it shows on the task list.
// A card with subtasks acts as an epic. A subtask can be put on the task list (taskId); then the task is the source of truth for done.
export interface Sub { id: string; text: string; done: boolean; taskId?: string | null }
export interface Card { id: string; text: string; lane: string; pos: number; cat: Cat; taskId?: string | null; subs?: Sub[]; epic?: boolean; due?: string; updatedAt: number }   // due: only used while the card has no linked task (a task keeps its own due date)
export interface Lane { id: string; name: string }
export const DEFAULT_LANES: Lane[] = [{ id: 'ideas', name: 'Ideas' }, { id: 'next', name: 'Next up' }, { id: 'doing', name: 'Doing' }, { id: 'done', name: 'Done' }];
export interface Entry { id: string; start: number; end: number; cat: Cat; taskId?: string | null; note: string; updatedAt: number }
export interface Segment { acc: number; since: number | null; cat: Cat; taskId: string | null; note: string }
export interface TimerDoc {
  timer: Segment | null;
  block: { acc: number; since: number | null };   // continuous run time in the current focus block
  brk: { until: number } | null;                   // break countdown
  pausedBy?: string;                               // set by the phone app when it pauses the timer
  updatedAt: number;
}
export interface SettingsDoc { focus: number; brk: number; days: Record<string, number>; lanes?: Lane[]; updatedAt: number }
export interface TrackState {
  tasks: Record<string, Task>;
  cards: Record<string, Card>;
  entries: Record<string, Entry>;
  timer: TimerDoc;
  settings: SettingsDoc;
}
type Kind = 'task' | 'card' | 'entry' | 'timer' | 'settings';
interface Pending { kind: Kind; id: string; op: 'put' | 'delete'; data?: unknown; updatedAt: number }
export interface SyncStatus { pending: number; syncing: boolean; error: string | null; lastSync: number | null }

const KEY = 'track_state_v1';

const emptyState = (): TrackState => ({
  tasks: {}, cards: {}, entries: {},
  timer: { timer: null, block: { acc: 0, since: null }, brk: null, updatedAt: 0 },
  settings: { focus: 25, brk: 5, days: {}, updatedAt: 0 },
});

let state: TrackState = emptyState();
let dead: Record<string, number> = {};          // "<kind>#<id>" -> when it was deleted
let pending: Record<string, Pending> = {};
let status: SyncStatus = { pending: 0, syncing: false, error: null, lastSync: null };
let statusSnap: SyncStatus = status;
const listeners = new Set<() => void>();

try {
  const s = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (s?.state) {
    const base = emptyState();
    state = { ...base, ...s.state, timer: { ...base.timer, ...s.state.timer }, settings: { ...base.settings, ...s.state.settings } };
    dead = s.dead || {};
    pending = s.pending || {};
  }
} catch { /* start empty */ }

const persist = () => {
  try { localStorage.setItem(KEY, JSON.stringify({ state, dead, pending })); } catch { /* storage full or blocked: still in memory */ }
};
const emit = () => listeners.forEach(l => l());
const setStatus = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch, pending: Object.keys(pending).length };
  statusSnap = status;
  emit();
};
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export const useTrack = () => useSyncExternalStore(subscribe, () => state);
export const useTrackSync = () => useSyncExternalStore(subscribe, () => statusSnap);

const sk = (kind: Kind, id: string) => `${kind}#${id}`;
const now = () => Date.now();
export const uid = () => Math.random().toString(36).slice(2, 9) + now().toString(36).slice(-3);

function enqueue(p: Pending) {
  pending[sk(p.kind, p.id)] = p;
  persist();
  setStatus({});
  void syncSoon();
}

// --- writes ---
export function saveTask(t: Omit<Task, 'updatedAt'>) {
  const task = { ...t, updatedAt: now() };
  state = { ...state, tasks: { ...state.tasks, [t.id]: task } };
  delete dead[sk('task', t.id)];
  enqueue({ kind: 'task', id: t.id, op: 'put', data: task, updatedAt: task.updatedAt });
}
export function removeTask(id: string) {
  const { [id]: _gone, ...rest } = state.tasks;
  const at = now();
  state = { ...state, tasks: rest };
  dead[sk('task', id)] = at;
  enqueue({ kind: 'task', id, op: 'delete', updatedAt: at });
  if (state.cards['c_' + id]) removeCard('c_' + id);      // the card that was made for this task goes with it
}
export function saveCard(c: Omit<Card, 'updatedAt'>) {
  const card = { ...c, updatedAt: now() };
  state = { ...state, cards: { ...state.cards, [c.id]: card } };
  delete dead[sk('card', c.id)];
  enqueue({ kind: 'card', id: c.id, op: 'put', data: card, updatedAt: card.updatedAt });
}
export function removeCard(id: string) {
  const gone = state.cards[id];
  const { [id]: _gone, ...rest } = state.cards;
  const at = now();
  state = { ...state, cards: rest };
  dead[sk('card', id)] = at;
  enqueue({ kind: 'card', id, op: 'delete', updatedAt: at });
  // Deleting a card must not make adoptTasks() recreate it for the task it was linked to
  if (gone?.taskId && id !== 'c_' + gone.taskId) {
    dead[sk('card', 'c_' + gone.taskId)] = at;
    enqueue({ kind: 'card', id: 'c_' + gone.taskId, op: 'delete', updatedAt: at });
  }
}

// Every task gets a board card (id "c_<taskId>", so two devices make the same one). Open tasks go to
// "Next up", done ones to "Done". Tasks that are a card's subtask, or already have a card, are skipped.
export function adoptTasks(laneIds: string[]) {
  if (!laneIds.length) return;
  const cards = Object.values(state.cards);
  const taken = new Set<string>();
  cards.forEach(c => { if (c.taskId) taken.add(c.taskId); (c.subs ?? []).forEach(x => { if (x.taskId) taken.add(x.taskId); }); });
  const tail: Record<string, number> = {};
  cards.forEach(c => { tail[c.lane] = Math.max(tail[c.lane] ?? 0, c.pos); });
  const todo = laneIds.includes('next') ? 'next' : laneIds[0];
  const done = laneIds.includes('done') ? 'done' : laneIds[laneIds.length - 1];
  const fresh = Object.values(state.tasks).filter(t => !taken.has(t.id) && !state.cards['c_' + t.id] && !dead[sk('card', 'c_' + t.id)]);
  fresh.sort((a, b) => (a.done !== b.done ? (a.done ? 1 : -1) : a.done ? (b.doneAt || 0) - (a.doneAt || 0) : (a.due || '9').localeCompare(b.due || '9')));
  for (const t of fresh) {
    const lane = t.done ? done : todo;
    tail[lane] = (tail[lane] ?? 0) + 1;
    saveCard({ id: 'c_' + t.id, text: t.title, lane, pos: tail[lane], cat: t.cat, taskId: t.id });
  }
}
export function saveEntry(e: Omit<Entry, 'updatedAt'>) {
  const entry = { ...e, updatedAt: now() };
  state = { ...state, entries: { ...state.entries, [e.id]: entry } };
  enqueue({ kind: 'entry', id: e.id, op: 'put', data: entry, updatedAt: entry.updatedAt });
}
export function removeEntry(id: string) {
  const { [id]: _gone, ...rest } = state.entries;
  const at = now();
  state = { ...state, entries: rest };
  dead[sk('entry', id)] = at;
  enqueue({ kind: 'entry', id, op: 'delete', updatedAt: at });
}
export function saveTimer(patch: Partial<Omit<TimerDoc, 'updatedAt'>>) {
  // Any change made here clears the phone's "paused by" mark
  const doc = { ...state.timer, pausedBy: undefined, ...patch, updatedAt: now() };
  state = { ...state, timer: doc };
  enqueue({ kind: 'timer', id: 'active', op: 'put', data: doc, updatedAt: doc.updatedAt });
}
export function saveSettings(patch: Partial<Omit<SettingsDoc, 'updatedAt'>>) {
  const doc = { ...state.settings, ...patch, updatedAt: now() };
  state = { ...state, settings: doc };
  enqueue({ kind: 'settings', id: 'main', op: 'put', data: doc, updatedAt: doc.updatedAt });
}

// --- sync ---
interface Remote { kind: Kind; id: string; data?: any; deleted?: boolean; updatedAt: number }

function localStamp(kind: Kind, id: string): number | undefined {
  if (kind === 'task') return state.tasks[id]?.updatedAt;
  if (kind === 'card') return state.cards[id]?.updatedAt;
  if (kind === 'entry') return state.entries[id]?.updatedAt;
  if (kind === 'timer') return state.timer.updatedAt || undefined;
  return state.settings.updatedAt || undefined;
}

function applyRemote(items: Remote[]) {
  let next = state;
  for (const r of items) {
    const key = sk(r.kind, r.id);
    if (pending[key] && pending[key].updatedAt >= r.updatedAt) continue;     // our newer change is still waiting to go out
    const mine = Math.max(localStamp(r.kind, r.id) ?? -1, dead[key] ?? -1);
    if (mine >= r.updatedAt) continue;
    if (r.deleted) {
      dead[key] = r.updatedAt;
      if (r.kind === 'task') { const { [r.id]: _g, ...rest } = next.tasks; next = { ...next, tasks: rest }; }
      if (r.kind === 'card') { const { [r.id]: _g, ...rest } = next.cards; next = { ...next, cards: rest }; }
      if (r.kind === 'entry') { const { [r.id]: _g, ...rest } = next.entries; next = { ...next, entries: rest }; }
    } else if (r.data) {
      delete dead[key];
      const val = { ...r.data, updatedAt: r.updatedAt };
      if (r.kind === 'task') next = { ...next, tasks: { ...next.tasks, [r.id]: { ...val, id: r.id } } };
      if (r.kind === 'card') next = { ...next, cards: { ...next.cards, [r.id]: { ...val, id: r.id } } };
      if (r.kind === 'entry') next = { ...next, entries: { ...next.entries, [r.id]: { ...val, id: r.id } } };
      if (r.kind === 'timer') next = { ...next, timer: { ...emptyState().timer, ...val } };
      if (r.kind === 'settings') next = { ...next, settings: { ...emptyState().settings, ...val } };
    }
  }
  if (next !== state) { state = next; persist(); emit(); }
}

let syncing = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function syncSoon() {
  if (!started) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void syncNow(); }, 600);
}

export async function syncNow(): Promise<void> {
  if (!started || syncing) return;
  syncing = true;
  setStatus({ syncing: true, error: null });
  try {
    for (const [key, p] of Object.entries({ ...pending })) {
      if (p.op === 'put') await apiService.putTrack(p.kind, p.id, p.data, p.updatedAt);
      else await apiService.deleteTrack(p.kind, p.id, p.updatedAt);
      if (pending[key]?.updatedAt === p.updatedAt) delete pending[key];   // keep it if a newer change arrived meanwhile
      persist();
    }
    applyRemote(await apiService.fetchTrack());
    setStatus({ syncing: false, lastSync: now() });
  } catch (e: any) {
    setStatus({ syncing: false, error: navigator.onLine ? (e?.message || 'Sync failed') : 'Offline' });
  } finally {
    syncing = false;
  }
}

// Start syncing (owner only). Returns a function that stops it.
export function startSync(): () => void {
  started = true;
  void syncNow();
  // While the timer is running, check every 5 s so a pause from the phone shows up quickly; otherwise every 30 s
  let beat = 0;
  const poll = setInterval(() => {
    beat++;
    const running = !!state.timer.timer?.since;
    if (document.visibilityState === 'visible' && (running || beat % 6 === 0)) void syncNow();
  }, 5000);
  const wake = () => { if (document.visibilityState === 'visible') void syncNow(); };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
  return () => {
    started = false;
    clearInterval(poll);
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('online', wake);
    if (timer) clearTimeout(timer);
  };
}
