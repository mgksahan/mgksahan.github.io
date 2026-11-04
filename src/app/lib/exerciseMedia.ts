// Exercise pictures: free-exercise-db (public domain, https://github.com/yuhonas/free-exercise-db), copied into public/exercises/.
// Keyed by the trimmed exercise name used in gymPlan.ts. Two frames per exercise (start/end), cross-faded on the page.
export const EXERCISE_MEDIA: Record<string, { dir: string; muscle: string }> = {
  "Barbell Bench Press": { dir: "Barbell_Bench_Press_-_Medium_Grip", muscle: "chest" },
  "Barbell Incline Bench Press": { dir: "Barbell_Incline_Bench_Press_-_Medium_Grip", muscle: "chest" },
  "Dumbbell Incline Bench Press": { dir: "Incline_Dumbbell_Press", muscle: "chest" },
  "Machine Deltoid Raise": { dir: "Side_Lateral_Raise", muscle: "shoulders" },
  "Dumbbell Seated Side Lateral Raise": { dir: "Seated_Side_Lateral_Raise", muscle: "shoulders" },
  "unilateral tricep machine extension blue machine": { dir: "Machine_Triceps_Extension", muscle: "triceps" },
  "Dumbbell Seated One-Arm Tricep Extension": { dir: "Dumbbell_One-Arm_Triceps_Extension", muscle: "triceps" },
  "Machine Ab Crunch": { dir: "Ab_Crunch_Machine", muscle: "abdominals" },
  "Weighted Pull-Up": { dir: "Weighted_Pull_Ups", muscle: "lats" },
  "Barbell Squat": { dir: "Barbell_Squat", muscle: "quadriceps" },
  "Barbell Row": { dir: "Bent_Over_Barbell_Row", muscle: "middle back" },
  "Close Grip Cable Seated Row": { dir: "Seated_Cable_Rows", muscle: "middle back" },
  "Cable Seated Row": { dir: "Seated_Cable_Rows", muscle: "middle back" },
  "Dumbbell One-Arm Row": { dir: "One-Arm_Dumbbell_Row", muscle: "middle back" },
  "Machine Reverse Fly": { dir: "Reverse_Machine_Flyes", muscle: "shoulders" },
  "Dumbbell Seated Bent-Over Reverse Fly": { dir: "Reverse_Flyes", muscle: "shoulders" },
  "Machine Bicep Curls Unilateral": { dir: "Machine_Bicep_Curl", muscle: "biceps" },
  "Dumbbell Alternating Bicep Curl": { dir: "Dumbbell_Alternate_Bicep_Curl", muscle: "biceps" },
};

export const mediaFor = (name: string) => EXERCISE_MEDIA[name.trim()] ?? null;
