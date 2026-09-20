import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import {
  calculateListRecalibration,
  getBracketBounds,
  getScoreTier,
  RecalibratedPlace,
  stepComparison,
  Vibe,
} from '../comparison';
import { getCandidatePlaces } from '../service';
import type { CandidatePlace, RankedPlace, RankingMode, SaveRatingInput } from '../types';
import { RatingPlaceSummary } from './rating-place-summary';

const closeIcon = require('../../../../assets/images/rankings/close.svg');
const vibeIcons = {
  disliked: require('../../../../assets/images/rankings/vibe-disliked.svg'),
  fine: require('../../../../assets/images/rankings/vibe-fine.svg'),
  liked: require('../../../../assets/images/rankings/vibe-liked.svg'),
  loved: require('../../../../assets/images/rankings/vibe-loved.svg'),
} as const;

const vibeOptions = [
  { key: 'disliked', label: 'Didn’t like it.' },
  { key: 'fine', label: 'It’s fine.' },
  { key: 'liked', label: 'It’s good!' },
  { key: 'loved', label: 'Loved it!' },
] as const;

function ShowdownScore({ score }: { score: number }) {
  const tier = getScoreTier(score);
  return (
    <View style={[styles.showdownScore, { backgroundColor: tier.backgroundColor, borderColor: tier.color }]}>
      <ThemedText style={[styles.showdownScoreText, { color: tier.textColor }]}>{score.toFixed(1)}</ThemedText>
    </View>
  );
}

interface RatePlaceModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (input: SaveRatingInput) => Promise<void>;
  existingRankings: RankedPlace[];
  mode: RankingMode;
  initialPlace?: CandidatePlace | null;
}

type ModalStep = 'select_place' | 'vibe_check' | 'showdown' | 'score_reveal';

