export type Vibe = 'loved' | 'liked' | 'fine' | 'disliked';

export interface VibeConfig {
  key: Vibe;
  label: string;
  icon: string;
  min: number;
  max: number;
  baseline: number;
  description: string;
}

export const VIBE_CONFIGS: Record<Vibe, VibeConfig> = {
  loved: {
    key: 'loved',
    label: 'Loved it!',
    icon: '🤩',
    min: 8.5,
    max: 10.0,
    baseline: 9.2,
    description: 'A standout favorite you’d rush back to',
  },
  liked: {
    key: 'liked',
    label: 'I liked it!',
    icon: '😊',
    min: 7.0,
    max: 8.4,
    baseline: 7.8,
    description: 'Solid, delicious, and would recommend',
  },
  fine: {
    key: 'fine',
    label: 'It was fine',
    icon: '😐',
    min: 5.0,
    max: 6.9,
    baseline: 6.0,
    description: 'Okay, but wouldn’t go out of your way',
  },
  disliked: {
    key: 'disliked',
    label: 'Didn’t like it',
    icon: '😕',
    min: 0.0,
    max: 4.9,
    baseline: 3.8,
    description: 'Disappointing or would not return',
  },
};

export interface ScoreTier {
  color: string;
  backgroundColor: string;
  textColor: string;
  label: string;
}

export function getScoreTier(score: number): ScoreTier {
  const s = Math.max(0.0, Math.min(10.0, Math.round(score * 10) / 10));
  if (s >= 9.0) {
    return {
      color: '#059669',
      backgroundColor: '#D1FAE5',
      textColor: '#065F46',
      label: 'Exceptional',
    };
  }
  if (s >= 8.0) {
    return {
      color: '#16A34A',
      backgroundColor: '#DCFCE7',
      textColor: '#166534',
      label: 'Great',
    };
  }
  if (s >= 7.0) {
    return {
      color: '#65A30D',
      backgroundColor: '#ECFCCB',
      textColor: '#3F6212',
      label: 'Good',
    };
  }
  if (s >= 6.0) {
    return {
      color: '#EA580C',
      backgroundColor: '#FFEDD5',
      textColor: '#9A3412',
      label: 'Average',
    };
  }
  return {
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    textColor: '#991B1B',
    label: 'Disappointing',
  };
}

export function inferVibeFromRating(rating: number): Vibe {
  const r = Math.max(0.0, Math.min(10.0, rating));
  if (r >= 8.5) return 'loved';
  if (r >= 7.0) return 'liked';
  if (r >= 5.0) return 'fine';
  return 'disliked';
}
