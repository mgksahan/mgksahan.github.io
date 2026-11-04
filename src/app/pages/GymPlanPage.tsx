import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Play, Dumbbell, RefreshCw, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Check, TrendingUp, History, LineChart } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../apiService';
import { useAuth } from '../context/AuthContext';
import { mediaFor, displayName, EXERCISE_MEDIA } from '../lib/exerciseMedia';
import { ExerciseHistory } from '../components/ExerciseHistory';
import { WorkoutSession, SyncPill } from '../components/WorkoutSession';
import { SHORT_NAME, STANDARDS, TIER_BAR, TIER_TEXT, overallRank, rankOf } from '../lib/strengthStandards';
import {
  FitnessRow, MainLiftPlan, AccessoryOption, LoggedSet, MAIN_LIFTS, PLAN_START,
  getPowerbuildingRoutine, planMainLift, planAccessoryOptions, accessorySets, alternativesFor, restLabel,
  nextDayIndex, lastAssignedDay, roundTo, toKg, localToday, workingSets,
} from '../lib/gymPlan';

// Layout rule: left column = where you are (day, week, rank); right column = the session, in order.
// Each exercise shows its picture, its name, and ONE big number. Everything else is smaller or folded away.

const shortDate = (d: string) =>
  new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const weekday = (d: string) =>
  new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

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

// --- weeks: calendar weeks (Mon-Sun), week 1 = the week the plan started ---
const DAY_MS = 86400000;
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mondayOf = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const MAX_OFFSET = 1; // one week ahead is projected; further out isn't predicted

function weekInfo(offset: number) {
  const thisMonday = mondayOf(localToday());
  const planMonday = mondayOf(PLAN_START);
  const thisNum = Math.round((thisMonday.getTime() - planMonday.getTime()) / (7 * DAY_MS)) + 1;
  const start = addDays(thisMonday, offset * 7);
  const end = addDays(start, 6);
  const range = start.getMonth() === end.getMonth()
    ? `${shortDate(isoOf(start))} – ${end.getDate()}`
    : `${shortDate(isoOf(start))} – ${shortDate(isoOf(end))}`;
  return { num: thisNum + offset, start: isoOf(start), end: isoOf(end), range, minOffset: -(thisNum - 1) };
}

