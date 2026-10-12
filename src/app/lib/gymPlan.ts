// Training plan for the /gym landing page.
//
// Main lifts (bench, squat, weighted pull-up) use a top set + back-offs on a
// 4-week wave (5s, 4s, 3s, 2s). The estimated max (E) is replayed from history
// since PLAN_START:
//   - top set prescribed at ~1 rep in reserve: E / (1 + (reps + 1) / 30)
//   - hit it (Epley of what you did >= Epley of what was prescribed): E += bump
//     (or jumps to your actual Epley if that is higher)
//   - miss it: E resets to the Epley of what you did, never below 95% of your
//     best E in the last 60 days
//   - two misses in a row, or every 4th completed cycle: next week is a deload
// Accessories use double progression: 8-12 reps, add weight once every set
// hits 12, drop 10% only after missing 8 reps two sessions in a row.
//
// All weights here are in lb; FitnessTracker stores kg in raw_logs.

export interface RoutineExercise {
  name: string;
  setcount: number;
  timer: number;
}

export interface RoutineDay {
  id: string;
  name: string;
  day_index: string;
  exercises: RoutineExercise[];
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  days: RoutineDay[];
}

export interface FitnessRow {
  exercise_name: string;
  workout_date: string;
  raw_logs?: string;
  set_types?: string;
  one_rep_max_lbs?: number;
}

export interface LoggedSet {
  lb: number;
  reps: number;
  type: string; // warm-up | default | failure | drop
}

export function getPowerbuildingRoutine(): Routine {
  return {
    id: 'powerbuilding',
    name: 'Powerbuilding Routine',
    description: 'Autoregulated 5-day cycle combining powerlifting peaking (Bench, Squat, Pull-Ups) with non-erasable bodybuilder accessories.',
    days: [
      {
        id: 'pb-day-1',
        name: 'Day 1: Powerbuilding Push A (Bench Focus)',
        day_index: '1',
        exercises: [
          { name: 'Barbell Bench Press', setcount: 4, timer: 180 },
          { name: 'Barbell Incline Bench Press', setcount: 4, timer: 120 },
          { name: 'Machine Deltoid Raise', setcount: 4, timer: 90 },
          { name: 'unilateral tricep machine extension blue machine ', setcount: 4, timer: 120 },
          { name: 'Machine Ab Crunch', setcount: 4, timer: 120 }
        ]
      },
      {
        id: 'pb-day-2',
        name: 'Day 2: Powerbuilding Pull + Squats A (Squat & Pull-Up Focus)',
        day_index: '2',
        exercises: [
          { name: 'Weighted Pull-Up', setcount: 3, timer: 240 },
          { name: 'Barbell Squat', setcount: 5, timer: 240 },
          { name: 'Dumbbell One-Arm Row', setcount: 4, timer: 120 },
          { name: 'Close Grip Cable Seated Row', setcount: 4, timer: 120 },
          { name: 'Machine Reverse Fly', setcount: 4, timer: 90 },
          { name: 'Machine Bicep Curls Unilateral', setcount: 4, timer: 90 }
        ]
      },
      {
        id: 'pb-day-3',
        name: 'Day 3: Shoulders, Abs & Arms (Accessory Day)',
        day_index: '3',
        exercises: [
          { name: 'Machine Deltoid Raise', setcount: 6, timer: 90 },
          { name: 'Machine Ab Crunch', setcount: 5, timer: 90 },
          { name: 'unilateral tricep machine extension blue machine ', setcount: 5, timer: 120 },
          { name: 'Machine Bicep Curls Unilateral', setcount: 5, timer: 90 },
          { name: 'Dumbbell External Rotation', setcount: 3, timer: 120 }
        ]
      },
      {
        id: 'pb-day-4',
        name: 'Day 4: Powerbuilding Push B (Bench Focus)',
        day_index: '4',
        exercises: [
          { name: 'Barbell Bench Press', setcount: 4, timer: 180 },
          { name: 'Dumbbell Incline Bench Press', setcount: 4, timer: 120 },
          { name: 'Machine Deltoid Raise', setcount: 4, timer: 90 },
          { name: 'Dumbbell Seated One-Arm Tricep Extension', setcount: 4, timer: 120 },
          { name: 'Machine Ab Crunch', setcount: 4, timer: 120 }
        ]
      },
      {
        id: 'pb-day-5',
        name: 'Day 5: Powerbuilding Pull + Squats B (Squat & Pull-Up Focus)',
        day_index: '5',
        exercises: [
          { name: 'Weighted Pull-Up', setcount: 3, timer: 240 },
          { name: 'Barbell Squat', setcount: 5, timer: 240 },
          { name: 'Barbell Row', setcount: 3, timer: 120 },
          { name: 'Cable Seated Row', setcount: 4, timer: 120 },
          { name: 'Dumbbell Seated Bent-Over Reverse Fly', setcount: 4, timer: 90 },
          { name: 'Dumbbell Alternating Bicep Curl', setcount: 4, timer: 90 }
        ]
      }
    ]
  };
}

