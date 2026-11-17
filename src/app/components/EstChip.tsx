import { useState } from 'react';
import { parseEstimate } from '../lib/trackStore';

// "Prediction vs actual" for one task: shows time tracked against its estimate, and lets you set or change the estimate.
// Green = under the estimate, amber = over, red = over by half or more.
const fmtMin = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') + 'm' : ''}`);
export const fmtEstMin = fmtMin;

export function estTone(actualMin: number, est: number | undefined) {
  if (!est) return 'text-zinc-500';
  const r = actualMin / est;
  return r > 1.5 ? 'text-red-400' : r > 1 ? 'text-amber-300' : 'text-emerald-300';
}

export function EstChip({ est, loggedMs, done, onChange, className = '' }: { est?: number; loggedMs: number; done: boolean; onChange: (minutes: number | null) => void; className?: string }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState('');
  const actual = Math.round(loggedMs / 60000);
  const open = () => { setVal(est ? fmtMin(est).replace(' ', '') : ''); setEdit(true); };
  const commit = () => {
    setEdit(false);
    if (!val.trim()) { onChange(null); return; }       // empty clears the estimate
    const m = parseEstimate(val);
    if (m !== null && m > 0) onChange(m);              // anything that is not a time is ignored
  };
  if (edit) {
    return <input autoFocus aria-label="Estimate" placeholder="45m, 1h30" value={val} onChange={e => setVal(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(false); }}
      className={`w-24 rounded-md bg-white/5 border border-white/20 px-1.5 py-0 text-[11px] text-white ${className}`} />;
  }
  if (est) {
    return <button onClick={open} title={`Estimated ${fmtMin(est)}, tracked ${fmtMin(actual)} (${Math.round(actual / est * 100)}%). Click to change.`}
      className={`inline-flex items-center gap-1 text-[11px] ${estTone(actual, est)}! hover:underline ${className}`}>⏱ {fmtMin(actual)} / {fmtMin(est)}</button>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] text-zinc-500 ${className}`}>
      {actual > 0 && <span>{fmtMin(actual)} logged</span>}
      {!done && <button onClick={open} title="Estimate how long this will take, to compare with the time you actually track" className="text-zinc-400! hover:text-cyan-300!">+ Est</button>}
    </span>
  );
}
