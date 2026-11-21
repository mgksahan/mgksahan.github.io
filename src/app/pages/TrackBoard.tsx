import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { GripVertical, X, ListPlus, ListChecks, Plus, ChevronDown, Check, Play, Pause, Layers, CalendarDays, Unlink } from 'lucide-react';
import {
  Cat, Card, Lane, Task, DEFAULT_LANES, NEXT_CAT, setActivityCat, useTrack, adoptTasks, settleDoneTasks, completeDoneNotes, migrateSubs, addSubtask, convertToEpic, convertToTask, setEpicDone, moveIntoEpic, detachSubtask, renameCard, renameTask, saveCard, removeCard, saveTask, removeTask, saveSettings, uid,
} from '../lib/trackStore';

// Board tab: sticky-note cards in swim lanes (a small kanban). Drag a card by its grip to reorder or move
// it to another lane; neighbours glide out of the way. A card can be put on the task list, which creates a
// task (no due date) linked to the card. Cards sync as "card" items, lanes live in the settings item.

const CATS: Record<Cat, { label: string; note: string; dot: string; edge: string }> = {
  work:  { label: 'Work',     note: 'bg-sky-400/15 border-sky-400/40',         dot: 'bg-sky-400',     edge: 'border-l-sky-400' },
  learn: { label: 'Learning', note: 'bg-amber-400/15 border-amber-400/40',     dot: 'bg-amber-400',   edge: 'border-l-amber-400' },
  life:  { label: 'Personal', note: 'bg-emerald-400/15 border-emerald-400/40', dot: 'bg-emerald-400', edge: 'border-l-emerald-400' },
};
const field = 'w-full min-w-0 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-300/60';
const spring = { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 } as const;

