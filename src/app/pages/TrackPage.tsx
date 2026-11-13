import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { Play, Pause, Square, X, Check, Minimize2, Maximize2, Timer, CloudOff, RefreshCw, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BoardTab } from './TrackBoard';
import {
  Cat, Task, Entry, Segment, TrackState, useTrack, useTrackSync, startSync, syncNow,
  saveTask, removeTask, saveEntry, removeEntry, saveTimer, saveSettings, uid,
} from '../lib/trackStore';

// Time tracker at /track (owner only). Tasks with points, a calendar, and a running timer, all tagged
// Work / Learning / Personal. Time adds up per activity. Optional focus blocks remind you when a block ends
// while the clock keeps counting. Data syncs through lib/trackStore.ts.

const CATS: Record<Cat, { label: string; dot: string; text: string; ring: string; bar: string; chipOn: string }> = {
  work:  { label: 'Work',     dot: 'bg-sky-400',     text: 'text-sky-300',     ring: 'border-sky-400',     bar: 'bg-sky-400',     chipOn: 'border-sky-400 bg-sky-400/15 text-white!' },
  learn: { label: 'Learning', dot: 'bg-amber-400',   text: 'text-amber-300',   ring: 'border-amber-400',   bar: 'bg-amber-400',   chipOn: 'border-amber-400 bg-amber-400/15 text-white!' },
  life:  { label: 'Personal', dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'border-emerald-400', bar: 'bg-emerald-400', chipOn: 'border-emerald-400 bg-emerald-400/15 text-white!' },
};
const CAT_KEYS = Object.keys(CATS) as Cat[];

const card = 'rounded-xl border border-white/10 bg-[#141518] p-4';
const field = 'w-full min-w-0 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-300/60 [&>option]:bg-[#141518]';
const btn = 'rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100! hover:bg-white/10 disabled:opacity-40 disabled:cursor-default';
const btnPrimary = 'rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-black! hover:bg-cyan-200 disabled:opacity-40 disabled:cursor-default';
const label = 'text-[11px] uppercase tracking-[0.09em] font-semibold text-zinc-500';

// ---------- helpers ----------
const pad = (n: number) => String(n).padStart(2, '0');
const dkey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dkey(new Date());
const fmtHMS = (ms: number) => { const s = Math.floor(ms / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`; };
const fmtMS = (ms: number) => { const s = Math.floor(ms / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
const fmtDur = (ms: number) => { const m = Math.round(ms / 60000); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${pad(m % 60)}m`; };
const entryMs = (e: Entry) => e.end - e.start;
// An activity is a linked task, or a free-text label. Time adds up per activity across sessions.
const keyOf = (taskId: string | null | undefined, note: string | undefined) =>
  taskId ? taskId : 'n:' + ((note || '').trim().toLowerCase() || 'untitled');

const elapsed = (seg: Segment | null, at: number) => (seg ? seg.acc + (seg.since ? at - seg.since : 0) : 0);
const blockMsOf = (b: { acc: number; since: number | null }, at: number) => b.acc + (b.since ? at - b.since : 0);
const blockRun = (b: { acc: number; since: number | null }, on: boolean) =>
  on ? (b.since ? b : { acc: b.acc, since: Date.now() }) : (b.since ? { acc: b.acc + Date.now() - b.since, since: null } : b);

// ---------- alerts: sound + browser notification ----------
let ac: AudioContext | null = null;
function unlock() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ac ??= new AC();
    if (ac.state === 'suspended') void ac.resume();
  } catch { /* no audio */ }
}
// level 1 is a gentle double beep; 2 and 3 get more beeps, higher and louder, so they cut through deep work
const BEEPS: Record<1 | 2 | 3, { at: number[]; hz: number; vol: number }> = {
  1: { at: [0, 0.35], hz: 880, vol: 0.25 },
  2: { at: [0, 0.3, 0.6, 0.9], hz: 1000, vol: 0.5 },
  3: { at: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75], hz: 1200, vol: 0.9 },
};
function beep(level: 1 | 2 | 3 = 1) {
  try {
    if (!ac) return;
    const c = ac, b = BEEPS[level];
    b.at.forEach(d => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination); o.frequency.value = b.hz;
      const t = c.currentTime + d;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(b.vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.start(t); o.stop(t + 0.22);
    });
  } catch { /* ignore */ }
}
function askPermission() {
  try { if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission(); } catch { /* ignore */ }
}

// A block alert nags in 3 steps (1 min apart). If none of its buttons is clicked, tracking stops 1 minute after the third.
interface AlertInfo { title: string; body: string; kind: 'block' | 'break' | 'stopped'; endedAt?: number; level?: 1 | 2 | 3 }
const NAG_STEP = 60000, NAG_STOP = 180000;
interface Sel { cat: Cat; taskId: string | null; note: string }

export function TrackPage() {
  const { isAdmin, isLoading } = useAuth();
  useEffect(() => { if (isAdmin) return startSync(); }, [isAdmin]);

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-zinc-400">Loading...</div>;
  if (!isAdmin) return <Navigate to="/login?next=/track" replace />;
  return <Tracker />;
}

