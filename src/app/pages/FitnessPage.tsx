import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { apiService } from '../../apiService';
import { 
  Search, ChevronRight, BookOpen, Dumbbell, TrendingUp, Info, X, 
  Play, Pause, Plus, Trash2, Check, Clock, Volume2, Award, Flame, Sparkles, RotateCcw,
  History
} from 'lucide-react';
import { toast } from 'sonner';
// @ts-ignore
import confetti from 'canvas-confetti';

// Helper to generate a smooth Catmull-Rom Bezier spline path for chart points
function getBezierPath(points: { x: number; y: number }[], smoothing = 0.16) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;

  let path = `M ${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    
    // Tangent points
    const prev = points[i - 1] || p0;
    const next = points[i + 2] || p1;

    const cp1x = p0.x + (p1.x - prev.x) * smoothing;
    const cp1y = p0.y + (p1.y - prev.y) * smoothing;

    const cp2x = p1.x - (next.x - p0.x) * smoothing;
    const cp2y = p1.y - (next.y - p0.y) * smoothing;

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
  }

  return path;
}

export function FitnessPage() {
  // Fitness Tracker State
  const [fitnessExercises, setFitnessExercises] = useState<string[]>([]);
  const [selectedFitnessExercise, setSelectedFitnessExercise] = useState('');
  const [fitnessHistory, setFitnessHistory] = useState<any[]>([]);
  const [selectedFitnessMetric, setSelectedFitnessMetric] = useState<'1rem' | 'volume' | 'multiplier'>('1rem'); // '1rem' or 'volume' or 'multiplier'
  const [bodyWeightHistory, setBodyWeightHistory] = useState<any[]>([]);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [timePeriod, setTimePeriod] = useState<'1M' | '3M' | '6M' | '1Y' | 'All' | 'custom'>('All');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<any>(null);
  const [selectedDayWorkouts, setSelectedDayWorkouts] = useState<any[]>([]);
  const [selectedDayLoading, setSelectedDayLoading] = useState(false);
  const [fitnessLoading, setFitnessLoading] = useState(false);
  const [fitnessError, setFitnessError] = useState('');
  const [searchExerciseQuery, setSearchExerciseQuery] = useState('');
  const [isExerciseDropdownOpen, setIsExerciseDropdownOpen] = useState(false);
  const [hoveredDataPoint, setHoveredDataPoint] = useState<any>(null);
  const [hoveredPointCoords, setHoveredPointCoords] = useState({ x: 0, y: 0 });

  // ==================== WORKOUT MODE STATE & ACTIONS ====================
  const [isWorkoutMode, setIsWorkoutMode] = useState(false);
  const [workoutElapsedTime, setWorkoutElapsedTime] = useState(0);
  const [activeExercises, setActiveExercises] = useState<any[]>([]);
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const [configuredRestTime, setConfiguredRestTime] = useState(90); // default 90 seconds
  const [selectedWorkoutExercise, setSelectedWorkoutExercise] = useState('');
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const [finishedSummary, setFinishedSummary] = useState<any>(null);
  const [isSubmittingWorkout, setIsSubmittingWorkout] = useState(false);
  const [searchWorkoutExerciseQuery, setSearchWorkoutExerciseQuery] = useState('');
  const [isWorkoutDropdownOpen, setIsWorkoutDropdownOpen] = useState(false);
  const [workoutHistoryMap, setWorkoutHistoryMap] = useState<Record<string, any[]>>({});

  // Synthetic Audio Beep (Web Audio API)
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

  // Session timer
  useEffect(() => {
    let interval: any = null;
    if (isWorkoutMode && !workoutFinished) {
      interval = setInterval(() => {
        setWorkoutElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setWorkoutElapsedTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isWorkoutMode, workoutFinished]);

  // Rest Timer countdown
  useEffect(() => {
    let interval: any = null;
    if (isRestTimerActive && restTimeLeft > 0) {
      interval = setInterval(() => {
        setRestTimeLeft(prev => {
          if (prev <= 1) {
            setIsRestTimerActive(false);
            playBeep();
            setTimeout(playBeep, 200);
            setTimeout(playBeep, 400);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRestTimerActive, restTimeLeft]);

  const fetchHistoryForExercise = async (name: string) => {
    if (workoutHistoryMap[name]) return workoutHistoryMap[name];
    try {
      const history = await apiService.fetchFitnessHistory(name);
      setWorkoutHistoryMap(prev => ({ ...prev, [name]: history }));
      return history;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const calculate1RM = (weight: number, reps: number) => {
    if (reps <= 1) return weight;
    return weight * (1 + reps / 30.0);
  };

  const handleAddExerciseToWorkout = async (name: string) => {
    if (!name) return;
    
    // Check if already added
    if (activeExercises.some(e => e.name === name)) {
      toast.error('Exercise already added to session!');
      return;
    }

    try {
      const history = await fetchHistoryForExercise(name);
      let defaultSets = [{ weight: '', reps: '', completed: false }];
      
      if (history && history.length > 0) {
        // Sort history by date descending
        const sortedHistory = [...history].sort((a, b) => b.workout_date.localeCompare(a.workout_date));
        const latest = sortedHistory[0];
        if (latest && latest.raw_logs) {
          const parts = latest.raw_logs.split(',');
          defaultSets = parts.map((part: string) => {
            const sub = part.split('x');
            return {
              weight: sub[0] || '',
              reps: sub[1] || '',
              completed: false
            };
          });
        }
      }
      
      const newExercise = {
        name,
        sets: defaultSets
      };
      
      setActiveExercises(prev => [...prev, newExercise]);
      setCurrentExerciseIdx(activeExercises.length);
      setSelectedWorkoutExercise('');
      setIsWorkoutDropdownOpen(false);
      toast.success(`Added ${name}`);
    } catch (e) {
      toast.error('Failed to add exercise.');
    }
  };

  const handleCreateCustomExercise = () => {
    const name = searchWorkoutExerciseQuery.trim();
    if (!name) return;
    handleAddExerciseToWorkout(name);
    setSearchWorkoutExerciseQuery('');
  };

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
      const isCompleted = !copy[exerciseIdx].sets[setIdx].completed;
      copy[exerciseIdx].sets[setIdx].completed = isCompleted;
      
      if (isCompleted) {
        setRestTimeLeft(configuredRestTime);
        setIsRestTimerActive(true);
        toast.info('Rest timer started!');
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

  const handleRemoveExercise = (exerciseIdx: number) => {
    setActiveExercises(prev => prev.filter((_, idx) => idx !== exerciseIdx));
    if (currentExerciseIdx >= activeExercises.length - 1 && currentExerciseIdx > 0) {
      setCurrentExerciseIdx(prev => prev - 1);
    }
  };

  const handleFinishWorkout = async () => {
    const completedWorkouts: any[] = [];
    
    activeExercises.forEach(ex => {
      const completedSets = ex.sets.filter((s: any) => s.completed && s.weight !== '' && s.reps !== '');
      if (completedSets.length > 0) {
        completedWorkouts.push({
          name: ex.name,
          sets: completedSets
        });
      }
    });

    if (completedWorkouts.length === 0) {
      toast.error('Log at least one completed set to finish your workout!');
      return;
    }

    setIsSubmittingWorkout(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      let totalVolumeLbs = 0;
      
      for (const item of completedWorkouts) {
        const rawLogs = item.sets.map((s: any) => `${s.weight}x${s.reps}`).join(',');
        
        let volumeKg = 0;
        let max1rmKg = 0;
        
        item.sets.forEach((s: any) => {
          const w = parseFloat(s.weight) || 0;
          const r = parseInt(s.reps) || 0;
          volumeKg += w * r;
          const oneRM = calculate1RM(w, r);
          if (oneRM > max1rmKg) max1rmKg = oneRM;
        });

        const totalVolLbs = Math.round(volumeKg * 2.20462 * 100) / 100;
        const oneRMKg = Math.round(max1rmKg * 100) / 100;
        const oneRMLbs = Math.round(max1rmKg * 2.20462 * 100) / 100;
        
        totalVolumeLbs += totalVolLbs;

        await apiService.createFitnessLog({
          exercise_name: item.name,
          workout_date: todayStr,
          raw_logs: rawLogs,
          one_rep_max_kg: oneRMKg,
          one_rep_max_lbs: oneRMLbs,
          total_volume_lbs: totalVolLbs
        });
      }

      setFinishedSummary({
        duration: formatTime(workoutElapsedTime),
        exercisesCount: completedWorkouts.length,
        volume: Math.round(totalVolumeLbs)
      });
      setWorkoutFinished(true);
      
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
      
      const exercises = await apiService.fetchFitnessExercises();
      setFitnessExercises(exercises);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to save workout.');
    } finally {
      setIsSubmittingWorkout(false);
    }
  };

  const handleCloseSummary = () => {
    setIsWorkoutMode(false);
    setWorkoutFinished(false);
    setFinishedSummary(null);
    setActiveExercises([]);
    setWorkoutElapsedTime(0);
  };

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

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Set default custom dates based on loaded history boundaries
  useEffect(() => {
    if (fitnessHistory.length > 0) {
      const dates = fitnessHistory.map(h => h.workout_date).sort();
      setCustomStartDate(dates[0]);
      setCustomEndDate(dates[dates.length - 1]);
    }
  }, [fitnessHistory]);

  // Fetch all exercises performed on the selected date
  useEffect(() => {
    if (!selectedPoint) {
      setSelectedDayWorkouts([]);
      return;
    }

    const loadDayWorkouts = async () => {
      setSelectedDayLoading(true);
      try {
        const workouts = await apiService.fetchFitnessDay(selectedPoint.date);
        setSelectedDayWorkouts(workouts);
      } catch (err) {
        console.error('Failed to load day workouts:', err);
      } finally {
        setSelectedDayLoading(false);
      }
    };

    loadDayWorkouts();
  }, [selectedPoint]);

  // Initial load
  useEffect(() => {
    loadFitnessExercises();
  }, []);

  // Handle click outside to close fitness dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExerciseDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadFitnessExercises = async () => {
    try {
      const exercises = await apiService.fetchFitnessExercises();
      setFitnessExercises(exercises);
      
      // Preload body weight history for multiplier calculation
      try {
        const bwData = await apiService.fetchFitnessHistory('Body Weight');
        if (Array.isArray(bwData)) {
          setBodyWeightHistory(bwData);
        }
      } catch (err) {
        console.error('Error preloading body weight history:', err);
      }

      if (exercises && exercises.length > 0) {
        // Default to a common exercise if present, else first
        const defaultExercise = exercises.find((ex: string) => 
          ex.toLowerCase().includes('bench press') || ex.toLowerCase().includes('squat')
        ) || exercises[0];
        
        setSelectedFitnessExercise(defaultExercise);
        loadFitnessHistory(defaultExercise);
      }
    } catch (e) {
      console.error('Error loading fitness exercises:', e);
    }
  };

  const loadFitnessHistory = async (exerciseName: string) => {
    setFitnessLoading(true);
    setFitnessError('');
    try {
      const history = await apiService.fetchFitnessHistory(exerciseName);
      if (Array.isArray(history)) {
        setFitnessHistory(history);
      } else {
        setFitnessHistory([]);
        setFitnessError('Received invalid data format from server.');
      }
    } catch (e: any) {
      console.error('Error loading fitness history:', e);
      setFitnessError(e.message || 'Failed to load fitness history');
      setFitnessHistory([]);
    } finally {
      setFitnessLoading(false);
    }
  };

  // Group and filter exercises by category
  const categorizedExercises = useMemo(() => {
    const query = searchExerciseQuery.toLowerCase().trim();
    
    // Categorize
    const bodyStats = fitnessExercises.filter(ex => ex === 'Body Weight');
    const weightExercises = fitnessExercises.filter(ex => ex !== 'Body Weight');
    
    // Filter
    const filteredBodyStats = bodyStats.filter(ex => ex.toLowerCase().includes(query));
    const filteredWeightExercises = weightExercises.filter(ex => ex.toLowerCase().includes(query));
    
    return {
      bodyStats: filteredBodyStats,
      weight: filteredWeightExercises
    };
  }, [fitnessExercises, searchExerciseQuery]);

  const handleExerciseChange = (exercise: string) => {
    setSelectedFitnessExercise(exercise);
    setSelectedPoint(null);
    setIsExerciseDropdownOpen(false);
    setSearchExerciseQuery('');
    setFitnessError('');
    loadFitnessHistory(exercise);
  };

  // Interpolator to get body weight in Lbs for a given date using linear interpolation
  const getInterpolatedBodyWeightLbs = useCallback((targetDateStr: string) => {
    if (!bodyWeightHistory || bodyWeightHistory.length === 0) return null;
    
    // Sort body weight history chronologically
    const sortedBw = [...bodyWeightHistory]
      .sort((a, b) => new Date(a.workout_date).getTime() - new Date(b.workout_date).getTime());
      
    const targetTime = new Date(targetDateStr + 'T00:00:00').getTime();
    
    // Boundary check 1: Target is before or at the first weigh-in
    const firstTime = new Date(sortedBw[0].workout_date + 'T00:00:00').getTime();
    if (targetTime <= firstTime) {
      return sortedBw[0].one_rep_max_lbs;
    }
    
    // Boundary check 2: Target is after or at the last weigh-in
    const lastTime = new Date(sortedBw[sortedBw.length - 1].workout_date + 'T00:00:00').getTime();
    if (targetTime >= lastTime) {
      return sortedBw[sortedBw.length - 1].one_rep_max_lbs;
    }
    
    // Linear interpolation
    for (let i = 0; i < sortedBw.length - 1; i++) {
      const timeA = new Date(sortedBw[i].workout_date + 'T00:00:00').getTime();
      const timeB = new Date(sortedBw[i+1].workout_date + 'T00:00:00').getTime();
      
      if (targetTime >= timeA && targetTime <= timeB) {
        const weightA = sortedBw[i].one_rep_max_lbs;
        const weightB = sortedBw[i+1].one_rep_max_lbs;
        
        // Linear interpolation formula
        const fraction = (targetTime - timeA) / (timeB - timeA);
        return weightA + fraction * (weightB - weightA);
      }
    }
    
    return sortedBw[0].one_rep_max_lbs;
  }, [bodyWeightHistory]);

  // SVG Chart Computations
  const allChartData = useMemo(() => {
    return [...fitnessHistory]
      .sort((a, b) => new Date(a.workout_date).getTime() - new Date(b.workout_date).getTime())
      .map(item => {
        let rawVal = 0;
        if (selectedFitnessExercise === 'Body Weight') {
          rawVal = item.one_rep_max_lbs;
        } else if (selectedFitnessMetric === '1rem') {
          rawVal = item.one_rep_max_lbs;
        } else if (selectedFitnessMetric === 'multiplier') {
          // Estimate body weight on this day using linear interpolation
          const bodyWeightLbs = getInterpolatedBodyWeightLbs(item.workout_date);
          rawVal = bodyWeightLbs && bodyWeightLbs > 0 ? (item.one_rep_max_lbs / bodyWeightLbs) : 0;
        } else {
          rawVal = item.total_volume_lbs;
        }
        
        // Convert to kg if weightUnit is 'kg', but NOT for multiplier (multiplier is unitless)
        const convertedVal = (selectedFitnessMetric === 'multiplier' && selectedFitnessExercise !== 'Body Weight') 
          ? rawVal 
          : (weightUnit === 'kg' ? rawVal / 2.20462 : rawVal);

        return {
          date: item.workout_date,
          value: convertedVal,
          one_rep_max_lbs: item.one_rep_max_lbs,
          raw_logs: item.raw_logs
        };
      })
      .filter(item => item.value !== undefined && item.value !== null);
  }, [fitnessHistory, selectedFitnessExercise, selectedFitnessMetric, weightUnit, getInterpolatedBodyWeightLbs]);

  const chartData = useMemo(() => {
    if (allChartData.length === 0) return [];
    
    let filtered = allChartData;
    
    if (timePeriod === 'custom') {
      const start = customStartDate ? new Date(customStartDate + 'T00:00:00') : null;
      const end = customEndDate ? new Date(customEndDate + 'T00:00:00') : null;
      filtered = allChartData.filter(item => {
        const d = new Date(item.date + 'T00:00:00');
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    } else if (timePeriod !== 'All') {
      const sorted = allChartData;
      const latestDate = new Date(sorted[sorted.length - 1].date + 'T00:00:00');
      
      let lookbackDays = 30;
      if (timePeriod === '3M') lookbackDays = 90;
      else if (timePeriod === '6M') lookbackDays = 180;
      else if (timePeriod === '1Y') lookbackDays = 365;
      
      const cutoffDate = new Date(latestDate.getTime());
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      
      filtered = sorted.filter(item => new Date(item.date + 'T00:00:00') >= cutoffDate);
    }
    return filtered;
  }, [allChartData, timePeriod, customStartDate, customEndDate]);

  // Compute separate smoothed data for the trend line representation, leaving the raw dots unchanged
  const trendData = useMemo(() => {
    if (chartData.length === 0) return [];

    let windowSize = 1;
    if (timePeriod === '3M') windowSize = 3;
    else if (timePeriod === '6M' || timePeriod === '1Y' || timePeriod === 'All') windowSize = 5;

    if (windowSize <= 1 || chartData.length < windowSize) {
      return chartData;
    }

    const half = Math.floor(windowSize / 2);
    return chartData.map((item, idx) => {
      let sum = 0;
      let count = 0;
      for (let w = -half; w <= half; w++) {
        const targetIdx = idx + w;
        if (targetIdx >= 0 && targetIdx < chartData.length) {
          sum += chartData[targetIdx].value;
          count++;
        }
      }
      return {
        ...item,
        value: sum / count // smoothed trend value
      };
    });
  }, [chartData, timePeriod]);

  const padding = { top: 45, right: 30, bottom: 45, left: 65 };
  
  let getX = (t: number) => 0;
  let getY = (v: number) => 0;
  let yTicks: number[] = [];
  let xTicks: any[] = [];
  let pathD = '';
  let areaD = '';

  if (chartData.length > 0) {
    const timestamps = chartData.map(d => new Date(d.date).getTime());
    const minX = Math.min(...timestamps);
    const maxX = Math.max(...timestamps);
    
    if (maxX > minX) {
      getX = (t) => padding.left + ((t - minX) / (maxX - minX)) * (800 - padding.left - padding.right);
    } else {
      getX = (t) => (800 - padding.left - padding.right) / 2 + padding.left;
    }

    const values = chartData.map(d => d.value);
    const minYVal = Math.min(...values);
    const maxYVal = Math.max(...values);
    const yBuffer = (maxYVal - minYVal) * 0.15 || 10;
    const minY = Math.max(0, minYVal - yBuffer);
    const maxY = maxYVal + yBuffer;

    if (maxY > minY) {
      getY = (v) => 400 - padding.bottom - ((v - minY) / (maxY - minY)) * (400 - padding.top - padding.bottom);
    } else {
      getY = (v) => (400 - padding.top - padding.bottom) / 2 + padding.top;
    }

    // Y ticks
    const yTicksCount = 5;
    yTicks = Array.from({ length: yTicksCount }, (_, i) => {
      return minY + (i * (maxY - minY)) / (yTicksCount - 1);
    });

    // X ticks (evenly spaced chronological date points)
    if (chartData.length === 1) {
      xTicks = [chartData[0]];
    } else if (chartData.length > 1) {
      const xTicksCount = Math.min(chartData.length, 5);
      xTicks = Array.from({ length: xTicksCount }, (_, i) => {
        const idx = Math.round((i * (chartData.length - 1)) / (xTicksCount - 1));
        return chartData[idx];
      }).filter(Boolean)
        .filter((item, index, self) => self.findIndex(t => t && item && t.date === item.date) === index); // deduplicate
    } else {
      xTicks = [];
    }

    // Path strings (conditional smoothing: straight lines for short timeframes/few points, Bezier curve for longer)
    // We map path coordinates from trendData (smoothed), while circles represent chartData (raw)
    if (chartData.length > 1) {
      const points = trendData.map(d => ({
        x: getX(new Date(d.date).getTime()),
        y: getY(d.value),
      }));

      // Determine smoothing (straight lines for 1M/3M or if points count < 8, smooth curve otherwise)
      const useSmoothing = timePeriod !== '1M' && timePeriod !== '3M' && chartData.length >= 8;

      if (useSmoothing) {
        pathD = getBezierPath(points, 0.16);
      } else {
        const pathPoints = points.map(p => `${p.x},${p.y}`);
        pathD = `M ${pathPoints.join(' L ')}`;
      }
      
      areaD = `${pathD} L ${points[points.length - 1].x},${400 - padding.bottom} L ${points[0].x},${400 - padding.bottom} Z`;
    }
  }

  const formatShortDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        return `${months[m]} ${d}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const formatFullDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString(undefined, { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (e) {
      return dateStr;
    }
  };

  const handlePointHover = (dataPoint: any, cx: number, cy: number) => {
    setHoveredDataPoint(dataPoint);
    setHoveredPointCoords({ x: cx, y: cy });
  };

  const handlePointLeave = () => {
    setHoveredDataPoint(null);
  };

  if (isWorkoutMode) {
    if (workoutFinished) {
      return (
        <div className="container mx-auto px-4 py-8 max-w-md text-center space-y-6 animate-fade-in">
          <div className="border border-border/80 rounded-2xl bg-card/30 p-8 shadow-xl space-y-6 backdrop-blur-md">
            <div className="inline-flex p-4 bg-emerald-500/10 text-emerald-500 rounded-full animate-pulse">
              <Award size={48} className="animate-bounce text-emerald-500" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Workout Complete!</h2>
              <p className="text-muted-foreground text-sm">Amazing job! Your workout has been saved to AWS DynamoDB.</p>
            </div>

            <div className="grid grid-cols-3 gap-3 py-4 border-y border-border/60">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground block font-medium">Duration</span>
                <span className="text-base font-bold text-foreground">{finishedSummary?.duration || '00:00'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground block font-medium">Exercises</span>
                <span className="text-base font-bold text-foreground">{finishedSummary?.exercisesCount || 0}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground block font-medium">Vol (lbs)</span>
                <span className="text-base font-bold text-foreground">{finishedSummary?.volume || 0}</span>
              </div>
            </div>

            <button
              onClick={handleCloseSummary}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      );
    }

    const currentExercise = activeExercises[currentExerciseIdx];
    const exerciseHistory = currentExercise ? (workoutHistoryMap[currentExercise.name] || []) : [];
    const sortedHistory = [...exerciseHistory].sort((a, b) => b.workout_date.localeCompare(a.workout_date));
    const latestWorkout = sortedHistory[0];
    const previousSets = latestWorkout ? latestWorkout.raw_logs.split(',') : [];

    const filteredExercises = fitnessExercises.filter(ex => 
      ex.toLowerCase().includes(searchWorkoutExerciseQuery.toLowerCase())
    );

    return (
      <div className="container mx-auto px-4 py-4 max-w-xl space-y-4 animate-fade-in pb-24">
        {/* Workout Mode Header */}
        <div className="border border-border/80 rounded-2xl bg-card/30 p-4 flex items-center justify-between shadow-sm backdrop-blur-md">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
              <Flame size={14} className="animate-pulse" /> Workout in Progress
            </h2>
            <div className="text-2xl font-black tabular-nums tracking-tight">
              {formatTime(workoutElapsedTime)}
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel your workout? All unsaved logs will be lost.')) {
                  setIsWorkoutMode(false);
                  setActiveExercises([]);
                }
              }}
              className="px-3 py-1.5 border border-border/80 text-xs font-semibold rounded-xl bg-background hover:bg-muted/40 transition-all cursor-pointer h-9"
            >
              Cancel
            </button>
            <button
              onClick={handleFinishWorkout}
              disabled={isSubmittingWorkout}
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer h-9 flex items-center gap-1.5 shadow-sm"
            >
              {isSubmittingWorkout ? 'Saving...' : 'Finish'}
            </button>
          </div>
        </div>

        {/* Rest Timer Panel */}
        {restTimeLeft > 0 && (
          <div className="border border-emerald-500/20 rounded-2xl bg-emerald-500/10 p-4 flex items-center justify-between shadow-sm animate-pulse">
            <div className="flex items-center gap-2.5">
              <Clock className="text-emerald-500 animate-spin" size={18} />
              <div className="space-y-0.5">
                <span className="text-xs text-emerald-500/80 block font-bold uppercase tracking-wider">Rest Time Remaining</span>
                <span className="text-xl font-black text-emerald-500 tabular-nums">{restTimeLeft}s</span>
              </div>
            </div>
            
            <div className="flex gap-1.5">
              <button 
                onClick={() => setRestTimeLeft(prev => prev + 10)}
                className="px-2.5 py-1.5 bg-background border rounded-lg text-xs font-bold hover:bg-muted/40 transition-colors"
              >
                +10s
              </button>
              <button 
                onClick={() => { setRestTimeLeft(0); setIsRestTimerActive(false); }}
                className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Exercises in Session Tab Bar */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Exercises in Session</label>
          <div className="flex flex-wrap gap-1.5">
            {activeExercises.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentExerciseIdx(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                  idx === currentExerciseIdx
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                    : 'bg-background hover:bg-muted/40 border-border/80'
                }`}
              >
                <span>{ex.name}</span>
                <X 
                  size={12} 
                  className="opacity-40 hover:opacity-100 hover:text-rose-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveExercise(idx);
                  }}
                />
              </button>
            ))}

            {/* Add Exercise Inline Selector */}
            <div className="relative">
              <button
                onClick={() => setIsWorkoutDropdownOpen(!isWorkoutDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-rose-500/40 text-rose-500 hover:bg-rose-500/5 text-xs font-bold cursor-pointer transition-all"
              >
                <Plus size={12} /> Add Exercise
              </button>

              {isWorkoutDropdownOpen && (
                <div className="absolute right-0 sm:left-0 mt-1.5 w-64 border rounded-xl bg-popover text-popover-foreground shadow-lg z-50 animate-slide-up max-h-80 flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 border-b px-3 py-2 bg-muted/20">
                    <Search size={12} className="opacity-40" />
                    <input 
                      type="text" 
                      placeholder="Search exercises..." 
                      value={searchWorkoutExerciseQuery}
                      onChange={(e) => setSearchWorkoutExerciseQuery(e.target.value)}
                      className="w-full bg-transparent border-0 outline-none text-xs p-0 focus:ring-0"
                    />
                  </div>
                  
                  <div className="overflow-y-auto max-h-56 divide-y">
                    {filteredExercises.length > 0 ? (
                      filteredExercises.map((ex, index) => (
                        <button
                          key={index}
                          type="button"
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 transition-colors block font-medium truncate"
                          onClick={() => handleAddExerciseToWorkout(ex)}
                        >
                          {ex}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1.5">No exercise found</p>
                        <button
                          onClick={handleCreateCustomExercise}
                          className="px-2.5 py-1 bg-rose-500 text-white rounded-md text-[10px] font-bold hover:bg-rose-600 transition-colors"
                        >
                          Create "{searchWorkoutExerciseQuery}"
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Exercise Detail Card */}
        {currentExercise ? (
          <div className="border border-border/80 rounded-2xl bg-card/30 p-4 shadow-sm backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="font-bold text-base tracking-tight">{currentExercise.name}</h3>
              
              {/* Rest Time Configurator */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                <Clock size={12} />
                <span>Rest:</span>
                <select
                  value={configuredRestTime}
                  onChange={(e) => setConfiguredRestTime(Number(e.target.value))}
                  className="bg-background border rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
                >
                  <option value={30}>30s</option>
                  <option value={45}>45s</option>
                  <option value={60}>60s</option>
                  <option value={90}>90s</option>
                  <option value={120}>120s</option>
                  <option value={180}>180s</option>
                </select>
              </div>
            </div>

            {/* Sets Logging Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2 pl-1">Set</th>
                    <th className="py-2">Previous</th>
                    <th className="py-2 text-center">Weight (kg)</th>
                    <th className="py-2 text-center">Reps</th>
                    <th className="py-2 pr-1 text-center">Done</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {currentExercise.sets.map((set: any, idx: number) => {
                    const prevSet = previousSets[idx];
                    const prevFormatted = prevSet ? prevSet.replace('x', ' kg × ') : '—';
                    
                    return (
                      <tr 
                        key={idx} 
                        className={`transition-colors ${set.completed ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : ''}`}
                      >
                        <td className="py-2 pl-1 font-bold">{idx + 1}</td>
                        <td className="py-2 text-muted-foreground font-medium">{prevFormatted}</td>
                        <td className="py-2 text-center">
                          <input
                            type="number"
                            step="any"
                            placeholder="0"
                            value={set.weight}
                            onChange={(e) => handleUpdateSet(currentExerciseIdx, idx, 'weight', e.target.value)}
                            className="w-16 px-1.5 py-1 border rounded bg-background text-center text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500"
                          />
                        </td>
                        <td className="py-2 text-center">
                          <input
                            type="number"
                            placeholder="0"
                            value={set.reps}
                            onChange={(e) => handleUpdateSet(currentExerciseIdx, idx, 'reps', e.target.value)}
                            className="w-14 px-1.5 py-1 border rounded bg-background text-center text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500"
                          />
                        </td>
                        <td className="py-2 pr-1 text-center">
                          <button
                            onClick={() => handleToggleSetCompleted(currentExerciseIdx, idx)}
                            className={`inline-flex items-center justify-center p-1.5 rounded-lg border cursor-pointer transition-all ${
                              set.completed
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-border bg-background text-muted-foreground/30 hover:border-muted'
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

            {/* Set Management Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleAddSet(currentExerciseIdx)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-dashed rounded-xl bg-background hover:bg-muted/40 text-xs font-bold cursor-pointer transition-all"
              >
                <Plus size={14} /> Add Set
              </button>
              {currentExercise.sets.length > 1 && (
                <button
                  onClick={() => handleRemoveSet(currentExerciseIdx)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 border border-rose-500/20 rounded-xl hover:bg-rose-500/5 text-rose-500 text-xs font-bold cursor-pointer transition-all"
                >
                  <Trash2 size={14} /> Remove Set
                </button>
              )}
            </div>

            {/* Exercise History / Progression section */}
            {sortedHistory.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <History size={12} /> Past Performance History
                </h4>
                
                <div className="space-y-1.5 max-h-48 overflow-y-auto divide-y divide-border/20 pr-1">
                  {sortedHistory.slice(0, 5).map((h, i) => (
                    <div key={i} className="py-2 flex justify-between items-start text-[10px]">
                      <div className="space-y-0.5">
                        <span className="font-bold text-foreground block">{h.workout_date}</span>
                        <span className="text-muted-foreground block font-medium">Sets: {h.raw_logs.replace(/,/g, ', ')}</span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="text-foreground font-bold block">1RM: {h.one_rep_max_kg} kg</span>
                        <span className="text-muted-foreground block font-medium">Vol: {h.total_volume_lbs} lbs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border border-border/80 border-dashed rounded-2xl p-12 text-center bg-card/10 space-y-4">
            <div className="inline-flex p-3 bg-rose-500/10 text-rose-500 rounded-full">
              <Dumbbell size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base">No exercises in session</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">Click "Add Exercise" above to select and load the sets for your workout.</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-4 animate-fade-in">
      {/* Compact Controls Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 border border-border/80 rounded-xl bg-card/30 p-2.5">
        {/* Searchable Exercise Dropdown Selector */}
        <div className="w-full sm:w-56 relative" ref={dropdownRef}>
          <button 
            className="w-full flex items-center justify-between border rounded-lg bg-background hover:bg-muted/40 transition-colors px-3 py-1.5 text-xs select-none cursor-pointer h-8" 
            onClick={() => setIsExerciseDropdownOpen(!isExerciseDropdownOpen)}
            type="button"
          >
            <span className="flex items-center gap-1.5 truncate font-medium">
              <Search size={12} className="opacity-40" />
              {selectedFitnessExercise || (fitnessExercises.length === 0 ? 'Loading options...' : 'Select option...')}
            </span>
            <ChevronRight size={14} className={`opacity-60 transform transition-transform duration-200 ${isExerciseDropdownOpen ? 'rotate-90' : ''}`} />
          </button>

          {isExerciseDropdownOpen && (
            <div className="absolute left-0 right-0 mt-1.5 border rounded-lg bg-popover text-popover-foreground shadow-lg z-50 animate-slide-up max-h-80 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 border-b px-3 py-2 bg-muted/20">
                <Search size={12} className="opacity-40" />
                <input 
                  type="text" 
                  placeholder="Search options..." 
                  value={searchExerciseQuery}
                  onChange={(e) => setSearchExerciseQuery(e.target.value)}
                  className="w-full bg-transparent border-0 outline-none text-xs p-0 focus:ring-0"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto max-h-64 divide-y">
                {categorizedExercises.bodyStats.length === 0 && categorizedExercises.weight.length === 0 ? (
                  <div className="px-3 py-3 text-center text-xs opacity-50">No exercises found</div>
                ) : (
                  <>
                    {/* Body Stats Group */}
                    {categorizedExercises.bodyStats.length > 0 && (
                      <div className="flex flex-col">
                        <div className="px-3 py-1.5 bg-muted/50 text-[10px] font-bold text-muted-foreground tracking-wider uppercase border-b border-t first:border-t-0">
                          Body Stats
                        </div>
                        {categorizedExercises.bodyStats.map(ex => (
                          <button 
                            key={ex}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer hover:bg-muted/50 ${selectedFitnessExercise === ex ? 'bg-primary/5 font-semibold text-primary' : ''}`}
                            onClick={() => handleExerciseChange(ex)}
                            type="button"
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Weight Group */}
                    {categorizedExercises.weight.length > 0 && (
                      <div className="flex flex-col">
                        <div className="px-3 py-1.5 bg-muted/50 text-[10px] font-bold text-muted-foreground tracking-wider uppercase border-b border-t first:border-t-0">
                          Weight
                        </div>
                        {categorizedExercises.weight.map(ex => (
                          <button 
                            key={ex}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer hover:bg-muted/50 ${selectedFitnessExercise === ex ? 'bg-primary/5 font-semibold text-primary' : ''}`}
                            onClick={() => handleExerciseChange(ex)}
                            type="button"
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Metric Toggle Buttons */}
        {selectedFitnessExercise !== 'Body Weight' && (
          <div className="inline-flex border rounded-lg bg-background p-0.5 gap-0.5 h-8">
            <button 
              className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${selectedFitnessMetric === '1rem' ? 'bg-primary text-primary-foreground shadow-sm' : 'opacity-65 hover:opacity-100'}`}
              onClick={() => setSelectedFitnessMetric('1rem')}
              type="button"
            >
              1RM
            </button>
            <button 
              className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${selectedFitnessMetric === 'volume' ? 'bg-primary text-primary-foreground shadow-sm' : 'opacity-65 hover:opacity-100'}`}
              onClick={() => setSelectedFitnessMetric('volume')}
              type="button"
            >
              Volume
            </button>
            <button 
              className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${selectedFitnessMetric === 'multiplier' ? 'bg-primary text-primary-foreground shadow-sm' : 'opacity-65 hover:opacity-100'}`}
              onClick={() => setSelectedFitnessMetric('multiplier')}
              type="button"
            >
              BW Mult
            </button>
          </div>
        )}

        {/* Unit Selector */}
        <div className="inline-flex border rounded-lg bg-background p-0.5 gap-0.5 h-8">
          <button 
            className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${weightUnit === 'lbs' ? 'bg-primary text-primary-foreground shadow-sm' : 'opacity-65 hover:opacity-100'}`}
            onClick={() => setWeightUnit('lbs')}
            type="button"
          >
            Lbs
          </button>
          <button 
            className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${weightUnit === 'kg' ? 'bg-primary text-primary-foreground shadow-sm' : 'opacity-65 hover:opacity-100'}`}
            onClick={() => setWeightUnit('kg')}
            type="button"
          >
            Kg
          </button>
        </div>

        {/* Time Period Selector */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[240px]">
          <div className="inline-flex border rounded-lg bg-background p-0.5 gap-0.5 h-8">
            {(['1M', '3M', '6M', '1Y', 'All', 'custom'] as const).map((period) => (
              <button
                key={period}
                className={`rounded px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                  timePeriod === period ? 'bg-primary text-primary-foreground shadow-sm' : 'opacity-65 hover:opacity-100'
                }`}
                onClick={() => setTimePeriod(period)}
                type="button"
              >
                {period === 'custom' ? 'Custom' : period}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {timePeriod === 'custom' && (
            <div className="flex items-center gap-1 animate-fade-in">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="border border-border/80 rounded-lg bg-card/60 text-foreground text-[10px] px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary h-[26px] cursor-pointer"
                aria-label="Start Date"
              />
              <span className="text-[10px] opacity-50 font-medium">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="border border-border/80 rounded-lg bg-card/60 text-foreground text-[10px] px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary h-[26px] cursor-pointer"
                aria-label="End Date"
              />
            </div>
          )}
        </div>
        
        {/* Start Workout Button */}
        <button
          onClick={() => {
            setIsWorkoutMode(true);
            setActiveExercises([]);
            setCurrentExerciseIdx(0);
            setWorkoutElapsedTime(0);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer h-8 transition-colors sm:ml-auto"
          type="button"
        >
          <Dumbbell size={12} /> Start Workout
        </button>
      </div>

      {/* Visualizer Chart */}
      <div className="border rounded-2xl bg-card text-card-foreground shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight">{selectedFitnessExercise || 'Exercise'} Progress</h3>
            <p className="text-sm opacity-60">
              {selectedFitnessExercise === 'Body Weight'
                ? `Chronological tracking of Body Weight (${weightUnit})`
                : selectedFitnessMetric === 'multiplier'
                  ? `Chronological tracking of Bodyweight Multiplier (1RM / Body Weight)`
                  : `Chronological tracking of ${selectedFitnessMetric === '1rem' ? 'Estimated 1-Rep Max' : 'Total Volume'} (${weightUnit})`
              }
            </p>
          </div>
          {chartData.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold px-2.5 py-1 rounded-full self-start sm:self-center">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Active Lift logs</span>
            </div>
          )}
        </div>
        
        {fitnessLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[340px] space-y-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm opacity-60 font-medium">Fetching history from AWS...</p>
          </div>
        ) : fitnessError ? (
          <div className="flex flex-col items-center justify-center min-h-[340px] text-center border-2 border-dashed border-destructive/30 rounded-xl p-8 bg-destructive/5">
            <Info className="w-10 h-10 text-destructive mb-2 opacity-80" />
            <h3 className="font-semibold text-lg text-destructive">Not Completed</h3>
            <p className="text-sm opacity-60 max-w-sm">{fitnessError}</p>
          </div>
        ) : chartData.length > 0 ? (
          <div className="relative w-full overflow-visible" style={{ minHeight: '340px' }}>
            <svg 
              viewBox="0 0 800 400" 
              className="w-full h-full select-none"
              style={{ maxHeight: '400px' }}
            >
              <defs>
                <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.00" />
                </linearGradient>
                <linearGradient id="chartLineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.4" />
                </linearGradient>
              </defs>
              
              {/* Horizontal Grid lines */}
              {yTicks.map((tickVal, index) => {
                const y = getY(tickVal);
                return (
                  <g key={index}>
                    <line 
                      x1={padding.left} 
                      y1={y} 
                      x2={800 - padding.right} 
                      y2={y} 
                      className="stroke-border/40"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text 
                      x={padding.left - 12} 
                      y={y + 4} 
                      className="fill-muted-foreground text-xs font-mono"
                      textAnchor="end"
                    >
                      {selectedFitnessExercise !== 'Body Weight' && selectedFitnessMetric === 'multiplier'
                        ? tickVal.toFixed(2) + 'x'
                        : Math.round(tickVal)
                      }
                    </text>
                  </g>
                );
              })}
              
              {/* Vertical Grid lines */}
              {xTicks.map((tickPoint, index) => {
                const t = new Date(tickPoint.date).getTime();
                const x = getX(t);
                return (
                  <g key={index}>
                    <line 
                      x1={x} 
                      y1={padding.top} 
                      x2={x} 
                      y2={400 - padding.bottom} 
                      className="stroke-border/30"
                      strokeWidth="1"
                    />
                    <text 
                      x={x} 
                      y={400 - padding.bottom + 20} 
                      className="fill-muted-foreground text-xs font-mono"
                      textAnchor="middle"
                    >
                      {formatShortDate(tickPoint.date)}
                    </text>
                  </g>
                );
              })}
              
              {/* Axis Borders */}
              <line 
                x1={padding.left} 
                y1={padding.top} 
                x2={padding.left} 
                y2={400 - padding.bottom} 
                className="stroke-border"
                strokeWidth="1.5"
              />
              <line 
                x1={padding.left} 
                y1={400 - padding.bottom} 
                x2={800 - padding.right} 
                y2={400 - padding.bottom} 
                className="stroke-border"
                strokeWidth="1.5"
              />
              
              {/* Line/Area plots */}
              {chartData.length > 1 ? (
                <>
                  <path d={areaD} fill="url(#chartAreaGradient)" />
                  <path d={pathD} stroke="url(#chartLineGradient)" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </>
              ) : null}
              
              {/* Data points (small light gray dot until hovered/selected, turning white) */}
              {chartData.map((d, index) => {
                const t = new Date(d.date).getTime();
                const cx = getX(t);
                const cy = getY(d.value);
                
                const isHovered = hoveredDataPoint && hoveredDataPoint.date === d.date;
                const isSelected = selectedPoint && selectedPoint.date === d.date;
                
                return (
                  <g key={index}>
                    {/* Selection outer halo */}
                    {isSelected && (
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={8} 
                        className="fill-primary/10 stroke-primary/40 animate-pulse"
                        strokeWidth="1.5"
                      />
                    )}
                    {/* Hover outer halo */}
                    {isHovered && !isSelected && (
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={7} 
                        className="fill-primary/5 stroke-primary/20"
                        strokeWidth="1"
                      />
                    )}
                    {/* Core Point (light grey default, white on hover/select) */}
                    <circle 
                      cx={cx} 
                      cy={cy} 
                      r={isSelected ? 4.5 : isHovered ? 4 : 2.5} 
                      className={`transition-all duration-150 cursor-pointer ${
                        isSelected 
                          ? 'fill-foreground stroke-background' 
                          : isHovered 
                          ? 'fill-foreground stroke-background' 
                          : 'fill-muted-foreground/50'
                      }`}
                      strokeWidth={isSelected || isHovered ? 2 : 0}
                    />
                    {/* Invisible Larger Interactive Hover Target */}
                    <circle 
                      cx={cx} 
                      cy={cy} 
                      r={16} 
                      className="fill-transparent stroke-transparent cursor-pointer"
                      onMouseEnter={() => handlePointHover(d, cx, cy)}
                      onMouseLeave={handlePointLeave}
                      onClick={() => setSelectedPoint(isSelected ? null : d)}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Tooltip component */}
            {hoveredDataPoint && (
              <div 
                className="absolute bg-popover text-popover-foreground border rounded-lg shadow-xl p-3 text-xs w-60 z-50 pointer-events-none transition-all duration-150 ease-out"
                style={{
                  left: `${(hoveredPointCoords.x / 800) * 100}%`,
                  top: `${(hoveredPointCoords.y / 400) * 100}%`,
                  transform: 'translate(-50%, -108%)',
                }}
              >
                <div className="font-semibold border-b pb-1 mb-1.5">{formatFullDate(hoveredDataPoint.date)}</div>
                {selectedFitnessMetric === 'multiplier' && selectedFitnessExercise !== 'Body Weight' ? (
                  <div className="space-y-1 mb-2 border-b pb-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="opacity-60">Est. 1-Rep Max:</span>
                      <span className="font-semibold">
                        {(weightUnit === 'kg' ? hoveredDataPoint.one_rep_max_lbs / 2.20462 : hoveredDataPoint.one_rep_max_lbs).toFixed(1)} {weightUnit}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="opacity-60">Est. Body Weight:</span>
                      <span className="font-semibold">
                        {(() => {
                          const bwLbs = getInterpolatedBodyWeightLbs(hoveredDataPoint.date);
                          if (!bwLbs) return 'N/A';
                          return (weightUnit === 'kg' ? bwLbs / 2.20462 : bwLbs).toFixed(1) + ' ' + weightUnit;
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold text-primary pt-0.5">
                      <span>BW Multiplier:</span>
                      <span>{hoveredDataPoint.value.toFixed(2)}x</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center mb-1.5 text-sm">
                    <span className="opacity-60">
                      {selectedFitnessExercise === 'Body Weight' ? 'Body Weight' : (selectedFitnessMetric === '1rem' ? 'Est. 1-Rep Max' : 'Total Volume')}:
                    </span>
                    <span className="font-bold text-primary">
                      {hoveredDataPoint.value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} {weightUnit}
                    </span>
                  </div>
                )}
                
                <div className="space-y-1">
                  <div className="opacity-55 font-semibold text-[10px] uppercase tracking-wider">
                    {selectedFitnessExercise === 'Body Weight' ? 'Body Weight:' : 'Sets (Weight × Reps):'}
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {selectedFitnessExercise === 'Body Weight' ? (
                      <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">
                        {hoveredDataPoint.value.toFixed(1)} {weightUnit}
                      </span>
                    ) : hoveredDataPoint.raw_logs && hoveredDataPoint.raw_logs.trim() !== "" ? (
                      hoveredDataPoint.raw_logs.split(',').map((setStr: string, sIdx: number) => {
                        const parts = setStr.split('x');
                        if (parts.length !== 2) return null;
                        const [weight, reps] = parts;
                        const rawWeightNum = parseFloat(weight);
                        if (isNaN(rawWeightNum)) return null;
                        const displayWeight = weightUnit === 'lbs' 
                          ? (rawWeightNum * 2.20462).toFixed(1) 
                          : rawWeightNum.toFixed(1);
                        return (
                          <span key={sIdx} className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">
                            {displayWeight} {weightUnit} × {reps}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[10px] opacity-50">No detailed sets.</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[340px] text-center border-2 border-dashed rounded-xl p-8 bg-muted/10">
            <BookOpen size={40} className="opacity-30 mb-2" />
            <h3 className="font-semibold text-lg">No data found</h3>
            <p className="text-sm opacity-60 max-w-sm">No workout records exist for this exercise yet. Try choosing another exercise.</p>
          </div>
        )}
      </div>

      {/* Selected Workout Detail Card */}
      {selectedPoint && (
        <div className="border rounded-2xl bg-card text-card-foreground shadow-sm p-6 space-y-5 animate-slide-up">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-lg font-bold tracking-tight">Workout Logs: {formatFullDate(selectedPoint.date)}</h3>
              <p className="text-xs opacity-50 font-mono mt-0.5">Showing all exercises recorded on this day</p>
            </div>
            <button
              onClick={() => setSelectedPoint(null)}
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer border rounded-md p-1.5 hover:bg-muted/40"
              aria-label="Close details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedDayLoading ? (
            <div className="text-center py-10 space-y-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs opacity-60 font-medium">Retrieving day's training logs...</p>
            </div>
          ) : selectedDayWorkouts.length > 0 ? (
            <div className="space-y-6">
              {selectedDayWorkouts.map((workout, index) => {
                const ename = workout.exercise_name;
                const rawLogs = workout.raw_logs;
                
                // Get converted metrics
                const onerm = weightUnit === 'kg' 
                  ? workout.one_rep_max_lbs / 2.20462 
                  : workout.one_rep_max_lbs;
                const vol = weightUnit === 'kg' 
                  ? workout.total_volume_lbs / 2.20462 
                  : workout.total_volume_lbs;
                  
                return (
                  <div key={index} className="p-4 rounded-xl border bg-card/60 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/20 pb-2">
                      <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
                        <Dumbbell className="w-4 h-4 opacity-75 text-primary" />
                        {ename}
                      </h4>
                      {ename !== 'Body Weight' ? (
                        <div className="flex items-center gap-4 text-[10px] uppercase font-bold opacity-60 font-mono">
                          <span>1RM: {onerm.toFixed(1)} {weightUnit}</span>
                          <span className="opacity-30">|</span>
                          <span>Vol: {vol.toLocaleString(undefined, { maximumFractionDigits: 1 })} {weightUnit}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 text-[10px] uppercase font-bold opacity-60 font-mono">
                          <span>Weight: {onerm.toFixed(1)} {weightUnit}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Sets for this exercise */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {ename === 'Body Weight' ? (
                        <div className="bg-background border rounded px-2.5 py-1 text-xs flex items-center gap-1.5 justify-between">
                          <span className="opacity-45 text-[10px] font-semibold">Log</span>
                          <span className="font-bold text-[11px]">{onerm.toFixed(1)} {weightUnit}</span>
                        </div>
                      ) : rawLogs && rawLogs.trim() !== "" ? (
                        rawLogs.split(',').map((setStr: string, sIdx: number) => {
                          const parts = setStr.split('x');
                          if (parts.length !== 2) return null;
                          const [weight, reps] = parts;
                          const rawWeightNum = parseFloat(weight);
                          if (isNaN(rawWeightNum)) return null;
                          const displayWeight = weightUnit === 'lbs' 
                            ? (rawWeightNum * 2.20462).toFixed(1) 
                            : rawWeightNum.toFixed(1);
                          return (
                            <div key={sIdx} className="bg-background border rounded px-2.5 py-1 text-xs flex items-center gap-1.5 min-w-[95px] justify-between">
                              <span className="opacity-45 text-[10px] font-semibold">S{sIdx + 1}</span>
                              <span className="font-bold text-[11px]">{displayWeight} {weightUnit}</span>
                              <span className="opacity-70 text-[10px]">× {reps}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs opacity-50 py-1">No detailed set logs recorded.</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 opacity-50 text-sm">
              No logs found for this date.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
