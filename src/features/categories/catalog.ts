import type { CategoryGroup, ProfileMode } from '@/features/profile/types';

export const PASS_WEIGHT_DELTA = -0.01;
export const NOT_NOW_WEIGHT_DELTA = 0.02;
export const SAVE_WEIGHT_DELTA = 0.10;

export const FOOD_CATEGORY_GROUPS: readonly CategoryGroup[] = [
  {
    key: 'cafes_bakeries_sweets',
    label: 'Cafes, Bakeries & Sweets',
    icon: '☕',
    description: 'Coffee shops, bakeries, dessert spots, and morning treats',
    placeTypes: [
      'acai_shop', 'bagel_shop', 'bakery', 'cafe', 'cake_shop', 'candy_store',
      'cat_cafe', 'chocolate_factory', 'chocolate_shop', 'coffee_roastery',
      'coffee_shop', 'coffee_stand', 'confectionery', 'dessert_restaurant',
      'dessert_shop', 'dog_cafe', 'donut_shop', 'ice_cream_shop', 'juice_shop',
      'pastry_shop', 'tea_house',
    ],
  },
  {
    key: 'east_southeast_asian',
    label: 'East & Southeast Asian',
    icon: '🍣',
    description: 'Japanese, Korean, Chinese, Vietnamese, Thai, and regional Asian flavors',
    placeTypes: [
      'asian_fusion_restaurant', 'asian_restaurant', 'burmese_restaurant',
      'cambodian_restaurant', 'cantonese_restaurant', 'chinese_noodle_restaurant',
      'chinese_restaurant', 'dim_sum_restaurant', 'dumpling_restaurant',
      'filipino_restaurant', 'hot_pot_restaurant', 'indonesian_restaurant',
      'japanese_curry_restaurant', 'japanese_izakaya_restaurant',
      'japanese_restaurant', 'korean_barbecue_restaurant', 'korean_restaurant',
      'malaysian_restaurant', 'mongolian_barbecue_restaurant', 'noodle_shop',
      'ramen_restaurant', 'sushi_restaurant', 'taiwanese_restaurant',
      'thai_restaurant', 'tibetan_restaurant', 'tonkatsu_restaurant',
      'vietnamese_restaurant', 'yakiniku_restaurant', 'yakitori_restaurant',
    ],
  },
  {
    key: 'western_european_mediterranean',
    label: 'Western & Mediterranean',
    icon: '🍝',
    description: 'Italian, French, Spanish tapas, pizza, and European bistros',
    placeTypes: [
      'american_restaurant', 'australian_restaurant', 'austrian_restaurant',
      'basque_restaurant', 'bavarian_restaurant', 'belgian_restaurant',
      'bistro', 'british_restaurant', 'californian_restaurant', 'croatian_restaurant',
      'czech_restaurant', 'danish_restaurant', 'dutch_restaurant',
      'eastern_european_restaurant', 'european_restaurant', 'fondue_restaurant',
      'french_restaurant', 'german_restaurant', 'greek_restaurant',
      'hungarian_restaurant', 'irish_restaurant', 'italian_restaurant',
      'mediterranean_restaurant', 'pizza_delivery', 'pizza_restaurant',
      'polish_restaurant', 'portuguese_restaurant', 'romanian_restaurant',
      'russian_restaurant', 'scandinavian_restaurant', 'spanish_restaurant',
      'swiss_restaurant', 'tapas_restaurant', 'ukrainian_restaurant',
      'western_restaurant',
    ],
  },
  {
    key: 'latin_south_american_bbq',
    label: 'Latin, Mexican & BBQ',
    icon: '🌮',
    description: 'Tacos, burritos, barbecue, Brazilian rodizio, and South American cooking',
    placeTypes: [
      'argentinian_restaurant', 'barbecue_restaurant', 'brazilian_restaurant',
      'burrito_restaurant', 'caribbean_restaurant', 'chilean_restaurant',
      'colombian_restaurant', 'cuban_restaurant', 'latin_american_restaurant',
      'mexican_restaurant', 'peruvian_restaurant', 'south_american_restaurant',
      'southwestern_us_restaurant', 'taco_restaurant', 'tex_mex_restaurant',
    ],
  },
  {
    key: 'south_asian_middle_eastern_african',
    label: 'South Asian & Middle Eastern',
    icon: '🍛',
    description: 'Curries, kebabs, falafel, shawarma, and vibrant spices',
    placeTypes: [
      'afghani_restaurant', 'african_restaurant', 'bangladeshi_restaurant',
      'ethiopian_restaurant', 'falafel_restaurant', 'gyro_restaurant',
      'halal_restaurant', 'indian_restaurant', 'israeli_restaurant',
      'kebab_shop', 'lebanese_restaurant', 'middle_eastern_restaurant',
      'moroccan_restaurant', 'north_indian_restaurant', 'pakistani_restaurant',
      'persian_restaurant', 'shawarma_restaurant', 'south_indian_restaurant',
      'sri_lankan_restaurant', 'turkish_restaurant',
    ],
  },
  {
    key: 'quick_bites_fast_food',
    label: 'Burgers & Quick Bites',
    icon: '🍔',
    description: 'Burgers, sandwiches, diners, and speedy bites on the go',
    placeTypes: [
      'cafeteria', 'chicken_restaurant', 'chicken_wings_restaurant', 'deli',
      'diner', 'fast_food_restaurant', 'fish_and_chips_restaurant', 'food_court',
      'hamburger_restaurant', 'hot_dog_restaurant', 'hot_dog_stand',
      'meal_delivery', 'meal_takeaway', 'salad_shop', 'sandwich_shop',
      'snack_bar', 'soup_restaurant',
    ],
  },
  {
    key: 'bars_pubs_breweries',
    label: 'Bars, Pubs & Breweries',
    icon: '🍷',
    description: 'Craft breweries, cocktail bars, wine lounges, and pubs',
    placeTypes: [
      'bar', 'bar_and_grill', 'beer_garden', 'brewery', 'brewpub',
      'cocktail_bar', 'gastropub', 'hookah_bar', 'irish_pub', 'lounge_bar',
      'pub', 'sports_bar', 'wine_bar', 'winery',
    ],
  },
  {
    key: 'steak_seafood_specialty',
    label: 'Steak & Seafood',
    icon: '🥩',
    description: 'Fresh seafood, oyster bars, and prime steakhouses',
    placeTypes: [
      'oyster_bar_restaurant', 'seafood_restaurant', 'steak_house',
    ],
  },
  {
    key: 'healthy_vegan_fusion',
    label: 'Healthy, Vegan & Regional',
    icon: '🥗',
    description: 'Plant-based, vegan dining, Hawaiian poke, and regional fusions',
    placeTypes: [
      'cajun_restaurant', 'fusion_restaurant', 'hawaiian_restaurant',
      'soul_food_restaurant', 'vegan_restaurant', 'vegetarian_restaurant',
    ],
  },
  {
    key: 'casual_fine_dining',
    label: 'Casual & Fine Dining',
    icon: '🍽️',
    description: 'Brunch spots, breakfast tables, family meals, and upscale dining',
    placeTypes: [
      'breakfast_restaurant', 'brunch_restaurant', 'buffet_restaurant',
      'family_restaurant', 'fine_dining_restaurant', 'restaurant',
    ],
  },
];