function Tracker() {
  const s = useTrack();
  const sync = useTrackSync();
  const sRef = useRef(s);
  sRef.current = s;

  const [, setNow] = useState(Date.now());
  const [tab, setTab] = useState<'tasks' | 'board' | 'cal' | 'stats'>('tasks');
  const [mini, setMini] = useState(() => { try { return localStorage.getItem('track_mini') === '1'; } catch { return false; } });
  const [sel, setSel] = useState<Sel>({ cat: 'learn', taskId: null, note: '' });
  const [alert, setAlert] = useState<AlertInfo | null>(null);

  // "Install as an app": Chrome and Edge offer it once the page has a manifest and a service worker
  const [installEvt, setInstallEvt] = useState<any>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    const onInstalled = () => setInstallEvt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  const install = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch { /* ignore */ }
    setInstallEvt(null);
  };

  const timerDoc = s.timer;
  const seg = timerDoc.timer;
  const running = !!seg?.since;
  const cur: Sel = seg ? { cat: seg.cat, taskId: seg.taskId, note: seg.note } : sel;
  const tasks = useMemo(() => Object.values(s.tasks), [s.tasks]);
  const entries = useMemo(() => Object.values(s.entries), [s.entries]);
  const taskTitle = (id: string | null | undefined) => (id ? s.tasks[id]?.title : undefined);
  const labelOf = (taskId: string | null | undefined, note: string | undefined) => taskTitle(taskId) || (note || '').trim() || 'Untitled activity';

  // The note box follows the running activity (including when another device switches it)
  const [noteText, setNoteText] = useState('');
  const segKey = seg ? keyOf(seg.taskId, seg.note) : '';
  useEffect(() => { if (seg) setNoteText(seg.note); }, [segKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- tick: clock, block end, break end, tab title ----
  const alertRef = useRef(alert);
  alertRef.current = alert;
  const autoStopRef = useRef<(endedAt: number) => void>(() => {});
  useEffect(() => {
    const id = setInterval(() => {
      const cs = sRef.current, at = Date.now();
      setNow(at);
      const doc = cs.timer, fm = cs.settings.focus * 60000;
      const lbl = (() => { const sg = doc.timer; if (!sg) return 'your activity'; const t = sg.taskId ? cs.tasks[sg.taskId]?.title : ''; return t || sg.note || 'Untitled activity'; })();
      if (fm && doc.block.since && blockMsOf(doc.block, at) >= fm) {
        const n = (cs.settings.days[today()] || 0) + 1;
        saveTimer({ block: { acc: 0, since: at } });
        saveSettings({ days: { ...cs.settings.days, [today()]: n } });
        notify({ title: `${cs.settings.focus}-minute block done`, body: `Block ${n} today. You are on: ${lbl}. Click Keep going or take a ${cs.settings.brk} minute break, or tracking stops in 3 minutes.`, kind: 'block', endedAt: at, level: 1 });
      }
      const al = alertRef.current;
      if (al?.kind === 'block' && al.endedAt) {
        const wait = at - al.endedAt;
        if (!doc.timer?.since) setAlert(null);                                  // paused or stopped elsewhere: nothing left to nag about
        else if (wait >= NAG_STOP) autoStopRef.current(al.endedAt);
        else {
          const level = (wait >= 2 * NAG_STEP ? 3 : wait >= NAG_STEP ? 2 : 1) as 1 | 2 | 3;
          if (level !== al.level) notify({ ...al, level, title: level === 3 ? 'Last warning: tracking stops soon' : 'Still there? Tracking is running', body: `Your ${cs.settings.focus}-minute block ended. Tracking on ${lbl} stops automatically unless you respond.` });
        }
      }
      if (doc.brk && at >= doc.brk.until) {
        saveTimer({ brk: null });
        notify({ title: 'Break over', body: 'Time to get back to it.', kind: 'break' });
      }
      const sg = doc.timer;
      const base = sg?.since ? `${fmtHMS(elapsed(sg, at))} · Time Tracker` : 'Time Tracker';
      document.title = alertRef.current && Math.floor(at / 1000) % 2 ? `⏰ ${alertRef.current.title}` : base;
    }, 1000);
    return () => { clearInterval(id); document.title = 'Time Tracker'; };
  }, []);
  function notify(a: AlertInfo) {
    setAlert(a); beep(a.level ?? 1);
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification(a.title, { body: a.body, tag: 'timetracker', renotify: true, requireInteraction: a.kind === 'block' } as NotificationOptions);
        n.onclick = () => { window.focus(); n.close(); };
      }
    } catch { /* ignore */ }
  }

  // ---- per-activity totals ----
  const activityTotals = (key: string) => {
    let all = 0, td = 0;
    for (const e of entries) if (keyOf(e.taskId, e.note) === key) { const m = entryMs(e); all += m; if (dkey(new Date(e.start)) === today()) td += m; }
    return { all, td };
  };

  // ---- timer actions ----
  const commitSeg = (sg: Segment | null) => {
    if (!sg) return;
    const ms = elapsed(sg, Date.now());
    if (ms >= 1000) { const end = Date.now(); saveEntry({ id: uid(), start: end - ms, end, cat: sg.cat, taskId: sg.taskId || null, note: labelOf(sg.taskId, sg.note) }); }
  };
  // Pivot to another activity. If the timer was running, the new activity starts running right away.
  const switchTo = (next: Sel, start = false) => {
    const was = running;
    if (alert?.kind === 'block') setAlert(null);
    commitSeg(seg);
    setSel(next); setNoteText(next.note);
    if (was || start) saveTimer({ timer: { acc: 0, since: Date.now(), cat: next.cat, taskId: next.taskId, note: next.note }, block: blockRun(timerDoc.block, true), brk: null });
    else if (seg || timerDoc.brk) saveTimer({ timer: null, brk: null });
  };
  const startPause = () => {
    unlock(); askPermission(); setAlert(null);
    if (!seg) {
      const note = (noteText.trim() || labelOf(sel.taskId, '')).trim();
      saveTimer({ timer: { acc: 0, since: Date.now(), cat: sel.cat, taskId: sel.taskId, note: sel.taskId ? labelOf(sel.taskId, '') : note }, block: blockRun(timerDoc.block, true), brk: null });
    } else if (seg.since) {
      saveTimer({ timer: { ...seg, acc: seg.acc + Date.now() - seg.since, since: null }, block: blockRun(timerDoc.block, false) });
    } else {
      saveTimer({ timer: { ...seg, since: Date.now() }, block: blockRun(timerDoc.block, true), brk: null });
    }
  };
  const stop = () => {
    commitSeg(seg);
    saveTimer({ timer: null, block: { acc: 0, since: null }, brk: null });
    setAlert(null); setSel(p => ({ ...p, taskId: null, note: '' })); setNoteText('');
  };
  // Nobody answered the block alerts: save the time up to when the block ended (not the idle minutes after) and stop
  autoStopRef.current = (endedAt: number) => {
    const sg = sRef.current.timer.timer;
    if (!sg?.since) { setAlert(null); return; }
    const ms = Math.max(0, elapsed(sg, endedAt));
    const note = labelOf(sg.taskId, sg.note);
    if (ms >= 1000) saveEntry({ id: uid(), start: endedAt - ms, end: endedAt, cat: sg.cat, taskId: sg.taskId || null, note });
    saveTimer({ timer: null, block: { acc: 0, since: null }, brk: null });
    setSel(p => ({ ...p, taskId: null, note: '' })); setNoteText('');
    const hm = new Date(endedAt); 
    notify({ title: 'Tracking stopped', body: `No response, so ${note} was saved and stopped at ${pad(hm.getHours())}:${pad(hm.getMinutes())} (${fmtDur(ms)}).`, kind: 'stopped' });
  };
  const takeBreak = () => {
    unlock();
    saveTimer({ timer: seg && seg.since ? { ...seg, acc: seg.acc + Date.now() - seg.since, since: null } : seg, block: { acc: 0, since: null }, brk: { until: Date.now() + s.settings.brk * 60000 } });
    setAlert(null);
  };
  const resumeFromBreak = () => {
    unlock();
    if (seg && !seg.since) saveTimer({ timer: { ...seg, since: Date.now() }, block: blockRun(timerDoc.block, true) });
    setAlert(null);
  };

  const pickCat = (cat: Cat) => {
    if (seg) { if (seg.cat !== cat) switchTo({ cat, taskId: seg.taskId, note: seg.note }); }
    else setSel(p => ({ ...p, cat }));
  };
  const pickTask = (id: string) => {
    const t = id ? s.tasks[id] : undefined;
    const cat = t ? t.cat : cur.cat;
    const note = t ? t.title : noteText.trim();
    if (seg) switchTo({ cat, taskId: id || null, note });
    else { setSel({ cat, taskId: id || null, note }); setNoteText(note); }
  };
  const commitNote = () => {
    const note = noteText.trim();
    if (!seg) { setSel(p => ({ ...p, note })); return; }
    if (seg.taskId) { if (note !== seg.note) saveTimer({ timer: { ...seg, note } }); return; }
    if (keyOf(null, note) !== keyOf(null, seg.note)) switchTo({ cat: seg.cat, taskId: null, note });
  };
  const trackTask = (t: Task) => { unlock(); askPermission(); switchTo({ cat: t.cat, taskId: t.id, note: t.title }, true); };

  // ---- derived timer display ----
  const at = Date.now();
  const ms = elapsed(seg, at);
  const brk = timerDoc.brk;
  const stateText = brk ? `On break · ${fmtMS(Math.max(0, brk.until - at))} left` : seg ? `${seg.since ? 'Tracking' : timerDoc.pausedBy === 'phone' ? 'Paused by phone' : 'Paused'} · ${CATS[seg.cat].label}` : 'Ready';
  const curKey = keyOf(cur.taskId, seg ? cur.note : noteText.trim() || cur.note);
  const hasActivity = !!(cur.taskId || (seg ? cur.note : noteText.trim()));
  const tot = activityTotals(curKey);
  const fm = s.settings.focus * 60000;
  const bm = blockMsOf(timerDoc.block, at);
  const blocksToday = s.settings.days[today()] || 0;
  const openTasks = tasks.filter(t => !t.done);
  const recent = useMemo(() => [...new Set(entries.map(e => e.note).filter(Boolean))].slice(-30), [entries]);

  // ---- points ----
  // Level points come from time tracked only: 1 point per 10 minutes. Finishing a task does not add points.
  const points = Math.floor(entries.reduce((a, e) => a + entryMs(e), 0) / 600000);
  const level = Math.floor(points / 100) + 1, into = points % 100;
  const doneToday = tasks.filter(t => t.done && t.doneAt && dkey(new Date(t.doneAt)) === today()).length;

  const toggleMini = () => setMini(m => { const n = !m; try { localStorage.setItem('track_mini', n ? '1' : '0'); } catch { /* ignore */ } return n; });
  const toggleDone = (t: Task) => saveTask({ ...t, done: !t.done, doneAt: !t.done ? Date.now() : null });

  const board = tab === 'board' && !mini;
  const alertBox = alert && (
      <div role="alert" className={`rounded-lg border p-3 flex flex-col gap-2 text-sm ${alert.level === 3 ? 'border-red-400 bg-red-400/15' : alert.level === 2 ? 'border-amber-400 bg-amber-400/10' : 'border-cyan-300/60 bg-cyan-300/10'}`}>
        <b className="text-white">{alert.title}</b>
        <span className="text-zinc-300">{alert.body}</span>
        {alert.kind === 'block' && alert.endedAt && <span className="font-mono text-[13px] text-zinc-200">Stops in {fmtMS(Math.max(0, alert.endedAt + NAG_STOP - at))}</span>}
        <div className="flex gap-2 flex-wrap">
          {alert.kind === 'stopped' ? (
            <button className={btn} onClick={() => setAlert(null)}>Dismiss</button>
          ) : alert.kind === 'block' ? (
            <><button className={btnPrimary} onClick={takeBreak}>Take {s.settings.brk} min break</button><button className={btn} onClick={() => { unlock(); setAlert(null); }}>Keep going</button></>
          ) : (
            <><button className={btnPrimary} onClick={resumeFromBreak}>Back to it</button><button className={btn} onClick={() => setAlert(null)}>Dismiss</button></>
          )}
        </div>
      </div>
  );

  return (
    <div className={`flex-1 w-full mx-auto p-4 sm:p-6 grid gap-5 items-start ${mini ? 'max-w-[340px]' : board ? 'max-w-none' : 'max-w-[1180px] lg:grid-cols-[360px_minmax(0,1fr)]'}`}>
      <aside className={`flex flex-col gap-3.5 min-w-0 ${mini ? '' : 'lg:sticky lg:top-4'} ${board ? 'hidden' : ''}`}>
        <div className={`${card} flex flex-col gap-3`}>
          <div className="flex items-center justify-between gap-2">
            <h1 className="font-semibold text-white flex items-center gap-2" style={{ margin: 0, fontSize: 18, lineHeight: 1.25, letterSpacing: 'normal', maxWidth: 'none' }}><Timer size={18} className="text-cyan-300" aria-hidden />Time Tracker</h1>
            <div className="flex items-center gap-2">
              <SyncPill sync={sync} />
              {installEvt && (
                <button onClick={() => void install()} className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/40 px-2 py-1 text-[12px] text-cyan-300!" title="Install as an app" aria-label="Install as an app">
                  <Download size={13} />{!mini && 'Install'}
                </button>
              )}
              <button onClick={toggleMini} className="rounded-lg border border-white/10 p-1.5 text-zinc-400! hover:text-white!" title={mini ? 'Full view' : 'Corner mode'} aria-label={mini ? 'Full view' : 'Corner mode'}>
                {mini ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
            </div>
          </div>

          {alertBox}

          <div>
            <div className={label}>{stateText}</div>
            <div className={`font-mono text-[56px] leading-none tabular-nums mt-1.5 ${running ? 'text-cyan-300' : 'text-white'} ${mini ? 'text-[44px]' : ''}`}>{fmtHMS(ms)}</div>
            <div className="text-[13px] text-zinc-400 mt-1.5 min-h-5 break-words">
              {hasActivity
                ? <><b className="text-zinc-100 font-semibold">{labelOf(cur.taskId, seg ? cur.note : noteText)}</b>: {fmtDur(tot.all + ms)} total · {fmtDur(tot.td + ms)} today</>
                : 'Pick or type an activity to see its total.'}
            </div>
          </div>

          {fm > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-cyan-300 rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, bm / fm * 100)}%` }} /></div>
              <div className="flex justify-between text-[13px] text-zinc-400"><span>Block {fmtMS(bm)} / {fmtMS(fm)}</span><span>{blocksToday} blocks today</span></div>
            </div>
          )}

          <input
            className={field} placeholder="What are you working on?" autoComplete="off" list="track-recent" enterKeyHint="done"
            value={noteText} onChange={e => setNoteText(e.target.value)} onBlur={commitNote}
            onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
          />
          <datalist id="track-recent">{recent.map(n => <option key={n} value={n} />)}</datalist>

          <div className="flex gap-1.5 flex-wrap">
            {CAT_KEYS.map(k => (
              <button key={k} onClick={() => pickCat(k)} aria-pressed={cur.cat === k}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] ${cur.cat === k ? CATS[k].chipOn + ' font-semibold' : 'border-white/10 text-zinc-300! hover:text-white!'}`}>
                <span className={`h-2 w-2 rounded-full ${CATS[k].dot}`} />{CATS[k].label}
              </button>
            ))}
          </div>

          <select className={field} aria-label="Activity from your tasks" value={cur.taskId && openTasks.some(t => t.id === cur.taskId) ? cur.taskId : ''} onChange={e => pickTask(e.target.value)}>
            <option value="">No linked task</option>
            {openTasks.map(t => { const a = activityTotals(t.id).all; return <option key={t.id} value={t.id}>{t.title}{a ? ` · ${fmtDur(a)}` : ''}</option>; })}
          </select>

          <div className="flex gap-2">
            <button className={`${btnPrimary} flex-1 inline-flex items-center justify-center gap-2`} onClick={startPause}>
              {running ? <><Pause size={15} />Pause</> : <><Play size={15} />{seg ? 'Resume' : 'Start'}</>}
            </button>
            <button className={`${btn} inline-flex items-center gap-2`} onClick={stop} disabled={!seg}><Square size={13} />Stop &amp; save</button>
          </div>

          {!mini && (
            <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2 text-[13px] text-zinc-400">
              <label htmlFor="track-focus">Block</label>
              <select id="track-focus" className={field} value={s.settings.focus} onChange={e => saveSettings({ focus: +e.target.value })}>
                {[[0, 'Off'], [15, '15 min'], [25, '25 min'], [45, '45 min'], [50, '50 min'], [90, '90 min']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <label htmlFor="track-break">Break</label>
              <select id="track-break" className={field} value={s.settings.brk} onChange={e => saveSettings({ brk: +e.target.value })}>
                {[5, 10, 15, 20].map(v => <option key={v} value={v}>{v} min</option>)}
              </select>
            </div>
          )}
        </div>

        {!mini && (
          <div className={`${card} flex flex-col gap-1.5`}>
            <div className="flex justify-between text-[13px] text-zinc-400"><b className="text-white text-[15px]">Level {level}</b><span>{points} points · 1 per 10 min</span></div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-cyan-300 rounded-full transition-[width] duration-500" style={{ width: `${into}%` }} /></div>
            <div className="flex justify-between text-[13px] text-zinc-400"><span>{100 - into} to level {level + 1}</span><span>{doneToday} done today</span></div>
          </div>
        )}
      </aside>

      {!mini && (
        <main className={`min-w-0 ${board ? '' : card}`}>
          {board && alertBox && <div className="mb-3 max-w-[520px]">{alertBox}</div>}
          <div className="flex gap-1 mb-4 border-b border-white/10 items-center" role="tablist">
            {([['tasks', 'Tasks'], ['board', 'Board'], ['cal', 'Calendar'], ['stats', 'Stats']] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`px-3.5 py-2 text-sm font-semibold -mb-px border-b-2 ${tab === k ? 'text-white! border-cyan-300' : 'text-zinc-500! border-transparent hover:text-zinc-300!'}`}>{l}</button>
            ))}
            {board && (
              <div className="ml-auto flex items-center gap-2.5 pb-1 text-[13px] text-zinc-400 min-w-0">
                <span className="truncate max-w-[260px]">{hasActivity ? labelOf(cur.taskId, seg ? cur.note : noteText) : 'Nothing tracking'}</span>
                <span className={`font-mono text-base tabular-nums ${running ? 'text-cyan-300' : 'text-white'}`}>{fmtHMS(ms)}</span>
                <button onClick={startPause} className="rounded-lg bg-cyan-300 p-1.5 text-black!" aria-label={running ? 'Pause' : seg ? 'Resume' : 'Start'}>{running ? <Pause size={14} /> : <Play size={14} />}</button>
                <button onClick={toggleMini} className="rounded-lg border border-white/10 p-1.5 text-zinc-400! hover:text-white!" title="Corner mode" aria-label="Corner mode"><Minimize2 size={14} /></button>
              </div>
            )}
          </div>
          {tab === 'tasks' && <TasksTab tasks={tasks} activityTotals={activityTotals} onToggle={toggleDone} onTrack={trackTask} />}
          {tab === 'board' && <BoardTab />}
          {tab === 'cal' && <CalendarTab tasks={tasks} entries={entries} activityTotals={activityTotals} onToggle={toggleDone} onTrack={trackTask} />}
          {tab === 'stats' && <StatsTab s={s} tasks={tasks} entries={entries} labelOf={labelOf} />}
        </main>
      )}
    </div>
  );
}

