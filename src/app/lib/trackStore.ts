import { useSyncExternalStore } from 'react';
import { apiService } from '../../apiService';

// Time tracker data. Everything is saved in localStorage first, so the timer responds instantly and
// works offline. Each task, time entry, the running timer and the settings is one item in the cloud
// (TrackerItems table). Last write wins per item, compared by updatedAt. A delete leaves a tombstone
// so a device with an old copy cannot bring the item back.

export type Cat = 'work' | 'learn' | 'life';
// A subtask is a normal task with epicId set to its epic card (it shows on the Tasks page and Calendar like any task, grouped under the epic on the Board). ord keeps their order inside the epic.
export interface Task { id: string; title: string; cat: Cat; pts: number; due: string; done: boolean; doneAt?: number | null; epicId?: string; ord?: number; updatedAt: number }   // points come from tracked time (1 per 10 min), pts is unused
// Board: sticky-note cards in swim lanes. A card can be linked to a task so it shows on the task list.
// Legacy: subtasks used to live inside the card. migrateSubs() turns them into tasks and clears this.
export interface Sub { id: string; text: string; done: boolean; taskId?: string | null }
export interface Card { id: string; text: string; lane: string; pos: number; cat: Cat; taskId?: string | null; subs?: Sub[]; epic?: boolean; due?: string; done?: boolean; updatedAt: number }   // done: only for epics (a task keeps its own done)   // due: only used while the card has no linked task (a task keeps its own due date)
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
// An outing: a stretch of time away from home, reported by the phone app (geofence or Timeline import).
// 'new' waits in the Tasks tab inbox; 'used' became time on a task; 'dismissed' was ignored.
export interface Outing { id: string; start: number; end: number; source: string; status: 'new' | 'used' | 'dismissed'; updatedAt: number }
export interface TrackState {
  tasks: Record<string, Task>;
  outings: Record<string, Outing>;
  cards: Record<string, Card>;
  entries: Record<string, Entry>;
  timer: TimerDoc;
  settings: SettingsDoc;
}
type Kind = 'task' | 'card' | 'entry' | 'timer' | 'settings' | 'outing';
interface Pending { kind: Kind; id: string; op: 'put' | 'delete'; data?: unknown; updatedAt: number }
export interface SyncStatus { pending: number; syncing: boolean; error: string | null; lastSync: number | null }

const KEY = 'track_state_v1';