export const ACTIVITY_CATEGORY_GROUPS: readonly CategoryGroup[] = [
  {
    key: 'nature_parks_outdoors',
    label: 'Nature & Outdoors',
    icon: '🌳',
    description: 'Parks, gardens, beaches, hiking trails, and scenic viewpoints',
    placeTypes: [
      'beach', 'botanical_garden', 'campground', 'city_park', 'cycling_park',
      'dog_park', 'fountain', 'garden', 'hiking_area', 'island', 'lake',
      'mountain_peak', 'national_park', 'nature_preserve', 'off_roading_area',
      'park', 'picnic_ground', 'playground', 'river', 'scenic_spot',
      'state_park', 'wildlife_park', 'wildlife_refuge', 'woods', 'zoo',
    ],
  },
  {
    key: 'culture_history_museums',
    label: 'Culture & History',
    icon: '🏛️',
    description: 'Museums, art galleries, monuments, and historic landmarks',
    placeTypes: [
      'art_gallery', 'art_museum', 'art_studio', 'castle', 'cultural_center',
      'cultural_landmark', 'historical_landmark', 'historical_place',
      'history_museum', 'monument', 'museum', 'plaza', 'sculpture',
      'visitor_center',
    ],
  },
  {
    key: 'amusement_games_fun',
    label: 'Amusement & Games',
    icon: '🍿',
    description: 'Theme parks, arcades, bowling, aquariums, and family attractions',
    placeTypes: [
      'amusement_center', 'amusement_park', 'aquarium', 'bowling_alley',
      'ferris_wheel', 'go_karting_venue', 'indoor_playground', 'internet_cafe',
      'karaoke', 'miniature_golf_course', 'movie_rental', 'movie_theater',
      'paintball_center', 'roller_coaster', 'skateboard_park', 'video_arcade',
      'water_park',
    ],
  },
  {
    key: 'arts_shows_music',
    label: 'Arts, Theater & Music',
    icon: '🎭',
    description: 'Live concerts, theaters, comedy clubs, and performance venues',
    placeTypes: [
      'amphitheatre', 'auditorium', 'comedy_club', 'concert_hall', 'dance_hall',
      'live_music_venue', 'opera_house', 'performing_arts_theater',
      'philharmonic_hall', 'planetarium',
    ],
  },
  {
    key: 'adventure_sports_recreation',
    label: 'Adventure & Recreation',
    icon: '⛷️',
    description: 'Adventure sports, observation decks, marinas, and vineyards',
    placeTypes: [
      'adventure_sports_center', 'barbecue_area', 'childrens_camp', 'marina',
      'observation_deck', 'tourist_attraction', 'vineyard',
    ],
  },
  {
    key: 'social_nightlife_venues',
    label: 'Nightlife & Venues',
    icon: '🌃',
    description: 'Nightclubs, casinos, event halls, and social venues',
    placeTypes: [
      'banquet_hall', 'casino', 'community_center', 'convention_center',
      'event_venue', 'night_club', 'wedding_venue',
    ],
  },
];