// Two frames of the movement, cross-faded. Falls back to a dumbbell icon when there is no picture.
function Thumb({ name, size }: { name: string; size: number }) {
  const m = mediaFor(name);
  const box = { width: size, height: size };
  if (!m || !m.dir) {
    return (
      <div style={box} className="shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500">
        <Dumbbell size={size / 2.5} />
      </div>
    );
  }
  return (
    <div style={box} className="relative shrink-0 rounded-lg overflow-hidden bg-white border border-white/10">
      <img src={`/exercises/${m.dir}/0.jpg`} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover saturate-[.8]" />
      <img src={`/exercises/${m.dir}/1.jpg`} alt={`${name.trim()} movement`} loading="lazy" className="ex-flip absolute inset-0 w-full h-full object-cover saturate-[.8]" />
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
      className={`cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded-lg ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

function Details({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-white/[0.08] pt-2.5">
      <summary className="list-none cursor-pointer flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 select-none">
        <ChevronDown size={14} className="transition-transform group-open:rotate-180" /> {label}
      </summary>
      <div className="mt-2 space-y-1 text-[13px] text-zinc-400">{children}</div>
    </details>
  );
}

const card = 'rounded-xl border bg-[#141518] p-4 space-y-3 transition-colors';

function MainLiftRow({ plan, selected, onSelect }: { plan: MainLiftPlan; selected: string | null; onSelect: (name: string) => void }) {
  const deload = plan.phase === 'deload';
  const warmups = plan.warmups.map(w => `${!plan.isPullUp && w.lb === 45 ? 'Bar' : weightLabel(plan, w.lb).replace(' lb', '')}×${w.reps}`);
  const mm = mediaFor(plan.name);
  return (
    <li className={`${card} sm:p-5 sm:space-y-4 ${selected === plan.name ? 'border-cyan-400/70' : 'border-cyan-400/25'}`}>
      <Clickable onClick={() => onSelect(plan.name)} label={`Show ${plan.name} history`} className="flex items-center gap-3">
        <Thumb name={plan.name} size={80} />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-cyan-300 font-medium">Main lift</div>
          <h3 className="text-lg font-semibold text-white leading-tight" style={{ margin: 0 }}>{displayName(plan.name)}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {mm ? `${cap(mm.muscle)} · ` : ''}
            {plan.projected ? 'Projected · ' : ''}
            {deload ? `Deload · cycle ${plan.cycle}` : `Week ${plan.phase} of 4 · cycle ${plan.cycle}`}
          </p>
        </div>
        <LineChart size={18} className={`shrink-0 ${selected === plan.name ? 'text-cyan-300' : 'text-zinc-600'}`} aria-hidden />
      </Clickable>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-black/25 border border-white/[0.08] p-3">
          <span className="text-xs text-zinc-400">Top set</span>
          <div className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-white leading-none mt-1.5">
            {weightLabel(plan, plan.top.lb)} <span className="text-cyan-300">×{plan.top.reps}</span>
          </div>
          {!plan.isPullUp && <span className="font-mono text-xs text-zinc-500 tabular-nums">{toKg(plan.top.lb).toFixed(1)} kg</span>}
        </div>
        <div className="rounded-lg border border-white/[0.08] p-3">
          <span className="text-xs text-zinc-400">Then back-offs</span>
          <div className="font-mono text-lg sm:text-xl font-semibold tabular-nums text-zinc-100 leading-none mt-2">
            {plan.backoff.sets}×{plan.backoff.reps}
            <span className="text-zinc-400 text-sm"> @ {weightLabel(plan, plan.backoff.lb)}</span>
          </div>
          {!plan.isPullUp && <span className="font-mono text-xs text-zinc-500 tabular-nums">{toKg(plan.backoff.lb).toFixed(1)} kg</span>}
        </div>
      </div>

      <div>
        <span className="text-xs text-zinc-400">Warm up first</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {warmups.map((w, i) => (
            <span key={i} className="px-2 py-1 rounded-md bg-white/[0.05] font-mono text-xs text-zinc-200 tabular-nums">{w}</span>
          ))}
        </div>
      </div>

      <p className="text-[13px] text-zinc-300">
        {deload
          ? 'Deload week: keep every rep fast and easy.'
          : `Leave about 1 rep in the tank. Miss the top set? Do ${plan.backoff.sets - 1} back-offs instead of ${plan.backoff.sets}.`}
      </p>

      <Details label="Rest times and notes">
        <div>Between warm-ups <b className="text-zinc-200 font-medium">{plan.rest.warmups}</b></div>
        <div>Last warm-up → top set <b className="text-zinc-200 font-medium">{plan.rest.toTop}</b></div>
        <div>Top set → first back-off <b className="text-zinc-200 font-medium">{plan.rest.toBackoff}</b></div>
        <div>Between back-offs <b className="text-zinc-200 font-medium">{plan.rest.backoffs}</b></div>
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

function AccessoryRow({ options, selected, onSelect }: { options: AccessoryOption[]; selected: string | null; onSelect: (name: string) => void }) {
  // Opens on the option done most recently; tap another to swap
  const start = options.reduce((best, o, i) => ((o.lastDate ?? '') > (options[best].lastDate ?? '') ? i : best), 0);
  const [index, setIndex] = useState(start);
  const o = options[Math.min(index, options.length - 1)];
  const p = o.plan;
  const mm = mediaFor(p.name);
  const active = selected !== null && options.some(x => x.plan.name === selected);
  return (
    <li className={`${card} ${active ? 'border-cyan-400/60' : 'border-white/[0.08]'}`}>
      <Clickable onClick={() => onSelect(p.name)} label={`Show ${displayName(p.name)} history`} className="flex items-center gap-3">
        <Thumb name={p.name} size={64} />
        <div className="min-w-0 flex-1">
          {mm && <div className="text-xs text-zinc-400">{cap(mm.muscle)}</div>}
          <h3 className="text-[15px] font-semibold text-white leading-snug" style={{ margin: 0 }}>{displayName(p.name)}</h3>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-xl font-semibold tabular-nums text-white leading-none">
            {p.lb !== null ? `${o.estimated ? '~' : ''}${p.lb}` : '—'}
            <span className="text-xs font-normal text-zinc-400"> lb</span>
          </div>
          <div className="font-mono text-[13px] text-cyan-300 tabular-nums mt-1">{p.sets}×{p.repLow}–{p.repHigh}</div>
        </div>
      </Clickable>

      <p className="text-[13px] text-zinc-300">{p.note}</p>

      {options.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500 mr-1">Swap for</span>
          {options.map((opt, i) => (
            <button
              key={opt.plan.name}
              onClick={() => { setIndex(i); if (active) onSelect(opt.plan.name); }}
              className={`px-2.5 py-1 rounded-md text-xs border cursor-pointer transition-colors ${
                i === index ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200' : 'border-white/10 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {displayName(opt.plan.name)}
            </button>
          ))}
        </div>
      )}

      <Details label="Rest and last session">
        <div>Rest <b className="text-zinc-200 font-medium">{restLabel(p.restSec)}</b> between sets</div>
        <div className="tabular-nums">
          Last done {daysAgo(o.lastDate)}
          {p.last && ` · ${p.last.sets.map(s => `${Math.round(s.lb)}×${s.reps}`).join(', ')}`}
        </div>
      </Details>
    </li>
  );
}