function SyncPill({ sync }: { sync: ReturnType<typeof useTrackSync> }) {
  if (sync.error) {
    return (
      <button onClick={() => void syncNow()} title={sync.error} className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] text-amber-300!">
        <CloudOff size={11} />{sync.pending ? `${sync.pending} waiting` : 'Retry'}
      </button>
    );
  }
  if (sync.syncing || sync.pending) {
    return <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500"><RefreshCw size={11} className="animate-spin" />Syncing</span>;
  }
  return <span className="text-[11px] text-zinc-600">{sync.lastSync ? 'Synced' : ''}</span>;
}

// ---------- tasks ----------
type TotalsFn = (key: string) => { all: number; td: number };

function TaskRow({ t, totals, onToggle, onTrack }: { t: Task; totals: TotalsFn; onToggle: (t: Task) => void; onTrack: (t: Task) => void }) {
  const [editPts, setEditPts] = useState(false);
  const [ptsVal, setPtsVal] = useState(String(t.pts));
  const commitPts = () => {
    setEditPts(false);
    const n = Math.min(500, Math.max(1, parseInt(ptsVal) || t.pts));
    if (n !== t.pts) saveTask({ id: t.id, title: t.title, cat: t.cat, pts: n, due: t.due, done: t.done, doneAt: t.doneAt });
  };
  const logged = totals(t.id).all;
  const due = t.due ? (t.due === today() ? 'Due today' : `Due ${t.due.slice(5)}`) : 'No due date';
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.07] last:border-b-0">
      <button onClick={() => onToggle(t)} aria-label={t.done ? 'Mark open' : 'Mark done'}
        className={`h-[22px] w-[22px] shrink-0 rounded-[7px] border-2 grid place-items-center ${CATS[t.cat].ring} ${t.done ? CATS[t.cat].bar + ' text-black!' : ''}`}>
        {t.done && <Check size={14} strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`break-words ${t.done ? 'line-through text-zinc-500' : 'text-white'}`}>{t.title}</div>
        <div className="flex gap-2.5 flex-wrap text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${CATS[t.cat].dot}`} />{CATS[t.cat].label}</span>
          {due && <span>{due}</span>}
          {logged > 0 && <span>{fmtDur(logged)} logged</span>}
        </div>
      </div>
      {editPts
        ? <input autoFocus type="number" min={1} max={500} aria-label="Points" value={ptsVal} onChange={e => setPtsVal(e.target.value)} onBlur={commitPts}
            onKeyDown={e => { if (e.key === 'Enter') commitPts(); if (e.key === 'Escape') { setPtsVal(String(t.pts)); setEditPts(false); } }}
            className="w-16 rounded-md bg-white/5 border border-white/20 px-1.5 py-0.5 text-[13px] font-mono text-white" />
        : <button onClick={() => { setPtsVal(String(t.pts)); setEditPts(true); }} title="Edit points" aria-label="Edit points"
            className="font-mono text-[13px] font-bold text-cyan-300! whitespace-nowrap hover:underline">+{t.pts}</button>}
      {!t.done && <button onClick={() => onTrack(t)} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-400! hover:text-cyan-300! hover:border-cyan-300/50" title="Switch the timer to this task">Track</button>}
      <button onClick={() => removeTask(t.id)} aria-label="Delete task" className="text-zinc-500! hover:text-red-400! p-1"><X size={14} /></button>
    </div>
  );
}

