import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { GripVertical, X, ListPlus, ListChecks, Plus, ChevronDown, Check, Play, Pause, Layers, CalendarDays } from 'lucide-react';
import {
  Cat, Card, Lane, Sub, Task, DEFAULT_LANES, useTrack, adoptTasks, settleDoneTasks, saveCard, removeCard, saveTask, removeTask, saveSettings, uid,
} from '../lib/trackStore';

// Board tab: sticky-note cards in swim lanes (a small kanban). Drag a card by its grip to reorder or move
// it to another lane; neighbours glide out of the way. A card can be put on the task list, which creates a
// task (no due date) linked to the card. Cards sync as "card" items, lanes live in the settings item.

const CATS: Record<Cat, { label: string; note: string; dot: string; edge: string }> = {
  work:  { label: 'Work',     note: 'bg-sky-400/15 border-sky-400/40',         dot: 'bg-sky-400',     edge: 'border-l-sky-400' },
  learn: { label: 'Learning', note: 'bg-amber-400/15 border-amber-400/40',     dot: 'bg-amber-400',   edge: 'border-l-amber-400' },
  life:  { label: 'Personal', note: 'bg-emerald-400/15 border-emerald-400/40', dot: 'bg-emerald-400', edge: 'border-l-emerald-400' },
};
const NEXT_CAT: Record<Cat, Cat> = { work: 'learn', learn: 'life', life: 'work' };
const field = 'w-full min-w-0 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-300/60';
const spring = { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 } as const;

