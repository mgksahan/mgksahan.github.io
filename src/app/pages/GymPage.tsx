import { useState, useEffect, useRef, useMemo } from 'react';
import { apiService } from '../../apiService';
import routinesData from '../data/routines.json';
import { 
  Play, Plus, Trash2, Check, Clock, Award, Flame, X, 
  ChevronDown, ChevronUp, Search, ArrowLeft, Dumbbell, History, 
  TrendingUp, RotateCcw, AlertTriangle, CheckCircle2, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
// @ts-ignore
import confetti from 'canvas-confetti';

interface RoutineExercise {
  name: string;
  setcount: number;
  timer: number;
}

interface RoutineDay {
  id: string;
  name: string;
  day_index: string;
  exercises: RoutineExercise[];
}

interface Routine {
  id: string;
  name: string;
  description: string;
  days: RoutineDay[];
}

interface ActiveSet {
  weight: string;
  reps: string;
  completed: boolean;
}

interface ActiveExercise {
  name: string;
  sets: ActiveSet[];
  timer: number; // rest time in seconds
  expanded: boolean;
}

export function GymPage() {
  // --- Core Workout State ---
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [workoutElapsedTime, setWorkoutElapsedTime] = useState(0);
  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>([]);
  
  // --- Timers ---
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  
  // --- Metadata & Preload Data ---
  const [exerciseDatabase, setExerciseDatabase] = useState<string[]>([]);
  const [workoutHistoryMap, setWorkoutHistoryMap] = useState<Record<string, any[]>>({});
  const [preloadingHistory, setPreloadingHistory] = useState(false);
  
  // --- UI States ---
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [selectedDay, setSelectedDay] = useState<RoutineDay | null>(null);
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const [finishedSummary, setFinishedSummary] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoverySession, setRecoverySession] = useState<any>(null);
  
  // --- Refs ---
  const stopwatchIntervalRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);

  // --- Web Audio API Synthetic Beep ---
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz A5 note beep
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      console.error('Failed to play beep:', e);
    }
  };

  const playTripleBeep = () => {
    playBeep();
    setTimeout(playBeep, 200);
    setTimeout(playBeep, 400);
  };

  // --- Load Exercise Database ---
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const list = await apiService.fetchFitnessExercises();
        setExerciseDatabase(list);
      } catch (err) {
        console.error('Failed to load exercise list:', err);
      }
    };
    loadExercises();
    
    // Check if there is an active session in progress in localStorage
    const savedSession = localStorage.getItem('gym_active_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        // Only recover if the session is less than 12 hours old
        const ageHours = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
        if (ageHours < 12) {
          setRecoverySession(parsed);
        } else {
          localStorage.removeItem('gym_active_session');
        }
      } catch (e) {
        localStorage.removeItem('gym_active_session');
      }
    }
  }, []);

  // --- Save Active Session to LocalStorage for recovery ---
  useEffect(() => {
    if (isWorkoutActive && !workoutFinished) {
      const sessionState = {
        timestamp: Date.now() - (workoutElapsedTime * 1000), // Approximate start timestamp
        elapsedTime: workoutElapsedTime,
        exercises: activeExercises,
        selectedDayName: selectedDay?.name || 'Custom Workout',
        selectedRoutineName: selectedRoutine?.name || ''
      };
      localStorage.setItem('gym_active_session', JSON.stringify(sessionState));
    } else if (!isWorkoutActive) {
      localStorage.removeItem('gym_active_session');
    }
  }, [isWorkoutActive, workoutElapsedTime, activeExercises, selectedDay, selectedRoutine, workoutFinished]);

  // --- Elapsed Time Stopwatch ---
  useEffect(() => {
    if (isWorkoutActive && !workoutFinished) {
      stopwatchIntervalRef.current = setInterval(() => {
        setWorkoutElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    }
    return () => {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    };
  }, [isWorkoutActive, workoutFinished]);

  // --- Rest Timer Countdown ---
  useEffect(() => {
    if (isRestTimerActive && restTimeLeft > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setRestTimeLeft(prev => {
          if (prev <= 1) {
            setIsRestTimerActive(false);
            playTripleBeep();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isRestTimerActive, restTimeLeft]);

  // --- Fetch History Map for Workout Exercises ---
  const fetchWorkoutHistory = async (exercisesList: string[]) => {
    setPreloadingHistory(true);
    const uniqueNames = [...new Set(exercisesList)];
    const historyPromises = uniqueNames.map(async (name) => {
      try {
        const history = await apiService.fetchFitnessHistory(name);
        return { name, history };
      } catch (e) {
        return { name, history: [] };
      }
    });

    const results = await Promise.all(historyPromises);
    const newHistoryMap: Record<string, any[]> = {};
    results.forEach(res => {
      newHistoryMap[res.name] = res.history;
    });

    setWorkoutHistoryMap(prev => ({ ...prev, ...newHistoryMap }));
    setPreloadingHistory(false);
    return newHistoryMap;
  };

  // --- Start Workout from Day Selection ---
  const handleStartDayWorkout = async (day: RoutineDay, routine: Routine) => {
    setSelectedRoutine(routine);
    setSelectedDay(day);
    setWorkoutElapsedTime(0);
    setRestTimeLeft(0);
    setIsRestTimerActive(false);

    // Initial empty exercises setup
    const initialExercises = day.exercises.map((ex, idx) => ({
      name: ex.name,
      timer: ex.timer || 90,
      expanded: idx === 0, // expand first exercise by default
      sets: Array.from({ length: ex.setcount || 3 }, () => ({
        weight: '',
        reps: '',
        completed: false
      }))
    }));

    setActiveExercises(initialExercises);
    setIsWorkoutActive(true);
    setWorkoutFinished(false);

    // Fetch history in background and auto-populate
    try {
      const exerciseNames = day.exercises.map(e => e.name);
      const historyMap = await fetchWorkoutHistory(exerciseNames);

      // Populate weights & reps from latest historical log
      setActiveExercises(prev => {
        return prev.map(ex => {
          const history = historyMap[ex.name] || [];
          if (history.length > 0) {
            // Sort by date descending
            const sorted = [...history].sort((a, b) => b.workout_date.localeCompare(a.workout_date));
            const latest = sorted[0];
            if (latest && latest.raw_logs) {
              const prevSets = latest.raw_logs.split(',');
              const updatedSets = ex.sets.map((set, setIdx) => {
                const prevSet = prevSets[setIdx] || prevSets[prevSets.length - 1]; // fallback to last set if logged fewer sets previously
                if (prevSet) {
                  const [w, r] = prevSet.split('x');
                  return {
                    ...set,
                    weight: w || '',
                    reps: r || ''
                  };
                }
                return set;
              });
              return { ...ex, sets: updatedSets };
            }
          }
          return ex;
        });
      });
    } catch (err) {
      console.error('Failed to preload history weights:', err);
    }
  };

  // --- Start Custom Blank Workout ---
  const handleStartEmptyWorkout = () => {
    setSelectedRoutine(null);
    setSelectedDay(null);
    setWorkoutElapsedTime(0);
    setRestTimeLeft(0);
    setIsRestTimerActive(false);
    setActiveExercises([]);
    setIsWorkoutActive(true);
    setWorkoutFinished(false);
  };

  // --- Recover Saved Session ---
  const handleRecoverSession = () => {
    if (recoverySession) {
      const passedSeconds = Math.floor((Date.now() - recoverySession.timestamp) / 1000);
      setWorkoutElapsedTime(passedSeconds > 0 ? passedSeconds : recoverySession.elapsedTime);
      setActiveExercises(recoverySession.exercises);
      setIsWorkoutActive(true);
      setWorkoutFinished(false);
      setRecoverySession(null);
      toast.success('Workout session recovered!');
      
      // Fetch history for active exercises in background
      const names = recoverySession.exercises.map((e: any) => e.name);
      fetchWorkoutHistory(names);
    }
  };

  // --- Set Actions ---
  const handleUpdateSet = (exerciseIdx: number, setIdx: number, field: 'weight' | 'reps', value: string) => {
    setActiveExercises(prev => {
      const copy = [...prev];
      copy[exerciseIdx].sets[setIdx][field] = value;
      return copy;
    });
  };

  const handleToggleSetCompleted = (exerciseIdx: number, setIdx: number) => {
    setActiveExercises(prev => {
      const copy = [...prev];
      const targetSet = copy[exerciseIdx].sets[setIdx];
      const nextCompleted = !targetSet.completed;
      targetSet.completed = nextCompleted;

      if (nextCompleted) {
        // Only trigger timer if weight and reps are set, and timer is set to a value > 0
        if (targetSet.weight && targetSet.reps && copy[exerciseIdx].timer > 0) {
          setRestTimeLeft(copy[exerciseIdx].timer);
          setIsRestTimerActive(true);
        }
      }
      return copy;
    });
  };

  const handleAddSet = (exerciseIdx: number) => {
    setActiveExercises(prev => {
      const copy = [...prev];
      const sets = copy[exerciseIdx].sets;
      const lastSet = sets[sets.length - 1];
      sets.push({
        weight: lastSet ? lastSet.weight : '',
        reps: lastSet ? lastSet.reps : '',
        completed: false
      });
      return copy;
    });
  };

  const handleRemoveSet = (exerciseIdx: number) => {
    setActiveExercises(prev => {
      const copy = [...prev];
      if (copy[exerciseIdx].sets.length > 1) {
        copy[exerciseIdx].sets.pop();
      }
      return copy;
    });
  };

  // --- Exercise Actions ---
  const handleToggleExerciseExpanded = (idx: number) => {
    setActiveExercises(prev => prev.map((ex, i) => i === idx ? { ...ex, expanded: !ex.expanded } : ex));
  };

  const handleRemoveExercise = (idx: number) => {
    if (window.confirm('Remove this exercise from current session?')) {
      setActiveExercises(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleAddExerciseToWorkout = async (name: string) => {
    if (!name) return;
    
    // Check duplication
    if (activeExercises.some(e => e.name === name)) {
      toast.error('Exercise already added!');
      return;
    }

    const newExercise: ActiveExercise = {
      name,
      timer: 90,
      expanded: true,
      sets: [{ weight: '', reps: '', completed: false }]
    };

    setActiveExercises(prev => {
      // Collapse others, expand new
      const collapsed = prev.map(ex => ({ ...ex, expanded: false }));
      return [...collapsed, newExercise];
    });

    setIsAddExerciseOpen(false);
    setSearchQuery('');
    toast.success(`Added ${name}`);

    // Fetch history for new exercise
    try {
      const historyMap = await fetchWorkoutHistory([name]);
      const history = historyMap[name] || [];
      if (history.length > 0) {
        const sorted = [...history].sort((a, b) => b.workout_date.localeCompare(a.workout_date));
        const latest = sorted[0];
        if (latest && latest.raw_logs) {
          const prevSets = latest.raw_logs.split(',');
          const defaultSets = prevSets.map(p => {
            const [w, r] = p.split('x');
            return { weight: w || '', reps: r || '', completed: false };
          });
          
          setActiveExercises(prev => prev.map(ex => ex.name === name ? { ...ex, sets: defaultSets } : ex));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCustomExercise = () => {
    const name = searchQuery.trim();
    if (!name) return;
    handleAddExerciseToWorkout(name);
  };

  // --- Finish Workout Saving to DynamoDB ---
  const handleFinishWorkout = async () => {
    // Filter out exercises that have at least one completed set with weights/reps
    const completedWorkoutList: any[] = [];
    activeExercises.forEach(ex => {
      const completedSets = ex.sets.filter(s => s.completed && s.weight !== '' && s.reps !== '');
      if (completedSets.length > 0) {
        completedWorkoutList.push({
          name: ex.name,
          sets: completedSets
        });
      }
    });

    if (completedWorkoutList.length === 0) {
      toast.error('Complete at least one set with weight and reps to finish workout!');
      return;
    }

    setIsSubmitting(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      let totalVolLbs = 0;

      const calculate1RM = (weight: number, reps: number) => {
        if (reps <= 1) return weight;
        return weight * (1 + reps / 30.0);
      };

      // Push logs sequentially to avoid throttles
      for (const item of completedWorkoutList) {
        const rawLogs = item.sets.map((s: any) => `${s.weight}x${s.reps}`).join(',');
        
        let volKg = 0;
        let max1rmKg = 0;

        item.sets.forEach((s: any) => {
          const w = parseFloat(s.weight) || 0;
          const r = parseInt(s.reps) || 0;
          volKg += w * r;
          const oneRM = calculate1RM(w, r);
          if (oneRM > max1rmKg) max1rmKg = oneRM;
        });

        const exVolLbs = Math.round(volKg * 2.20462 * 100) / 100;
        const oneRMKg = Math.round(max1rmKg * 100) / 100;
        const oneRMLbs = Math.round(max1rmKg * 2.20462 * 100) / 100;

        totalVolLbs += exVolLbs;

        await apiService.createFitnessLog({
          exercise_name: item.name,
          workout_date: todayStr,
          raw_logs: rawLogs,
          one_rep_max_kg: oneRMKg,
          one_rep_max_lbs: oneRMLbs,
          total_volume_lbs: exVolLbs
        });
      }

      // Record last workout date/time for stats
      localStorage.setItem('gym_last_workout_summary', JSON.stringify({
        date: todayStr,
        dayName: selectedDay?.name || 'Custom Session',
        exercisesCount: completedWorkoutList.length,
        volume: Math.round(totalVolLbs)
      }));

      setFinishedSummary({
        duration: formatTime(workoutElapsedTime),
        exercisesCount: completedWorkoutList.length,
        volume: Math.round(totalVolLbs)
      });
      setWorkoutFinished(true);

      // Trigger confetti!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });

      localStorage.removeItem('gym_active_session');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to save workout logs to DynamoDB');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Reset All States ---
  const handleCloseFinishedView = () => {
    setIsWorkoutActive(false);
    setWorkoutFinished(false);
    setFinishedSummary(null);
    setActiveExercises([]);
    setWorkoutElapsedTime(0);
    setSelectedDay(null);
    setSelectedRoutine(null);
  };

  // --- Helper Formats ---
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [
      hrs > 0 ? String(hrs).padStart(2, '0') : null,
      String(mins).padStart(2, '0'),
      String(secs).padStart(2, '0')
    ].filter(Boolean).join(':');
  };

  // --- Filter Search Exercises ---
  const filteredExercises = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return exerciseDatabase.slice(0, 15);
    return exerciseDatabase.filter(e => e.toLowerCase().includes(q));
  }, [exerciseDatabase, searchQuery]);

  // --- Retrieve Last Workout Summary ---
  const lastWorkout = useMemo(() => {
    const raw = localStorage.getItem('gym_last_workout_summary');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [workoutFinished]);

  // ==================== RENDERS ====================

  // 1. SESSION RECOVERY DIALOG
  if (recoverySession) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center p-6 bg-zinc-950 text-white select-none">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-6 text-center backdrop-blur-md">
          <div className="mx-auto w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center animate-pulse">
            <AlertTriangle size={28} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight">Session in Progress</h3>
            <p className="text-sm text-zinc-400">
              A workout session from earlier today was found ({recoverySession.selectedDayName}).
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleRecoverSession}
              className="w-full h-12 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RotateCcw size={16} /> Resume Session
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('gym_active_session');
                setRecoverySession(null);
              }}
              className="w-full h-12 border border-zinc-800 text-zinc-400 hover:bg-zinc-900 font-semibold rounded-xl cursor-pointer transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. CONGRATULATIONS / FINISHED SUMMARY VIEW
  if (workoutFinished) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center p-6 bg-zinc-950 text-white select-none">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-6 text-center backdrop-blur-md animate-scale-up">
          <div className="mx-auto w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center animate-bounce">
            <Award size={36} />
          </div>
          
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">Workout Saved!</h2>
            <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
              <CheckCircle2 size={12} /> Sync Complete to DynamoDB
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 py-4 border-y border-zinc-800/80 bg-zinc-950/40 rounded-lg">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase block">Duration</span>
              <span className="text-sm font-extrabold text-white tabular-nums">{finishedSummary?.duration}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase block">Exercises</span>
              <span className="text-sm font-extrabold text-white tabular-nums">{finishedSummary?.exercisesCount}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase block">Volume</span>
              <span className="text-sm font-extrabold text-white tabular-nums">{finishedSummary?.volume} lbs</span>
            </div>
          </div>

          <button
            onClick={handleCloseFinishedView}
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl cursor-pointer transition-colors"
          >
            Back to Portal
          </button>
        </div>
      </div>
    );
  }

  // 3. ACTIVE WORKOUT SCREEN
  if (isWorkoutActive) {
    return (
      <div className="flex-1 flex flex-col bg-zinc-950 text-white select-none pb-20 animate-fade-in">
        {/* Top Header Stopwatch Navigation */}
        <div className="sticky top-0 z-30 bg-zinc-950/80 border-b border-zinc-900 backdrop-blur px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => {
              if (window.confirm('Cancel workout? All unsaved active set logs will be deleted.')) {
                setIsWorkoutActive(false);
                localStorage.removeItem('gym_active_session');
              }
            }}
            className="text-xs font-bold text-rose-500 px-3 py-2 rounded-xl hover:bg-rose-500/10 cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <div className="text-xl font-black tabular-nums tracking-tight text-white flex items-center gap-1.5">
            <Clock size={16} className="text-rose-500 animate-pulse" />
            {formatTime(workoutElapsedTime)}
          </div>

          <button
            onClick={handleFinishWorkout}
            disabled={isSubmitting}
            className="text-xs font-bold bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white px-4 py-2 rounded-xl cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
          >
            {isSubmitting ? 'Saving...' : 'Finish'}
          </button>
        </div>

        {/* Rest Countdown Bar */}
        {restTimeLeft > 0 && (
          <div className="sticky top-[53px] z-20 bg-emerald-500/20 border-b border-emerald-500/30 px-4 py-2.5 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <Clock className="text-emerald-400 animate-spin" size={16} />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Rest Timer ticking</span>
                <span className="text-base font-black text-emerald-300 tabular-nums leading-none">{restTimeLeft} seconds</span>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setRestTimeLeft(prev => prev + 10)}
                className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-[10px] font-bold rounded-lg text-emerald-300 active:scale-95"
              >
                +10s
              </button>
              <button
                onClick={() => setRestTimeLeft(prev => {
                  if (prev <= 10) {
                    setIsRestTimerActive(false);
                    return 0;
                  }
                  return prev - 10;
                })}
                className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-[10px] font-bold rounded-lg text-emerald-300 active:scale-95"
              >
                -10s
              </button>
              <button
                onClick={() => {
                  setRestTimeLeft(0);
                  setIsRestTimerActive(false);
                }}
                className="px-2.5 py-1 bg-rose-500/80 hover:bg-rose-500 text-white text-[10px] font-bold rounded-lg active:scale-95"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Main Active Workout Exercises Scroll */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
            <Dumbbell size={12} className="text-rose-500" />
            {selectedDay ? `${selectedRoutine?.name} › ${selectedDay.name}` : 'Custom Workout Session'}
          </div>

          {activeExercises.length > 0 ? (
            activeExercises.map((ex, exIdx) => {
              const exerciseHistory = workoutHistoryMap[ex.name] || [];
              const sortedHistory = [...exerciseHistory].sort((a, b) => b.workout_date.localeCompare(a.workout_date));
              const latestWorkout = sortedHistory[0];
              const previousSets = latestWorkout ? latestWorkout.raw_logs.split(',') : [];

              const completedSetsCount = ex.sets.filter(s => s.completed).length;

              return (
                <div 
                  key={exIdx} 
                  className={`border rounded-2xl transition-all ${
                    ex.expanded 
                      ? 'border-zinc-800 bg-zinc-900/40 shadow-lg' 
                      : 'border-zinc-900 bg-zinc-900/15'
                  }`}
                >
                  {/* Collapsed Header */}
                  <div 
                    onClick={() => handleToggleExerciseExpanded(exIdx)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="space-y-1 flex-1 pr-3">
                      <h4 className="font-extrabold text-sm tracking-tight text-white leading-tight">
                        {ex.name}
                      </h4>
                      <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase flex items-center gap-1">
                        <Check size={10} className="text-emerald-500" />
                        {completedSetsCount} / {ex.sets.length} sets logged
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveExercise(exIdx);
                        }}
                        className="p-2 text-zinc-500 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                        title="Remove exercise"
                      >
                        <Trash2 size={14} />
                      </button>
                      <div className="text-zinc-400">
                        {ex.expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Body Panel */}
                  {ex.expanded && (
                    <div className="px-4 pb-4 border-t border-zinc-900/80 pt-3 space-y-4">
                      {/* Rest Time Customizer */}
                      <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-900/60 pb-2">
                        <span className="font-semibold flex items-center gap-1">
                          <Clock size={11} className="text-zinc-500" /> Rest Timer setting:
                        </span>
                        <select
                          value={ex.timer}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setActiveExercises(prev => prev.map((item, i) => i === exIdx ? { ...item, timer: val } : item));
                          }}
                          className="bg-zinc-950 border border-zinc-800 text-[10px] font-bold rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-rose-500"
                        >
                          <option value={0}>Off / None</option>
                          <option value={30}>30 seconds</option>
                          <option value={45}>45 seconds</option>
                          <option value={60}>60 seconds</option>
                          <option value={90}>90 seconds</option>
                          <option value={120}>2 minutes</option>
                          <option value={180}>3 minutes</option>
                          <option value={240}>4 minutes</option>
                        </select>
                      </div>

                      {/* Sets Logger Table */}
                      <div className="overflow-x-auto select-none">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-zinc-900/80 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                              <th className="pb-2 pl-1 w-12 text-center">Set</th>
                              <th className="pb-2">Previous</th>
                              <th className="pb-2 text-center w-20">Weight</th>
                              <th className="pb-2 text-center w-16">Reps</th>
                              <th className="pb-2 pr-1 text-center w-12">Log</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900/40">
                            {ex.sets.map((set, setIdx) => {
                              const prevSet = previousSets[setIdx] || previousSets[previousSets.length - 1];
                              const prevFormatted = prevSet ? prevSet.replace('x', ' × ') + ' kg' : '—';

                              return (
                                <tr 
                                  key={setIdx} 
                                  className={`transition-colors ${
                                    set.completed 
                                      ? 'bg-emerald-500/5 text-emerald-400 font-bold' 
                                      : 'text-zinc-300'
                                  }`}
                                >
                                  <td className="py-2.5 text-center font-black">{setIdx + 1}</td>
                                  <td className="py-2.5 text-[10px] font-bold text-zinc-500 tabular-nums">
                                    {prevFormatted}
                                  </td>
                                  <td className="py-2.5 text-center">
                                    <input
                                      type="number"
                                      step="any"
                                      placeholder="0"
                                      value={set.weight}
                                      onChange={(e) => handleUpdateSet(exIdx, setIdx, 'weight', e.target.value)}
                                      className="w-16 h-8 bg-zinc-950 border border-zinc-850 rounded-lg text-center font-extrabold text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                                    />
                                  </td>
                                  <td className="py-2.5 text-center">
                                    <input
                                      type="number"
                                      placeholder="0"
                                      value={set.reps}
                                      onChange={(e) => handleUpdateSet(exIdx, setIdx, 'reps', e.target.value)}
                                      className="w-12 h-8 bg-zinc-950 border border-zinc-850 rounded-lg text-center font-extrabold text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                                    />
                                  </td>
                                  <td className="py-2.5 pr-1 text-center">
                                    <button
                                      onClick={() => handleToggleSetCompleted(exIdx, setIdx)}
                                      className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-all ${
                                        set.completed
                                          ? 'bg-emerald-500 border-emerald-500 text-white'
                                          : 'border-zinc-800 bg-zinc-950 text-zinc-600 hover:text-zinc-400'
                                      }`}
                                    >
                                      <Check size={14} className="stroke-[3]" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Set Modifiers */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddSet(exIdx)}
                          className="flex-1 h-9 border border-dashed border-zinc-800 bg-zinc-950/20 hover:bg-zinc-900/40 rounded-xl text-[11px] font-bold text-zinc-400 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus size={12} /> Add Set
                        </button>
                        {ex.sets.length > 1 && (
                          <button
                            onClick={() => handleRemoveSet(exIdx)}
                            className="h-9 px-3 border border-zinc-850 hover:bg-rose-500/5 text-rose-400 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        )}
                      </div>

                      {/* In-workout Progression History */}
                      {sortedHistory.length > 0 && (
                        <div className="pt-3 border-t border-zinc-900/80 space-y-2">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                            <History size={10} className="text-zinc-500" /> Past Session History
                          </span>
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1 select-none divide-y divide-zinc-900/30">
                            {sortedHistory.slice(0, 3).map((h, i) => (
                              <div key={i} className="py-2 flex justify-between items-center text-[10px]">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-zinc-300 block">{h.workout_date}</span>
                                  <span className="text-zinc-500 block font-medium">Sets: {h.raw_logs.replace(/,/g, ', ')}</span>
                                </div>
                                <div className="text-right space-y-0.5">
                                  <span className="text-zinc-300 font-bold block">1RM: {h.one_rep_max_kg} kg</span>
                                  <span className="text-zinc-500 block font-medium">Vol: {h.total_volume_lbs} lbs</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-12 border border-zinc-900 border-dashed rounded-3xl text-center bg-zinc-950 p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
                <Dumbbell size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-white">Active session is empty</h4>
                <p className="text-xs text-zinc-500 max-w-[220px] mx-auto">
                  Click the button below to add exercises from your database to log your training.
                </p>
              </div>
            </div>
          )}

          {/* Add Exercise Trigger Button */}
          <button
            onClick={() => setIsAddExerciseOpen(true)}
            className="w-full h-12 border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 rounded-2xl text-xs font-bold text-zinc-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus size={14} /> Add Exercise
          </button>
        </div>

        {/* Search Exercise Full Drawer Modal */}
        {isAddExerciseOpen && (
          <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col animate-slide-up select-none">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between">
              <button
                onClick={() => { setIsAddExerciseOpen(false); setSearchQuery(''); }}
                className="p-2 text-zinc-400 hover:text-white cursor-pointer"
              >
                <ArrowLeft size={20} />
              </button>
              <h3 className="text-sm font-extrabold text-white">Search Exercise</h3>
              <div className="w-9 h-9"></div> {/* spacing placeholder */}
            </div>

            {/* Modal Search Input */}
            <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-900">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Bench press, curls, squats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-9 pr-4 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Search Results List */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-900 px-4 py-2">
              {filteredExercises.length > 0 ? (
                filteredExercises.map((exName, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAddExerciseToWorkout(exName)}
                    className="w-full text-left py-3.5 text-xs text-zinc-200 hover:text-white font-bold transition-colors block border-zinc-900/30 active:bg-zinc-900/20"
                  >
                    {exName}
                  </button>
                ))
              ) : (
                <div className="py-8 text-center space-y-3">
                  <p className="text-xs text-zinc-500">No exercise found matching "{searchQuery}"</p>
                  <button
                    onClick={handleCreateCustomExercise}
                    className="h-9 px-4 bg-rose-500 text-white rounded-lg text-[10px] font-bold hover:bg-rose-600 transition-colors"
                  >
                    Create Custom "{searchQuery}"
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. MAIN WORKOUT DASHBOARD / ROUTINES SELECTOR (Default State)
  return (
    <div className="flex-1 flex flex-col bg-zinc-950 text-white select-none pb-8 animate-fade-in">
      {/* App Header */}
      <div className="sticky top-0 z-30 bg-zinc-950 border-b border-zinc-900 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell size={22} className="text-rose-500 animate-pulse" />
          <h1 className="text-lg font-black tracking-tight text-white font-outfit uppercase">Gym Dashboard</h1>
        </div>
        
        {/* Subtle quick back link to main website */}
        <a
          href="/fitness"
          className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest border border-zinc-800 rounded-xl px-3 py-1.5 hover:bg-zinc-900/40"
        >
          Visualizer
        </a>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        
        {/* Last Workout Quick Info Card */}
        {lastWorkout && (
          <div className="border border-zinc-900 bg-zinc-900/20 rounded-2xl p-4 flex items-center justify-between backdrop-blur-sm">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1 leading-none">
                <Flame size={10} /> Last session completed
              </span>
              <h4 className="font-extrabold text-sm text-white">{lastWorkout.dayName}</h4>
              <span className="text-[10px] text-zinc-500 font-medium block">
                {lastWorkout.date} · {lastWorkout.exercisesCount} exercises · {lastWorkout.volume} lbs
              </span>
            </div>
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>
        )}

        {/* Start Workout Quick Options */}
        <div className="space-y-2">
          <button
            onClick={handleStartEmptyWorkout}
            className="w-full h-12 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs shadow-md active:scale-[0.99]"
          >
            <Play size={14} fill="currentColor" /> Start Empty Workout
          </button>
        </div>

        {/* Routines Database Section */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
            <TrendingUp size={12} className="text-rose-500" />
            Your Routines (from Jefit)
          </div>

          <div className="space-y-4">
            {(routinesData as Routine[]).map((routine) => {
              const isSelected = selectedRoutine?.id === routine.id;
              
              return (
                <div 
                  key={routine.id}
                  className={`border rounded-2xl transition-all ${
                    isSelected ? 'border-zinc-800 bg-zinc-900/10' : 'border-zinc-900 bg-zinc-950/20'
                  }`}
                >
                  {/* Routine Header */}
                  <div
                    onClick={() => setSelectedRoutine(isSelected ? null : routine)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="space-y-1 flex-1 pr-2">
                      <h3 className="font-extrabold text-sm text-white tracking-tight leading-tight">{routine.name}</h3>
                      {routine.description && (
                        <p className="text-[10px] text-zinc-500 font-semibold line-clamp-1">{routine.description}</p>
                      )}
                      <span className="text-[9px] font-bold text-rose-500/80 uppercase tracking-widest block">
                        {routine.days.length} Workout Days
                      </span>
                    </div>
                    <div className="text-zinc-500">
                      {isSelected ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Routine Days List */}
                  {isSelected && (
                    <div className="px-4 pb-4 pt-1 border-t border-zinc-900/60 divide-y divide-zinc-900/40">
                      {routine.days.map((day) => {
                        const isDaySelected = selectedDay?.id === day.id;

                        return (
                          <div key={day.id} className="py-3.5 space-y-3">
                            <div 
                              onClick={() => setSelectedDay(isDaySelected ? null : day)}
                              className="flex items-center justify-between cursor-pointer select-none"
                            >
                              <div className="space-y-0.5 flex-1 pr-2">
                                <span className="font-bold text-xs text-zinc-200 block leading-snug">{day.name}</span>
                                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">
                                  {day.exercises.length} Exercises configured
                                </span>
                              </div>
                              <div className="text-zinc-600">
                                {isDaySelected ? <ChevronUp size={14} /> : <ChevronRight size={14} />}
                              </div>
                            </div>

                            {isDaySelected && (
                              <div className="space-y-3 pl-2.5 border-l border-zinc-900 animate-fade-in">
                                {/* Exercises Quick Preview List */}
                                <div className="space-y-1">
                                  {day.exercises.map((ex, exIdx) => (
                                    <div key={exIdx} className="text-[10px] text-zinc-500 font-semibold flex justify-between items-center">
                                      <span className="truncate pr-2">· {ex.name}</span>
                                      <span className="text-zinc-600 text-[9px] uppercase font-bold tabular-nums min-w-[70px] text-right">
                                        {ex.setcount} sets · {ex.timer}s
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                <button
                                  onClick={() => handleStartDayWorkout(day, routine)}
                                  className="w-full h-9 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-sm"
                                >
                                  <Play size={10} fill="currentColor" /> Start Workout Day
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
