import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, SkipForward } from 'lucide-react';
import { playRestDone, setRest, useRest } from '../lib/restTimer';

const clock = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, Math.floor(sec) % 60)).padStart(2, '0')}`;

// The rest timer card. Shown on the logging screen and on the plan view (raised above the Resume bar there).
export function RestBar({ raised = false }: { raised?: boolean }) {
  const rest = useRest();
  const [now, setNow] = useState(Date.now());
  const buzzedFor = useRef<number | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const restLeft = rest ? Math.ceil((rest.end - now) / 1000) : 0;
  useEffect(() => {
    if (!rest) return;
    if (restLeft > 0) { buzzedFor.current = null; return; }
    if (buzzedFor.current === rest.end) return;
    // already over when this opened (e.g. coming back from the plan): don't buzz again
    const fresh = Date.now() - rest.end < 2000;
    buzzedFor.current = rest.end;
    if (fresh) {
      playRestDone();
      try { navigator.vibrate?.([250, 120, 250]); } catch { /* not supported */ }
    }
  }, [rest, restLeft]);
  if (!rest) return null;
  return (
    <div className={`fixed inset-x-0 z-40 px-4 pb-4 pt-2 pointer-events-none ${raised ? 'bottom-28' : 'bottom-0'}`}>
      <div className={`pointer-events-auto mx-auto max-w-md rounded-2xl border p-3 flex items-center gap-3 shadow-xl bg-[#0d0e10] ${restLeft <= 0 ? 'border-emerald-400/60' : 'border-white/15'}`}>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-zinc-400">{restLeft <= 0 ? 'Rest over. Next set.' : 'Rest'} · target {clock((rest.end - rest.start) / 1000)}</div>
          <div className={`font-mono text-3xl font-semibold tabular-nums leading-none ${restLeft <= 0 ? 'text-emerald-300' : 'text-white'}`}>{restLeft <= 0 ? `+${clock(-restLeft)}` : clock(restLeft)}</div>
          <div className="font-mono text-xs text-zinc-300 tabular-nums mt-1">Rested {clock((now - rest.start) / 1000)} so far</div>
          <div className="h-1 rounded-full bg-white/10 mt-2 overflow-hidden">
            <div className="h-full bg-cyan-400 transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, (restLeft / rest.total) * 100))}%` }} />
          </div>
        </div>
        <button onClick={() => setRest(r => (r ? { ...r, end: r.end - 15000 } : r))} aria-label="15 seconds less" className="p-2.5 rounded-lg bg-white/[0.07] text-zinc-200 cursor-pointer"><Minus size={16} /></button>
        <button onClick={() => setRest(r => (r ? { ...r, end: Math.max(r.end, Date.now()) + 15000, total: r.total + 15 } : r))} aria-label="15 seconds more" className="p-2.5 rounded-lg bg-white/[0.07] text-zinc-200 cursor-pointer"><Plus size={16} /></button>
        <button onClick={() => setRest(null)} aria-label="Skip rest" className="p-2.5 rounded-lg bg-white/[0.07] text-zinc-200 cursor-pointer"><SkipForward size={16} /></button>
      </div>
    </div>
  );
}
