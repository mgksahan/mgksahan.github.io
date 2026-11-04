import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Dumbbell, RefreshCw, AlertTriangle, ChevronDown, Check, BarChart3, History, LineChart } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../apiService';
import { useAuth } from '../context/AuthContext';
import { mediaFor } from '../lib/exerciseMedia';
import { ExerciseHistory } from '../components/ExerciseHistory';
import {
  FitnessRow, MainLiftPlan, AccessoryOption, MAIN_LIFTS,
  getPowerbuildingRoutine, planMainLift, planAccessoryOptions, accessorySets, alternativesFor, restLabel, nextDayIndex, lastAssignedDay, roundTo, toKg,
} from '../lib/gymPlan';

// Layout rule for this page: one big thing per block. Left column = where you are in the week;
// right column = the session in order. Each exercise shows its picture, its name, and ONE big
// number (what to lift); everything else is smaller or folded away.

const shortDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// "Day 2: Powerbuilding Pull + Squats A (Squat & Pull-Up Focus)" -> "Pull + Squats A"
const shortDayName = (name: string) =>
  name.replace(/^Day \d+:\s*/, '').replace(/^Powerbuilding\s+/, '').replace(/\s*\(.*\)\s*$/, '');
const focusOf = (name: string) => name.match(/\(([^)]+)\)/)?.[1] ?? '';

const daysAgo = (d: string | null) => {
  if (!d) return 'never logged';
  const n = Math.round((Date.now() - new Date(d + 'T12:00:00').getTime()) / 86400000);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
};