const fmtDur = (ms: number) => { const m = Math.round(ms / 60000); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
// What a card's time is logged against: its linked task, or the card itself when it has none (an epic can be tracked on its own)
const trackIdOf = (c: Card, tasks: Record<string, Task>) => (c.taskId && tasks[c.taskId] ? c.taskId : c.id);

export function BoardTab({ onTrack, onToggleTask, trackingId, running }: { onTrack: (cat: Cat, id: string, title: string) => void; onToggleTask: (t: Task) => void; trackingId: string | null; running: boolean }) {
  const s = useTrack();
  const lanes: Lane[] = s.settings.lanes?.length ? s.settings.lanes : DEFAULT_LANES;
  const laneIds = lanes.map(l => l.id);
  const cards = Object.values(s.cards);
  const laneOf = (c: Card) => (laneIds.includes(c.lane) ? c.lane : laneIds[0]);
  const inLane = (id: string) => cards.filter(c => laneOf(c) === id).sort((a, b) => a.pos - b.pos);

  const epicTasksOf = (epicId: string) => Object.values(s.tasks).filter(t => t.epicId === epicId).sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));

  // Time logged per activity id, so a card can show its own total plus its subtasks' tasks
  const loggedBy: Record<string, number> = {};
  Object.values(s.entries).forEach(e => { if (e.taskId) loggedBy[e.taskId] = (loggedBy[e.taskId] || 0) + (e.end - e.start); });
  const loggedOf = (c: Card) => {
    const ids = new Set([trackIdOf(c, s.tasks), ...epicTasksOf(c.id).map(x => x.id)]);   // a Set, so nothing is counted twice
    let t = 0; ids.forEach(i => { t += loggedBy[i] || 0; }); return t;
  };

  // Put every task on the board (once), and keep new tasks coming in
  const laneKey = laneIds.join(',');
  useEffect(() => { migrateSubs(); adoptTasks(laneIds); settleDoneTasks(laneIds); completeDoneNotes(laneIds); }, [s.tasks, s.cards, laneKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // The epic card under the pointer while dragging a plain card (dropping on it makes the card a subtask)
  const [hoverEpic, setHoverEpic] = useState<string | null>(null);
  const epicAt = (x: number, y: number, exclude: string): string | null => {
    for (const el of document.elementsFromPoint(x, y)) {
      const c = (el as HTMLElement).closest?.('[data-card]');
      if (c && c.getAttribute('data-card') !== exclude && c.getAttribute('data-epic')) return c.getAttribute('data-card');
    }
    return null;
  };
  // Deleting a card can be undone for a while (the tombstone is replaced by saving the card again)
  const [undo, setUndo] = useState<Card | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);
  const deleteCard = (c: Card) => {
    removeCard(c.id);
    setUndo(c);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 12000);
  };
  const doneLane = laneIds.includes('done') ? 'done' : laneIds[laneIds.length - 1];
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
    const dragIsEpic = card.epic ?? epicTasksOf(card.id).length > 0;
    const hit = dragIsEpic ? null : epicAt(clientX, clientY, card.id);
    if (hit) { moveIntoEpic(card.id, hit); return; }
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
    if (target === laneOf(card) && pos === card.pos) return;
    const from = laneOf(card), toDone = target === doneLane && from !== doneLane, fromDone = from === doneLane && target !== doneLane;
    const epic = card.epic ?? epicTasksOf(card.id).length > 0;
    // Moving into Done completes the card (a task, or an epic and all its subtasks); moving out of Done reopens it
    saveCard({ ...card, lane: target, pos, ...(epic && toDone ? { done: true } : epic && fromDone ? { done: false } : {}) });
    if (epic && toDone) epicTasksOf(card.id).filter(x => !x.done).forEach(onToggleTask);
    const t = card.taskId ? s.tasks[card.taskId] : undefined;
    if (t && ((toDone && !t.done) || (fromDone && t.done))) onToggleTask(t);
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
    <motion.div layoutScroll className="app-scroll board-scroll overflow-x-auto lg:overflow-y-auto lg:flex-1 lg:min-h-0 max-lg:min-h-[calc(100dvh-175px)]">
    <div className="flex gap-3 items-stretch min-h-full">
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
                  tasks={s.tasks} task={c.taskId ? s.tasks[c.taskId] : undefined} epicTasks={epicTasksOf(c.id)} loggedBy={loggedBy} trackingId={trackingId} onTrackTask={t => onTrack(t.cat, t.id, t.title)} onToggleTask={onToggleTask} logged={loggedOf(c)} tracking={trackingId === trackIdOf(c, s.tasks)} running={running} onTrack={() => onTrack(c.cat, trackIdOf(c, s.tasks), c.text.split('\n')[0].slice(0, 120))} onPut={() => putOnTasks(c)} onTake={() => takeOffTasks(c)}
                  onStart={() => setDragging(c.id)}
                  onMove={(x, y) => { const t = laneAt(x); setOver(p => (p === t ? p : t)); const isEpic = c.epic ?? epicTasksOf(c.id).length > 0; const h = isEpic ? null : epicAt(x, y, c.id); setHoverEpic(p => (p === h ? p : h)); }}
                  dropTarget={hoverEpic === c.id} onDelete={() => deleteCard(c)}
                  onEnd={(x, y) => { setDragging(null); setOver(null); setHoverEpic(null); drop(c, x, y); }}
                />
              ))}
            </AnimatePresence>
            {!inLane(l.id).length && <div className="text-xs text-zinc-600 text-center py-2">Drop cards here</div>}
          </div>
          <div className="sticky bottom-0 z-10 -mx-3 -mb-3 px-3 pb-3 pt-2 bg-[#191a1d] rounded-b-xl">
            <Jot onAdd={(t, cat) => addCard(l.id, t, cat)} />
          </div>
        </div>
      ))}
      <AnimatePresence>
        {undo && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.18 }}
            role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-white/15 bg-[#1b1d22] px-4 py-2.5 text-sm text-zinc-200 shadow-2xl">
            <span className="max-w-[260px] truncate">Deleted “{undo.text.split('\n')[0]}”</span>
            <button onClick={() => { saveCard(undo); setUndo(null); }} className="font-semibold text-cyan-300!">Undo</button>
            <button onClick={() => setUndo(null)} aria-label="Dismiss" className="text-zinc-500! hover:text-white!"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>
      <button onClick={addLane} className="shrink-0 self-start rounded-xl border border-dashed border-white/15 px-3 py-3 text-sm text-zinc-400! hover:text-white! hover:border-white/30 inline-flex items-center gap-1.5"><Plus size={14} />Lane</button>
    </div>
    </motion.div>
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

function CardNote({ card, lane, task, onDelete, dropTarget, epicTasks, loggedBy, trackingId, onTrackTask, onToggleTask, logged, tracking, running, onTrack, onPut, onTake, onStart, onMove, onEnd }: {
  card: Card; lane: string; task?: Task; tasks: Record<string, Task>; epicTasks: Task[]; loggedBy: Record<string, number>; trackingId: string | null; onTrackTask: (t: Task) => void; onToggleTask: (t: Task) => void; logged: number; tracking: boolean; running: boolean; onTrack: () => void; onPut: () => void; onTake: () => void;
  dropTarget: boolean; onDelete: () => void; onStart: () => void; onMove: (clientX: number, clientY: number) => void; onEnd: (clientX: number, clientY: number) => void;
}) {
  const controls = useDragControls();
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(card.text);
  const linked = !!card.taskId && !!task;
  const [open, setOpen] = useState(false);
  const [subText, setSubText] = useState('');
  // Due date: a linked task owns it; a card with no task keeps its own
  const due = task ? task.due : card.due ?? '';
  const [editDue, setEditDue] = useState(false);
  const setDue = (v: string) => { if (task) saveTask({ ...task, due: v }); else saveCard({ ...card, due: v }); };
  const overdue = !!due && due < new Date().toLocaleDateString('en-CA');
  const epic = card.epic ?? epicTasks.length > 0;
  const canDue = task ? !task.done : !(epic && card.done);
  const doneCount = epicTasks.filter(x => x.done).length;
  const addSub = (e: React.FormEvent) => { e.preventDefault(); addSubtask(card, subText); setSubText(''); };
  const commit = () => {
    setEdit(false);
    const t = text.trim();
    if (!t) { setText(card.text); return; }       // an empty name is never saved (and never deletes the card): keep the old one
    renameCard(card, t);
  };
  return (
    <motion.div
      layout layoutId={card.id}
      data-card={card.id} data-lane={lane} data-epic={epic ? '1' : undefined}
      drag dragControls={controls} dragListener={false} dragMomentum={false} dragElastic={0.12}
      onDragStart={onStart}
      onDrag={(_, i) => onMove(i.point.x - window.scrollX, i.point.y - window.scrollY)}
      onDragEnd={(_, i) => onEnd(i.point.x - window.scrollX, i.point.y - window.scrollY)}
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
      whileDrag={{ scale: 1.05, rotate: 2.5, zIndex: 50, boxShadow: '0 16px 32px rgba(0,0,0,0.5)', cursor: 'grabbing' }}
      transition={{ layout: spring, default: { duration: 0.18 } }}
      className={`group relative rounded-lg border flex gap-1 transition-shadow ${dropTarget ? 'ring-2 ring-cyan-300 shadow-[0_0_24px_rgba(103,232,249,0.35)]' : ''} ${epic ? `p-3 pl-1.5 shadow-md border-l-4 ${CATS[card.cat].note} ${CATS[card.cat].edge}` : `p-2 pl-1 border-l-2 border-white/10 bg-white/[0.035] ${CATS[card.cat].edge}`}`}
    >
      <button
        onPointerDown={e => { e.preventDefault(); controls.start(e); }}
        aria-label="Drag card" title="Drag"
        className="shrink-0 self-start py-0.5 text-zinc-500! hover:text-zinc-200! cursor-grab touch-none"
      ><GripVertical size={16} /></button>
      <div className="min-w-0 flex-1 flex flex-col gap-2">
        <div className="flex items-start gap-2">
        {epic && <button onClick={() => setEpicDone(card.id, !card.done, onToggleTask)} aria-label={card.done ? 'Mark epic open' : 'Mark epic done'} title={card.done ? 'Reopen the epic' : 'Complete the epic and all its subtasks'}
          className={`mt-0.5 h-[18px] w-[18px] shrink-0 rounded-[6px] border-2 border-cyan-300/70 grid place-items-center ${card.done ? 'bg-cyan-300 text-black!' : ''}`}>{card.done && <Check size={12} strokeWidth={3} />}</button>}
        <div className="min-w-0 flex-1">
        {edit
          ? <textarea autoFocus rows={3} className={`${field} !py-1.5 resize-none`} value={text} onChange={e => setText(e.target.value)} onBlur={commit}
              onKeyDown={e => { if (e.key === 'Escape') { setText(card.text); setEdit(false); } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }} />
          : <div onClick={() => { setText(card.text); setEdit(true); }} className={`break-words whitespace-pre-wrap cursor-text ${epic ? 'text-[15px] font-semibold' : 'text-[13px]'} ${(linked && task?.done) || (epic && card.done) ? 'line-through text-zinc-500' : epic ? 'text-white' : 'text-zinc-300'}`}>{epic && <Layers size={13} className="inline -mt-0.5 mr-1.5 text-cyan-300" aria-hidden />}{card.text}</div>}
        </div>
        </div>
        {canDue && editDue && (
          <div className="flex items-center gap-2 -mt-0.5">
            <input autoFocus type="date" aria-label="Due date" className={`${field} !py-1 !w-auto !text-[12px]`} value={due} onChange={e => setDue(e.target.value)} onBlur={() => setEditDue(false)} onKeyDown={e => { if (e.key === 'Escape' || e.key === 'Enter') setEditDue(false); }} />
            {due && <button onMouseDown={e => { e.preventDefault(); setDue(''); setEditDue(false); }} className="text-[11px] text-zinc-400! hover:text-red-400!">Clear</button>}
          </div>
        )}
        {canDue && !editDue && due && (
          <button onClick={() => setEditDue(true)} title="Change due date" className={`self-start inline-flex items-center gap-1 text-[11px] -mt-0.5 hover:text-white! ${overdue ? 'text-red-400!' : 'text-zinc-400!'}`}><CalendarDays size={12} />{overdue ? 'Overdue · ' : 'Due '}{due.slice(5)}</button>
        )}
        {epic && epicTasks.length > 0 && (
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><motion.div className="h-full bg-cyan-300 rounded-full" initial={false} animate={{ width: `${doneCount / epicTasks.length * 100}%` }} transition={{ duration: 0.3 }} /></div>
        )}
        <div className={`flex items-center gap-x-2 gap-y-1 flex-wrap ${epic ? '' : 'opacity-50 group-hover:opacity-100 focus-within:opacity-100 transition-opacity'}`}>
          <button onClick={() => setActivityCat({ taskId: task ? card.taskId : card.id }, NEXT_CAT[card.cat])} title={`${CATS[card.cat].label} (click to change; also changes its time entries)`} aria-label={`Category: ${CATS[card.cat].label}`} className="p-0.5"><span className={`block h-2.5 w-2.5 rounded-full ${CATS[card.cat].dot}`} /></button>
          {epic ? null : linked
            ? <button onClick={() => onTake()} title="Remove from task list (deletes the task)" className="inline-flex items-center gap-1 text-[11px] text-cyan-300!"><ListChecks size={13} />{task?.done ? 'Task done' : 'On task list'}</button>
            : <button onClick={() => onPut()} title="Add to the task list" className="inline-flex items-center gap-1 text-[11px] text-zinc-400! hover:text-cyan-300!"><ListPlus size={13} />To tasks</button>}
          {canDue && !due && !editDue && <button onClick={() => setEditDue(true)} title="Set a due date" aria-label="Set due date" className="inline-flex items-center gap-1 text-[11px] text-zinc-400! hover:text-white!"><CalendarDays size={12} />Due</button>}
          <button onClick={() => { if (epic) { setOpen(false); convertToTask(card.id); } else convertToEpic(card.id); }} title={epic ? 'Turn into a task (its subtasks become separate tasks)' : 'Turn into an epic (it leaves the Tasks page; its subtasks stay there under it)'}
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[11px] ${epic ? 'border-cyan-300/60 text-cyan-300!' : 'border-white/15 text-zinc-400! hover:text-white!'}`}><Layers size={11} />{epic ? 'Epic' : '→ Epic'}</button>
          {epic && (
            <button onClick={() => setOpen(o => !o)} aria-expanded={open} title="Subtasks" className="inline-flex items-center gap-0.5 text-[11px] text-zinc-400! hover:text-white!">
              {epicTasks.length ? `${doneCount}/${epicTasks.length}` : 'Subtasks'}<ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button onClick={onTrack} title={tracking && running ? 'Pause the timer' : 'Track time on this card'} aria-label="Track time"
            className={`inline-flex items-center gap-1 text-[11px] ${tracking && running ? 'text-cyan-300!' : 'text-zinc-400! hover:text-cyan-300!'}`}>
            {tracking && running ? <Pause size={12} /> : <Play size={12} />}{logged > 0 ? fmtDur(logged) : 'Track'}
          </button>
          <button onClick={onDelete} aria-label="Delete card" className="ml-auto text-zinc-500! hover:text-red-400! p-0.5"><X size={13} /></button>
        </div>
        <AnimatePresence initial={false}>
          {open && epic && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
                {epicTasks.map(x => (
                  <SubRow key={x.id} x={x} logged={loggedBy[x.id] || 0} tracking={trackingId === x.id && running}
                    onToggle={() => onToggleTask(x)} onTrack={() => onTrackTask(x)} />
                ))}
                <form onSubmit={addSub}><input className={`${field} !py-1 !text-[13px]`} placeholder="Add subtask…" autoComplete="off" value={subText} onChange={e => setSubText(e.target.value)} /></form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// A subtask is a normal task shown inside its epic: tick, rename, category, due date, track, delete.
function SubRow({ x, logged, tracking, onToggle, onTrack }: { x: Task; logged: number; tracking: boolean; onToggle: () => void; onTrack: () => void }) {
  const [editName, setEditName] = useState(false);
  const [val, setVal] = useState(x.title);
  const [editDue, setEditDue] = useState(false);
  const overdue = !!x.due && !x.done && x.due < new Date().toLocaleDateString('en-CA');
  return (
    <div className="flex items-start gap-1.5 text-[13px]">
      <button onClick={onToggle} aria-label={x.done ? 'Mark open' : 'Mark done'} className={`mt-0.5 h-4 w-4 shrink-0 rounded-[5px] border-2 border-white/40 grid place-items-center ${x.done ? 'bg-cyan-300 border-cyan-300 text-black!' : ''}`}>{x.done && <Check size={11} strokeWidth={3} />}</button>
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        {editName
          ? <input autoFocus aria-label="Subtask name" className={`${field} !py-0.5 !text-[13px]`} value={val} onChange={e => setVal(e.target.value)}
              onBlur={() => { setEditName(false); renameTask(x.id, val); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setVal(x.title); setEditName(false); } }} />
          : <span onClick={() => { setVal(x.title); setEditName(true); }} title="Click to rename" className={`break-words cursor-text ${x.done ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>{x.title}</span>}
        <div className="flex items-center gap-2.5 text-[11px] text-zinc-400 flex-wrap">
          <button onClick={() => setActivityCat({ taskId: x.id }, NEXT_CAT[x.cat])} title={`${CATS[x.cat].label} (click to change)`} aria-label={`Category: ${CATS[x.cat].label}`} className="p-0.5"><span className={`block h-2 w-2 rounded-full ${CATS[x.cat].dot}`} /></button>
          {editDue
            ? <input autoFocus type="date" aria-label="Due date" className={`${field} !py-0.5 !w-auto !text-[11px]`} value={x.due} onChange={e => saveTask({ ...x, due: e.target.value })} onBlur={() => setEditDue(false)} onKeyDown={e => { if (e.key === 'Escape' || e.key === 'Enter') setEditDue(false); }} />
            : <button onClick={() => setEditDue(true)} title="Change due date" className={`inline-flex items-center gap-1 text-[11px] hover:text-white! ${overdue ? 'text-red-400!' : 'text-zinc-400!'}`}><CalendarDays size={11} />{x.due ? `${overdue ? 'Overdue · ' : ''}${x.due.slice(5)}` : 'Due'}</button>}
          {!x.done && (
            <button onClick={onTrack} aria-label="Track time" title={tracking ? 'Pause the timer' : 'Track time on this subtask'} className={`inline-flex items-center gap-1 text-[11px] ${tracking ? 'text-cyan-300!' : 'text-zinc-400! hover:text-cyan-300!'}`}>
              {tracking ? <Pause size={11} /> : <Play size={11} />}{logged > 0 ? fmtDur(logged) : 'Track'}
            </button>
          )}
          {x.done && logged > 0 && <span>{fmtDur(logged)}</span>}
        </div>
      </div>
      <button onClick={() => detachSubtask(x.id)} aria-label="Make a free task" title="Take out of the epic (becomes a free task)" className="text-zinc-600! hover:text-cyan-300! shrink-0 mt-0.5"><Unlink size={12} /></button>
      <button onClick={() => { if (logged >= 60000 && !confirm(`Delete “${x.title}”? Its ${fmtDur(logged)} of tracked time stays in Stats but will no longer be listed under it.`)) return; removeTask(x.id); }} aria-label="Delete subtask" title="Delete (it is also a task)" className="text-zinc-600! hover:text-red-400! shrink-0 mt-0.5"><X size={12} /></button>
    </div>
  );
}
