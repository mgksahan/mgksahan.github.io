import { FitnessRow, localToday } from '../lib/gymPlan';

export interface PastNote { date: string; text: string }

// Every note ever written for an exercise, newest first
export const pastNotes = (rows: FitnessRow[]): PastNote[] =>
  rows.filter(r => r.notes && r.notes.trim() && /^\d{4}-/.test(r.workout_date))
    .map(r => ({ date: r.workout_date.slice(0, 10), text: r.notes!.trim() }))
    .sort((a, b) => b.date.localeCompare(a.date));

const label = (d: string) => {
  if (d === localToday()) return 'Earlier today';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: dt.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

export function NoteHistory({ notes }: { notes: PastNote[] }) {
  if (!notes.length) return <p className="text-xs text-zinc-500">No notes yet for this exercise.</p>;
  return (
    <ul className="space-y-2">
      {notes.map(n => (
        <li key={n.date} className="rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2">
          <div className="text-[11px] text-zinc-500">{label(n.date)}</div>
          <p className="text-[13px] text-zinc-200 whitespace-pre-wrap break-words">{n.text}</p>
        </li>
      ))}
    </ul>
  );
}