// --- Constants ---

export const PLAN_START = '2026-10-13'; // first session judged by the plan; its week (Mon 2026-10-12) is week 1
export const LB_PER_KG = 2.2046226218;
export const MAIN_LIFTS = ['Barbell Bench Press', 'Barbell Squat', 'Weighted Pull-Up'];
const WAVE_REPS = [5, 4, 3, 2];
const BUMP_LB: Record<string, number> = { 'Barbell Bench Press': 1.25, 'Barbell Squat': 2.5, 'Weighted Pull-Up': 1.25 };
const BACKOFF = { sets: 3, reps: 6, pct: 0.85 };
const DELOAD = { pct: 0.70, reps: 5, backoffSets: 2 };
const DAY_MS = 24 * 60 * 60 * 1000;

// --- Helpers ---

export const epley = (lb: number, reps: number) => lb * (1 + reps / 30);
export const roundTo = (lb: number, step: number) => Math.round(lb / step) * step;
export const toKg = (lb: number) => lb / LB_PER_KG;
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const parseDay = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const mondayOf = (s: string) => {
  const t = parseDay(s);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * DAY_MS).toISOString().slice(0, 10);
};

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseSets(row: FitnessRow): LoggedSet[] {
  const types = row.set_types ? row.set_types.split(',') : [];
  return (row.raw_logs || '').split(',').map((s, i) => {
    const [w, r] = s.split('x');
    return { lb: (parseFloat(w) || 0) * LB_PER_KG, reps: parseInt(r) || 0, type: types[i] || 'default' };
  }).filter(s => s.reps > 0);
}

// Rows synced from Jefit tag warm-ups; older rows don't, so treat light sets as warm-ups there
export function workingSets(row: FitnessRow): LoggedSet[] {
  const sets = parseSets(row);
  if (row.set_types) return sets.filter(s => s.type !== 'warm-up');
  const max = Math.max(0, ...sets.map(s => s.lb));
  return sets.filter(s => s.lb >= max * 0.75);
}

function datedRows(rows: FitnessRow[]): FitnessRow[] {
  return rows.filter(r => isDate(r.workout_date)).sort((a, b) => a.workout_date.localeCompare(b.workout_date));
}

// Pull-ups: Jefit logs total weight (body + added); some older rows logged added weight only
function pullUpTotal(lb: number, bodyWeightLb: number) {
  return lb < bodyWeightLb * 0.6 ? lb + bodyWeightLb : lb;
}

// --- Main lifts ---

export type Phase = 1 | 2 | 3 | 4 | 'deload';

export interface MainLiftPlan {
  kind: 'main';
  name: string;
  phase: Phase;
  cycle: number;
  estMaxLb: number;
  top: { lb: number; reps: number };
  backoff: { sets: number; reps: number; lb: number };
  isPullUp: boolean;
  bodyWeightLb: number;
  reason: string;
  lastTop?: { date: string; lb: number; reps: number };
}

function prescribe(E: number, phase: Phase, step: number) {
  const reps = phase === 'deload' ? DELOAD.reps : WAVE_REPS[phase - 1];
  const raw = phase === 'deload' ? E * DELOAD.pct : E / (1 + (reps + 1) / 30);
  const lb = roundTo(raw, step);
  return {
    top: { lb, reps },
    backoff: { sets: phase === 'deload' ? DELOAD.backoffSets : BACKOFF.sets, reps: BACKOFF.reps, lb: roundTo(lb * BACKOFF.pct, step) },
  };
}

