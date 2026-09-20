import { useEffect, useMemo, useRef } from 'react';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { enforceSearchAccess } from '@/features/subscriptions/model';
import { useSubscription } from '@/providers/subscription-provider';
import { DEFAULT_FILTERS, parseSearch, type SearchRequest } from './model';
import { SearchResultItem } from './search-result-item';
import { usePlaceSearch } from './use-search';

type ResultsParams = {
  query?: string;
  latitude?: string;
  longitude?: string;
  filters?: string;
};

function requestFromParams(params: ResultsParams): SearchRequest | null {
  try {
    return parseSearch({
      query: params.query,
      center: { latitude: Number(params.latitude), longitude: Number(params.longitude) },
      filters: params.filters ? JSON.parse(params.filters) : DEFAULT_FILTERS,
    });
  } catch {
    return null;
  }
}

export function SearchResultsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<ResultsParams>();
  const search = usePlaceSearch();
  const { isPro } = useSubscription();
  const startedRequestKey = useRef<string | null>(null);
  const requestKey = `${params.query ?? ''}|${params.latitude ?? ''}|${params.longitude ?? ''}|${params.filters ?? ''}|pro:${isPro}`;
  const request = useMemo(() => {
    const parsed = requestFromParams(params);
    return parsed ? { ...parsed, filters: enforceSearchAccess(parsed.filters, isPro) } : null;
  }, [isPro, requestKey]);

  useEffect(() => {
    if (!request || startedRequestKey.current === requestKey) return;
    startedRequestKey.current = requestKey;
    void search.run(request);
  }, [request, requestKey]);

  const goBack = () => router.canGoBack() ? router.back() : router.replace('/search' as Href);

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.backgroundElement }]}>
      <AppHeader description="Search Results" showBack onBack={goBack} />
      <View style={styles.content}>
        <ThemedText accessibilityRole="header" style={styles.title}>
          Search Results for “{request?.query ?? params.query ?? ''}”
        </ThemedText>

        {!request ? (
          <View style={styles.message}>
            <ThemedText accessibilityRole="alert">This search could not be opened.</ThemedText>
            <Button label="Back to search" onPress={goBack} />
          </View>
        ) : (
          <FlatList
            accessibilityRole="list"
            contentContainerStyle={[styles.list, !search.results.length && styles.emptyList]}
            data={search.results}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            keyExtractor={(place) => place.id}
            renderItem={({ item }) => (
              <SearchResultItem
                place={item}
                onPress={(place) => router.push({ pathname: '/search/[id]', params: { id: place.id, mode: place.mode } } as unknown as Href)}
              />
            )}
            ListEmptyComponent={
              search.loading ? (
                <ActivityIndicator color={theme.primary} accessibilityLabel="Searching places" />
              ) : search.error ? (
                <View style={styles.message}>
                  <ThemedText accessibilityRole="alert">{search.error}</ThemedText>
                  <Button label="Retry" onPress={() => void search.run(request)} />
                </View>
              ) : search.response ? (
                <View style={styles.message}>
                  <ThemedText type="subtitle">No matches in this area</ThemedText>
                  <ThemedText themeColor="textSecondary">Try a wider distance, fewer filters, or a different query.</ThemedText>
                  <Button label="Adjust search" onPress={goBack} />
                </View>
              ) : null
            }
            ListFooterComponent={search.results.length ? (
              <View style={styles.footer}>
                {search.error ? <ThemedText accessibilityRole="alert">{search.error}</ThemedText> : null}
                {search.response?.cursor ? (
                  <Button
                    disabled={search.loadingMore}
                    label={search.loadingMore ? 'Loading more…' : 'Load more matches'}
                    onPress={() => void search.loadMore()}
                  />
                ) : null}
              </View>
            ) : null}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, width: '100%', maxWidth: 402, alignSelf: 'center', padding: 10, gap: 10, overflow: 'hidden' },
  title: { width: '100%', color: '#000000', fontSize: 16, fontWeight: '600', lineHeight: 20 },
  list: { padding: 10, paddingBottom: 36 },
  separator: { height: 10 },
  emptyList: { flexGrow: 1 },
  message: { gap: 14, alignItems: 'flex-start' },
  footer: { paddingTop: 20, gap: 14 },
});
