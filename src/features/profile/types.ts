export type ProfileMode = 'food' | 'activities';

export interface CategoryGroup {
  key: string;
  label: string;
  icon: string;
  description: string;
  placeTypes: readonly string[];
}


export interface CategoryWeightRecord {
  categoryKey: string;
  weight: number;
  updatedAt: string;
}
