import { VIBE_CONFIGS, type Vibe } from './vibe-config.ts';

function enforceDescendingSteps(scores: number[], config: { min: number; max: number }): void {
  for (let i = scores.length - 2; i >= 0; i--) {
    if (scores[i] <= scores[i + 1]) {
      scores[i] = Math.min(config.max, Math.round((scores[i + 1] + 0.1) * 10) / 10);
    }
  }
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] >= scores[i - 1]) {
      scores[i] = Math.max(config.min, Math.round((scores[i - 1] - 0.1) * 10) / 10);
    }
  }
}

function enforceMonotonicClamp(scores: number[]): void {
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[i - 1]) {
      scores[i] = scores[i - 1];
    }
  }
}

/**
 * Distributes M items across a vibe tier [Vmin, Vmax] using continuous percentile mapping.
 * Ensures strict monotonicity and smooth spacing across the tier.
 */
export function recalibrateTierScores(count: number, vibe: Vibe): number[] {
  if (count <= 0) return [];
  const config = VIBE_CONFIGS[vibe];
  if (count === 1) {
    return [config.baseline];
  }

  const range = config.max - config.min;
  const maxDistinctSteps = Math.round(range * 10);

  const scores: number[] = [];
  for (let i = 0; i < count; i++) {
    const percentile = (count - i - 0.5) / count;
    const rawScore = config.min + percentile * range;
    const rounded = Math.round(rawScore * 10) / 10;
    scores.push(Math.max(config.min, Math.min(config.max, rounded)));
  }

  if (count <= maxDistinctSteps + 1) {
    enforceDescendingSteps(scores, config);
  } else {
    enforceMonotonicClamp(scores);
  }

  return scores;
}