const fmtDur = (ms: number) => { const m = Math.round(ms / 60000); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
// What a card's time is logged against: its linked task, or the card itself when it has none (an epic can be tracked on its own)
const trackIdOf = (c: Card, tasks: Record<string, Task>) => (c.taskId && tasks[c.taskId] ? c.taskId : c.id);

export function BoardTab({ onTrack, trackingId, running }: { onTrack: (cat: Cat, id: string, title: string) => void; trackingId: string | null; running: boolean }) {
  const s = useTrack();
  const lanes: Lane[] = s.settings.lanes?.length ? s.settings.lanes : DEFAULT_LANES;
  const laneIds = lanes.map(l => l.id);
  const cards = Object.values(s.cards);
  const laneOf = (c: Card) => (laneIds.includes(c.lane) ? c.lane : laneIds[0]);
  const inLane = (id: string) => cards.filter(c => laneOf(c) === id).sort((a, b) => a.pos - b.pos);

  // Time logged per activity id, so a card can show its own total plus its subtasks' tasks
  const loggedBy: Record<string, number> = {};
  Object.values(s.entries).forEach(e => { if (e.taskId) loggedBy[e.taskId] = (loggedBy[e.taskId] || 0) + (e.end - e.start); });
  const loggedOf = (c: Card) => {
    const ids = new Set([trackIdOf(c, s.tasks), ...(c.epic ?? (c.subs?.length ?? 0) > 0 ? (c.subs ?? []).map(x => x.taskId).filter(Boolean) as string[] : [])]);
    let t = 0; ids.forEach(i => { t += loggedBy[i] || 0; }); return t;
  };

  // Put every task on the board (once), and keep new tasks coming in
  const laneKey = laneIds.join(',');
  useEffect(() => { adoptTasks(laneIds); settleDoneTasks(laneIds); }, [s.tasks, laneKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const laneEls = useRef<Record<string, HTMLElement | null>>({});
  const [over, setOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  // Which lane is under the pointer (nearest one if it is between lanes)
  const laneAt = (clientX: number): string => {
    let best = laneIds[0], dist = Infinity;
    for (const id of laneIds) {
      const r = laneEls.current[id]?.getBoundingClientRect();
      if (!r) continue;
      const d = clientX < r.left ? r.left - clientX : clientX > r.right ? clientX - r.right : 0;
      if (d < dist) { dist = d; best = id; }
    }
    return best;
  };

  const drop = (card: Card, clientX: number, clientY: number) => {
    const target = laneAt(clientX);
    const others = inLane(target).filter(c => c.id !== card.id);
    // Slot = number of cards whose middle is above the pointer
    const slot = others.filter(c => {
      const el = laneEls.current[target]?.querySelector(`[data-card="${c.id}"]`);
      const r = el?.getBoundingClientRect();
      return r ? r.top + r.height / 2 < clientY : false;
    }).length;
    const before = others[slot - 1]?.pos, after = others[slot]?.pos;
    const pos = before === undefined && after === undefined ? 1 : before === undefined ? after! - 1 : after === undefined ? before + 1 : (before + after) / 2;
    if (target !== laneOf(card) || pos !== card.pos) saveCard({ ...card, lane: target, pos });
  };

  const addCard = (lane: string, text: string, cat: Cat) => {
    const last = inLane(lane).at(-1);
    saveCard({ id: uid(), text, lane, pos: (last?.pos ?? 0) + 1, cat });
  };

  const putOnTasks = (c: Card) => {
    const id = uid();
    saveTask({ id, title: (c.text.split('\n')[0] || 'Untitled').slice(0, 120), cat: c.cat, pts: 10, due: c.due ?? '', done: false });
    saveCard({ ...c, taskId: id, due: undefined });
  };
  const takeOffTasks = (c: Card) => {
    const t = c.taskId ? s.tasks[c.taskId] : undefined;
    if (c.taskId) removeTask(c.taskId);
    saveCard({ ...c, taskId: null, due: t?.due || c.due });
  };

  const renameLane = (id: string, name: string) => saveSettings({ lanes: lanes.map(l => (l.id === id ? { ...l, name: name.trim() || l.name } : l)) });
  const addLane = () => saveSettings({ lanes: [...lanes, { id: uid(), name: 'New lane' }] });
  const deleteLane = (id: string) => {
    if (lanes.length < 2) return;
    const rest = lanes.filter(l => l.id !== id);
    const tail = inLane(rest[0].id).at(-1)?.pos ?? 0;
    inLane(id).forEach((c, i) => saveCard({ ...c, lane: rest[0].id, pos: tail + 1 + i }));
    saveSettings({ lanes: rest });
  };

  return (
    <div className="flex gap-3 items-stretch min-h-[calc(100vh-175px)] overflow-x-auto">
      {lanes.map(l => (
        <div data-lanecol
          key={l.id}
          ref={el => { laneEls.current[l.id] = el; }}
          className={`flex-1 basis-0 min-w-[150px] rounded-xl border p-3 flex flex-col gap-2.5 transition-colors duration-200 ${over === l.id && dragging ? 'border-cyan-300/70 bg-cyan-300/[0.07]' : 'border-white/10 bg-white/[0.03]'}`}
        >
          <LaneHeader lane={l} count={inLane(l.id).length} canDelete={lanes.length > 1} onRename={n => renameLane(l.id, n)} onDelete={() => deleteLane(l.id)} />
          <div className="flex flex-col gap-2.5 flex-1">
            <AnimatePresence initial={false}>
              {inLane(l.id).map(c => (
                <CardNote
                  key={c.id} card={c} lane={l.id}
                  tasks={s.tasks} task={c.taskId ? s.tasks[c.taskId] : undefined} logged={loggedOf(c)} tracking={trackingId === trackIdOf(c, s.tasks)} running={running} onTrack={() => onTrack(c.cat, trackIdOf(c, s.tasks), c.text.split('\n')[0].slice(0, 120))} onPut={() => putOnTasks(c)} onTake={() => takeOffTasks(c)}
                  onStart={() => setDragging(c.id)}
                  onMove={x => { const t = laneAt(x); setOver(p => (p === t ? p : t)); }}
                  onEnd={(x, y) => { setDragging(null); setOver(null); drop(c, x, y); }}
                />
              ))}
            </AnimatePresence>
            {!inLane(l.id).length && <div className="text-xs text-zinc-600 text-center py-2">Drop cards here</div>}
          </div>
          <Jot onAdd={(t, cat) => addCard(l.id, t, cat)} />
        </div>
      ))}
      <button onClick={addLane} className="shrink-0 self-start rounded-xl border border-dashed border-white/15 px-3 py-3 text-sm text-zinc-400! hover:text-white! hover:border-white/30 inline-flex items-center gap-1.5"><Plus size={14} />Lane</button>
    </div>
  );
}

function LaneHeader({ lane, count, canDelete, onRename, onDelete }: { lane: Lane; count: number; canDelete: boolean; onRename: (n: string) => void; onDelete: () => void }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(lane.name);
  const done = () => { setEdit(false); if (val.trim() !== lane.name) onRename(val); };
  return (
    <div className="flex items-center gap-2 px-0.5">
      {edit
        ? <input autoFocus className={`${field} !py-1`} value={val} onChange={e => setVal(e.target.value)} onBlur={done} onKeyDown={e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') { setVal(lane.name); setEdit(false); } }} />
        : <button onClick={() => { setVal(lane.name); setEdit(true); }} title="Rename lane" className="text-[11px] uppercase tracking-[0.09em] font-semibold text-zinc-300! hover:text-white! truncate">{lane.name}</button>}
      <span className="text-[11px] text-zinc-600">{count}</span>
      {canDelete && !edit && <button onClick={() => { if (!count || confirm(`Delete lane "${lane.name}"? Its cards move to the first lane.`)) onDelete(); }} aria-label="Delete lane" className="ml-auto text-zinc-600! hover:text-red-400!"><X size={13} /></button>}
    </div>
  );
}

function Jot({ onAdd }: { onAdd: (text: string, cat: Cat) => void }) {
  const [text, setText] = useState('');
  const [cat, setCat] = useState<Cat>('work');
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (text.trim()) { onAdd(text.trim(), cat); setText(''); } };
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <button type="button" onClick={() => setCat(NEXT_CAT[cat])} title={`${CATS[cat].label} (click to change)`} aria-label={`Category: ${CATS[cat].label}`} className="p-1.5"><span className={`block h-3 w-3 rounded-full ${CATS[cat].dot}`} /></button>
      <input className={`${field} !py-1.5`} placeholder="Jot something…" autoComplete="off" value={text} onChange={e => setText(e.target.value)} />
    </form>
  );
}

function CardNote({ card, lane, task, tasks, logged, tracking, running, onTrack, onPut, onTake, onStart, onMove, onEnd }: {
  card: Card; lane: string; task?: Task; tasks: Record<string, Task>; logged: number; tracking: boolean; running: boolean; onTrack: () => void; onPut: () => void; onTake: () => void;
  onStart: () => void; onMove: (clientX: number) => void; onEnd: (clientX: number, clientY: number) => void;
}) {
  const controls = useDragControls();
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(card.text);
  const linked = !!card.taskId && !!task;
  const [open, setOpen] = useState(false);
  const [subText, setSubText] = useState('');
  const subs = card.subs ?? [];
  // Due date: a linked task owns it; a card with no task keeps its own
  const due = task ? task.due : card.due ?? '';
  const [editDue, setEditDue] = useState(false);
  const setDue = (v: string) => { if (task) saveTask({ ...task, due: v }); else saveCard({ ...card, due: v }); };
  const overdue = !!due && due < new Date().toLocaleDateString('en-CA');
  const canDue = !task?.done;
  const epic = card.epic ?? subs.length > 0;
  const subDone = (x: Sub) => (x.taskId && tasks[x.taskId] ? tasks[x.taskId].done : x.done);
  const doneCount = subs.filter(subDone).length;
  const setSubs = (next: Sub[]) => saveCard({ ...card, subs: next });
  const toggleSub = (x: Sub) => {
    const t = x.taskId ? tasks[x.taskId] : undefined;
    if (t) saveTask({ ...t, done: !t.done, doneAt: !t.done ? Date.now() : null });
    else setSubs(subs.map(y => (y.id === x.id ? { ...y, done: !y.done } : y)));
  };
  const subToTasks = (x: Sub) => {
    const id = uid();
    saveTask({ id, title: x.text.slice(0, 120), cat: card.cat, pts: 10, due: '', done: x.done });
    setSubs(subs.map(y => (y.id === x.id ? { ...y, taskId: id } : y)));
  };
  const addSub = (e: React.FormEvent) => {
    e.preventDefault();
    const t = subText.trim();
    if (!t) return;
    setSubs([...subs, { id: uid(), text: t, done: false }]); setSubText('');
  };
  const commit = () => {
    setEdit(false);
    const t = text.trim();
    if (!t) { removeCard(card.id); return; }
    if (t !== card.text) saveCard({ ...card, text: t });
  };
  return (
    <motion.div
      layout layoutId={card.id}
      data-card={card.id} data-lane={lane}
      drag dragControls={controls} dragListener={false} dragMomentum={false} dragElastic={0.12}
      onDragStart={onStart}
      onDrag={(_, i) => onMove(i.point.x - window.scrollX)}
      onDragEnd={(_, i) => onEnd(i.point.x - window.scrollX, i.point.y - window.scrollY)}
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
      whileDrag={{ scale: 1.05, rotate: 2.5, zIndex: 50, boxShadow: '0 16px 32px rgba(0,0,0,0.5)', cursor: 'grabbing' }}
      transition={{ layout: spring, default: { duration: 0.18 } }}
      className={`group relative rounded-lg border flex gap-1 ${epic ? `p-3 pl-1.5 shadow-md border-l-4 ${CATS[card.cat].note} ${CATS[card.cat].edge}` : `p-2 pl-1 border-l-2 border-white/10 bg-white/[0.035] ${CATS[card.cat].edge}`}`}
    >
      <button
        onPointerDown={e => { e.preventDefault(); controls.start(e); }}
        aria-label="Drag card" title="Drag"
        className="shrink-0 self-start py-0.5 text-zinc-500! hover:text-zinc-200! cursor-grab touch-none"
      ><GripVertical size={16} /></button>
      <div className="min-w-0 flex-1 flex flex-col gap-2">
        {edit
          ? <textarea autoFocus rows={3} className={`${field} !py-1.5 resize-none`} value={text} onChange={e => setText(e.target.value)} onBlur={commit}
              onKeyDown={e => { if (e.key === 'Escape') { setText(card.text); setEdit(false); } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }} />
          : <div onClick={() => { setText(card.text); setEdit(true); }} className={`break-words whitespace-pre-wrap cursor-text ${epic ? 'text-[15px] font-semibold' : 'text-[13px]'} ${linked && task?.done ? 'line-through text-zinc-500' : epic ? 'text-white' : 'text-zinc-300'}`}>{epic && <Layers size={13} className="inline -mt-0.5 mr-1.5 text-cyan-300" aria-hidden />}{card.text}</div>}
        {canDue && editDue && (
          <div className="flex items-center gap-2 -mt-0.5">
            <input autoFocus type="date" aria-label="Due date" className={`${field} !py-1 !w-auto !text-[12px]`} value={due} onChange={e => setDue(e.target.value)} onBlur={() => setEditDue(false)} onKeyDown={e => { if (e.key === 'Escape' || e.key === 'Enter') setEditDue(false); }} />
            {due && <button onMouseDown={e => { e.preventDefault(); setDue(''); setEditDue(false); }} className="text-[11px] text-zinc-400! hover:text-red-400!">Clear</button>}
          </div>
        )}
        {canDue && !editDue && due && (
          <button onClick={() => setEditDue(true)} title="Change due date" className={`self-start inline-flex items-center gap-1 text-[11px] -mt-0.5 hover:text-white! ${overdue ? 'text-red-400!' : 'text-zinc-400!'}`}><CalendarDays size={12} />{overdue ? 'Overdue · ' : 'Due '}{due.slice(5)}</button>
        )}
        {epic && subs.length > 0 && (
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><motion.div className="h-full bg-cyan-300 rounded-full" initial={false} animate={{ width: `${doneCount / subs.length * 100}%` }} transition={{ duration: 0.3 }} /></div>
        )}
        <div className={`flex items-center gap-x-2 gap-y-1 flex-wrap ${epic ? '' : 'opacity-50 group-hover:opacity-100 focus-within:opacity-100 transition-opacity'}`}>
          <button onClick={() => saveCard({ ...card, cat: NEXT_CAT[card.cat] })} title={`${CATS[card.cat].label} (click to change)`} aria-label={`Category: ${CATS[card.cat].label}`} className="p-0.5"><span className={`block h-2.5 w-2.5 rounded-full ${CATS[card.cat].dot}`} /></button>
          {linked
            ? <button onClick={() => onTake()} title="Remove from task list (deletes the task)" className="inline-flex items-center gap-1 text-[11px] text-cyan-300!"><ListChecks size={13} />{task?.done ? 'Task done' : 'On task list'}</button>
            : <button onClick={() => onPut()} title="Add to the task list" className="inline-flex items-center gap-1 text-[11px] text-zinc-400! hover:text-cyan-300!"><ListPlus size={13} />To tasks</button>}
          {canDue && !due && !editDue && <button onClick={() => setEditDue(true)} title="Set a due date" aria-label="Set due date" className="inline-flex items-center gap-1 text-[11px] text-zinc-400! hover:text-white!"><CalendarDays size={12} />Due</button>}
          <button onClick={() => { saveCard({ ...card, epic: !epic }); if (epic) setOpen(false); }} title={epic ? 'Turn back into a plain task card (subtasks are kept)' : 'Turn into an epic with subtasks'}
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[11px] ${epic ? 'border-cyan-300/60 text-cyan-300!' : 'border-white/15 text-zinc-400! hover:text-white!'}`}><Layers size={11} />{epic ? 'Epic' : '→ Epic'}</button>
          {epic && (
            <button onClick={() => setOpen(o => !o)} aria-expanded={open} title="Subtasks" className="inline-flex items-center gap-0.5 text-[11px] text-zinc-400! hover:text-white!">
              {subs.length ? `${doneCount}/${subs.length}` : 'Subtasks'}<ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button onClick={onTrack} title={tracking && running ? 'Pause the timer' : 'Track time on this card'} aria-label="Track time"
            className={`inline-flex items-center gap-1 text-[11px] ${tracking && running ? 'text-cyan-300!' : 'text-zinc-400! hover:text-cyan-300!'}`}>
            {tracking && running ? <Pause size={12} /> : <Play size={12} />}{logged > 0 ? fmtDur(logged) : 'Track'}
          </button>
          <button onClick={() => removeCard(card.id)} aria-label="Delete card" className="ml-auto text-zinc-500! hover:text-red-400! p-0.5"><X size={13} /></button>
        </div>
        <AnimatePresence initial={false}>
          {open && epic && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
                {subs.map(x => {
                  const d = subDone(x);
                  return (
                    <div key={x.id} className="flex items-center gap-1.5 text-[13px]">
                      <button onClick={() => toggleSub(x)} aria-label={d ? 'Mark open' : 'Mark done'} className={`h-4 w-4 shrink-0 rounded-[5px] border-2 border-white/40 grid place-items-center ${d ? 'bg-cyan-300 border-cyan-300 text-black!' : ''}`}>{d && <Check size={11} strokeWidth={3} />}</button>
                      <span className={`min-w-0 flex-1 break-words ${d ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>{x.text}</span>
                      {x.taskId && tasks[x.taskId]
                        ? <ListChecks size={13} className="text-cyan-300 shrink-0" aria-label="On task list" />
                        : <button onClick={() => subToTasks(x)} title="Add to the task list" aria-label="Add subtask to task list" className="text-zinc-500! hover:text-cyan-300! shrink-0"><ListPlus size={13} /></button>}
                      <button onClick={() => setSubs(subs.filter(y => y.id !== x.id))} aria-label="Delete subtask" className="text-zinc-600! hover:text-red-400! shrink-0"><X size={12} /></button>
                    </div>
                  );
                })}
                <form onSubmit={addSub}><input className={`${field} !py-1 !text-[13px]`} placeholder="Add subtask…" autoComplete="off" value={subText} onChange={e => setSubText(e.target.value)} /></form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