// Past weeks: show what was actually logged, not what was prescribed
interface Logged { name: string; date: string; sets: LoggedSet[] }

function ReviewRow({ exercise, entry, selected, onSelect }: {
  exercise: string; entry: Logged | null; selected: string | null; onSelect: (name: string) => void;
}) {
  const name = entry?.name ?? exercise;
  const top = entry ? entry.sets.reduce((b, s) => (s.lb > b.lb || (s.lb === b.lb && s.reps > b.reps) ? s : b), entry.sets[0]) : null;
  const mm = mediaFor(name);
  return (
    <li className={`${card} ${selected === name ? 'border-cyan-400/60' : 'border-white/[0.08]'}`}>
      <Clickable onClick={() => onSelect(name)} label={`Show ${displayName(name)} history`} className="flex items-center gap-3">
        <Thumb name={name} size={64} />
        <div className="min-w-0 flex-1">
          {mm && <div className="text-xs text-zinc-400">{cap(mm.muscle)}</div>}
          <h3 className="text-[15px] font-semibold text-white leading-snug" style={{ margin: 0 }}>{displayName(name)}</h3>
          <div className="text-xs text-zinc-500">{entry ? weekday(entry.date) : 'Not logged this week'}</div>
        </div>
        {top && (
          <div className="shrink-0 text-right">
            <div className="font-mono text-xl font-semibold tabular-nums text-white leading-none">
              {Math.round(top.lb)}<span className="text-xs font-normal text-zinc-400"> lb</span>
            </div>
            <div className="font-mono text-[13px] text-cyan-300 tabular-nums mt-1">×{top.reps} top</div>
          </div>
        )}
      </Clickable>
      {entry && (
        <div className="flex flex-wrap gap-1.5">
          {entry.sets.map((s, i) => (
            <span key={i} className="px-2 py-1 rounded-md bg-white/[0.05] font-mono text-xs text-zinc-200 tabular-nums">{Math.round(s.lb)}×{s.reps}</span>
          ))}
        </div>
      )}
    </li>
  );
}