export function planMainLift(name: string, rows: FitnessRow[], bodyWeightLb: number, today = localToday()): MainLiftPlan | null {
  const isPullUp = name === 'Weighted Pull-Up';
  const step = 5;
  const sessions = datedRows(rows).map(r => {
    const sets = workingSets(r).map(s => ({ ...s, lb: isPullUp ? pullUpTotal(s.lb, bodyWeightLb) : s.lb }));
    const top = sets.reduce<LoggedSet | null>((best, s) => (!best || s.lb > best.lb || (s.lb === best.lb && s.reps > best.reps) ? s : best), null);
    const best = Math.max(0, ...sets.filter(s => s.reps <= 10).map(s => epley(s.lb, s.reps)));
    return { date: r.workout_date, top, best };
  }).filter((s): s is { date: string; top: LoggedSet; best: number } => !!s.top);
  if (sessions.length === 0) return null;

  // Calibrate from the best set in the 30 days before the plan started (or the first session after it)
  const before = sessions.filter(s => s.date < PLAN_START && parseDay(PLAN_START) - parseDay(s.date) <= 30 * DAY_MS);
  const seed = before.length ? before : sessions.slice(0, 1);
  let E = Math.max(...seed.map(s => s.best || epley(s.top.lb, Math.min(s.top.reps, 10))));
  const eHistory: { date: string; E: number }[] = [{ date: PLAN_START, E }];

  let phase: Phase = 1;
  let cycle = 1;
  let misses = 0;
  let reason = 'Week 1 of the plan.';
  const currentWeek = mondayOf(today);
  const planSessions = sessions.filter(s => s.date >= PLAN_START);
  const weeks = [...new Set(planSessions.map(s => mondayOf(s.date)))];

  for (const week of weeks) {
    for (const s of planSessions.filter(p => mondayOf(p.date) === week)) {
      if (phase === 'deload') continue;
      const { top } = prescribe(E, phase, step);
      const did = epley(s.top.lb, s.top.reps);
      if (did >= epley(top.lb, top.reps) - 0.01) {
        E = Math.max(E + BUMP_LB[name], did);
        misses = 0;
        reason = `Hit ${Math.round(s.top.lb)}×${s.top.reps} on ${s.date}: max up.`;
      } else {
        const best60 = Math.max(...eHistory.filter(h => parseDay(s.date) - parseDay(h.date) <= 60 * DAY_MS).map(h => h.E));
        E = Math.max(did, best60 * 0.95);
        misses += 1;
        reason = `Missed on ${s.date} (${Math.round(s.top.lb)}×${s.top.reps} vs ${top.lb}×${top.reps}): max reset.`;
      }
      eHistory.push({ date: s.date, E });
    }
    // The current week isn't over: keep its phase for the rest of the week
    if (week >= currentWeek) break;
    if (phase === 'deload') {
      phase = 1;
      cycle += 1;
      reason = 'Deload done: new cycle.';
    } else if (misses >= 2) {
      phase = 'deload';
      misses = 0;
      reason = 'Two misses in a row: deload week.';
    } else if (phase === 4) {
      if (cycle % 4 === 0) {
        phase = 'deload';
        reason = `Finished cycle ${cycle}: planned deload.`;
      } else {
        phase = 1;
        cycle += 1;
        reason = `Finished cycle ${cycle - 1}: new cycle.`;
      }
    } else {
      phase = (phase + 1) as Phase;
    }
  }

  const { top, backoff } = prescribe(E, phase, step);
  const last = sessions[sessions.length - 1];
  return {
    kind: 'main', name, phase, cycle, estMaxLb: E, top, backoff, isPullUp, bodyWeightLb, reason,
    lastTop: { date: last.date, lb: last.top.lb, reps: last.top.reps },
  };
}

// --- Accessories ---

export interface AccessoryPlan {
  kind: 'accessory';
  name: string;
  lb: number | null;
  sets: number;
  repLow: number;
  repHigh: number;
  note: string;
  last?: { date: string; sets: LoggedSet[] };
}

const REP_LOW = 8;
const REP_HIGH = 12;

