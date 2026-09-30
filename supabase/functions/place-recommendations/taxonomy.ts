/**
 * supabase/functions/place-recommendations/taxonomy.ts
 * Category taxonomy, preference tier allocation, lodging exclusion, and multi-factor scoring.
 */

import type { Coordinates, Mode, PhotoAttribution, Place } from './types.ts';
import { haversineDistanceMeters } from './geometry.ts';

export const groups: Record<Mode, Record<string, string[]>> = {
  activities: {
    nature_parks_outdoors: [
      "beach", "botanical_garden", "campground", "city_park", "cycling_park",
      "dog_park", "fountain", "garden", "hiking_area", "island", "lake",
      "mountain_peak", "national_park", "nature_preserve", "off_roading_area",
      "park", "picnic_ground", "playground", "river", "scenic_spot",
      "state_park", "wildlife_park", "wildlife_refuge", "woods", "zoo",
    ],
    culture_history_museums: [
      "art_gallery", "art_museum", "art_studio", "castle", "cultural_center",
      "cultural_landmark", "historical_landmark", "historical_place",
      "history_museum", "monument", "museum", "plaza", "sculpture",
      "visitor_center",
    ],
    amusement_games_fun: [
      "amusement_center", "amusement_park", "aquarium", "bowling_alley",
      "ferris_wheel", "go_karting_venue", "indoor_playground", "internet_cafe",
      "karaoke", "miniature_golf_course", "movie_rental", "movie_theater",
      "paintball_center", "roller_coaster", "skateboard_park", "video_arcade",
      "water_park",
    ],
    arts_shows_music: [
      "amphitheatre", "auditorium", "comedy_club", "concert_hall", "dance_hall",
      "live_music_venue", "opera_house", "performing_arts_theater",
      "philharmonic_hall", "planetarium",
    ],
    adventure_sports_recreation: [
      "adventure_sports_center", "barbecue_area", "childrens_camp", "marina",
      "observation_deck", "tourist_attraction", "vineyard",
    ],
    social_nightlife_venues: [
      "casino", "community_center", "convention_center",
      "event_venue", "night_club",
    ],
  },
  food: {
    cafes_bakeries_sweets: [
      "acai_shop", "bagel_shop", "bakery", "cafe", "cake_shop", "candy_store",
      "cat_cafe", "chocolate_factory", "chocolate_shop", "coffee_roastery",
      "coffee_shop", "coffee_stand", "confectionery", "dessert_restaurant",
      "dessert_shop", "dog_cafe", "donut_shop", "ice_cream_shop", "juice_shop",
      "pastry_shop", "tea_house",
    ],
    east_southeast_asian: [
      "asian_fusion_restaurant", "asian_restaurant", "burmese_restaurant",
      "cambodian_restaurant", "cantonese_restaurant", "chinese_noodle_restaurant",
      "chinese_restaurant", "dim_sum_restaurant", "dumpling_restaurant",
      "filipino_restaurant", "hot_pot_restaurant", "indonesian_restaurant",
      "japanese_curry_restaurant", "japanese_izakaya_restaurant",
      "japanese_restaurant", "korean_barbecue_restaurant", "korean_restaurant",
      "malaysian_restaurant", "mongolian_barbecue_restaurant", "noodle_shop",
      "ramen_restaurant", "sushi_restaurant", "taiwanese_restaurant",
      "thai_restaurant", "tibetan_restaurant", "tonkatsu_restaurant",
      "vietnamese_restaurant", "yakiniku_restaurant", "yakitori_restaurant",
    ],
    western_european_mediterranean: [
      "american_restaurant", "australian_restaurant", "austrian_restaurant",
      "basque_restaurant", "bavarian_restaurant", "belgian_restaurant",
      "bistro", "british_restaurant", "californian_restaurant", "croatian_restaurant",
      "czech_restaurant", "danish_restaurant", "dutch_restaurant",
      "eastern_european_restaurant", "european_restaurant", "fondue_restaurant",
      "french_restaurant", "german_restaurant", "greek_restaurant",
      "hungarian_restaurant", "irish_restaurant", "italian_restaurant",
      "mediterranean_restaurant", "pizza_delivery", "pizza_restaurant",
      "polish_restaurant", "portuguese_restaurant", "romanian_restaurant",
      "russian_restaurant", "scandinavian_restaurant", "spanish_restaurant",
      "swiss_restaurant", "tapas_restaurant", "ukrainian_restaurant",
      "western_restaurant",
    ],
    latin_south_american_bbq: [
      "argentinian_restaurant", "barbecue_restaurant", "brazilian_restaurant",
      "burrito_restaurant", "caribbean_restaurant", "chilean_restaurant",
      "colombian_restaurant", "cuban_restaurant", "latin_american_restaurant",
      "mexican_restaurant", "peruvian_restaurant", "south_american_restaurant",
      "southwestern_us_restaurant", "taco_restaurant", "tex_mex_restaurant",
    ],
    south_asian_middle_eastern_african: [
      "afghani_restaurant", "african_restaurant", "bangladeshi_restaurant",
      "ethiopian_restaurant", "falafel_restaurant", "gyro_restaurant",
      "halal_restaurant", "indian_restaurant", "israeli_restaurant",
      "kebab_shop", "lebanese_restaurant", "middle_eastern_restaurant",
      "moroccan_restaurant", "north_indian_restaurant", "pakistani_restaurant",
      "persian_restaurant", "shawarma_restaurant", "south_indian_restaurant",
      "sri_lankan_restaurant", "turkish_restaurant",
    ],
    quick_bites_fast_food: [
      "cafeteria", "chicken_restaurant", "chicken_wings_restaurant", "deli",
      "diner", "fast_food_restaurant", "fish_and_chips_restaurant", "food_court",
      "hamburger_restaurant", "hot_dog_restaurant", "hot_dog_stand",
      "meal_delivery", "meal_takeaway", "salad_shop", "sandwich_shop",
      "snack_bar", "soup_restaurant",
    ],
    bars_pubs_breweries: [
      "bar", "bar_and_grill", "beer_garden", "brewery", "brewpub",
      "cocktail_bar", "gastropub", "hookah_bar", "irish_pub", "lounge_bar",
      "pub", "sports_bar", "wine_bar", "winery",
    ],
    steak_seafood_specialty: [
      "oyster_bar_restaurant", "seafood_restaurant", "steak_house",
    ],
    healthy_vegan_fusion: [
      "cajun_restaurant", "fusion_restaurant", "hawaiian_restaurant",
      "soul_food_restaurant", "vegan_restaurant", "vegetarian_restaurant",
    ],
    casual_fine_dining: [
      "breakfast_restaurant", "brunch_restaurant", "buffet_restaurant",
      "family_restaurant", "fine_dining_restaurant", "restaurant",
    ],
  },
};

