import { useEffect, useMemo, useState } from 'react';
import { localToday } from '../lib/gymPlan';
import { X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FitnessRow, parseSets, toKg } from '../lib/gymPlan';
import { displayName } from '../lib/exerciseMedia';
import { STANDARDS, TIERS, TIER_BAR, TIER_TEXT, rankOf } from '../lib/strengthStandards';

type Metric = 'oneRm' | 'volume' | 'multiplier';
type Range = '1M' | '3M' | '6M' | '1Y' | 'ALL' | 'CUSTOM';

const METRICS: { id: Metric; label: string; hint: string }[] = [
  { id: 'oneRm', label: 'Est. 1RM', hint: 'Estimated one-rep max' },
  { id: 'volume', label: 'Volume', hint: 'Total weight lifted per session (sets × reps × weight)' },
  { id: 'multiplier', label: '× Bodyweight', hint: 'Estimated 1RM divided by your body weight that day' },
];
const RANGES: { id: Range; label: string }[] = [
  { id: '1M', label: '1M' }, { id: '3M', label: '3M' }, { id: '6M', label: '6M' }, { id: '1Y', label: '1Y' }, { id: 'ALL', label: 'All' },
];
const DAYS: Record<string, number> = { '1M': 30, '3M': 91, '6M': 182, '1Y': 365 };

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}/.test(d);
const ts = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00').getTime();
const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtDay = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

function fmtValue(metric: Metric, v: number) {
  if (metric === 'multiplier') return `${v.toFixed(2)}×`;
  return `${Math.round(v).toLocaleString()} lb`;
}

