import { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, StickyNote, Check, Plus, Trash2, X, Cloud, CloudOff, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { mediaFor, displayName } from '../lib/exerciseMedia';
import { FitnessRow, MainLiftPlan, AccessoryOption, LoggedSet, parseSets, localToday } from '../lib/gymPlan';
import { RestBar } from './RestBar';
import { setRest, startRest } from '../lib/restTimer';
import { NoteHistory, pastNotes } from './ExerciseNotes';
import { DraftSet, SetType, buildPayload, flushLogs, getSyncStatus, queueLog, subscribeSync } from '../lib/offlineLog';

// Jefit-style logging: every set (warm-ups, top set, back-offs, accessories) is a row you can edit.
// Tick a set to log it and start the rest timer. Each tick saves to the cloud right away; with no
// signal it is kept on the phone (see offlineLog.ts) and sent later.

type PlanItem = MainLiftPlan | AccessoryOption[] | null;

interface Block {
  key: string;
  isMain: boolean;
  isPullUp: boolean;
  options?: AccessoryOption[];
  extra?: boolean;
  names: string[]; // names this block can be logged under (swap options)
  rest: (sets: DraftSet[], i: number) => number;
  hint: string;
}
// base = sets for this exercise already logged today by another session (kept, never shown as ticked)
interface Draft { name: string; sets: DraftSet[]; base: DraftSet[]; baseRaw?: string; baseTypes?: string; note: string; baseNote?: string }
type Drafts = Record<string, Draft>;

// Notes are saved by the backend (POST /fitness `notes`, applied in my-aws-environment#21).
const NOTES_ENABLED = true;
const SESSION_KEY = 'peak_active_session';
const TYPE_ORDER: SetType[] = ['warm-up', 'default', 'drop', 'failure'];
const PLATES = [45, 35, 25, 10, 5, 2.5];

const restSecs = (label: string) => {
  const n = (label.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (!n.length) return 90;
  const avg = n.reduce((a, b) => a + b, 0) / n.length;
  return Math.round(/min/i.test(label) ? avg * 60 : avg);
};
const clock = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, Math.floor(sec) % 60)).padStart(2, '0')}`;
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

// 45 lb bar + pairs of plates (smallest 2.5 lb, so totals go in 5 lb steps). A weight the plates can't
// make (e.g. 114) is shown as the closest loadable weight (115) instead of silently dropping the remainder.
function platesPerSide(lb: number) {
  const loadable = Math.round(lb / 5) * 5;
  let left = (loadable - 45) / 2;
  if (left <= 0) return 'bar only';
  const out: number[] = [];
  for (const p of PLATES) while (left >= p - 0.001) { out.push(p); left -= p; }
  return `${loadable === lb ? '' : `${loadable} lb: `}${out.join(' · ')} /side`;
}

function SyncPill() {
  const [, tick] = useState(0);
  useEffect(() => subscribeSync(() => tick(n => n + 1)), []);
  const s = getSyncStatus();
  if (s.syncing) return <span className="flex items-center gap-1 text-xs text-zinc-400"><Loader2 size={13} className="animate-spin" /> Saving…</span>;
  if (s.pending) return <button onClick={() => void flushLogs()} className="flex items-center gap-1 text-xs text-amber-300 cursor-pointer"><CloudOff size={13} /> {s.pending} waiting to sync{s.error ? ` · ${s.error}` : ''}</button>;
  return <span className="flex items-center gap-1 text-xs text-emerald-300"><Cloud size={13} /> Saved</span>;
}
export { SyncPill };

export function WorkoutSession({ dayId, dayName, plans, extraNames, history, bodyWeightLb, onExit, onFinished, historyOpen, onHistory }: {
  dayId: string;
  dayName: string;
  plans: PlanItem[];
  extraNames: string[]; // exercises you can add on top of the plan
  history: Record<string, FitnessRow[]>;
  bodyWeightLb: number;
  onExit: () => void;
  onFinished: () => void;
  historyOpen: string | null; // exercise whose graph is open, if any
  onHistory: (name: string | null) => void;
}) {
  const today = localToday();

  const saved = useMemo(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return s && s.v === 2 && s.date === today && s.dayId === dayId ? s : null;
    } catch { return null; }
  }, [today, dayId]);

  const [startedAt] = useState<number>(saved?.startedAt ?? Date.now());
  const [extras, setExtras] = useState<string[]>(saved?.extras ?? []);

  const toAdded = (lb: number, isPullUp: boolean) => (isPullUp ? Math.max(0, Math.round(lb - bodyWeightLb)) : lb);

  // What each block is, and how to pre-fill it
  const blocks = useMemo<Block[]>(() => {
    const out: Block[] = [];
    plans.forEach((p, i) => {
      if (p === null) return;
      if (Array.isArray(p)) {
        out.push({
          key: String(i), isMain: false, isPullUp: false, options: p, names: p.map(o => o.plan.name),
          rest: () => p[0].plan.restSec, hint: `${p[0].plan.sets} sets · ${p[0].plan.repLow}–${p[0].plan.repHigh} reps`,
        });
      } else {
        const firstWork = p.warmups.length;
        out.push({
          key: String(i), isMain: true, isPullUp: p.isPullUp, names: [p.name],
          hint: `Top set ${p.isPullUp ? '+' : ''}${toAdded(p.top.lb, p.isPullUp)} lb × ${p.top.reps}`,
          rest: (sets, idx) => {
            const t = sets[idx]?.type;
            if (t === 'warm-up') return restSecs(sets[idx + 1]?.type === 'warm-up' ? p.rest.warmups : p.rest.toTop);
            return restSecs(idx === firstWork ? p.rest.toBackoff : p.rest.backoffs);
          },
        });
      }
    });
    extras.forEach(name => out.push({ key: `x:${name}`, isMain: false, isPullUp: false, extra: true, names: [name], rest: () => 90, hint: 'Added exercise' }));
    return out;
  }, [plans, extras, bodyWeightLb]);

  const lastRows = (name: string) =>
    (history[name] || []).filter(r => /^\d{4}-/.test(r.workout_date) && r.workout_date.slice(0, 10) < today)
      .sort((a, b) => a.workout_date.localeCompare(b.workout_date)).pop();

  const fromRow = (row: FitnessRow, isPullUp: boolean): DraftSet[] => {
    const types = row.set_types ? row.set_types.split(',') : [];
    const sets = parseSets(row);
    const maxLb = Math.max(0, ...sets.map(s => s.lb));
    return sets.map((s, i) => ({
      lb: isPullUp ? (s.lb >= bodyWeightLb * 0.6 ? Math.round(s.lb - bodyWeightLb) : Math.round(s.lb)) : Math.round(s.lb * 10) / 10,
      reps: s.reps,
      type: ((types[i] as SetType) || (row.set_types || s.lb >= maxLb * 0.75 ? 'default' : 'warm-up')) as SetType,
      done: true,
    }));
  };

  const initial = (b: Block, name: string): DraftSet[] => {
    const mk = (lb: number, reps: number, type: SetType): DraftSet => ({ lb, reps, type, done: false });
    const idx = plans.findIndex((_, i) => String(i) === b.key);
    const p = idx >= 0 ? plans[idx] : null;
    if (p && !Array.isArray(p)) {
      return [
        ...p.warmups.map(w => mk(toAdded(w.lb, p.isPullUp), w.reps, 'warm-up')),
        mk(toAdded(p.top.lb, p.isPullUp), p.top.reps, 'default'),
        ...Array.from({ length: p.backoff.sets }, () => mk(toAdded(p.backoff.lb, p.isPullUp), p.backoff.reps, 'default')),
      ];
    }
    if (b.options) {
      const o = b.options.find(x => x.plan.name === name) ?? b.options[0];
      const pl = o.plan;
      return Array.from({ length: pl.sets }, (_, i) => mk(pl.lb ?? 0, pl.last?.sets[i]?.reps ?? pl.repLow, 'default'));
    }
    const last = lastRows(name);
    const ls = last ? parseSets(last).filter(s => s.lb > 0) : [];
    return (ls.length ? ls.slice(-3) : [{ lb: 0, reps: 10 } as LoggedSet, { lb: 0, reps: 10 } as LoggedSet, { lb: 0, reps: 10 } as LoggedSet])
      .map(s => mk(Math.round(s.lb * 10) / 10, s.reps, 'default'));
  };

  // Sets logged earlier today (by an earlier session) for the same exercise
  const baseFor = (b: Block, name: string): DraftSet[] => {
    const row = (history[name] || []).find(r => r.workout_date.slice(0, 10) === today);
    return row ? fromRow(row, b.isPullUp) : [];
  };
  const makeDraft = (b: Block, name: string): Draft => {
    const row = (history[name] || []).find(r => r.workout_date.slice(0, 10) === today);
    // Sets already saved today come back as ticked (green) rows at the top, and the plan fills in the sets still to do
    const done = baseFor(b, name);
    return { name, sets: [...done, ...initial(b, name).slice(done.length)], base: [], note: '', baseNote: row?.notes };
  };

  const defaultName = (b: Block) => {
    if (!b.options) return b.names[0];
    // opens on the option done most recently, like the plan page
    const start = b.options.reduce((best, o, i) => ((o.lastDate ?? '') > (b.options![best].lastDate ?? '') ? i : best), 0);
    return b.options[start].plan.name;
  };

  const [drafts, setDrafts] = useState<Drafts>(() => {
    const d: Drafts = {};
    blocks.forEach(b => {
      const sv: Draft | undefined = saved?.drafts?.[b.key];
      const name = sv && b.names.includes(sv.name) ? sv.name : defaultName(b);
      d[b.key] = sv && b.names.includes(sv.name) ? { ...sv, base: sv.base ?? [], note: sv.note ?? '' } : makeDraft(b, name);
    });
    return d;
  });

  // Blocks added later (extra exercises) get drafts on first render
  const draftOf = (b: Block): Draft => drafts[b.key] ?? makeDraft(b, defaultName(b));

  const patch = (b: Block, fn: (d: Draft) => Draft) =>
    setDrafts(cur => ({ ...cur, [b.key]: fn(cur[b.key] ?? makeDraft(b, defaultName(b))) }));

  // --- session clock (the rest timer lives in lib/restTimer so it survives leaving this screen) ---
  const [now, setNow] = useState(Date.now());
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  // keep the screen on while logging
  useEffect(() => {
    let lock: any = null;
    (async () => { try { lock = await (navigator as any).wakeLock?.request('screen'); } catch { /* denied */ } })();
    return () => { try { lock?.release(); } catch { /* ignore */ } };
  }, []);

  // --- save: to the phone immediately, to the cloud on every change ---
  const lastSent = useRef<Record<string, string>>({});
  useEffect(() => {
    const t = setTimeout(() => {
      // Never replace a draft that has ticked sets with an empty one (opening a different day would wipe it)
      try {
        const anyDone = Object.values(drafts).some(d => d.sets.some(x => x.done));
        if (anyDone || !localStorage.getItem(SESSION_KEY)) localStorage.setItem(SESSION_KEY, JSON.stringify({ v: 2, date: today, dayId, startedAt, extras, drafts }));
      } catch { /* ignore */ }
      blocks.forEach(b => {
        const d = drafts[b.key];
        if (!d || !d.sets.some(x => x.done)) return; // nothing ticked in THIS session: leave earlier rows alone
        const payload = buildPayload(d.name, today, d.sets, { isPullUp: b.isPullUp, bodyWeightLb, base: d.base, baseRaw: d.baseRaw, baseTypes: d.baseTypes, notes: NOTES_ENABLED ? [d.baseNote, d.note].filter(x => x && x.trim()).join('\n') : undefined });
        if (!payload) return;
        const sig = JSON.stringify(payload);
        if (lastSent.current[b.key + d.name] === sig) return;
        lastSent.current[b.key + d.name] = sig;
        queueLog(payload);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [drafts, blocks, today, dayId, startedAt, extras, bodyWeightLb]);

  const setCell = (b: Block, i: number, p: Partial<DraftSet>) =>
    patch(b, d => ({ ...d, sets: d.sets.map((s, k) => (k === i ? { ...s, ...p } : s)) }));

  const toggleDone = (b: Block, i: number) => {
    const d = draftOf(b);
    const s = d.sets[i];
    if (!s.done) {
      if (!(s.reps > 0)) { toast.error('Enter the reps first.'); return; }
      startRest(b.rest(d.sets, i));
    }
    setCell(b, i, { done: !s.done });
  };

  const addSet = (b: Block) => patch(b, d => {
    const last = d.sets[d.sets.length - 1];
    return { ...d, sets: [...d.sets, { lb: last?.lb ?? 0, reps: last?.reps ?? 8, type: last?.type === 'warm-up' ? 'default' : last?.type ?? 'default', done: false }] };
  });
  const removeSet = (b: Block, i: number) => patch(b, d => ({ ...d, sets: d.sets.filter((_, k) => k !== i) }));
  const cycleType = (b: Block, i: number) => {
    const s = draftOf(b).sets[i];
    setCell(b, i, { type: TYPE_ORDER[(TYPE_ORDER.indexOf(s.type) + 1) % TYPE_ORDER.length] });
  };
  const swapOption = (b: Block, name: string) => {
    const d = draftOf(b);
    if (d.name === name) return;
    if (d.sets.some(s => s.done) && !window.confirm('Switching exercise clears the sets you ticked for this one. Continue?')) return;
    patch(b, () => makeDraft(b, name));
    if (historyOpen && b.names.includes(historyOpen)) onHistory(name);
  };

  const prevFor = (name: string, isPullUp: boolean) => {
    const row = lastRows(name);
    if (!row) return { warm: [] as DraftSet[], work: [] as DraftSet[] };
    const sets = fromRow(row, isPullUp);
    return { warm: sets.filter(s => s.type === 'warm-up'), work: sets.filter(s => s.type !== 'warm-up') };
  };

  // --- swipe between exercises: native scroll-snap, one exercise per screen ---
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const goTo = (i: number) => {
    const el = track.current;
    const n = Math.max(0, Math.min(blocks.length - 1, i));
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
    setPage(n);
  };
  const isComplete = (b: Block) => { const d = draftOf(b); return d.sets.length > 0 && d.sets.every(x => x.done); };
  // open on the first exercise that still has sets to do (e.g. after a refresh mid-workout)
  useEffect(() => {
    const first = blocks.findIndex(b => !isComplete(b));
    const el = track.current;
    if (el && first > 0) { el.scrollTo({ left: first * el.clientWidth }); setPage(first); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep an open graph on the exercise you are looking at
  useEffect(() => {
    const b = blocks[page];
    if (historyOpen && b) onHistory(draftOf(b).name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalDone = blocks.reduce((n, b) => n + draftOf(b).sets.filter(s => s.done).length, 0);

  const finish = async () => {
    if (!totalDone && !window.confirm('No sets are ticked. Leave without saving anything?')) return;
    const orphan = blocks.filter(b => { const d = draftOf(b); return d.note.trim() && !d.sets.some(x => x.done); }).length;
    if (orphan && !window.confirm(`${orphan} note${orphan > 1 ? 's' : ''} won't be saved: notes save with a ticked set for that exercise. Finish anyway?`)) return;
    await flushLogs();
    const left = getSyncStatus().pending;
    try { localStorage.removeItem(SESSION_KEY); localStorage.setItem('peak_finished_date', today); } catch { /* ignore */ }
    setRest(null);
    toast.success(left ? `${totalDone} sets saved on this phone. They'll sync when you're online.` : `${totalDone} sets saved.`);
    onFinished();
    onExit();
  };
  const discard = () => {
    if (totalDone && !window.confirm('Close without finishing? Sets you already ticked stay saved.')) return;
    onExit();
  };

  const addable = extraNames.filter(n => !blocks.some(b => b.names.includes(n)));
  const input = 'w-full min-w-0 rounded-md bg-black/30 border border-white/10 px-2 py-2 text-center font-mono text-base tabular-nums text-white outline-none focus:border-cyan-400/70';

  return (
    <div className="pb-40">
      <div className="sticky top-[3.4rem] z-20 -mx-5 px-5 lg:mx-0 lg:px-0 py-2 bg-[#0d0e10]/95 border-b border-white/[0.08] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-cyan-300 font-medium truncate">Workout · {dayName}</div>
          <div className="font-mono text-lg font-semibold tabular-nums text-white leading-tight">{clock((now - startedAt) / 1000)}</div>
        </div>
        <div className="flex items-center gap-3">
          <SyncPill />
          <button onClick={discard} aria-label="Close" className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"><X size={18} /></button>
          <button onClick={finish} style={{ color: '#0f172a' }} className="px-3 py-2 rounded-lg bg-cyan-400 text-sm font-semibold cursor-pointer">Finish</button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button onClick={() => goTo(page - 1)} disabled={page === 0} aria-label="Previous exercise"
          className="p-2 rounded-lg border border-white/10 text-zinc-300 disabled:opacity-30 cursor-pointer disabled:cursor-default"><ChevronLeft size={16} /></button>
        <div className="min-w-0 text-center">
          <div className="text-xs text-zinc-500">Exercise {Math.min(page + 1, blocks.length)} of {blocks.length} · swipe</div>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            {blocks.map((b, i) => (
              <button key={b.key} onClick={() => goTo(i)} aria-label={`Go to exercise ${i + 1}`} aria-current={i === page}
                className={`h-2 rounded-full cursor-pointer transition-all ${i === page ? 'w-5 bg-cyan-400' : isComplete(b) ? 'w-2 bg-emerald-400' : 'w-2 bg-white/20'}`} />
            ))}
          </div>
        </div>
        <button onClick={() => goTo(page + 1)} disabled={page >= blocks.length - 1} aria-label="Next exercise"
          className="p-2 rounded-lg border border-white/10 text-zinc-300 disabled:opacity-30 cursor-pointer disabled:cursor-default"><ChevronRight size={16} /></button>
      </div>

      <div
        ref={track}
        role="list"
        onScroll={e => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== page) setPage(i);
        }}
        className="mt-3 flex items-start overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {blocks.map((b, bi) => {
          const d = draftOf(b);
          const mm = mediaFor(d.name);
          const prev = prevFor(d.name, b.isPullUp);
          let w = 0, k = 0;
          return (
            <div key={b.key} role="listitem" className="snap-center snap-always shrink-0 w-full pr-3">
            <div className="rounded-xl border border-white/[0.08] bg-[#141518] p-3 space-y-2">
              <div className="flex items-center gap-3">
                {mm?.dir ? (
                  <img src={`/exercises/${mm.dir}/0.jpg`} alt="" className="w-11 h-11 rounded-md object-cover bg-white shrink-0 saturate-[.8]" />
                ) : <div className="w-11 h-11 rounded-md bg-white/5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-white leading-snug" style={{ margin: 0 }}>{displayName(d.name)}</h3>
                  <div className="text-xs text-zinc-500">{b.hint}</div>
                  {d.base.length > 0 && (
                    <div className="text-xs text-zinc-500 font-mono tabular-nums">Earlier today: {d.base.map(x => `${x.lb}×${x.reps}`).join(', ')}</div>
                  )}
                </div>
                <button
                  onClick={() => onHistory(historyOpen === d.name ? null : d.name)}
                  aria-label={`Show ${displayName(d.name)} history`}
                  className={`shrink-0 p-2 rounded-lg border cursor-pointer ${historyOpen === d.name ? 'border-cyan-400/60 text-cyan-300 bg-cyan-400/10' : 'border-white/10 text-zinc-400 hover:text-white'}`}
                >
                  <LineChart size={18} />
                </button>
              </div>

              {b.options && b.options.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-zinc-500 mr-1">Doing</span>
                  {b.options.map(o => (
                    <button key={o.plan.name} onClick={() => swapOption(b, o.plan.name)}
                      className={`px-2.5 py-1 rounded-md text-xs border cursor-pointer ${d.name === o.plan.name ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200' : 'border-white/10 text-zinc-400'}`}>
                      {displayName(o.plan.name)}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-[2rem_3.6rem_1fr_1fr_2.6rem_1.4rem] gap-x-1.5 gap-y-1.5 items-center text-[11px] text-zinc-500">
                <span className="text-center">Set</span><span className="text-center">Prev</span>
                <span className="text-center">{b.isPullUp ? '+ lb' : 'lb'}</span><span className="text-center">Reps</span><span /><span />
                {d.sets.map((s, i) => {
                  const warm = s.type === 'warm-up';
                  const pv = warm ? prev.warm[w++] : prev.work[k++];
                  const label = warm ? 'W' : s.type === 'drop' ? 'D' : s.type === 'failure' ? 'F' : String(d.sets.slice(0, i + 1).filter(x => x.type !== 'warm-up').length);
                  const tone = warm ? 'text-amber-300' : s.type === 'drop' ? 'text-violet-300' : s.type === 'failure' ? 'text-rose-300' : 'text-zinc-300';
                  return (
                    <div key={i} className={`contents ${s.done ? '[&_input]:bg-emerald-400/10 [&_input]:border-emerald-400/30' : ''}`}>
                      <button onClick={() => cycleType(b, i)} title="Tap to change set type (warm-up, normal, drop, failure)"
                        className={`h-9 rounded-md bg-white/[0.05] font-mono text-sm font-semibold cursor-pointer ${tone}`}>{label}</button>
                      <span className="text-center font-mono text-[11px] text-zinc-500 tabular-nums">{pv ? `${pv.lb}×${pv.reps}` : '–'}</span>
                      <input className={input} inputMode="decimal" value={s.lb || ''} placeholder="0" aria-label={`Set ${i + 1} weight`}
                        onFocus={e => e.target.select()} onChange={e => setCell(b, i, { lb: num(e.target.value) })} />
                      <input className={input} inputMode="numeric" value={s.reps || ''} placeholder="0" aria-label={`Set ${i + 1} reps`}
                        onFocus={e => e.target.select()} onChange={e => setCell(b, i, { reps: Math.floor(num(e.target.value)) })} />
                      <button onClick={() => toggleDone(b, i)} aria-label={s.done ? `Untick set ${i + 1}` : `Tick set ${i + 1}`}
                        className={`h-9 rounded-md flex items-center justify-center cursor-pointer ${s.done ? 'bg-emerald-400 text-slate-900' : 'bg-white/[0.07] text-zinc-400 hover:text-white'}`}>
                        <Check size={18} />
                      </button>
                      <button onClick={() => removeSet(b, i)} aria-label={`Remove set ${i + 1}`} className="text-zinc-600 hover:text-rose-300 cursor-pointer"><Trash2 size={14} /></button>
                      {d.name.includes('Barbell') && s.lb >= 45 && (
                        <span className="col-span-6 -mt-1 pl-[2.4rem] text-[11px] text-zinc-600 font-mono">{platesPerSide(s.lb)}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <button onClick={() => addSet(b)} className="w-full py-2 rounded-md border border-dashed border-white/15 text-xs text-zinc-400 hover:text-white hover:border-white/30 flex items-center justify-center gap-1 cursor-pointer">
                <Plus size={14} /> Add set
              </button>

              {NOTES_ENABLED && (() => {
                const past = pastNotes(history[d.name] || []);
                const open = !!openNotes[b.key];
                return (
                  <div className="border-t border-white/[0.08] pt-2 space-y-2">
                    <button onClick={() => setOpenNotes(o => ({ ...o, [b.key]: !o[b.key] }))}
                      className="w-full flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer">
                      <StickyNote size={14} className={d.note.trim() ? 'text-cyan-300' : ''} />
                      <span>Notes{past.length ? ` · ${past.length} earlier` : ''}{d.note.trim() ? ' · written today' : ''}</span>
                      {!open && past[0] && <span className="ml-auto min-w-0 truncate text-zinc-600 max-w-[50%]">{past[0].text.replace(/\s+/g, ' ')}</span>}
                    </button>
                    {open && (
                      <div className="space-y-2">
                        <textarea
                          value={d.note}
                          onChange={e => patch(b, x => ({ ...x, note: e.target.value }))}
                          rows={3}
                          placeholder="How did it feel? Setup, cues, pain, what to change next time…"
                          className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-[13px] text-white outline-none focus:border-cyan-400/70 resize-y"
                        />
                        {d.note.trim() && !d.sets.some(x => x.done) && <p className="text-[11px] text-amber-300/80">Saves with your first ticked set.</p>}
                        <div className="text-[11px] text-zinc-500">All notes for this exercise</div>
                        <NoteHistory notes={past} />
                      </div>
                    )}
                  </div>
                );
              })()}

              <button
                onClick={() => (bi >= blocks.length - 1 ? finish() : goTo(bi + 1))}
                style={isComplete(b) ? { color: '#0f172a' } : undefined}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                  isComplete(b) ? 'bg-cyan-400' : 'bg-white/[0.06] text-zinc-300 hover:bg-white/10'
                }`}
              >
                {bi >= blocks.length - 1 ? 'Finish workout' : <>Next exercise <ChevronRight size={16} /></>}
              </button>
            </div>
            </div>
          );
        })}
      </div>

      {addable.length > 0 && (
        <div className="mt-4">
          <label className="text-xs text-zinc-500 block mb-1.5">Add an exercise to this workout</label>
          <select value="" onChange={e => { if (e.target.value) { setExtras(x => [...x, e.target.value]); setTimeout(() => goTo(blocks.length), 50); } }}
            className="w-full rounded-lg bg-[#141518] border border-white/10 px-3 py-2.5 text-sm text-zinc-200 [color-scheme:dark]">
            <option value="">Choose…</option>
            {addable.map(n => <option key={n} value={n}>{displayName(n)}</option>)}
          </select>
        </div>
      )}

      <RestBar />
    </div>
  );
}
