export type SearchMode = 'all' | 'food' | 'activities';
export type Center = { latitude: number; longitude: number };
export const SEARCH_CATEGORIES = [
  { key: 'restaurant', label: 'Restaurants', mode: 'food' },
  { key: 'cafe', label: 'Cafés', mode: 'food' },
  { key: 'bakery', label: 'Bakeries', mode: 'food' },
  { key: 'bar', label: 'Bars', mode: 'food' },
  { key: 'ramen_restaurant', label: 'Ramen', mode: 'food' },
  { key: 'vegetarian_restaurant', label: 'Vegetarian', mode: 'food' },
  { key: 'park', label: 'Parks', mode: 'activities' },
  { key: 'museum', label: 'Museums', mode: 'activities' },
  { key: 'art_gallery', label: 'Art galleries', mode: 'activities' },
  { key: 'tourist_attraction', label: 'Attractions', mode: 'activities' },
  { key: 'hiking_area', label: 'Hiking', mode: 'activities' },
  { key: 'movie_theater', label: 'Cinemas', mode: 'activities' },
  { key: 'amusement_park', label: 'Amusement parks', mode: 'activities' },
  { key: 'botanical_garden', label: 'Gardens', mode: 'activities' },
] as const;
export const PRICES = [
  { key: 'PRICE_LEVEL_FREE', label: 'Free' },
  { key: 'PRICE_LEVEL_INEXPENSIVE', label: '$' },
  { key: 'PRICE_LEVEL_MODERATE', label: '$$' },
  { key: 'PRICE_LEVEL_EXPENSIVE', label: '$$$' },
  { key: 'PRICE_LEVEL_VERY_EXPENSIVE', label: '$$$$' },
] as const;
export interface SearchFilters {
  mode: SearchMode;
  category: string;
  radiusMeters: number;
  openNow: boolean;
  price: string;
  minRating: number;
  sort: 'relevance' | 'distance';
}
export const DEFAULT_FILTERS: SearchFilters = {
  mode: 'all', category: '', radiusMeters: 10000, openNow: false,
  price: '', minRating: 0, sort: 'relevance',
};
export interface SearchRequest { query: string; center: Center; filters: SearchFilters; cursor?: string }
export class SearchError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new SearchError('Invalid search request.');
  return v as Record<string, unknown>;
};
export function validQuery(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 160) {
    throw new SearchError('Enter between 2 and 160 characters.');
  }
  return value.trim();
}
export function parseSearch(value: unknown): SearchRequest {
  const v = object(value), c = object(v.center), f = object(v.filters);
  if (typeof c.latitude !== 'number' || !Number.isFinite(c.latitude) || Math.abs(c.latitude) > 90 ||
      typeof c.longitude !== 'number' || !Number.isFinite(c.longitude) || Math.abs(c.longitude) > 180) {
    throw new SearchError('Choose a valid search area.');
  }
  if (!['all', 'food', 'activities'].includes(String(f.mode)) ||
      !['relevance', 'distance'].includes(String(f.sort)) || typeof f.openNow !== 'boolean' ||
      typeof f.radiusMeters !== 'number' || !Number.isFinite(f.radiusMeters) || f.radiusMeters < 1000 || f.radiusMeters > 50000 ||
      ![0, 3, 3.5, 4, 4.5].includes(f.minRating as number) ||
      !(f.price === '' || PRICES.some(p => p.key === f.price)) ||
      !(f.category === '' || SEARCH_CATEGORIES.some(c => c.key === f.category && (f.mode === 'all' || c.mode === f.mode)))) {
    throw new SearchError('Choose valid search filters.');
  }
  if (v.cursor !== undefined && (typeof v.cursor !== 'string' || v.cursor.length > 12000)) throw new SearchError('Invalid search page.');
  return {
    query: validQuery(v.query), center: { latitude: c.latitude, longitude: c.longitude },
    filters: { mode: f.mode as SearchMode, sort: f.sort as SearchFilters['sort'], category: f.category as string,
      radiusMeters: f.radiusMeters, openNow: f.openNow, price: f.price as string, minRating: f.minRating as number },
    cursor: v.cursor as string | undefined,
  };
}
export function distanceMeters(a: Center, b: Center) {
  const rad = (n: number) => n * Math.PI / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function mergeResults<T extends { id: string; distanceMeters?: number | null }>(old: T[], next: T[], sort: SearchFilters['sort']): T[] {
  const merged = [...new Map([...old, ...next].map(p => [p.id, p])).values()];
  return sort === 'distance' ? merged.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity)) : merged;
}
export function addRecentSearch(history: string[], query: string) {
  const q = query.trim();
  return q.length < 2 ? history : [q, ...history.filter(s => s.toLocaleLowerCase() !== q.toLocaleLowerCase())].slice(0, 8);
}
export function priceLabel(value?: string | null) { return PRICES.find(p => p.key === value)?.label ?? 'Price unavailable'; }