const sessionDate = (d: string) => {
  const dt = new Date(d.slice(0, 10) + 'T12:00:00');
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: dt.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

// Every logged session for this exercise, newest first: sets, est. 1RM, volume and any note
function SessionList({ rows, pullUpBw }: { rows: FitnessRow[]; pullUpBw?: (date: string) => number }) {
  const [shown, setShown] = useState(8);
  const sessions = useMemo(() => rows.filter(r => isDate(r.workout_date) && r.raw_logs)
    .sort((a, b) => b.workout_date.localeCompare(a.workout_date)), [rows]);
  if (!sessions.length) return null;
  const today = localToday();
  return (
    <div className="space-y-2">
      <span className="text-xs text-zinc-400">Sessions · {sessions.length}</span>
      <ul className="space-y-2">
        {sessions.slice(0, shown).map(r => {
          const types = r.set_types ? r.set_types.split(',') : [];
          // Weighted pull-ups are stored as total load (body + added): show the added weight, with the total beside it.
          // Older rows logged added weight only (well under body weight): those show as added, no total.
          const bw = pullUpBw ? pullUpBw(r.workout_date) : 0;
          const sets = parseSets(r).map((s, i) => {
            const total = s.lb;
            const hasTotal = bw > 0 && total >= bw * 0.6;
            return { ...s, warm: types[i] === 'warm-up', added: pullUpBw ? (hasTotal ? Math.max(0, total - bw) : total) : null, total: hasTotal ? total : null };
          });
          const vol = Number(r.total_volume_lbs) || sets.reduce((n, s) => n + s.lb * s.reps, 0);
          return (
            <li key={r.workout_date} className="rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-medium text-zinc-200">{r.workout_date.slice(0, 10) === today ? 'Today' : sessionDate(r.workout_date)}</span>
                <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                  {Number(r.one_rep_max_lbs) > 0 ? `1RM ${Math.round(Number(r.one_rep_max_lbs))} lb · ` : ''}vol {Math.round(vol).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {sets.map((s, i) => (
                  <span key={i} className={`px-2 py-0.5 rounded-md font-mono text-xs tabular-nums ${s.warm ? 'bg-amber-400/10 text-amber-200/80' : 'bg-white/[0.06] text-zinc-100'}`}>
                    {s.added === null ? `${Math.round(s.lb * 10) / 10}×${s.reps}` : `+${Math.round(s.added * 10) / 10}×${s.reps}`}
                    {s.total !== null && <span className="text-zinc-500"> ({Math.round(s.total)})</span>}
                  </span>
                ))}
              </div>
              {r.notes && r.notes.trim() && <p className="mt-2 text-[12px] text-zinc-400 whitespace-pre-wrap break-words">{r.notes.trim()}</p>}
            </li>
          );
        })}
      </ul>
      {sessions.length > shown && (
        <button onClick={() => setShown(n => n + 10)} className="w-full py-2 rounded-lg border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.06] cursor-pointer">
          Show older sessions ({sessions.length - shown} more)
        </button>
      )}
      <p className="text-[11px] text-zinc-600">Amber sets are warm-ups.{pullUpBw ? ' Pull-ups show added weight, with total load (body + added) in brackets.' : ''}</p>
    </div>
  );
}

export function ExerciseHistory({ name, rows, bodyWeightRows, onClose }: {
  name: string;
  rows: FitnessRow[];
  bodyWeightRows: FitnessRow[];
  onClose: () => void;
}) {
  const [metric, setMetric] = useState<Metric>('oneRm');
  const [range, setRange] = useState<Range>('1M');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // One point per session: est. 1RM, volume, and 1RM relative to body weight on that day
  const bwSeries = useMemo(() => bodyWeightRows.filter(r => isDate(r.workout_date) && Number(r.one_rep_max_lbs) > 0)
    .map(r => ({ t: ts(r.workout_date), lb: Number(r.one_rep_max_lbs) })).sort((a, b) => a.t - b.t), [bodyWeightRows]);
  // body weight on a given day (the latest weigh-in on or before it)
  const bwAt = (date: string | number) => {
    const t = typeof date === 'number' ? date : ts(date);
    let w = bwSeries[0]?.lb ?? 0;
    for (const b of bwSeries) { if (b.t <= t) w = b.lb; else break; }
    return w;
  };
  const points = useMemo(() => {
    return rows.filter(r => isDate(r.workout_date) && Number(r.one_rep_max_lbs) > 0)
      .map(r => {
        const t = ts(r.workout_date);
        const oneRm = Number(r.one_rep_max_lbs);
        const volume = Number(r.total_volume_lbs) || parseSets(r).reduce((s, x) => s + x.lb * x.reps, 0);
        const w = bwAt(t);
        return { t, oneRm, volume, multiplier: w > 0 ? oneRm / w : 0 };
      })
      .sort((a, b) => a.t - b.t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, bwSeries]);

  const visible = useMemo(() => {
    if (range === 'ALL') return points;
    if (range === 'CUSTOM') {
      const a = from ? ts(from) : -Infinity;
      const b = to ? ts(to) : Infinity;
      return points.filter(p => p.t >= a && p.t <= b);
    }
    const cutoff = Date.now() - DAYS[range] * 86400000;
    return points.filter(p => p.t >= cutoff);
  }, [points, range, from, to]);

  // Strength rank uses the latest session overall (not just the visible range)
  const bwLatest = [...bodyWeightRows].filter(r => isDate(r.workout_date) && Number(r.one_rep_max_lbs) > 0)
    .sort((a, b) => a.workout_date.localeCompare(b.workout_date)).pop();
  const bwNow = bwLatest ? Number(bwLatest.one_rep_max_lbs) : 0;
  let estNow = points.length ? points[points.length - 1].oneRm : 0;
  if (name === 'Weighted Pull-Up' && bwNow > 0 && estNow < bwNow * 0.6) estNow += bwNow; // older rows logged added weight only
  const rank = STANDARDS[name] && bwNow > 0 && estNow > 0 ? rankOf(name, estNow / bwNow) : null;

  const values = visible.map(p => p[metric]);
  const latest = values[values.length - 1];
  const first = values[0];
  const best = values.length ? Math.max(...values) : 0;
  const change = values.length > 1 && first > 0 ? ((latest - first) / first) * 100 : null;
  const firstT = points[0]?.t;
  const lastT = points[points.length - 1]?.t;

  const pill = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
      active ? 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/40' : 'text-zinc-400 hover:text-zinc-200'
    }`;

  return (
    <>
      <div className="xl:hidden fixed inset-0 z-[45] bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="region"
        key={name}
        aria-label={`${displayName(name)} history`}
        className="panel-in fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-2xl border border-white/15 bg-[#141518] p-5 space-y-4
                   xl:static xl:z-auto xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:rounded-xl xl:border-white/[0.08] xl:sticky xl:top-24 xl:self-start"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-medium text-cyan-300">History</span>
            <h2 style={{ margin: 0 }} className="text-lg font-semibold text-white leading-tight">{displayName(name)}</h2>
          </div>
          <button onClick={onClose} aria-label="Close history" className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {points.length === 0 ? (
          <p className="text-sm text-zinc-400">No logged sessions yet. Log it in Jefit and sync.</p>
        ) : (
          <>
            <div className="inline-flex flex-wrap gap-1 rounded-xl border border-white/10 p-1">
              {METRICS.map(m => (
                <button key={m.id} title={m.hint} onClick={() => setMetric(m.id)} className={pill(metric === m.id)}>{m.label}</button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Latest', value: latest !== undefined ? fmtValue(metric, latest) : '–' },
                { label: 'Best', value: values.length ? fmtValue(metric, best) : '–' },
                { label: 'Change', value: change === null ? '–' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`, tone: change === null ? '' : change >= 0 ? 'text-emerald-300' : 'text-amber-300' },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-black/25 border border-white/[0.08] px-3 py-2">
                  <span className="text-xs text-zinc-500 block">{s.label}</span>
                  <span className={`font-mono text-[15px] font-semibold tabular-nums ${s.tone || 'text-white'}`}>{s.value}</span>
                </div>
              ))}
            </div>

            {rank && (
              <div className="rounded-lg border border-white/[0.08] p-3 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-zinc-400">Strength rank</span>
                  <span className={`text-sm font-semibold ${rank.tier >= 0 ? TIER_TEXT[rank.tier] : 'text-zinc-400'}`}>{rank.name}</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {TIERS.map((t, i) => (
                    <div key={t} title={`${t}: ${STANDARDS[name][i]}× bodyweight`}>
                      <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                        <div className={`h-full ${TIER_BAR[i]}`} style={{ width: i < rank.tier ? '100%' : i === rank.tier ? `${Math.round(rank.progress * 100)}%` : '0%' }} />
                      </div>
                      <div className={`text-[10px] mt-1 truncate ${i === rank.tier ? TIER_TEXT[i] : 'text-zinc-600'}`}>{t}</div>
                    </div>
                  ))}
                </div>
                <p className="font-mono text-xs text-zinc-400 tabular-nums">
                  {rank.ratio.toFixed(2)}× bodyweight
                  {rank.next && ` · +${Math.max(1, Math.ceil(rank.next.ratio * bwNow - estNow))} lb to ${rank.next.name}`}
                </p>
              </div>
            )}

            <div className="h-56 -mx-2">
              {visible.length < 2 ? (
                <div className="h-full flex items-center justify-center text-[12px] text-zinc-500 px-6 text-center">
                  {visible.length === 1 ? 'Only one session in this range. Widen it to see a trend.' : 'No sessions in this range.'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={visible} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="hist-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtDate}
                      tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={32} />
                    <YAxis domain={['auto', 'auto']} width={44} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => (metric === 'multiplier' ? Number(v).toFixed(2) : Math.round(Number(v)).toLocaleString())} />
                    <Tooltip
                      cursor={{ stroke: 'rgba(34,211,238,0.4)' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as { t: number; oneRm: number; volume: number; multiplier: number };
                        return (
                          <div className="rounded-xl border border-white/15 bg-[#0a0f1c]/95 px-3 py-2 text-[11px] text-zinc-300 shadow-xl">
                            <div className="font-bold text-white mb-1">{fmtDay(p.t)}</div>
                            <div>1RM <b className="text-white tabular-nums">{Math.round(p.oneRm)} lb</b> <span className="text-zinc-500">({toKg(p.oneRm).toFixed(1)} kg)</span></div>
                            <div>Volume <b className="text-white tabular-nums">{Math.round(p.volume).toLocaleString()} lb</b></div>
                            {p.multiplier > 0 && <div>× BW <b className="text-white tabular-nums">{p.multiplier.toFixed(2)}×</b></div>}
                          </div>
                        );
                      }}
                    />
                    <Area type="monotone" dataKey={metric} stroke="#22d3ee" strokeWidth={2.5} fill="url(#hist-fill)"
                      dot={{ r: 3, fill: '#22d3ee', strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive animationDuration={700} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {RANGES.map(r => (
                  <button key={r.id} onClick={() => setRange(r.id)} className={pill(range === r.id)}>{r.label}</button>
                ))}
                <button
                  onClick={() => {
                    setRange('CUSTOM');
                    if (!from && firstT) setFrom(iso(firstT));
                    if (!to && lastT) setTo(iso(lastT));
                  }}
                  className={pill(range === 'CUSTOM')}
                >
                  Custom
                </button>
              </div>
              {range === 'CUSTOM' && (
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}
                    className="bg-black/30 border border-white/15 rounded-lg px-2 py-1 text-zinc-200 [color-scheme:dark]" />
                  <span>to</span>
                  <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}
                    className="bg-black/30 border border-white/15 rounded-lg px-2 py-1 text-zinc-200 [color-scheme:dark]" />
                </div>
              )}
              <p className="text-[11px] text-zinc-500">{visible.length} session{visible.length === 1 ? '' : 's'} shown</p>
            </div>

            <SessionList rows={rows} pullUpBw={name === 'Weighted Pull-Up' ? bwAt : undefined} />
          </>
        )}
      </div>
    </>
  );
}