export function planAccessory(name: string, rows: FitnessRow[], setcount: number): AccessoryPlan {
  const sessions = datedRows(rows).map(r => ({ date: r.workout_date, sets: workingSets(r) })).filter(s => s.sets.length > 0);
  const base = { kind: 'accessory' as const, name, sets: setcount, repLow: REP_LOW, repHigh: REP_HIGH };
  if (sessions.length === 0) {
    return { ...base, lb: null, note: `No history yet: pick a weight you can do for ${REP_LOW}–${REP_HIGH}.` };
  }
  const last = sessions[sessions.length - 1];
  const W = Math.max(...last.sets.map(s => s.lb));
  const atW = last.sets.filter(s => s.lb >= W - 0.5);
  const step = W < 30 ? 2.5 : 5;
  const shown = (lb: number) => roundTo(lb, 0.5);

  if (atW.every(s => s.reps >= REP_HIGH)) {
    return { ...base, lb: shown(W + step), note: `Hit ${REP_HIGH}+ on every set last time: +${step} lb.`, last };
  }
  if (atW.some(s => s.reps < REP_LOW)) {
    const prev = sessions[sessions.length - 2];
    const prevW = prev ? Math.max(...prev.sets.map(s => s.lb)) : 0;
    const missedBefore = !!prev && Math.abs(prevW - W) < 0.5 && prev.sets.filter(s => s.lb >= W - 0.5).some(s => s.reps < REP_LOW);
    if (missedBefore) {
      return { ...base, lb: shown(roundTo(W * 0.9, step)), note: `Under ${REP_LOW} reps two sessions running: down 10%.`, last };
    }
    return { ...base, lb: shown(W), note: `Same weight; get every set to ${REP_LOW}+.`, last };
  }
  return { ...base, lb: shown(W), note: `Same weight; add reps until every set hits ${REP_HIGH}.`, last };
}

// --- Which day is next ---

const ACCESSORY_DAY_LIFTS = [
  'Machine Deltoid Raise', 'Machine Ab Crunch', 'unilateral tricep machine extension blue machine ',
  'Machine Bicep Curls Unilateral', 'Dumbbell External Rotation', 'Barbell Incline Bench Press',
  'Dumbbell One-Arm Row', 'Close Grip Cable Seated Row', 'Machine Reverse Fly', 'Dumbbell Incline Bench Press',
  'Dumbbell Seated One-Arm Tricep Extension', 'Barbell Row', 'Cable Seated Row',
  'Dumbbell Seated Bent-Over Reverse Fly', 'Dumbbell Alternating Bicep Curl',
];

// Same state machine as the old tracker: bench days are 1/4, squat + pull-up days 2/5, accessory-only days 3
export function lastAssignedDay(history: Record<string, FitnessRow[]>): { day: number; date: string | null } {
  const dates: Record<string, { bench: boolean; squatPull: boolean; acc: boolean }> = {};
  const mark = (name: string, key: 'bench' | 'acc') => (history[name] || []).forEach(r => {
    if (!isDate(r.workout_date)) return;
    dates[r.workout_date] ??= { bench: false, squatPull: false, acc: false };
    dates[r.workout_date][key] = true;
  });
  mark('Barbell Bench Press', 'bench');
  ACCESSORY_DAY_LIFTS.forEach(n => mark(n, 'acc'));
  const pullDates = new Set((history['Weighted Pull-Up'] || []).map(r => r.workout_date));
  (history['Barbell Squat'] || []).forEach(r => {
    if (!isDate(r.workout_date) || !pullDates.has(r.workout_date)) return;
    dates[r.workout_date] ??= { bench: false, squatPull: false, acc: false };
    dates[r.workout_date].squatPull = true;
  });

  let last = 0;
  let lastDate: string | null = null;
  for (const date of Object.keys(dates).sort()) {
    const d = dates[date];
    let assigned = 0;
    if (d.squatPull) assigned = last === 0 || last === 1 || last === 5 ? 2 : 5;
    else if (d.bench) assigned = last === 2 || last === 3 ? 4 : 1;
    else if (d.acc) assigned = 3;
    if (assigned) {
      last = assigned;
      lastDate = date;
    }
  }
  return { day: last, date: lastDate };
}

export function nextDayIndex(history: Record<string, FitnessRow[]>): number {
  const { day } = lastAssignedDay(history);
  return day === 0 ? 1 : (day % 5) + 1;
}