function CatChips({ value, onChange }: { value: Cat; onChange: (c: Cat) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {CAT_KEYS.map(k => (
        <button type="button" key={k} onClick={() => onChange(k)} aria-pressed={value === k}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] ${value === k ? CATS[k].chipOn + ' font-semibold' : 'border-white/10 text-zinc-300! hover:text-white!'}`}>
          <span className={`h-2 w-2 rounded-full ${CATS[k].dot}`} />{CATS[k].label}
        </button>
      ))}
    </div>
  );
}

function TasksTab({ tasks, activityTotals, onToggle, onTrack }: { tasks: Task[]; activityTotals: TotalsFn; onToggle: (t: Task) => void; onTrack: (t: Task) => void }) {
  const [title, setTitle] = useState('');
  const [pts, setPts] = useState(10);
  const [due, setDue] = useState(today());
  const [noDue, setNoDue] = useState(false);
  const [cat, setCat] = useState<Cat>('work');
  const open = tasks.filter(t => !t.done).sort((a, b) => ((a.due || '9') < (b.due || '9') ? -1 : 1));
  const done = tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 8);
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    saveTask({ id: uid(), title: title.trim(), cat, pts: Math.max(1, pts || 10), due: noDue ? '' : due, done: false });
    setTitle('');
  };
  return (
    <div>
      <form onSubmit={add} className="grid grid-cols-[minmax(0,1fr)_72px] sm:grid-cols-[minmax(0,1fr)_84px_140px_auto] gap-2 mb-2">
        <input className={field} placeholder="Add a task" autoComplete="off" required value={title} onChange={e => setTitle(e.target.value)} />
        <input className={field} type="number" min={1} max={500} aria-label="Points" value={pts} onChange={e => setPts(parseInt(e.target.value) || 0)} />
        <input className={`${field} ${noDue ? 'opacity-40' : ''}`} type="date" aria-label="Due date" disabled={noDue} value={due} onChange={e => setDue(e.target.value)} />
        <button className={btnPrimary}>Add</button>
      </form>
      <div className="flex items-center gap-2 flex-wrap mb-4"><CatChips value={cat} onChange={setCat} /><span className={`${label} ml-1`}>points on completion</span>
        <label className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-zinc-400"><input type="checkbox" checked={noDue} onChange={e => setNoDue(e.target.checked)} />No due date</label></div>
      <h2 className="text-lg font-semibold text-white mb-2" style={{ margin: '0 0 8px' }}>To do · {open.length}</h2>
      {open.length ? open.map(t => <TaskRow key={t.id} t={t} totals={activityTotals} onToggle={onToggle} onTrack={onTrack} />) : <div className="text-zinc-500 py-3">Nothing open. Add a task above.</div>}
      {done.length > 0 && <>
        <h2 className="text-lg font-semibold text-white" style={{ margin: '22px 0 8px' }}>Completed</h2>
        {done.map(t => <TaskRow key={t.id} t={t} totals={activityTotals} onToggle={onToggle} onTrack={onTrack} />)}
      </>}
    </div>
  );
}

// ---------- calendar ----------
function CalendarTab({ tasks, entries, activityTotals, onToggle, onTrack }: { tasks: Task[]; entries: Entry[]; activityTotals: TotalsFn; onToggle: (t: Task) => void; onTrack: (t: Task) => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selDay, setSelDay] = useState(today());
  const [title, setTitle] = useState('');
  const [pts, setPts] = useState(10);
  const [cat, setCat] = useState<Cat>('work');
  const y = month.getFullYear(), mo = month.getMonth();
  const first = new Date(y, mo, 1), start = new Date(y, mo, 1 - ((first.getDay() + 6) % 7));
  const byDay: Record<string, { t: Task[]; ms: number }> = {};
  tasks.forEach(t => { if (t.due) (byDay[t.due] ||= { t: [], ms: 0 }).t.push(t); });
  entries.forEach(e => { (byDay[dkey(new Date(e.start))] ||= { t: [], ms: 0 }).ms += entryMs(e); });
  const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const info = byDay[selDay] || { t: [], ms: 0 };
  const dayEntries = entries.filter(e => dkey(new Date(e.start)) === selDay).sort((a, b) => a.start - b.start);
  const hm = (v: number) => { const d = new Date(v); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const nav = (v: number) => {
    if (v === 0) { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelDay(today()); }
    else setMonth(new Date(y, mo + v, 1));
  };
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    saveTask({ id: uid(), title: title.trim(), cat, pts: Math.max(1, pts || 10), due: selDay, done: false });
    setTitle('');
  };
  const nb = 'rounded-lg border border-white/10 px-2.5 py-1 text-[13px] text-zinc-400! hover:text-white!';
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-lg font-semibold text-white" style={{ margin: 0 }}>{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <div className="flex gap-1.5"><button className={nb} onClick={() => nav(-1)}>Prev</button><button className={nb} onClick={() => nav(0)}>Today</button><button className={nb} onClick={() => nav(1)}>Next</button></div>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-7 gap-1 min-w-0">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="text-[11px] uppercase tracking-[0.08em] text-zinc-500 text-center py-1">{d}</div>)}
          {cells.map(d => {
            const k = dkey(d), i = byDay[k] || { t: [], ms: 0 };
            return (
              <button key={k} onClick={() => setSelDay(k)} aria-pressed={k === selDay}
                className={`min-h-[56px] md:min-h-[74px] min-w-0 rounded-lg border p-1.5 flex flex-col gap-1 text-left ${k === selDay ? 'border-cyan-300 bg-[#1b1d22]' : 'border-transparent bg-white/5'} ${d.getMonth() !== mo ? 'opacity-40' : ''}`}>
                <span className={`text-xs font-semibold self-start ${k === today() ? 'bg-cyan-300 text-black rounded-full px-1.5' : 'text-zinc-200'}`}>{d.getDate()}</span>
                <span className="flex gap-[3px] flex-wrap">{i.t.slice(0, 6).map(t => <span key={t.id} className={`h-[7px] w-[7px] rounded-full ${CATS[t.cat].dot} ${t.done ? 'opacity-40' : ''}`} />)}</span>
                {i.ms > 0 && <span className="hidden md:block mt-auto font-mono text-[11px] text-zinc-500">{fmtDur(i.ms)}</span>}
              </button>
            );
          })}
        </div>
        <div className="min-w-0">
          <div className={label}>{selDay}</div>
          <h2 className="text-lg font-semibold text-white" style={{ margin: '4px 0 0' }}>{info.ms ? `${fmtDur(info.ms)} tracked` : 'Nothing tracked'}</h2>
          <form onSubmit={add} className="flex flex-col gap-2 my-3">
            <div className="flex gap-2"><input className={field} placeholder="Add a task for this day" autoComplete="off" required value={title} onChange={e => setTitle(e.target.value)} />
              <input className={`${field} !w-[72px]`} type="number" min={1} max={500} aria-label="Points" value={pts} onChange={e => setPts(parseInt(e.target.value) || 0)} /></div>
            <div className="flex items-center gap-2 flex-wrap"><CatChips value={cat} onChange={setCat} /><button className={`${btnPrimary} ml-auto`}>Add</button></div>
          </form>
          {info.t.length ? info.t.map(t => <TaskRow key={t.id} t={t} totals={activityTotals} onToggle={onToggle} onTrack={onTrack} />) : <div className="text-zinc-500 py-2">No tasks due on this day.</div>}
          {dayEntries.length > 0 && <>
            <div className={`${label} mt-4`}>Time entries</div>
            {dayEntries.map(e => (
              <div key={e.id} className="flex items-center gap-2.5 py-2 border-b border-white/[0.07] text-sm">
                <span className={`h-2 w-2 rounded-full shrink-0 ${CATS[e.cat].dot}`} />
                <span className="min-w-0 break-words text-zinc-200">{e.note || CATS[e.cat].label}</span>
                <span className="ml-auto font-mono text-[13px] text-zinc-300 whitespace-nowrap">{hm(e.start)} · {fmtDur(entryMs(e))}</span>
                <button onClick={() => removeEntry(e.id)} aria-label="Delete entry" className="text-zinc-500! hover:text-red-400! p-1"><X size={14} /></button>
              </div>
            ))}
          </>}
        </div>
      </div>
    </div>
  );
}

// ---------- stats ----------
function StatsTab({ s, tasks, entries, labelOf }: { s: TrackState; tasks: Task[]; entries: Entry[]; labelOf: (id: string | null | undefined, note: string | undefined) => string }) {
  // Default is today. Presets look back N days from today; Custom takes any from/to dates.
  const [mode, setMode] = useState<'today' | 7 | 14 | 30 | 'custom'>('today');
  const [from, setFrom] = useState(() => { const d = new Date(); return dkey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6)); });
  const [to, setTo] = useState(today());
  const nowD = new Date();
  const span = mode === 'today' ? 1 : mode === 'custom' ? 0 : mode;
  const parse = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  let startD = span ? new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() - (span - 1)) : parse(from || to || today());
  let endD = span ? new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()) : parse(to || from || today());
  if (startD > endD) [startD, endD] = [endD, startD];
  const count = Math.min(366, Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1);
  const days = Array.from({ length: count }, (_, i) => dkey(new Date(startD.getFullYear(), startD.getMonth(), startD.getDate() + i)));
  const range = days.length;
  const per: Record<string, Record<Cat, number>> = {};
  days.forEach(k => { per[k] = { work: 0, learn: 0, life: 0 }; });
  const tot: Record<Cat, number> = { work: 0, learn: 0, life: 0 };
  const acts: Record<string, { ms: number; cat: Cat; label: string }> = {};
  entries.forEach(e => {
    const k = dkey(new Date(e.start));
    if (!per[k]) return;
    per[k][e.cat] += entryMs(e); tot[e.cat] += entryMs(e);
    const ak = keyOf(e.taskId, e.note);
    const g = (acts[ak] ||= { ms: 0, cat: e.cat, label: labelOf(e.taskId, e.note) });
    g.ms += entryMs(e);
  });
  const all = tot.work + tot.learn + tot.life;
  const max = Math.max(3600000, ...days.map(k => per[k].work + per[k].learn + per[k].life));
  const list = Object.values(acts).sort((a, b) => b.ms - a.ms).slice(0, 10);
  const top = list[0]?.ms || 1;
  const doneTasks = tasks.filter(t => t.done && t.doneAt && days.includes(dkey(new Date(t.doneAt))));
  const blocks = days.reduce((a, k) => a + (s.settings.days[k] || 0), 0);
  const dn = (k: string) => new Date(k + 'T00:00').toLocaleString(undefined, { weekday: 'short' }).slice(0, range > 7 ? 1 : 3);
  const showDn = range <= 31;
  const h2 = 'text-lg font-semibold text-white';
  return (
    <div>
      <div className="flex gap-1.5 mb-3 flex-wrap items-center">
        {([['today', 'Today'], [7, '7 days'], [14, '14 days'], [30, '30 days'], ['custom', 'Custom']] as const).map(([v, l]) => <button key={v} onClick={() => setMode(v)} aria-pressed={mode === v}
          className={`rounded-full border px-3 py-1 text-[13px] ${mode === v ? 'border-cyan-300 bg-cyan-300/15 text-white! font-semibold' : 'border-white/10 text-zinc-300!'}`}>{l}</button>)}
      </div>
      {mode === 'custom' && (
        <div className="flex gap-2 items-center flex-wrap mb-3 text-[13px] text-zinc-400">
          <input className={`${field} !w-auto`} type="date" aria-label="From date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
          <span>to</span>
          <input className={`${field} !w-auto`} type="date" aria-label="To date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
        </div>
      )}
      <div className={label}>Time allocation</div>
      <h2 className={h2} style={{ margin: '4px 0 0' }}>{all ? `${fmtDur(all)} tracked` : 'Nothing tracked yet'}</h2>
      <div className="flex h-4 rounded-full overflow-hidden bg-white/10 my-2.5" role="img" aria-label="Share of time by category">
        {all > 0 && CAT_KEYS.map(k => <div key={k} className={CATS[k].bar} style={{ width: `${tot[k] / all * 100}%` }} />)}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {CAT_KEYS.map(k => (
          <div key={k} className="flex flex-col gap-0.5">
            <b className="text-2xl text-white font-semibold">{fmtDur(tot[k])}</b>
            <span className="text-[13px] text-zinc-400 flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${CATS[k].dot}`} />{CATS[k].label}{all ? ` · ${Math.round(tot[k] / all * 100)}%` : ''}</span>
          </div>
        ))}
      </div>
      <div className={`${label} mt-6`}>Time per activity</div>
      <div className="flex flex-col gap-2.5 mt-2">
        {list.length ? list.map(a => (
          <div key={a.label + a.cat} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 items-center text-sm">
            <span className="flex items-center gap-2 min-w-0 break-words text-zinc-200"><span className={`h-2 w-2 rounded-full shrink-0 ${CATS[a.cat].dot}`} />{a.label}</span>
            <span className="font-mono text-[13px] text-zinc-300">{fmtDur(a.ms)}</span>
            <div className="col-span-2 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className={`h-full ${CATS[a.cat].bar}`} style={{ width: `${a.ms / top * 100}%` }} /></div>
          </div>
        )) : <div className="text-zinc-500 py-2">Track something and it shows up here.</div>}
      </div>
      {range > 1 && <>
      <div className={`${label} mt-6`}>Per day</div>
      <div className="flex items-end gap-2 h-[130px] mt-1.5">
        {days.map(k => {
          const p = per[k], t = p.work + p.learn + p.life;
          return (
            <div key={k} className="flex-1 min-w-0 h-full flex flex-col justify-end gap-1" title={`${k}: ${fmtDur(t)}`}>
              <div className="flex flex-col-reverse rounded-[5px] overflow-hidden bg-white/10" style={{ height: `${t / max * 100}%` }}>
                {CAT_KEYS.map(c => <div key={c} className={CATS[c].bar} style={{ height: `${p[c] / Math.max(1, t) * 100}%` }} />)}
              </div>
              <div className="text-[11px] text-zinc-500 text-center">{showDn ? dn(k) : ''}</div>
            </div>
          );
        })}
      </div>
      </>}
      <div className={`${label} mt-6`}>Tasks and focus blocks</div>
      <h2 className={h2} style={{ margin: '4px 0 0' }}>{doneTasks.length} tasks done · {blocks} focus blocks</h2>
    </div>
  );
}