export const typeToGroup: Record<Mode, Record<string, string>> = {
  activities: {},
  food: {},
};
for (const m of ['activities', 'food'] as const) {
  for (const [groupKey, types] of Object.entries(groups[m])) {
    for (const t of types) {
      typeToGroup[m][t] = groupKey;
    }
  }
}

export const defaults: Record<Mode, string[]> = {
  activities: ["park", "museum", "art_gallery", "tourist_attraction", "aquarium", "hiking_area", "performing_arts_theater", "botanical_garden", "amusement_park", "zoo"],
  food: ["restaurant", "cafe", "coffee_shop", "bakery", "seafood_restaurant", "bar", "pizza_restaurant", "diner", "bistro"],
};

export const HOTEL_LODGING_TYPES = [
  "bed_and_breakfast", "budget_japanese_inn", "camping_cabin", "cottage",
  "extended_stay_hotel", "farmstay", "guest_house", "hostel", "hotel", "inn",
  "japanese_inn", "lodging", "motel", "private_guest_room", "resort_hotel",
];
export const HOTEL_LODGING_TYPES_SET = new Set(HOTEL_LODGING_TYPES);

export function isHotelOrLodging(place: Place): boolean {
  const isHotelPrimary = Boolean(place.primaryType && HOTEL_LODGING_TYPES_SET.has(place.primaryType.toLowerCase()));
  const isHotelDisplayName = Boolean(
    place.primaryTypeDisplayName?.text &&
    /\b(hotel|resort|motel|hostel|inn|lodging)\b/i.test(place.primaryTypeDisplayName.text)
  );
  const hasLodgingType = Boolean(place.types?.some((t) => HOTEL_LODGING_TYPES_SET.has(t.toLowerCase())));
  const isHotelName = Boolean(
    place.displayName?.text &&
    /\b(hotel|resort|motel|hostel)\b/i.test(place.displayName.text)
  );
  return isHotelPrimary || isHotelDisplayName || (hasLodgingType && isHotelName);
}

export function sanitizeAttributions(attributions?: PhotoAttribution[] | null): PhotoAttribution[] | undefined {
  if (!attributions) return undefined;
  return attributions.map((a: PhotoAttribution) => ({
    displayName: a.displayName ?? null,
    uri: a.uri ?? null,
  }));
}