function WeekNav({ offset, setOffset }: { offset: number; setOffset: (n: number) => void }) {
  const w = weekInfo(offset);
  const btn = 'p-2 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default';
  const tag = offset < 0 ? 'Looking back' : offset > 0 ? 'Projected' : 'This week';
  return (
    <div>
      <span className="text-xs text-zinc-500">Week</span>
      <div className="mt-1.5 flex items-center gap-2">
        <button aria-label="Previous week" className={btn} disabled={offset <= w.minOffset} onClick={() => setOffset(offset - 1)}><ChevronLeft size={16} /></button>
        <div className="flex-1 min-w-0 text-center">
          <div className="text-sm font-semibold text-white tabular-nums">Week {w.num} · {w.range}</div>
          <div className={`text-xs ${offset === 0 ? 'text-cyan-300' : 'text-zinc-400'}`}>{tag}</div>
        </div>
        <button aria-label="Next week" className={btn} disabled={offset >= MAX_OFFSET} onClick={() => setOffset(offset + 1)}><ChevronRight size={16} /></button>
      </div>
      {offset !== 0 && (
        <button onClick={() => setOffset(0)} className="mt-2 text-xs text-cyan-300 hover:text-cyan-200 cursor-pointer">Back to this week</button>
      )}
      {offset > 0 && (
        <p className="text-xs text-zinc-500 mt-2">Main lifts assume every remaining top set this week is hit. Accessories progress on what you log.</p>
      )}
    </div>
  );
}

const RANK_LIFTS = Object.keys(STANDARDS);

