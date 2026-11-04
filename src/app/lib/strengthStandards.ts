// Strength ranks: estimated 1RM divided by body weight, compared with common benchmark ratios.
// Each number is the ratio where that tier starts. These are approximate, general-purpose
// benchmarks (not age/sex-adjusted); edit the table to taste. Pull-up ratios are total load
// (body weight + added) / body weight, so 1.0 = bodyweight only.

export const TIERS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'] as const;
export const TIER_TEXT = ['text-zinc-300', 'text-sky-300', 'text-emerald-300', 'text-violet-300', 'text-amber-300'];
export const TIER_BAR = ['bg-zinc-400', 'bg-sky-400', 'bg-emerald-400', 'bg-violet-400', 'bg-amber-400'];

export const STANDARDS: Record<string, number[]> = {
  'Barbell Bench Press': [0.5, 0.75, 1.25, 1.75, 2.25],
  'Barbell Squat': [0.75, 1.25, 1.75, 2.25, 2.75],
  'Weighted Pull-Up': [1.0, 1.1, 1.3, 1.55, 1.8],
  'Barbell Row': [0.5, 0.75, 1.0, 1.5, 1.75],
};

export const SHORT_NAME: Record<string, string> = {
  'Barbell Bench Press': 'Bench',
  'Barbell Squat': 'Squat',
  'Weighted Pull-Up': 'Pull-up',
  'Barbell Row': 'Row',
};

export interface Rank {
  tier: number; // -1 = below Beginner
  name: string;
  ratio: number;
  next: { name: string; ratio: number } | null;
  progress: number; // 0..1 toward the next tier
}

export function rankOf(lift: string, ratio: number): Rank | null {
  const t = STANDARDS[lift];
  if (!t || !(ratio > 0)) return null;
  let tier = -1;
  t.forEach((r, i) => { if (ratio >= r) tier = i; });
  const floor = tier >= 0 ? t[tier] : 0;
  const nextRatio = tier + 1 < t.length ? t[tier + 1] : null;
  return {
    tier,
    name: tier >= 0 ? TIERS[tier] : 'Untrained',
    ratio,
    next: nextRatio === null ? null : { name: TIERS[tier + 1], ratio: nextRatio },
    progress: nextRatio === null ? 1 : Math.min(1, Math.max(0, (ratio - floor) / (nextRatio - floor))),
  };
}

// Overall rank = average tier across the lifts that have data
export function overallRank(ranks: (Rank | null)[]): { tier: number; name: string } | null {
  const have = ranks.filter((r): r is Rank => r !== null);
  if (!have.length) return null;
  const tier = Math.floor(have.reduce((s, r) => s + r.tier, 0) / have.length);
  return { tier, name: tier >= 0 ? TIERS[tier] : 'Untrained' };
}
