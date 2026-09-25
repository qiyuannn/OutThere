export interface PlaceSuggestion { id: string; name: string; address: string }
export interface SuggestionsState<T = PlaceSuggestion> { loading: boolean; items: T[]; error: string | null }

/** One controller per mounted search field; invalidates both timers and in-flight responses. */
export function createSuggestionsController<T = PlaceSuggestion>(
  fetchSuggestions: (query: string, center?: { latitude: number; longitude: number }) => Promise<T[]>,
  publish: (state: SuggestionsState<T>) => void,
  delay = 350,
  fallbackErrorMessage = 'Suggestions are unavailable. Try typing again or use Search places.',
) {
  let version = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function cancel() { version++; clearTimeout(timer); }
  function update(query: string, center?: { latitude: number; longitude: number }) {
    cancel();
    const current = version;
    const input = query.trim();
    publish({ items: [], loading: input.length >= 2, error: null });
    if (input.length < 2) return;
    timer = setTimeout(async () => {
      try {
        const items = await fetchSuggestions(input, center);
        if (version === current) publish({ items, loading: false, error: null });
      } catch {
        if (version === current) publish({ items: [], loading: false, error: fallbackErrorMessage });
      }
    }, delay);
  }
  return { update, cancel };
}