function RankCard({ ranks, bodyWeightLb }: { ranks: { name: string; est: number | null }[]; bodyWeightLb: number }) {
  const rows = ranks.map(r => ({ ...r, rank: r.est ? rankOf(r.name, r.est / bodyWeightLb) : null }));
  const overall = overallRank(rows.map(r => r.rank));
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#141518] p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-zinc-400">Strength rank</span>
        {overall && <span className={`text-sm font-semibold ${overall.tier >= 0 ? TIER_TEXT[overall.tier] : 'text-zinc-400'}`}>{overall.name}</span>}
      </div>
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.name}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-zinc-200">{SHORT_NAME[r.name]}</span>
              {r.rank ? (
                <span className="font-mono text-xs tabular-nums text-zinc-400">
                  <span className={r.rank.tier >= 0 ? TIER_TEXT[r.rank.tier] : ''}>{r.rank.name}</span> · {r.rank.ratio.toFixed(2)}×
                </span>
              ) : <span className="text-xs text-zinc-600">no data</span>}
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.07] mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-700 ${r.rank && r.rank.tier >= 0 ? TIER_BAR[r.rank.tier] : 'bg-zinc-600'}`}
                style={{ width: `${Math.round((r.rank?.progress ?? 0) * 100)}%` }}
              />
            </div>
            {r.rank?.next && r.est && (
              <div className="font-mono text-[11px] text-zinc-500 tabular-nums mt-1">
                +{Math.max(1, Math.ceil(r.rank.next.ratio * bodyWeightLb - r.est))} lb to {r.rank.next.name}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const toggleSelected = (name: string) => setSelected(cur => (cur === name ? null : name));

  const load = async () => {
    setLoading(true);
    try {
      const names = new Set<string>([...MAIN_LIFTS, ...RANK_LIFTS, 'Body Weight']);
      routine.days.forEach(d => d.exercises.forEach(e => { names.add(e.name); alternativesFor(e.name).forEach(a => names.add(a)); }));
      // Last good copy of each exercise's history, so the plan still opens with no signal
      let cache: Record<string, FitnessRow[]> = {};
      try { cache = JSON.parse(localStorage.getItem('peak_history_cache') || '{}'); } catch { /* ignore */ }
      const fresh: Record<string, FitnessRow[]> = {};
      const entries = await Promise.all([...names].map(async name => {
        try {
          const rows = (await apiService.fetchFitnessHistory(name)) as FitnessRow[];
          fresh[name] = rows;
          return [name, rows] as const;
        } catch {
          return [name, cache[name] ?? ([] as FitnessRow[])] as const;
        }
      }));
      try { localStorage.setItem('peak_history_cache', JSON.stringify({ ...cache, ...fresh })); } catch { /* storage full */ }
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
  const week = weekInfo(weekOffset);
  const reviewing = weekOffset < 0;

  const plans = useMemo(() => reviewing ? [] : day.exercises.map(ex =>
    MAIN_LIFTS.includes(ex.name)
      ? planMainLift(ex.name, history[ex.name] || [], bodyWeightLb, weekOffset > 0)
      : planAccessoryOptions(ex.name, history, accessorySets(day.day_index, ex.name, ex.setcount), ex.timer, day.exercises.map(e => e.name))
  ), [day, history, bodyWeightLb, weekOffset, reviewing]);

  // What was logged for each of this day's exercises (or its swaps) during the viewed week
  const logged = useMemo<(Logged | null)[]>(() => !reviewing ? [] : day.exercises.map(ex => {
    const found: Logged[] = [];
    [ex.name, ...alternativesFor(ex.name)].forEach(n => {
      (history[n] || []).forEach(r => {
        const d = r.workout_date.slice(0, 10);
        if (d >= week.start && d <= week.end) {
          const sets = workingSets(r);
          if (sets.length) found.push({ name: n, date: d, sets });
        }
      });
    });
    return found.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  }), [day, history, week.start, week.end, reviewing]);

  const rankInputs = useMemo(() => RANK_LIFTS.map(name => {
    const rows = history[name] || [];
    let est: number | null = null;
    if (MAIN_LIFTS.includes(name)) {
      est = planMainLift(name, rows, bodyWeightLb)?.estMaxLb ?? null;
    } else {
      const latest = rows.filter(r => /^\d{4}-/.test(r.workout_date) && Number(r.one_rep_max_lbs) > 0)
        .sort((a, b) => a.workout_date.localeCompare(b.workout_date)).pop();
      est = latest ? Number(latest.one_rep_max_lbs) : null;
    }
    return { name, est };
  }), [history, bodyWeightLb]);

  const totalSets = reviewing
    ? logged.reduce((s, l) => s + (l?.sets.length ?? 0), 0)
    : plans.reduce((sum, p) => (p === null ? sum : sum + (Array.isArray(p) ? p[0].plan.sets : 1 + p.backoff.sets)), 0);
  const doneCount = logged.filter(Boolean).length;

  // Everything you could add to a workout on top of the plan
  const extraNames = useMemo(() => {
    const all = new Set<string>(Object.keys(EXERCISE_MEDIA));
    routine.days.forEach(d => d.exercises.forEach(e => { all.add(e.name.trim()); alternativesFor(e.name).forEach(a => all.add(a.trim())); }));
    return [...all].filter(n => !n.startsWith('__')).sort();
  }, []);
  // "Resume" only when today's session has at least one ticked set; an opened-but-empty one is just a fresh start
  const [, bumpSession] = useState(0);
  const hasActiveSession = (() => {
    try {
      const a = JSON.parse(localStorage.getItem('peak_active_session') || 'null');
      return !!a && a.v === 2 && a.date === localToday() && Object.values<any>(a.drafts || {}).some(d => d.sets?.some((x: any) => x.done));
    } catch { return false; }
  })();
  const canLog = isAdmin && weekOffset === 0 && !loading;

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

  const ghost = 'text-xs text-zinc-300 border border-white/10 rounded-lg px-2.5 sm:px-3 py-1.5 hover:bg-white/[0.06] flex items-center gap-1.5 cursor-pointer whitespace-nowrap';

  return (
    <div className={`flex-1 flex flex-col text-white animate-fade-in bg-[#0d0e10] ${canLog && !logging ? 'pb-32' : 'pb-10'}`}>
      <style>{`
        @keyframes exflip { 0%, 35% { opacity: 0 } 50%, 85% { opacity: 1 } 100% { opacity: 0 } }
        .ex-flip { animation: exflip 2s ease-in-out infinite }
        details > summary::-webkit-details-marker { display: none }
        @keyframes panelIn { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none } }
        @keyframes sheetIn { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: none } }
        .panel-in { animation: sheetIn 240ms cubic-bezier(.2,.8,.2,1) }
        @media (min-width: 1280px) { .panel-in { animation: panelIn 280ms cubic-bezier(.2,.8,.2,1) } }
        @media (prefers-reduced-motion: reduce) { .ex-flip { animation: none; opacity: 0 } .panel-in { animation: none } }
      `}</style>

      <header className="sticky top-0 z-30 bg-[#0d0e10]/95 border-b border-white/[0.08] px-5 lg:px-10 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-sm bg-cyan-400" aria-hidden />
          <span className="text-[15px] font-semibold tracking-tight">Peak</span>
          <span className="hidden sm:inline text-xs text-zinc-500">Powerbuilding plan</span>
        </div>
        <nav className="flex items-center gap-2">
          {isAdmin && !logging && <span className="hidden sm:block"><SyncPill /></span>}
          {isAdmin && (
            <button onClick={handleSync} disabled={syncing} className={`${ghost} disabled:opacity-50`}>
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Sync Jefit</span>
            </button>
          )}
          <Link to="/fitness" className={ghost}><TrendingUp size={13} /> <span className="hidden sm:inline">Progress</span></Link>
          <Link to="/gym/tracker" className={ghost}><History size={13} /> <span className="hidden sm:inline">Classic tracker</span></Link>
        </nav>
      </header>

      <div className={`px-5 lg:px-10 py-6 lg:py-10 w-full mx-auto flex flex-col lg:grid lg:grid-cols-[19rem_1fr] gap-6 lg:gap-12 lg:items-start transition-[max-width] duration-300 ${
        selected ? 'max-w-6xl xl:max-w-[96rem] xl:grid-cols-[17rem_minmax(0,1fr)_27rem] xl:gap-8' : 'max-w-6xl'
      }`}>
        {/* LEFT: where am I */}
        <aside className={`space-y-6 lg:sticky lg:top-20 ${logging ? 'hidden lg:block' : ''}`}>
          <div>
            <span className="text-xs font-medium text-cyan-300">
              {reviewing ? 'Looking back' : dayIndex === nextDay && weekOffset === 0 ? 'Up next' : 'Viewing'} · Day {day.day_index} of {routine.days.length}
            </span>
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight leading-[1.1] text-white" style={{ margin: '0.5rem 0 0' }}>{shortDayName(day.name)}</h1>
            <p className="text-sm text-zinc-300 mt-2">{focusOf(day.name)}</p>
            {!loading && (
              <p className="text-[13px] text-zinc-400 mt-3 tabular-nums">
                {reviewing
                  ? `${doneCount} of ${day.exercises.length} exercises logged · ${totalSets} working sets`
                  : `${day.exercises.length} exercises · ${totalSets} working sets`}
              </p>
            )}
            {lastDay.date && weekOffset === 0 && (
              <p className="text-xs text-zinc-500 mt-1">Last workout {shortDate(lastDay.date)} (Day {lastDay.day})</p>
            )}
          </div>

          <WeekNav offset={weekOffset} setOffset={n => { setWeekOffset(n); setSelected(null); }} />

          <div>
            <span className="text-xs text-zinc-500">Training days</span>
            <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {routine.days.map(d => {
                const idx = Number(d.day_index);
                const active = idx === dayIndex;
                const done = weekOffset === 0 && idx < nextDay;
                const isNext = weekOffset === 0 && idx === nextDay;
                return (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDay(idx); setSelected(null); }}
                    className={`shrink-0 flex items-center gap-3 rounded-lg border px-3 py-2 text-left cursor-pointer transition-colors ${
                      active ? 'border-cyan-400/50 bg-cyan-400/[0.07]' : 'border-white/[0.08] hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] shrink-0 ${
                      done ? 'bg-emerald-400/15 text-emerald-300' : isNext ? 'bg-cyan-400 text-slate-900 font-semibold' : 'bg-white/[0.06] text-zinc-400'
                    }`}>
                      {done ? <Check size={13} /> : d.day_index}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[13px] font-medium whitespace-nowrap ${active ? 'text-white' : 'text-zinc-200'}`}>{shortDayName(d.name)}</span>
                      {weekOffset === 0 && <span className="block text-[11px] text-zinc-500">{done ? 'Done' : isNext ? 'Next up' : 'Later'}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {!loading && <div className="hidden lg:block"><RankCard ranks={rankInputs} bodyWeightLb={bodyWeightLb} /></div>}

          {!authLoading && !isAdmin && (
            <a href="/login?next=/gym" className="flex items-center gap-2 text-xs text-amber-200/90 hover:text-amber-100">
              <AlertTriangle size={14} className="shrink-0" /> Log in to sync from Jefit
            </a>
          )}
        </aside>

        {/* RIGHT: what to do (or what you did), in order */}
        <main className="min-w-0">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading your history…</p>
          ) : logging && canLog ? (
            <WorkoutSession
              key={day.id}
              dayId={day.id}
              dayName={shortDayName(day.name)}
              plans={plans}
              extraNames={extraNames}
              history={history}
              bodyWeightLb={bodyWeightLb}
              onExit={() => setLogging(false)}
              onFinished={() => { void load(); }}
            />
          ) : reviewing ? (
            <ol className="space-y-3">
              {day.exercises.map((ex, i) => (
                <ReviewRow key={`${day.id}-${week.start}-${i}`} exercise={ex.name} entry={logged[i]} selected={selected} onSelect={toggleSelected} />
              ))}
            </ol>
          ) : (
            <ol className="space-y-3">
              {plans.map((p, i) =>
                p === null ? (
                  <li key={i} className="rounded-xl border border-white/[0.08] px-4 py-3 text-[13px] text-zinc-400">
                    <span className="font-medium text-zinc-200">{day.exercises[i].name}</span>: no history yet. Log a session in Jefit and sync.
                  </li>
                ) : Array.isArray(p) ? (
                  <AccessoryRow key={`${day.id}-${i}`} options={p} selected={selected} onSelect={toggleSelected} />
                ) : (
                  <MainLiftRow key={`${day.id}-${i}`} plan={p} selected={selected} onSelect={toggleSelected} />
                )
              )}
            </ol>
          )}
        </main>

        {!loading && <div className="lg:hidden"><RankCard ranks={rankInputs} bodyWeightLb={bodyWeightLb} /></div>}

        {selected && !logging && (
          <ExerciseHistory
            name={selected}
            rows={history[selected] || []}
            bodyWeightRows={history['Body Weight'] || []}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
      {canLog && !logging && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0d0e10]/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-md flex flex-col items-stretch gap-1.5">
            <button
              onClick={() => { setSelected(null); setLogging(true); }}
              style={{ color: '#0f172a' }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3.5 text-base font-semibold cursor-pointer hover:bg-cyan-300"
            >
              <Play size={17} /> {hasActiveSession ? 'Resume workout' : 'Start workout'} · {shortDayName(day.name)}
            </button>
            {hasActiveSession && (
              <button
                onClick={() => { if (window.confirm('Discard the unfinished workout on this phone? Sets you already ticked stay saved.')) { try { localStorage.removeItem('peak_active_session'); } catch { /* ignore */ } bumpSession(n => n + 1); } }}
                className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer py-1"
              >
                Discard unfinished workout
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