const emptyState = (): TrackState => ({
  tasks: {}, cards: {}, entries: {}, outings: {},
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
// Names: a task, its board card (and epic subtasks that are tasks) share one title, so it is changed in one place and
// the others follow. A card's text may have extra lines; only the first line is the title.
const firstLine = (t: string) => (t.split('\n')[0] || 'Untitled').slice(0, 120);

export function renameTask(id: string, title: string) {
  const t = state.tasks[id];
  title = title.trim().slice(0, 120);
  if (!t || !title || title === t.title) return;
  saveTask({ ...t, title });
  for (const c of Object.values(state.cards)) {
    const hasSub = (c.subs ?? []).some(x => x.taskId === id);
    if (c.taskId !== id && !hasSub) continue;
    const next: Card = { ...c };
    if (c.taskId === id) next.text = [title, ...c.text.split('\n').slice(1)].join('\n');
    if (hasSub) next.subs = (c.subs ?? []).map(x => (x.taskId === id ? { ...x, text: title } : x));
    saveCard(next);
  }
}

export function renameCard(c: Card, text: string) {
  text = text.trim();
  if (!text || text === c.text) return;
  saveCard({ ...c, text });
  const title = firstLine(text);
  const t = c.taskId ? state.tasks[c.taskId] : undefined;
  if (t) { if (t.title !== title) saveTask({ ...t, title }); return; }
  // A card tracked on its own: its time entries and a running timer carry the name, so they follow
  for (const e of Object.values(state.entries)) if (e.taskId === c.id && e.note !== title) saveEntry({ ...e, note: title });
  const seg = state.timer.timer;
  if (seg && seg.taskId === c.id && seg.note !== title) saveTimer({ timer: { ...seg, note: title } });
}

export function renameSub(card: Card, subId: string, text: string) {
  text = text.trim();
  const sub = (card.subs ?? []).find(x => x.id === subId);
  if (!sub || !text || text === sub.text) return;
  if (sub.taskId && state.tasks[sub.taskId]) { renameTask(sub.taskId, text); return; }
  saveCard({ ...card, subs: (card.subs ?? []).map(x => (x.id === subId ? { ...x, text } : x)) });
}

export const NEXT_CAT: Record<Cat, Cat> = { work: 'learn', learn: 'life', life: 'work' };

// Change an activity's category after the fact. An activity is a task (or board card id) or a typed label. The change
// covers everything that belongs to it, so the Stats totals follow: its past time entries, its task and its board cards.
export function setActivityCat(ref: { taskId?: string | null; note?: string }, cat: Cat) {
  const key = (t?: string | null, n?: string) => (t ? t : 'n:' + ((n || '').trim().toLowerCase() || 'untitled'));
  const k = key(ref.taskId, ref.note);
  for (const e of Object.values(state.entries)) if (key(e.taskId, e.note) === k && e.cat !== cat) saveEntry({ ...e, cat });
  if (!ref.taskId) return;
  const t = state.tasks[ref.taskId];
  if (t && t.cat !== cat) saveTask({ ...t, cat });
  for (const c of Object.values(state.cards)) if ((c.taskId === ref.taskId || c.id === ref.taskId) && c.cat !== cat) saveCard({ ...c, cat });
}

// Tick a task off (or reopen it) and move its board card to match: done -> top of the Done lane, reopened -> Next up
export function toggleTaskDone(t: Task) {
  const done = !t.done;
  saveTask({ ...t, done, doneAt: done ? now() : null });
  const laneIds = (state.settings.lanes?.length ? state.settings.lanes : DEFAULT_LANES).map(l => l.id);
  const doneLane = laneIds.includes('done') ? 'done' : laneIds[laneIds.length - 1];
  const todoLane = laneIds.includes('next') ? 'next' : laneIds[0];
  for (const c of Object.values(state.cards)) {
    if (c.taskId !== t.id) continue;
    const inLane = (l: string) => Object.values(state.cards).filter(x => x.lane === l && x.id !== c.id).map(x => x.pos);
    if (done && c.lane !== doneLane) saveCard({ ...c, lane: doneLane, pos: Math.min(1, ...inLane(doneLane)) - 1 });
    else if (!done && c.lane === doneLane) saveCard({ ...c, lane: todoLane, pos: Math.max(0, ...inLane(todoLane)) + 1 });
  }
}
// Time shorter than this is an accidental start/stop: it is not saved, and not listed in Stats
export const MIN_ENTRY_MS = 30000;
export const MIN_LISTED_MS = 60000;

// Clean-up of accidental start/stop entries saved before the minimum existed. Runs after the first sync of a session.
export function pruneTinyEntries() {
  Object.values(state.entries).filter(e => e.end - e.start < MIN_ENTRY_MS).forEach(e => removeEntry(e.id));
}

export function removeTask(id: string) {
  const { [id]: _gone, ...rest } = state.tasks;
  const at = now();
  state = { ...state, tasks: rest };
  dead[sk('task', id)] = at;
  enqueue({ kind: 'task', id, op: 'delete', updatedAt: at });
  if (state.cards['c_' + id]) removeCard('c_' + id);      // the card that was made for this task goes with it
  // A task made by accident usually has a few seconds of tracked time: those go with it. Real time (a minute or more) is kept.
  const mine = Object.values(state.entries).filter(e => e.taskId === id);
  if (mine.length && mine.reduce((a, e) => a + (e.end - e.start), 0) < MIN_LISTED_MS) mine.forEach(e => removeEntry(e.id));
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

// A task can be ticked somewhere that cannot move cards (the phone widget). When the board opens, move the card of any
// task that was completed after the card was last touched. Cards you dragged out of Done afterwards stay where you put them.
export function settleDoneTasks(laneIds: string[]) {
  if (!laneIds.length) return;
  const doneLane = laneIds.includes('done') ? 'done' : laneIds[laneIds.length - 1];
  for (const c of Object.values(state.cards)) {
    const t = c.taskId ? state.tasks[c.taskId] : undefined;
    if (!t?.done || !t.doneAt || c.lane === doneLane || t.doneAt <= c.updatedAt) continue;
    const top = Math.min(1, ...Object.values(state.cards).filter(x => x.lane === doneLane).map(x => x.pos));
    saveCard({ ...c, lane: doneLane, pos: top - 1 });
  }
}

// Every task gets a board card (id "c_<taskId>", so two devices make the same one). Open tasks go to
// "Next up", done ones to "Done". Tasks that are a card's subtask, or already have a card, are skipped.
// ---- epics and tasks ----
// An epic is a board card with epic = true and NO task of its own: it lives on the Board and its subtasks (tasks with
// epicId = the card) show it as their parent. Its own time and done state live on the card. Converting between the two
// moves everything across, so no tracked time is lost.
export const currentLaneIds = () => (state.settings.lanes?.length ? state.settings.lanes : DEFAULT_LANES).map(l => l.id);
export const doneLaneId = (ids = currentLaneIds()) => (ids.includes('done') ? 'done' : ids[ids.length - 1]);
export const todoLaneId = (ids = currentLaneIds()) => (ids.includes('next') ? 'next' : ids[0]);
export const isEpic = (c: Card) => c.epic ?? Object.values(state.tasks).some(t => t.epicId === c.id);

function dropTask(id: string) {       // remove the task item only (its card and time are handled by the caller)
  const { [id]: _g, ...rest } = state.tasks;
  const at = now();
  state = { ...state, tasks: rest };
  dead[sk('task', id)] = at;
  enqueue({ kind: 'task', id, op: 'delete', updatedAt: at });
}
function moveTime(from: string, to: string) {       // entries and a running timer follow when the activity id changes
  for (const e of Object.values(state.entries)) if (e.taskId === from) saveEntry({ ...e, taskId: to });
  const seg = state.timer.timer;
  if (seg && seg.taskId === from) saveTimer({ timer: { ...seg, taskId: to } });
}
const laneBottom = (lane: string) => Math.max(0, ...Object.values(state.cards).filter(x => x.lane === lane).map(x => x.pos)) + 1;
const laneTop = (lane: string) => Math.min(1, ...Object.values(state.cards).filter(x => x.lane === lane).map(x => x.pos)) - 1;

/** Task card -> epic: the task disappears from the Tasks page; its due date, category, done state and time go to the card. */
export function convertToEpic(cardId: string) {
  const c = state.cards[cardId];
  if (!c) return;
  const t = c.taskId ? state.tasks[c.taskId] : undefined;
  if (t) { moveTime(t.id, c.id); dropTask(t.id); }
  saveCard({ ...c, epic: true, taskId: null, cat: t?.cat ?? c.cat, due: t ? t.due : c.due, done: t ? t.done : c.done });
}

/** Epic -> task card: the card gets a task of its own again, and every subtask becomes a free (epicless) task with its own card. */
export function convertToTask(cardId: string) {
  const c = state.cards[cardId];
  if (!c) return;
  const done = !!c.done;
  const ids = currentLaneIds();
  Object.values(state.tasks).filter(t => t.epicId === c.id).sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)).forEach((k, i) => {
    saveTask({ ...k, epicId: undefined, ord: undefined });
    if (!state.cards['c_' + k.id]) saveCard({ id: 'c_' + k.id, text: k.title, lane: k.done ? doneLaneId(ids) : c.lane, pos: c.pos + (i + 1) / 1000, cat: k.cat, taskId: k.id });
  });
  const id = uid();
  saveTask({ id, title: firstLine(c.text), cat: c.cat, pts: 10, due: c.due ?? '', done, doneAt: done ? now() : null });
  moveTime(c.id, id);
  saveCard({ ...c, epic: false, taskId: id, due: undefined, done: undefined });
}

/** Turn a task into an epic from anywhere (the Tasks page too): finds or makes its card first. */
export function convertTaskToEpic(taskId: string) {
  const t = state.tasks[taskId];
  if (!t || t.epicId) return;
  let c = Object.values(state.cards).find(x => x.taskId === taskId);
  if (!c) { adoptTasks(currentLaneIds()); c = Object.values(state.cards).find(x => x.taskId === taskId); }
  if (c) convertToEpic(c.id);
}

/** Drop a free task (or a plain card) into an epic: it becomes one of its subtasks and its own board card goes away. */
export function moveIntoEpic(cardId: string, epicId: string) {
  const c = state.cards[cardId], e = state.cards[epicId];
  if (!c || !e || c.id === e.id) return;
  let t = c.taskId ? state.tasks[c.taskId] : undefined;
  if (!t) {                                   // a jotted card with no task yet: make the task now
    const id = uid();
    saveTask({ id, title: firstLine(c.text), cat: c.cat, pts: 10, due: c.due ?? '', done: false });
    moveTime(c.id, id);
    t = state.tasks[id];
  }
  saveTask({ ...t, epicId, ord: now() });
  removeCard(c.id);
}

/** A subtask becomes a free task again (it gets its own board card next to the epic). */
export function detachSubtask(taskId: string) {
  const t = state.tasks[taskId];
  if (!t?.epicId) return;
  const epic = state.cards[t.epicId];
  saveTask({ ...t, epicId: undefined, ord: undefined });
  const ids = currentLaneIds();
  if (!state.cards['c_' + t.id]) saveCard({ id: 'c_' + t.id, text: t.title, lane: t.done ? doneLaneId(ids) : epic?.lane ?? todoLaneId(ids), pos: (epic?.pos ?? 0) + 0.5, cat: t.cat, taskId: t.id });
}

/** Check or uncheck an epic: its subtasks follow when checking, and the card moves to Done (or back to Next up). */
export function setEpicDone(cardId: string, done: boolean, tick: (t: Task) => void = toggleTaskDone) {
  const c = state.cards[cardId];
  if (!c) return;
  if (done) Object.values(state.tasks).filter(t => t.epicId === cardId && !t.done).forEach(tick);
  const ids = currentLaneIds(), dl = doneLaneId(ids);
  const lane = done ? dl : c.lane === dl ? todoLaneId(ids) : c.lane;
  saveCard({ ...c, done, lane, pos: lane === c.lane ? c.pos : done ? laneTop(lane) : laneBottom(lane) });
}

export function addSubtask(epic: Card, title: string) {
  title = title.trim().slice(0, 120);
  if (!title) return;
  saveTask({ id: uid(), title, cat: epic.cat, pts: 10, due: '', done: false, epicId: epic.id, ord: now() });
}

// One-off conversion of old in-card subtasks into real tasks (same ids on every device, so it is safe to run anywhere, repeatedly)
export function migrateSubs() {
  for (const c of Object.values(state.cards)) {
    const subs = c.subs ?? [];
    if (!subs.length) continue;
    subs.forEach((x, i) => {
      const id = x.taskId && state.tasks[x.taskId] ? x.taskId : 's_' + x.id;
      const t = state.tasks[id];
      if (t) { if (t.epicId !== c.id) saveTask({ ...t, epicId: c.id, ord: t.ord ?? c.updatedAt + i }); }
      else if (!dead[sk('task', id)]) saveTask({ id, title: x.text, cat: c.cat, pts: 10, due: '', done: x.done, doneAt: x.done ? now() : null, epicId: c.id, ord: c.updatedAt + i });
    });
    saveCard({ ...c, subs: undefined, epic: true });
  }
  // Older data: an epic that still has a task item of its own becomes a pure epic, like every other epic
  for (const c of Object.values(state.cards)) if (c.taskId && state.tasks[c.taskId] && isEpic(c)) convertToEpic(c.id);
}

export function adoptTasks(laneIds: string[]) {
  if (!laneIds.length) return;
  const cards = Object.values(state.cards);
  const taken = new Set<string>();
  cards.forEach(c => { if (c.taskId) taken.add(c.taskId); (c.subs ?? []).forEach(x => { if (x.taskId) taken.add(x.taskId); }); });
  const tail: Record<string, number> = {};
  cards.forEach(c => { tail[c.lane] = Math.max(tail[c.lane] ?? 0, c.pos); });
  const todo = laneIds.includes('next') ? 'next' : laneIds[0];
  const done = laneIds.includes('done') ? 'done' : laneIds[laneIds.length - 1];
  const fresh = Object.values(state.tasks).filter(t => !taken.has(t.id) && !(t.epicId && state.cards[t.epicId]) && !state.cards['c_' + t.id] && !dead[sk('card', 'c_' + t.id)]);   // subtasks live inside their epic
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
export function saveOuting(o: Omit<Outing, 'updatedAt'>) {
  const outing = { ...o, updatedAt: now() };
  state = { ...state, outings: { ...state.outings, [o.id]: outing } };
  enqueue({ kind: 'outing', id: o.id, op: 'put', data: outing, updatedAt: outing.updatedAt });
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
  if (kind === 'outing') return state.outings[id]?.updatedAt;
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
      if (r.kind === 'outing') { const { [r.id]: _g, ...rest } = next.outings; next = { ...next, outings: rest }; }
    } else if (r.data) {
      delete dead[key];
      const val = { ...r.data, updatedAt: r.updatedAt };
      if (r.kind === 'task') next = { ...next, tasks: { ...next.tasks, [r.id]: { ...val, id: r.id } } };
      if (r.kind === 'card') next = { ...next, cards: { ...next.cards, [r.id]: { ...val, id: r.id } } };
      if (r.kind === 'entry') next = { ...next, entries: { ...next.entries, [r.id]: { ...val, id: r.id } } };
      if (r.kind === 'outing') next = { ...next, outings: { ...next.outings, [r.id]: { ...val, id: r.id } } };
      if (r.kind === 'timer') next = { ...next, timer: { ...emptyState().timer, ...val } };
      if (r.kind === 'settings') next = { ...next, settings: { ...emptyState().settings, ...val } };
    }
  }
  if (next !== state) { state = next; persist(); emit(); }
}

let syncing = false;
let pruned = false;
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
    if (!pruned) { pruned = true; pruneTinyEntries(); migrateSubs(); }
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
