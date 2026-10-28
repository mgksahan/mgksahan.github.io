import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Dumbbell, RefreshCw, AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../../apiService';
import { useAuth } from '../context/AuthContext';
import {
  FitnessRow, Routine, MainLiftPlan, AccessoryPlan, MAIN_LIFTS,
  getPowerbuildingRoutine, planMainLift, planAccessoryOptions, accessorySets, alternativesFor, restLabel, AccessoryOption, nextDayIndex, lastAssignedDay, roundTo, toKg, withRoutineFixes,
} from '../lib/gymPlan';

const shortDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// "Day 2: Powerbuilding Pull + Squats A (Squat & Pull-Up Focus)" -> "Pull + Squats A"
const shortDayName = (name: string) =>
  name.replace(/^Day \d+:\s*/, '').replace(/^Powerbuilding\s+/, '').replace(/\s*\(.*\)\s*$/, '');

function weightLabel(plan: MainLiftPlan, lb: number) {
  if (!plan.isPullUp) return `${lb} lb`;
  const added = roundTo(lb - plan.bodyWeightLb, 5);
  return added <= 0 ? 'Bodyweight' : `+${added} lb`;
}

function MainLiftCard({ plan }: { plan: MainLiftPlan }) {
  const deload = plan.phase === 'deload';
  return (
    <div className="border border-zinc-900 bg-zinc-900/30 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-extrabold text-sm text-white leading-snug">{plan.name}</h3>
        <span className={`shrink-0 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider border ${
          deload ? 'bg-sky-500/10 text-sky-300 border-sky-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
        }`}>
          {deload ? `Deload · Cycle ${plan.cycle}` : `Week ${plan.phase} of 4 · Cycle ${plan.cycle}`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Top set</span>
          <span className="text-2xl font-black text-white tabular-nums">
            {weightLabel(plan, plan.top.lb)} <span className="text-zinc-400">× {plan.top.reps}</span>
          </span>
          {!plan.isPullUp && (
            <span className="text-[10px] text-zinc-500 tabular-nums block">{toKg(plan.top.lb).toFixed(1)} kg</span>
          )}
        </div>
        <div>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Back-offs</span>
          <span className="text-lg font-extrabold text-zinc-200 tabular-nums">
            {plan.backoff.sets} × {plan.backoff.reps} <span className="text-zinc-400">@ {weightLabel(plan, plan.backoff.lb)}</span>
          </span>
          {!plan.isPullUp && (
            <span className="text-[10px] text-zinc-500 tabular-nums block">{toKg(plan.backoff.lb).toFixed(1)} kg</span>
          )}
        </div>
      </div>

      <div>
        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Warm-ups</span>
        <span className="text-[12px] font-bold text-zinc-300 tabular-nums">
          {plan.warmups.map(w => `${!plan.isPullUp && w.lb === 45 ? 'Bar' : weightLabel(plan, w.lb).replace(' lb', '')}×${w.reps}`).join(' · ')}
        </span>
        <span className="text-[10px] text-zinc-500 block">Mark these as warm-up sets in Jefit.</span>
      </div>

      <div>
        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Rest</span>
        <div className="text-[11px] text-zinc-300 tabular-nums space-y-0.5">
          <div>Between warm-ups <span className="text-white font-bold">{plan.rest.warmups}</span></div>
          <div>Last warm-up → top set <span className="text-white font-bold">{plan.rest.toTop}</span></div>
          <div>Top set → first back-off <span className="text-white font-bold">{plan.rest.toBackoff}</span></div>
          <div>Between back-offs <span className="text-white font-bold">{plan.rest.backoffs}</span></div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-400">
        {deload
          ? 'Deload week: keep every rep fast and easy.'
          : `Leave about 1 rep in the tank. Miss the top set? Do ${plan.backoff.sets - 1} back-offs instead of ${plan.backoff.sets}.`}
      </p>

      <div className="text-[10px] text-zinc-500 border-t border-zinc-900 pt-2 space-y-0.5">
        <div className="tabular-nums">
          Est. max {Math.round(plan.estMaxLb)} lb
          {plan.isPullUp && ` (incl. ${Math.round(plan.bodyWeightLb)} lb bodyweight)`}
          {plan.lastTop && ` · Last top set ${Math.round(plan.lastTop.lb)}×${plan.lastTop.reps} (${shortDate(plan.lastTop.date)})`}
        </div>
        <div>{plan.reason}</div>
      </div>
    </div>
  );
}

function AccessoryCard({ plan }: { plan: AccessoryPlan }) {
  return (
    <div className="border border-zinc-900 bg-zinc-900/20 rounded-2xl px-4 py-3 space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-bold text-[13px] text-zinc-100 leading-snug">{plan.name.trim()}</h3>
        <span className="shrink-0 text-base font-extrabold text-white tabular-nums">
          {plan.lb !== null ? `${plan.lb} lb` : '—'}
          <span className="text-zinc-400 font-bold text-sm"> · {plan.sets} × {plan.repLow}–{plan.repHigh}</span>
        </span>
      </div>
      <p className="text-[11px] text-zinc-400">{plan.note}</p>
      <p className="text-[10px] text-zinc-500">Rest {restLabel(plan.restSec)} between sets</p>
      {plan.last && (
        <p className="text-[10px] text-zinc-500 tabular-nums">
          Last ({shortDate(plan.last.date)}): {plan.last.sets.map(s => `${Math.round(s.lb)}×${s.reps}`).join(', ')}
        </p>
      )}
    </div>
  );
}

const daysAgo = (d: string | null) => {
  if (!d) return 'never logged';
  const n = Math.round((Date.now() - new Date(d + 'T12:00:00').getTime()) / 86400000);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
};

// One pane per either/or exercise: swipe or tap the arrows to switch. Opens on the one done most recently.
function AccessoryCarousel({ options }: { options: AccessoryOption[] }) {
  const start = options.reduce((best, o, i) => ((o.lastDate ?? '') > (options[best].lastDate ?? '') ? i : best), 0);
  const [index, setIndex] = useState(start);
  const track = useRef<HTMLDivElement>(null);

  const goTo = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    setIndex(i);
  };
  useEffect(() => {
    const el = track.current;
    if (el) el.scrollTo({ left: start * el.clientWidth });
  }, [start]);

  return (
    <div className="border border-zinc-900 bg-zinc-900/20 rounded-2xl overflow-hidden">
      <div
        ref={track}
        onScroll={e => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== index) setIndex(i);
        }}
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {options.map(o => (
          <div key={o.plan.name} className="snap-center shrink-0 w-full px-4 py-3 space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-bold text-[13px] text-zinc-100 leading-snug">{o.plan.name.trim()}</h3>
              <span className="shrink-0 text-base font-extrabold text-white tabular-nums">
                {o.plan.lb !== null ? `${o.estimated ? '~' : ''}${o.plan.lb} lb` : '—'}
                <span className="text-zinc-400 font-bold text-sm"> · {o.plan.sets} × {o.plan.repLow}–{o.plan.repHigh}</span>
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">{o.plan.note}</p>
            <p className="text-[10px] text-zinc-500">Rest {restLabel(o.plan.restSec)} between sets</p>
            <p className="text-[10px] text-zinc-500 tabular-nums">
              Last done {daysAgo(o.lastDate)}
              {o.plan.last && ` · ${o.plan.last.sets.map(s => `${Math.round(s.lb)}×${s.reps}`).join(', ')}`}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-zinc-900 px-2 py-1">
        <button aria-label="Previous option" disabled={index === 0} onClick={() => goTo(index - 1)}
          className="p-1.5 text-zinc-400 disabled:opacity-20"><ChevronLeft size={16} /></button>
        <span className="flex items-center gap-1.5">
          {options.map((o, i) => (
            <span key={o.plan.name} className={`h-1.5 rounded-full ${i === index ? 'w-4 bg-rose-400' : 'w-1.5 bg-zinc-700'}`} />
          ))}
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Swap · {index + 1}/{options.length}</span>
        </span>
        <button aria-label="Next option" disabled={index === options.length - 1} onClick={() => goTo(index + 1)}
          className="p-1.5 text-zinc-400 disabled:opacity-20"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function GymPlanPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [routine, setRoutine] = useState<Routine>(getPowerbuildingRoutine());
  const [history, setHistory] = useState<Record<string, FitnessRow[]>>({});
  const [bodyWeightLb, setBodyWeightLb] = useState(160);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      let active = getPowerbuildingRoutine();
      try {
        const cloud = await apiService.fetchFitnessHistory('__CONFIG_ROUTINES__');
        const latest = cloud?.find((l: FitnessRow) => l.workout_date === 'LATEST');
        const saved = latest?.raw_logs ? (JSON.parse(latest.raw_logs) as Routine[]).find(r => r.id === 'powerbuilding') : undefined;
        if (saved) active = withRoutineFixes(saved);
      } catch (e) {
        console.error('Failed to load saved routine, using default:', e);
      }
      setRoutine(active);

      const names = new Set<string>([...MAIN_LIFTS, 'Body Weight']);
      getPowerbuildingRoutine().days.concat(active.days).forEach(d => d.exercises.forEach(e => { names.add(e.name); alternativesFor(e.name).forEach(a => names.add(a)); }));
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
      ? planMainLift(ex.name, history[ex.name] || [], bodyWeightLb)
      : planAccessoryOptions(ex.name, history, accessorySets(day.day_index, ex.name, ex.setcount), ex.timer, day.exercises.map(e => e.name))
  ), [day, history, bodyWeightLb]);

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

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 text-white pb-8 animate-fade-in">
      <div className="sticky top-0 z-30 bg-zinc-950 border-b border-zinc-900 px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Dumbbell size={22} className="text-rose-500" />
          <h1 className="text-lg font-black tracking-tight text-white font-outfit uppercase">Today's Plan</h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest border border-zinc-800 rounded-xl px-3 py-1.5 hover:bg-zinc-900/40 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} /> Sync Jefit
            </button>
          )}
          <Link
            to="/gym/tracker"
            className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest border border-zinc-800 rounded-xl px-3 py-1.5 hover:bg-zinc-900/40"
          >
            Old tracker
          </Link>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-5 max-w-2xl w-full mx-auto">
        {!authLoading && !isAdmin && (
          <a
            href="/login?next=/gym"
            className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              Log in to sync from Jefit.
            </span>
            <span className="font-bold uppercase text-xs tracking-wider">Log in</span>
          </a>
        )}

        <div className="space-y-1">
          <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest block">
            {dayIndex === nextDay ? 'Next up' : 'Viewing'}
          </span>
          <h2 className="text-xl font-black text-white leading-tight">
            Day {day.day_index}: {shortDayName(day.name)}
          </h2>
          {lastDay.date && (
            <p className="text-[11px] text-zinc-500">
              Last workout: {shortDate(lastDay.date)} (Day {lastDay.day})
            </p>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {routine.days.map(d => {
            const idx = Number(d.day_index);
            const active = idx === dayIndex;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDay(idx)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left cursor-pointer transition-colors ${
                  active ? 'border-rose-500/60 bg-rose-500/10' : 'border-zinc-900 hover:bg-zinc-900/40'
                }`}
              >
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                  Day {d.day_index}
                  {idx === nextDay && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-label="Next up" />}
                </span>
                <span className="text-[11px] font-bold text-zinc-200 whitespace-nowrap">{shortDayName(d.name)}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading your history…</p>
        ) : (
          <div className="space-y-3">
            {plans.map((p, i) =>
              p === null ? (
                <div key={i} className="border border-zinc-900 rounded-2xl px-4 py-3 text-[12px] text-zinc-400">
                  <span className="font-bold text-zinc-200">{day.exercises[i].name}</span>: no history yet. Log a session in Jefit and sync.
                </div>
              ) : Array.isArray(p) ? (
                p.length === 1 ? <AccessoryCard key={i} plan={p[0].plan} /> : <AccessoryCarousel key={`${day.id}-${i}`} options={p} />
              ) : (
                <MainLiftCard key={i} plan={p} />
              )
            )}
          </div>
        )}

        <Link
          to="/fitness"
          className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-widest border border-zinc-900 rounded-2xl px-4 py-3 hover:bg-zinc-900/40"
        >
          Progress charts <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
