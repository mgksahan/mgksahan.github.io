import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Trash2, X, Cloud, CloudOff, Loader2, Minus, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { mediaFor, displayName } from '../lib/exerciseMedia';
import { FitnessRow, MainLiftPlan, AccessoryOption, LoggedSet, parseSets, localToday } from '../lib/gymPlan';
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
interface Draft { name: string; sets: DraftSet[] }
type Drafts = Record<string, Draft>;

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

function platesPerSide(lb: number) {
  let left = (lb - 45) / 2;
  if (left <= 0) return 'bar only';
  const out: number[] = [];
  for (const p of PLATES) while (left >= p - 0.001) { out.push(p); left -= p; }
  return out.join(' · ') + ' /side';
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

export function WorkoutSession({ dayId, dayName, plans, extraNames, history, bodyWeightLb, onExit, onFinished }: {
  dayId: string;
  dayName: string;
  plans: PlanItem[];
  extraNames: string[]; // exercises you can add on top of the plan
  history: Record<string, FitnessRow[]>;
  bodyWeightLb: number;
  onExit: () => void;
  onFinished: () => void;
}) {
  const today = localToday();

  const saved = useMemo(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return s && s.date === today && s.dayId === dayId ? s : null;
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
    const todayRow = (history[name] || []).find(r => r.workout_date.slice(0, 10) === today);
    if (todayRow) return fromRow(todayRow, b.isPullUp); // already logged today: don't overwrite it
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
      d[b.key] = sv && b.names.includes(sv.name) ? sv : { name, sets: initial(b, name) };
    });
    return d;
  });

  // Blocks added later (extra exercises) get drafts on first render
  const draftOf = (b: Block): Draft => drafts[b.key] ?? { name: defaultName(b), sets: initial(b, defaultName(b)) };

  const patch = (b: Block, fn: (d: Draft) => Draft) =>
    setDrafts(cur => ({ ...cur, [b.key]: fn(cur[b.key] ?? { name: defaultName(b), sets: initial(b, defaultName(b)) }) }));

  // --- rest timer + session clock ---
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState<{ end: number; total: number } | null>(null);
  const buzzed = useRef(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const restLeft = rest ? Math.ceil((rest.end - now) / 1000) : 0;
  useEffect(() => {
    if (rest && restLeft <= 0 && !buzzed.current) {
      buzzed.current = true;
      try { navigator.vibrate?.([250, 120, 250]); } catch { /* not supported */ }
    }
  }, [rest, restLeft]);
  const startRest = (sec: number) => { buzzed.current = false; setRest({ end: Date.now() + sec * 1000, total: sec }); };

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
      try { localStorage.setItem(SESSION_KEY, JSON.stringify({ date: today, dayId, startedAt, extras, drafts })); } catch { /* ignore */ }
      blocks.forEach(b => {
        const d = drafts[b.key];
        if (!d) return;
        const payload = buildPayload(d.name, today, d.sets, { isPullUp: b.isPullUp, bodyWeightLb });
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
    patch(b, () => ({ name, sets: initial(b, name) }));
  };

  const prevFor = (name: string, isPullUp: boolean) => {
    const row = lastRows(name);
    if (!row) return { warm: [] as DraftSet[], work: [] as DraftSet[] };
    const sets = fromRow(row, isPullUp);
    return { warm: sets.filter(s => s.type === 'warm-up'), work: sets.filter(s => s.type !== 'warm-up') };
  };

  const totalDone = blocks.reduce((n, b) => n + draftOf(b).sets.filter(s => s.done).length, 0);

  const finish = async () => {
    if (!totalDone && !window.confirm('No sets are ticked. Leave without saving anything?')) return;
    await flushLogs();
    const left = getSyncStatus().pending;
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
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

      <ol className="space-y-3 mt-3">
        {blocks.map(b => {
          const d = draftOf(b);
          const mm = mediaFor(d.name);
          const prev = prevFor(d.name, b.isPullUp);
          let w = 0, k = 0;
          return (
            <li key={b.key} className="rounded-xl border border-white/[0.08] bg-[#141518] p-3 space-y-2">
              <div className="flex items-center gap-3">
                {mm?.dir ? (
                  <img src={`/exercises/${mm.dir}/0.jpg`} alt="" className="w-11 h-11 rounded-md object-cover bg-white shrink-0 saturate-[.8]" />
                ) : <div className="w-11 h-11 rounded-md bg-white/5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-white leading-snug" style={{ margin: 0 }}>{displayName(d.name)}</h3>
                  <div className="text-xs text-zinc-500">{b.hint}</div>
                </div>
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
            </li>
          );
        })}
      </ol>

      {addable.length > 0 && (
        <div className="mt-4">
          <label className="text-xs text-zinc-500 block mb-1.5">Add an exercise to this workout</label>
          <select value="" onChange={e => { if (e.target.value) setExtras(x => [...x, e.target.value]); }}
            className="w-full rounded-lg bg-[#141518] border border-white/10 px-3 py-2.5 text-sm text-zinc-200 [color-scheme:dark]">
            <option value="">Choose…</option>
            {addable.map(n => <option key={n} value={n}>{displayName(n)}</option>)}
          </select>
        </div>
      )}

      {rest && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pt-2 pointer-events-none">
          <div className={`pointer-events-auto mx-auto max-w-md rounded-2xl border p-3 flex items-center gap-3 shadow-xl bg-[#0d0e10] ${restLeft <= 0 ? 'border-emerald-400/60' : 'border-white/15'}`}>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-400">{restLeft <= 0 ? 'Rest over. Next set.' : 'Rest'}</div>
              <div className={`font-mono text-3xl font-semibold tabular-nums leading-none ${restLeft <= 0 ? 'text-emerald-300' : 'text-white'}`}>{clock(restLeft)}</div>
              <div className="h-1 rounded-full bg-white/10 mt-2 overflow-hidden">
                <div className="h-full bg-cyan-400 transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, (restLeft / rest.total) * 100))}%` }} />
              </div>
            </div>
            <button onClick={() => setRest(r => (r ? { ...r, end: r.end - 15000 } : r))} aria-label="15 seconds less" className="p-2.5 rounded-lg bg-white/[0.07] text-zinc-200 cursor-pointer"><Minus size={16} /></button>
            <button onClick={() => setRest(r => (r ? { end: Math.max(r.end, Date.now()) + 15000, total: r.total + 15 } : r))} aria-label="15 seconds more" className="p-2.5 rounded-lg bg-white/[0.07] text-zinc-200 cursor-pointer"><Plus size={16} /></button>
            <button onClick={() => setRest(null)} aria-label="Skip rest" className="p-2.5 rounded-lg bg-white/[0.07] text-zinc-200 cursor-pointer"><SkipForward size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