export function extractAmenities(place: Place): Record<string, boolean> {
  const amenities: Record<string, boolean> = {};
  if (typeof place.dineIn === "boolean") amenities.dineIn = place.dineIn;
  if (typeof place.takeout === "boolean") amenities.takeout = place.takeout;
  if (typeof place.delivery === "boolean") amenities.delivery = place.delivery;
  if (typeof place.reservable === "boolean") amenities.reservable = place.reservable;
  if (typeof place.outdoorSeating === "boolean") amenities.outdoorSeating = place.outdoorSeating;
  if (typeof place.servesBeer === "boolean") amenities.servesBeer = place.servesBeer;
  if (typeof place.servesWine === "boolean") amenities.servesWine = place.servesWine;
  if (typeof place.servesVegetarianFood === "boolean") amenities.servesVegetarianFood = place.servesVegetarianFood;
  if (typeof place.goodForChildren === "boolean") amenities.goodForChildren = place.goodForChildren;
  if (typeof place.goodForGroups === "boolean") amenities.goodForGroups = place.goodForGroups;
  if (typeof place.restroom === "boolean") amenities.restroom = place.restroom;
  if (place.parkingOptions?.freeParkingLot || place.parkingOptions?.freeStreetParking) amenities.freeParking = true;
  return amenities;
}

export function allocateTierPlaceTypes(mode: Mode, weightsMap: Map<string, number>) {
  const groupKeys = Object.keys(groups[mode]);
  for (let i = groupKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = groupKeys[i];
    groupKeys[i] = groupKeys[j];
    groupKeys[j] = temp;
  }
  groupKeys.sort((a, b) => (weightsMap.get(b) ?? 0.0) - (weightsMap.get(a) ?? 0.0));

  const highCount = mode === "food" ? 2 : 1;
  const medCount = mode === "food" ? 3 : 2;

  const highGroups = groupKeys.slice(0, highCount);
  const medGroups = groupKeys.slice(highCount, highCount + medCount);
  const lowGroups = groupKeys.slice(highCount + medCount);

  const extractTypes = (keys: string[]): string[] => {
    const typesSet = new Set<string>();
    for (const key of keys) {
      for (const t of groups[mode][key] ?? []) {
        typesSet.add(t);
      }
    }
    const list = Array.from(typesSet).slice(0, 50);
    return list.length > 0 ? list : defaults[mode];
  };

  return {
    highTypes: extractTypes(highGroups),
    medTypes: extractTypes(medGroups),
    lowTypes: extractTypes(lowGroups),
  };
}

export function calculateRecommendationScore(
  place: Place,
  origin: Coordinates,
  radius: number,
  mode: Mode,
  weightsMap: Map<string, number>,
  tier: "high" | "med" | "low"
) {
  const placeLat = place.location!.latitude!;
  const placeLng = place.location!.longitude!;
  const meters = haversineDistanceMeters(origin, { latitude: placeLat, longitude: placeLng });

  const candidateCategoryKeys = new Set<string>();
  if (place.primaryType && typeToGroup[mode][place.primaryType]) {
    candidateCategoryKeys.add(typeToGroup[mode][place.primaryType]);
  }
  if (Array.isArray(place.types)) {
    for (const t of place.types) {
      if (typeToGroup[mode][t]) {
        candidateCategoryKeys.add(typeToGroup[mode][t]);
      }
    }
  }
  const matchedKeys = Array.from(candidateCategoryKeys);
  let maxWeight = 0.0;
  for (const k of matchedKeys) {
    const w = weightsMap.get(k) ?? 0.0;
    if (w > maxWeight) maxWeight = w;
  }

  const wCategory = 0.5 + 1.5 * Math.min(1.0, Math.max(0.0, maxWeight));
  const proximity = Math.max(0, 1 - meters / radius);
  const wProximity = 0.5 + 0.5 * proximity;
  const ratingValue = typeof place.rating === "number" ? Math.min(5, Math.max(0, place.rating)) : 3.5;
  const wQuality = 0.7 + 0.3 * (ratingValue / 5);
  const rawScore = wCategory * wProximity * wQuality;
  const normalizedScore = Math.min(1.0, Math.max(0.0, rawScore / 2.0));

  const tierReason =
    tier === "high"
      ? "Matches your top category preferences."
      : tier === "med"
        ? "Matches your secondary interests."
        : "A popular choice to expand your options.";

  return {
    meters,
    matchedKeys,
    normalizedScore: Number(normalizedScore.toFixed(4)),
    matchPercent: Math.round(normalizedScore * 100),
    reason: meters < radius * 0.3 ? "A nearby option within your chosen range." : tierReason,
  };
}