function weightLabel(plan: MainLiftPlan, lb: number) {
  if (!plan.isPullUp) return `${lb} lb`;
  const added = roundTo(lb - plan.bodyWeightLb, 5);
  return added <= 0 ? 'Bodyweight' : `+${added} lb`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Two frames of the movement, cross-faded. Falls back to a dumbbell icon when there is no picture.
function Thumb({ name, size }: { name: string; size: number }) {
  const m = mediaFor(name);
  const box = { width: size, height: size };
  if (!m) {
    return (
      <div style={box} className="shrink-0 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-cyan-300/70">
        <Dumbbell size={size / 2.5} />
      </div>
    );
  }
  return (
    <div style={box} className="relative shrink-0 rounded-xl overflow-hidden bg-white ring-1 ring-white/20">
      <img src={`/exercises/${m.dir}/0.jpg`} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      <img src={`/exercises/${m.dir}/1.jpg`} alt={`${name.trim()} movement`} loading="lazy" className="ex-flip absolute inset-0 w-full h-full object-cover" />
    </div>
  );
}

// Whole header area is the click target that opens the history panel
function Clickable({ onClick, label, className, children }: { onClick: () => void; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={`cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded-2xl ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="shrink-0 w-6 h-6 rounded-full border border-cyan-400/50 text-cyan-300 text-[11px] font-black flex items-center justify-center tabular-nums">
      {n}
    </span>
  );
}

function Details({ children }: { children: React.ReactNode }) {
  return (
    <details className="group border-t border-white/10 pt-2">
      <summary className="list-none cursor-pointer flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-zinc-200 select-none">
        <ChevronDown size={14} className="transition-transform group-open:rotate-180" /> Rest times and history
      </summary>
      <div className="mt-2 space-y-1 text-[12px] text-zinc-400">{children}</div>
    </details>
  );
}

function MainLiftRow({ n, plan, selected, onSelect }: { n: number; plan: MainLiftPlan; selected: string | null; onSelect: (name: string) => void }) {
  const deload = plan.phase === 'deload';
  const warmups = plan.warmups.map(w => `${!plan.isPullUp && w.lb === 45 ? 'Bar' : weightLabel(plan, w.lb).replace(' lb', '')}×${w.reps}`);
  const mm = mediaFor(plan.name);
  return (
    <li className={`rounded-3xl border bg-gradient-to-b from-cyan-400/[0.07] to-white/[0.03] p-4 sm:p-5 space-y-4 shadow-[0_0_40px_-12px_rgba(34,211,238,0.35)] transition-colors ${selected === plan.name ? 'border-cyan-300/70' : 'border-cyan-400/25'}`}>
      <Clickable onClick={() => onSelect(plan.name)} label={`Show ${plan.name} history`} className="flex items-center gap-3">
        <Thumb name={plan.name} size={88} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StepBadge n={n} />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300">Main lift</span>
          </div>
          <h3 className="text-lg font-extrabold text-white leading-tight">{plan.name}</h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {mm ? `${cap(mm.muscle)} · ` : ''}
            {plan.projected ? 'Projected · ' : ''}
            {deload ? `Deload · cycle ${plan.cycle}` : `Week ${plan.phase} of 4 · cycle ${plan.cycle}`}
          </p>
        </div>
        <LineChart size={18} className={`shrink-0 ${selected === plan.name ? 'text-cyan-300' : 'text-zinc-500'}`} aria-hidden />
      </Clickable>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Top set</span>
          <div className="text-3xl sm:text-4xl font-black tabular-nums text-white leading-none mt-1">
            {weightLabel(plan, plan.top.lb)} <span className="text-cyan-300">× {plan.top.reps}</span>
          </div>
          {!plan.isPullUp && <span className="text-[11px] text-zinc-500 tabular-nums">{toKg(plan.top.lb).toFixed(1)} kg</span>}
        </div>
        <div className="rounded-2xl bg-black/20 border border-white/10 p-3">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Then back-offs</span>
          <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-zinc-100 leading-none mt-1.5">
            {plan.backoff.sets} × {plan.backoff.reps}
            <span className="text-zinc-400 text-base"> @ {weightLabel(plan, plan.backoff.lb)}</span>
          </div>
          {!plan.isPullUp && <span className="text-[11px] text-zinc-500 tabular-nums">{toKg(plan.backoff.lb).toFixed(1)} kg</span>}
        </div>
      </div>

      <div>
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Warm up first</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {warmups.map((w, i) => (
            <span key={i} className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-[12px] font-bold text-zinc-200 tabular-nums">{w}</span>
          ))}
        </div>
      </div>

      <p className="text-[12px] text-zinc-300">
        {deload
          ? 'Deload week: keep every rep fast and easy.'
          : `Leave about 1 rep in the tank. Miss the top set? Do ${plan.backoff.sets - 1} back-offs instead of ${plan.backoff.sets}.`}
      </p>

      <Details>
        <div>Between warm-ups <b className="text-zinc-200">{plan.rest.warmups}</b></div>
        <div>Last warm-up → top set <b className="text-zinc-200">{plan.rest.toTop}</b></div>
        <div>Top set → first back-off <b className="text-zinc-200">{plan.rest.toBackoff}</b></div>
        <div>Between back-offs <b className="text-zinc-200">{plan.rest.backoffs}</b></div>
        <div className="pt-1 tabular-nums">
          Est. max {Math.round(plan.estMaxLb)} lb
          {plan.isPullUp && ` (incl. ${Math.round(plan.bodyWeightLb)} lb bodyweight)`}
          {plan.lastTop && ` · last top set ${Math.round(plan.lastTop.lb)}×${plan.lastTop.reps} (${shortDate(plan.lastTop.date)})`}
        </div>
        <div>{plan.reason}</div>
        <div className="text-zinc-500">Mark warm-ups as warm-up sets in Jefit.</div>
      </Details>
    </li>
  );
}

function AccessoryRow({ n, options, selected, onSelect }: { n: number; options: AccessoryOption[]; selected: string | null; onSelect: (name: string) => void }) {
  // Opens on the option done most recently; tap another to swap
  const start = options.reduce((best, o, i) => ((o.lastDate ?? '') > (options[best].lastDate ?? '') ? i : best), 0);
  const [index, setIndex] = useState(start);
  const o = options[Math.min(index, options.length - 1)];
  const p = o.plan;
  const mm = mediaFor(p.name);
  const active = selected !== null && options.some(x => x.plan.name === selected);
  return (
    <li className={`rounded-3xl border bg-white/[0.04] p-4 space-y-3 transition-colors ${active ? 'border-cyan-300/60' : 'border-white/10'}`}>
      <Clickable onClick={() => onSelect(p.name)} label={`Show ${p.name.trim()} history`} className="flex items-center gap-3">
        <Thumb name={p.name} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StepBadge n={n} />
            {mm && <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{cap(mm.muscle)}</span>}
          </div>
          <h3 className="text-[15px] font-bold text-white leading-snug">{p.name.trim()}</h3>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-black tabular-nums text-white leading-none">
            {p.lb !== null ? `${o.estimated ? '~' : ''}${p.lb}` : '—'}
            <span className="text-xs font-bold text-zinc-400"> lb</span>
          </div>
          <div className="text-[13px] font-bold text-cyan-300 tabular-nums mt-1">{p.sets} × {p.repLow}–{p.repHigh}</div>
        </div>
      </Clickable>

      <p className="text-[12px] text-zinc-300">{p.note}</p>

      {options.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mr-1">Swap</span>
          {options.map((opt, i) => (
            <button
              key={opt.plan.name}
              onClick={() => { setIndex(i); if (active) onSelect(opt.plan.name); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                i === index ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-200' : 'border-white/10 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {opt.plan.name.trim().replace(/^unilateral tricep machine extension blue machine$/, 'Tricep machine')}
            </button>
          ))}
        </div>
      )}

      <Details>
        <div>Rest <b className="text-zinc-200">{restLabel(p.restSec)}</b> between sets</div>
        <div className="tabular-nums">
          Last done {daysAgo(o.lastDate)}
          {p.last && ` · ${p.last.sets.map(s => `${Math.round(s.lb)}×${s.reps}`).join(', ')}`}
        </div>
      </Details>
    </li>
  );
}

// The routine lives in code only (gymPlan.ts); the old tracker's saved copy is ignored
const routine = getPowerbuildingRoutine();

export function GymPlanPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [history, setHistory] = useState<Record<string, FitnessRow[]>>({});
  const [bodyWeightLb, setBodyWeightLb] = useState(160);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [nextWeek, setNextWeek] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const toggleSelected = (name: string) => setSelected(cur => (cur === name ? null : name));

  const load = async () => {
    setLoading(true);
    try {
      const names = new Set<string>([...MAIN_LIFTS, 'Body Weight']);
      routine.days.forEach(d => d.exercises.forEach(e => { names.add(e.name); alternativesFor(e.name).forEach(a => names.add(a)); }));
      const entries = await Promise.all([...names].map(async name => {
        try {
          return [name, (await apiService.fetchFitnessHistory(name)) as FitnessRow[]] as const;
        } catch {
          return [name, [] as FitnessRow[]] as const;
        }
      }));
      const map = Object.fromEntries(entries);
      const weights = (map['Body Weight'] || []).filter(r => /^\d{4}-/.test(r.workout_date))
        .sort((a, b) => a.workout_date.localeCompare(b.workout_date));
      const lastWeight = Number(weights[weights.length - 1]?.one_rep_max_lbs);
      if (lastWeight > 0) setBodyWeightLb(lastWeight);
      setHistory(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const nextDay = useMemo(() => nextDayIndex(history), [history]);
  const lastDay = useMemo(() => lastAssignedDay(history), [history]);
  const dayIndex = selectedDay ?? nextDay;
  const day = routine.days.find(d => d.day_index === String(dayIndex)) ?? routine.days[0];

  const plans = useMemo(() => day.exercises.map(ex =>
    MAIN_LIFTS.includes(ex.name)
      ? planMainLift(ex.name, history[ex.name] || [], bodyWeightLb, nextWeek)
      : planAccessoryOptions(ex.name, history, accessorySets(day.day_index, ex.name, ex.setcount), ex.timer, day.exercises.map(e => e.name))
  ), [day, history, bodyWeightLb, nextWeek]);

  const totalSets = plans.reduce((sum, p) => {
    if (p === null) return sum;
    return sum + (Array.isArray(p) ? p[0].plan.sets : 1 + p.backoff.sets);
  }, 0);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await apiService.syncJefit();
      toast.success(res.message || 'Synced from Jefit.');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Jefit sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const ghost = 'text-[11px] font-bold text-zinc-300 border border-white/15 rounded-xl px-3 py-1.5 hover:bg-white/[0.07] flex items-center gap-1.5 cursor-pointer';

  return (
    <div className="flex-1 flex flex-col text-white pb-10 animate-fade-in bg-[#060912] bg-[radial-gradient(60rem_30rem_at_85%_-10%,rgba(34,211,238,0.12),transparent),radial-gradient(50rem_30rem_at_-10%_30%,rgba(139,92,246,0.12),transparent)]">
      <style>{`
        @keyframes exflip { 0%, 35% { opacity: 0 } 50%, 85% { opacity: 1 } 100% { opacity: 0 } }
        .ex-flip { animation: exflip 2s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .ex-flip { animation: none; opacity: 0 } }
        details > summary::-webkit-details-marker { display: none }
        @keyframes panelIn { from { opacity: 0; transform: translateX(28px) } to { opacity: 1; transform: none } }
        @keyframes sheetIn { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: none } }
        .panel-in { animation: sheetIn 260ms cubic-bezier(.2,.8,.2,1) }
        @media (min-width: 1280px) { .panel-in { animation: panelIn 320ms cubic-bezier(.2,.8,.2,1) } }
        @media (prefers-reduced-motion: reduce) { .panel-in { animation: none } }
      `}</style>

      <header className="sticky top-0 z-30 bg-[#060912]/75 backdrop-blur-xl border-b border-white/10 px-5 lg:px-10 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-extrabold tracking-wide">
          <Dumbbell size={18} className="text-cyan-400" /> Training
        </div>
        <nav className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={handleSync} disabled={syncing} className={`${ghost} disabled:opacity-50`}>
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> Sync
            </button>
          )}
          <Link to="/fitness" className={ghost}><BarChart3 size={13} /> Charts</Link>
          <Link to="/gym/tracker" className={ghost}><History size={13} /> Old tracker</Link>
        </nav>
      </header>

      <div className={`px-5 lg:px-10 py-6 lg:py-10 w-full mx-auto flex flex-col lg:grid lg:grid-cols-[19rem_1fr] gap-6 lg:gap-12 lg:items-start transition-[max-width] duration-300 ${
        selected ? 'max-w-6xl xl:max-w-[96rem] xl:grid-cols-[17rem_minmax(0,1fr)_27rem] xl:gap-8' : 'max-w-6xl'
      }`}>
        {/* LEFT: where am I */}
        <aside className="space-y-6 lg:sticky lg:top-24">
          <div>
            <span className="text-[11px] font-extrabold text-cyan-300 uppercase tracking-widest">
              {dayIndex === nextDay ? 'Up next' : 'Viewing'} · Day {day.day_index} of {routine.days.length}
            </span>
            <h1 className="text-3xl lg:text-4xl font-black leading-[1.1] mt-2 text-white">{shortDayName(day.name)}</h1>
            <p className="text-sm text-zinc-300 mt-2">{focusOf(day.name)}</p>
            {!loading && (
              <p className="text-[13px] text-zinc-400 mt-3 tabular-nums">
                {day.exercises.length} exercises · {totalSets} working sets
              </p>
            )}
            {lastDay.date && (
              <p className="text-[12px] text-zinc-500 mt-1">Last workout {shortDate(lastDay.date)} (Day {lastDay.day})</p>
            )}
          </div>

          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Your week</span>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {routine.days.map(d => {
                const idx = Number(d.day_index);
                const active = idx === dayIndex;
                const done = idx < nextDay;
                const isNext = idx === nextDay;
                return (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDay(idx); setSelected(null); }}
                    className={`shrink-0 flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left cursor-pointer transition-all ${
                      active ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-white/10 hover:bg-white/[0.07]'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                      done ? 'bg-emerald-400/15 text-emerald-300' : isNext ? 'bg-cyan-400 text-slate-900' : 'bg-white/[0.07] text-zinc-400'
                    }`}>
                      {done ? <Check size={14} /> : d.day_index}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[13px] font-bold whitespace-nowrap ${active ? 'text-white' : 'text-zinc-200'}`}>{shortDayName(d.name)}</span>
                      <span className="block text-[10px] uppercase tracking-widest text-zinc-500">{done ? 'Done' : isNext ? 'Next' : 'Later'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="inline-flex gap-1 rounded-xl border border-white/10 p-1">
              {[false, true].map(next => (
                <button
                  key={String(next)}
                  onClick={() => setNextWeek(next)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer ${
                    nextWeek === next ? 'bg-cyan-400/15 text-cyan-200' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {next ? 'Next week' : 'This week'}
                </button>
              ))}
            </div>
            {nextWeek && (
              <p className="text-[11px] text-zinc-500 mt-2">
                Main lifts assume every remaining top set this week is hit. Accessories are unchanged: they progress on what you log.
              </p>
            )}
          </div>

          {!authLoading && !isAdmin && (
            <a href="/login?next=/gym" className="flex items-center gap-2 text-[12px] text-amber-200/90 hover:text-amber-100">
              <AlertTriangle size={14} className="shrink-0" /> Log in to sync from Jefit
            </a>
          )}
        </aside>

        {/* RIGHT: what to do, in order */}
        <main className="min-w-0">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading your history…</p>
          ) : (
            <ol className="space-y-4">
              {plans.map((p, i) =>
                p === null ? (
                  <li key={i} className="rounded-3xl border border-white/10 px-4 py-3 text-[13px] text-zinc-400">
                    <span className="font-bold text-zinc-200">{i + 1}. {day.exercises[i].name}</span>: no history yet. Log a session in Jefit and sync.
                  </li>
                ) : Array.isArray(p) ? (
                  <AccessoryRow key={`${day.id}-${i}`} n={i + 1} options={p} selected={selected} onSelect={toggleSelected} />
                ) : (
                  <MainLiftRow key={`${day.id}-${i}`} n={i + 1} plan={p} selected={selected} onSelect={toggleSelected} />
                )
              )}
            </ol>
          )}
        </main>

        {selected && (
          <ExerciseHistory
            name={selected}
            rows={history[selected] || []}
            bodyWeightRows={history['Body Weight'] || []}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}
