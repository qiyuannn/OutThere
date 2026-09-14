export interface PlaceSuggestion { id: string; name: string; address: string }
export interface SuggestionsState { loading: boolean; items: PlaceSuggestion[]; error: string | null }

/** One controller per mounted search field; invalidates both timers and in-flight responses. */
export function createSuggestionsController(
  fetchSuggestions: (query: string, center?: { latitude: number; longitude: number }) => Promise<PlaceSuggestion[]>,
  publish: (state: SuggestionsState) => void,
  delay = 350,
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
        if (version === current) publish({ items: [], loading: false, error: 'Suggestions are unavailable. Try typing again or use Search places.' });
      }
    }, delay);
  }
  return { update, cancel };
}