export function RatePlaceModal({
  visible,
  onClose,
  onSave,
  existingRankings,
  mode,
  initialPlace = null,
}: RatePlaceModalProps) {
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;

  // Step state
  const [step, setStep] = useState<ModalStep>('select_place');
  const [selectedPlace, setSelectedPlace] = useState<CandidatePlace | null>(initialPlace);
  const [selectedVibe, setSelectedVibe] = useState<Vibe>('liked');

  // Candidate places state for selection
  const [candidates, setCandidates] = useState<CandidatePlace[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Showdown state
  const [lowIdx, setLowIdx] = useState(0);
  const [highIdx, setHighIdx] = useState(-1);
  const [currentMid, setCurrentMid] = useState<number | null>(null);
  const [comparisonCount, setComparisonCount] = useState(1);

  // Score state
  const [finalScore, setFinalScore] = useState<number>(7.8);
  const [recalibratedPlaces, setRecalibratedPlaces] = useState<RecalibratedPlace[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset modal state when opening
  useEffect(() => {
    if (visible) {
      if (initialPlace) {
        setSelectedPlace(initialPlace);
        setStep('vibe_check');
      } else {
        setSelectedPlace(null);
        setStep('select_place');
      }
      setSelectedVibe('liked');
      setSaving(false);
      setComparisonCount(1);
      setRecalibratedPlaces([]);
    }
  }, [visible, initialPlace]);

  // Load candidate places when on select_place step
  useEffect(() => {
    if (visible && step === 'select_place' && userId) {
      setLoadingCandidates(true);
      getCandidatePlaces(userId, mode)
        .then((data) => setCandidates(data))
        .catch(() => setCandidates([]))
        .finally(() => setLoadingCandidates(false));
    }
  }, [visible, step, userId, mode]);

  // Filtered candidate places
  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter(
      (c) =>
        c.display_name.toLowerCase().includes(q) ||
        c.formatted_address?.toLowerCase().includes(q) ||
        c.primary_type_display_name?.toLowerCase().includes(q),
    );
  }, [candidates, searchQuery]);

  // Handle selecting a place
  const handleSelectPlace = (place: CandidatePlace) => {
    setSelectedPlace(place);
    setStep('vibe_check');
  };

  // Handle choosing a vibe
  const handleSelectVibe = (vibe: Vibe) => {
    setSelectedVibe(vibe);

    // Initialize binary search bounds
    const bounds = getBracketBounds(existingRankings, vibe);
    if (bounds.low <= bounds.high && existingRankings.length > 0) {
      const mid = Math.floor((bounds.low + bounds.high) / 2);
      setLowIdx(bounds.low);
      setHighIdx(bounds.high);
      setCurrentMid(mid);
      setComparisonCount(1);
      setStep('showdown');
    } else {
      // No existing places in bracket or empty list
      const recalib = calculateListRecalibration(
        selectedPlace?.google_place_id ?? 'new_place',
        bounds.low,
        existingRankings,
        vibe,
      );
      setFinalScore(recalib.newScore);
      setRecalibratedPlaces(recalib.updatedPlaces);
      setStep('score_reveal');
    }
  };

  // Handle showdown choice
  const handleShowdownChoice = (choice: 'new_better' | 'existing_better' | 'equal') => {
    if (currentMid === null) return;

    const result = stepComparison(choice, currentMid, lowIdx, highIdx);

    if (result.isDone) {
      const recalib = calculateListRecalibration(
        selectedPlace?.google_place_id ?? 'new_place',
        result.insertionIndex,
        existingRankings,
        selectedVibe,
      );
      setFinalScore(recalib.newScore);
      setRecalibratedPlaces(recalib.updatedPlaces);
      setStep('score_reveal');
    } else {
      setLowIdx(result.nextLow);
      setHighIdx(result.nextHigh);
      setCurrentMid(result.nextMid);
      setComparisonCount((c) => c + 1);
    }
  };

  // Projected rank position in existing rankings
  const projectedRank = useMemo(() => {
    let rank = 1;
    for (const r of existingRankings) {
      if (r.rating > finalScore) {
        rank++;
      }
    }
    return rank;
  }, [existingRankings, finalScore]);

  // Handle save
  const handleSave = async (openPost = false) => {
    if (!selectedPlace || saving) return;
    setSaving(true);
    try {
      await onSave({
        google_place_id: selectedPlace.google_place_id,
        mode,
        rating: finalScore,
        vibe: selectedVibe,
        recommend: true,
        notes: '',
        recalibratedPlaces,
      });
      onClose();
      if (openPost) {
        router.push({
          pathname: '/rankings/post',
          params: {
            placeId: selectedPlace.google_place_id,
            name: selectedPlace.display_name,
            category: selectedPlace.primary_type_display_name ?? '',
            address: selectedPlace.formatted_address ?? '',
            rating: finalScore.toFixed(1),
          },
        } as unknown as Href);
      }
    } catch {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              {step === 'select_place' ? (
                <>
                  <ThemedText type="smallBold" themeColor="primary" style={styles.eyebrow}>SELECT PLACE</ThemedText>
                  <ThemedText type="subtitle" style={styles.selectTitle}>
                    {mode === 'food' ? 'Rate a Restaurant' : 'Rate an Activity'}
                  </ThemedText>
                </>
              ) : (
                <ThemedText style={styles.stepTitle}>
                  {step === 'vibe_check' && 'Vibe Check'}
                  {step === 'showdown' && `Showdown Match ${comparisonCount}`}
                  {step === 'score_reveal' && 'Final Score'}
                </ThemedText>
              )}
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <Image source={closeIcon} contentFit="contain" style={styles.closeIcon} />
            </Pressable>
          </View>

          {/* Step 1: Select Place */}
          {step === 'select_place' && (
            <View style={{ flex: 1 }}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search saved or recent places…"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />

              {loadingCandidates ? (
                <View style={styles.centerLoading}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <ThemedText themeColor="textSecondary" style={{ marginTop: 8 }}>
                    Loading places…
                  </ThemedText>
                </View>
              ) : (
                <FlatList
                  data={filteredCandidates}
                  keyExtractor={(item) => item.google_place_id}
                  style={styles.candidateList}
                  contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
                  ListEmptyComponent={
                    <View style={styles.emptyList}>
                      <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
                        {searchQuery.trim()
                          ? 'No matching places found.'
                          : 'No unrated places found. Save places from Discover to rate them here.'}
                      </ThemedText>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handleSelectPlace(item)}
                      style={({ pressed }) => [
                        styles.candidateItem,
                        {
                          backgroundColor: theme.backgroundElement,
                          borderColor: theme.border,
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                          {item.display_name}
                        </ThemedText>
                        {item.primary_type_display_name ? (
                          <ThemedText themeColor="primary" type="small" style={{ marginTop: 2 }}>
                            {item.primary_type_display_name}
                          </ThemedText>
                        ) : null}
                        {item.formatted_address ? (
                          <ThemedText themeColor="textSecondary" type="small" numberOfLines={1}>
                            {item.formatted_address}
                          </ThemedText>
                        ) : null}
                      </View>
                      <ThemedText style={{ fontSize: 18, color: theme.primary }}>→</ThemedText>
                    </Pressable>
                  )}
                />
              )}
            </View>
          )}

          {/* Step 2: Vibe Check */}
          {step === 'vibe_check' && selectedPlace && (
            <View style={styles.stepContent}>
              <RatingPlaceSummary place={selectedPlace} />
              <ThemedText style={styles.prompt}>How was your experience?</ThemedText>
              <View style={styles.vibeGrid}>
                {vibeOptions.map((option) => (
                  <Pressable
                    key={option.key}
                    accessibilityLabel={option.label}
                    accessibilityRole="button"
                    onPress={() => handleSelectVibe(option.key)}
                    style={({ pressed }) => [styles.vibeButton, pressed && styles.pressed]}
                  >
                    <Image source={vibeIcons[option.key]} contentFit="contain" style={styles.vibeIcon} />
                    <ThemedText numberOfLines={1} style={styles.vibeLabel}>{option.label}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Step 3: Showdown Comparison */}
          {step === 'showdown' && selectedPlace && currentMid !== null && existingRankings[currentMid] && (
            <View style={styles.stepContent}>
              <ThemedText style={[styles.prompt, styles.centeredPrompt]}>Which one is better?</ThemedText>
              <View style={styles.showdownRow}>
                <Pressable
                  accessibilityLabel={`${selectedPlace.display_name}, current place`}
                  accessibilityRole="button"
                  onPress={() => handleShowdownChoice('new_better')}
                  style={({ pressed }) => [styles.contenderCard, pressed && styles.pressed]}
                >
                  <ThemedText numberOfLines={2} style={styles.contenderName}>
                    {selectedPlace.display_name}
                  </ThemedText>
                  <ThemedText style={styles.contenderName}>(Current)</ThemedText>
                </Pressable>

                <View style={styles.vsColumn}>
                  <ThemedText style={styles.vsLabel}>vs</ThemedText>
                </View>

                <Pressable
                  accessibilityLabel={`${existingRankings[currentMid].display_name}, rated ${existingRankings[currentMid].rating.toFixed(1)}`}
                  accessibilityRole="button"
                  onPress={() => handleShowdownChoice('existing_better')}
                  style={({ pressed }) => [styles.contenderCard, styles.comparedCard, pressed && styles.pressed]}
                >
                  <ThemedText numberOfLines={2} style={styles.contenderName}>
                    {existingRankings[currentMid].display_name}
                  </ThemedText>
                  <View style={styles.comparedScore}>
                    <ShowdownScore score={existingRankings[currentMid].rating} />
                  </View>
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => handleShowdownChoice('equal')}
                style={({ pressed }) => [styles.equalBtn, pressed && styles.pressed]}
              >
                <ThemedText style={styles.equalLabel}>They’re about the same</ThemedText>
              </Pressable>
            </View>
          )}

          {/* Step 4: Final Score Reveal & Review */}
          {step === 'score_reveal' && selectedPlace && (
            <View style={styles.stepContent}>
              <RatingPlaceSummary place={selectedPlace} />
              <ThemedText style={styles.finalScore}>{finalScore.toFixed(1)}</ThemedText>
              <ThemedText style={styles.rankCopy}>
                Ranked {projectedRank}{projectedRank === 1 ? 'st' : projectedRank === 2 ? 'nd' : projectedRank === 3 ? 'rd' : 'th'} out of {existingRankings.length + 1} in {mode === 'food' ? 'Food' : 'Activities'}
              </ThemedText>
              <View style={styles.finalActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void handleSave()}
                  style={({ pressed }) => [styles.finalButton, (pressed || saving) && styles.pressed]}
                >
                  {saving ? <ActivityIndicator size="small" color="#000000" /> : <ThemedText style={styles.finalButtonLabel}>Save</ThemedText>}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void handleSave(true)}
                  style={({ pressed }) => [styles.finalButton, (pressed || saving) && styles.pressed]}
                >
                  {saving ? <ActivityIndicator size="small" color="#000000" /> : <ThemedText style={styles.finalButtonLabel}>Save &amp; Post</ThemedText>}
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 382,
    maxHeight: '90%',
    padding: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    overflow: 'hidden',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  selectTitle: {
    color: '#000000',
    fontSize: 20,
    lineHeight: 24,
  },
  stepTitle: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
  },
  closeBtn: {
    width: 24,
    height: 24,
    flexShrink: 0,
  },
  closeIcon: { width: 24, height: 24 },
  pressed: { opacity: 0.55 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  centerLoading: {
    padding: 32,
    alignItems: 'center',
  },
  candidateList: {
    maxHeight: 340,
  },
  candidateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  emptyList: {
    padding: 24,
  },
  stepContent: { width: '100%', gap: 10 },
  prompt: { width: '100%', color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15 },
  centeredPrompt: { textAlign: 'center' },
  vibeGrid: {
    height: 78,
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
  },
  vibeButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  vibeIcon: { width: 24, height: 24 },
  vibeLabel: { color: '#000000', fontSize: 10, fontWeight: '600', lineHeight: 12, textAlign: 'center' },
  showdownRow: {
    height: 96,
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
  },
  contenderCard: {
    flex: 4,
    minWidth: 0,
    padding: 10,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparedCard: { gap: 10 },
  contenderName: { color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15, textAlign: 'center' },
  comparedScore: { minHeight: 30, justifyContent: 'center' },
  showdownScore: { minWidth: 45, height: 30, paddingHorizontal: 10, borderWidth: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  showdownScoreText: { fontSize: 12, fontWeight: '400', lineHeight: 15, textAlign: 'center' },
  vsColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsLabel: { color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15, textAlign: 'center' },
  equalBtn: {
    minHeight: 36,
    paddingHorizontal: 40,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  equalLabel: { color: '#000000', fontSize: 12, fontWeight: '600', lineHeight: 15, textAlign: 'center' },
  finalScore: { color: '#000000', fontSize: 40, fontWeight: '100', lineHeight: 48, textAlign: 'center' },
  rankCopy: { width: '100%', color: '#000000', fontSize: 13, fontWeight: '600', lineHeight: 16, textAlign: 'center' },
  finalActions: {
    width: '100%',
    height: 45,
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
  },
  finalButton: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalButtonLabel: { color: '#000000', fontSize: 13, fontWeight: '600', lineHeight: 16, textAlign: 'center' },
});