export const CATEGORY_GROUPS_BY_MODE: Record<ProfileMode, readonly CategoryGroup[]> = {
  food: FOOD_CATEGORY_GROUPS,
  activities: ACTIVITY_CATEGORY_GROUPS,
};

const FOOD_TYPE_TO_GROUP = new Map<string, string>();
for (const group of FOOD_CATEGORY_GROUPS) {
  for (const type of group.placeTypes) {
    const raw = type.toLowerCase().trim();
    const snake = raw.replace(/[\s-]+/g, '_');
    const spaced = raw.replace(/_/g, ' ');
    FOOD_TYPE_TO_GROUP.set(raw, group.key);
    FOOD_TYPE_TO_GROUP.set(snake, group.key);
    FOOD_TYPE_TO_GROUP.set(spaced, group.key);
  }
}

const ACTIVITY_TYPE_TO_GROUP = new Map<string, string>();
for (const group of ACTIVITY_CATEGORY_GROUPS) {
  for (const type of group.placeTypes) {
    const raw = type.toLowerCase().trim();
    const snake = raw.replace(/[\s-]+/g, '_');
    const spaced = raw.replace(/_/g, ' ');
    ACTIVITY_TYPE_TO_GROUP.set(raw, group.key);
    ACTIVITY_TYPE_TO_GROUP.set(snake, group.key);
    ACTIVITY_TYPE_TO_GROUP.set(spaced, group.key);
  }
}

function resolveTypeToGroup(map: Map<string, string>, rawType: string): string | null {
  const cleaned = rawType.toLowerCase().trim();
  if (map.has(cleaned)) return map.get(cleaned)!;
  const snake = cleaned.replace(/[\s-]+/g, '_');
  if (map.has(snake)) return map.get(snake)!;
  const spaced = cleaned.replace(/_/g, ' ');
  if (map.has(spaced)) return map.get(spaced)!;
  return null;
}

export function getCategoryGroupKey(mode: ProfileMode, placeType: string): string | null {
  const map = mode === 'food' ? FOOD_TYPE_TO_GROUP : ACTIVITY_TYPE_TO_GROUP;
  return resolveTypeToGroup(map, placeType);
}

export function getCategoryKeysForPlace(
  mode: ProfileMode,
  primaryType?: string | null,
  types?: string[] | null,
): string[] {
  const keys = new Set<string>();
  const map = mode === 'food' ? FOOD_TYPE_TO_GROUP : ACTIVITY_TYPE_TO_GROUP;

  if (primaryType) {
    const key = resolveTypeToGroup(map, primaryType);
    if (key) keys.add(key);
  }

  if (types && Array.isArray(types)) {
    for (const t of types) {
      const key = resolveTypeToGroup(map, t);
      if (key) keys.add(key);
    }
  }

  return Array.from(keys);
}

export function clampWeight(weight: number): number {
  return Math.max(0.00, Math.min(1.00, Math.round(weight * 100) / 100));
}

export function calculateCategoryWeightMultiplier(weight: number): number {
  // Bounded w_category = 0.5 + 1.5 * W(c) in [0.5, 2.0]
  const clamped = clampWeight(weight);
  return 0.5 + 1.5 * clamped;
}
