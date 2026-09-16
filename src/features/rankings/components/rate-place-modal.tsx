import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { socialRead, invalidateSocial } from '@/features/social/service';
import type { SocialSettings, Visibility } from '@/features/social/types';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';
import {
  calculateListRecalibration,
  computeFinalScore,
  getBracketBounds,
  RecalibratedPlace,
  stepComparison,
  Vibe,
  VIBE_CONFIGS,
} from '../comparison';
import { getCandidatePlaces } from '../service';
import type { CandidatePlace, RankedPlace, RankingMode, SaveRatingInput } from '../types';
import { ScoreBadge } from './score-badge';

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

  // Score & Notes state
  const [finalScore, setFinalScore] = useState<number>(7.8);
  const [recalibratedPlaces, setRecalibratedPlaces] = useState<RecalibratedPlace[]>([]);
  const [recommend, setRecommend] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [socialSettings, setSocialSettings] = useState<SocialSettings | null>(null);
  const [privacyLoaded, setPrivacyLoaded] = useState(false);
  const [privacyError, setPrivacyError] = useState('');

  useEffect(() => {
    let live = true;
    setSocialSettings(null); setPrivacyLoaded(false); setPrivacyError('');
    if (visible && userId) void socialRead<SocialSettings>('settings').then(settings => {
      if (live) { setSocialSettings(settings); setPrivacyLoaded(true); }
    }).catch(() => { if (live) { setPrivacyError('Sharing settings could not load. This rating will stay private.'); setPrivacyLoaded(true); } });
    return () => { live = false; };
  }, [visible, userId]);
  useEffect(() => {
    const existing = existingRankings.find(item => item.google_place_id === selectedPlace?.google_place_id);
    setVisibility(socialSettings?.enabled ? (existing ? existing.social_visibility ?? 'private' : socialSettings.default_visibility) : 'private');
  }, [selectedPlace?.google_place_id, socialSettings, existingRankings]);

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
      setRecommend(true);
      setNotes('');
      setSaveError('');
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
  const handleSave = async () => {
    if (!selectedPlace || saving || !privacyLoaded) return;
    setSaveError('');
    setSaving(true);
    try {
      await onSave({
        google_place_id: selectedPlace.google_place_id,
        mode,
        rating: finalScore,
        vibe: selectedVibe,
        recommend,
        notes,
        social_visibility: visibility,
        recalibratedPlaces,
      });
      invalidateSocial();
      onClose();
    } catch {
      setSaveError('Could not save your rating. Please try again.');
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

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Modal Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" themeColor="primary" style={styles.eyebrow}>
                {step === 'select_place' && 'SELECT PLACE'}
                {step === 'vibe_check' && 'VIBE CHECK'}
                {step === 'showdown' && `SHOWDOWN · MATCH ${comparisonCount}`}
                {step === 'score_reveal' && 'FINAL SCORE & REVIEW'}
              </ThemedText>
              <ThemedText type="subtitle" style={{ fontSize: 20 }}>
                {step === 'select_place' && (mode === 'food' ? 'Rate a Restaurant' : 'Rate an Activity')}
                {step === 'vibe_check' && 'How was your experience?'}
                {step === 'showdown' && 'Which did you like more?'}
                {step === 'score_reveal' && 'Calculated Score'}
              </ThemedText>
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <ThemedText style={{ fontSize: 18, color: theme.textSecondary }}>✕</ThemedText>
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
            <View style={{ gap: 14 }}>
              <View style={[styles.selectedBanner, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {selectedPlace.display_name}
                </ThemedText>
                {selectedPlace.primary_type_display_name ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {selectedPlace.primary_type_display_name}
                  </ThemedText>
                ) : null}
              </View>

              <View style={styles.vibeGrid}>
                {(['loved', 'liked', 'fine', 'disliked'] as const).map((vibeKey) => {
                  const cfg = VIBE_CONFIGS[vibeKey];
                  return (
                    <Pressable
                      key={vibeKey}
                      onPress={() => handleSelectVibe(vibeKey)}
                      style={({ pressed }) => [
                        styles.vibeCard,
                        {
                          backgroundColor: theme.backgroundElement,
                          borderColor: theme.border,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <ThemedText style={styles.vibeIcon}>{cfg.icon}</ThemedText>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="smallBold" style={{ fontSize: 16 }}>
                          {cfg.label}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                          {cfg.description}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Step 3: Showdown Comparison */}
          {step === 'showdown' && selectedPlace && currentMid !== null && existingRankings[currentMid] && (
            <View style={{ gap: 16 }}>
              <ThemedText themeColor="textSecondary" style={{ fontSize: 13 }}>
                Compare this new spot against a place you’ve already rated:
              </ThemedText>

              {/* Showdown Contenders */}
              <View style={styles.showdownRow}>
                {/* New Contender */}
                <Pressable
                  onPress={() => handleShowdownChoice('new_better')}
                  style={({ pressed }) => [
                    styles.contenderCard,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.primary,
                      borderWidth: 2,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <ThemedText style={styles.contenderEmoji}>✨</ThemedText>
                  <ThemedText type="smallBold" numberOfLines={2} style={{ textAlign: 'center' }}>
                    {selectedPlace.display_name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="primary" style={{ marginTop: 4 }}>
                    New Place
                  </ThemedText>
                </Pressable>

                <View style={styles.vsBadge}>
                  <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12 }}>
                    VS
                  </ThemedText>
                </View>

                {/* Existing Contender */}
                <Pressable
                  onPress={() => handleShowdownChoice('existing_better')}
                  style={({ pressed }) => [
                    styles.contenderCard,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.border,
                      borderWidth: 1.5,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <ThemedText style={styles.contenderEmoji}>
                    {existingRankings[currentMid].category_icon ?? '📍'}
                  </ThemedText>
                  <ThemedText type="smallBold" numberOfLines={2} style={{ textAlign: 'center' }}>
                    {existingRankings[currentMid].display_name}
                  </ThemedText>
                  <View style={{ marginTop: 6 }}>
                    <ScoreBadge score={existingRankings[currentMid].rating} size="small" />
                  </View>
                </Pressable>
              </View>

              {/* Tie Option */}
              <Pressable
                onPress={() => handleShowdownChoice('equal')}
                style={({ pressed }) => [
                  styles.equalBtn,
                  {
                    backgroundColor: theme.backgroundSelected,
                    borderColor: theme.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <ThemedText type="smallBold" themeColor="textSecondary">
                  They’re about equal
                </ThemedText>
              </Pressable>
            </View>
          )}

          {/* Step 4: Final Score Reveal & Review */}
          {step === 'score_reveal' && selectedPlace && (
            <ScrollView
              style={{ maxHeight: 460, flexShrink: 1 }}
              contentContainerStyle={{ gap: 14, paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Score Reveal Banner */}
              <View style={[styles.scoreBanner, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold" style={{ fontSize: 16 }}>
                  {selectedPlace.display_name}
                </ThemedText>

                <ScoreBadge score={finalScore} size="large" showLabel />

                <ThemedText type="smallBold" themeColor="primary" style={{ marginTop: 2 }}>
                  Ranks #{projectedRank} of {existingRankings.length + 1} in {mode === 'food' ? 'Food' : 'Activities'}
                </ThemedText>
              </View>

              {/* Recommend Toggle */}
              <View style={styles.recommendRow}>
                <ThemedText type="smallBold" style={{ flex: 1 }}>
                  Would you recommend or return?
                </ThemedText>
                <Pressable
                  onPress={() => setRecommend(!recommend)}
                  style={[
                    styles.recommendBtn,
                    {
                      backgroundColor: recommend ? '#059669' : theme.backgroundSelected,
                    },
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    style={{ color: recommend ? '#fff' : theme.textSecondary }}
                  >
                    {recommend ? '👍 Yes' : '👎 No'}
                  </ThemedText>
                </Pressable>
              </View>

              {/* Notes Input */}
              <View style={{ gap: 6 }}>
                <ThemedText type="small" themeColor="textSecondary">
                  Notes & Highlights (Optional)
                </ThemedText>
                <TextInput
                  maxLength={2000}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="What did you order? What stood out?"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={3}
                  style={[
                    styles.notesInput,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
              </View>

              <View style={{ gap: 10 }}>
                <ThemedText type="smallBold">Who can see this rating and review?</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{privacyError || (!privacyLoaded ? 'Loading privacy settings…' : socialSettings?.enabled ? 'Friends can like and comment on shared ratings.' : 'Only you. Enable your social profile in Profile → Privacy & sharing to share ratings.')}</ThemedText>
                {(['private', 'friends'] as const).map(audience => <Pressable key={audience} accessibilityRole="radio" accessibilityState={{ checked: visibility === audience, disabled: saving || !privacyLoaded || (audience === 'friends' && !socialSettings?.enabled) }} disabled={saving || !privacyLoaded || (audience === 'friends' && !socialSettings?.enabled)} onPress={() => setVisibility(audience)} style={{ padding: 12, minHeight: 44, borderRadius: 12, backgroundColor: theme.backgroundElement, opacity: audience === 'friends' && !socialSettings?.enabled ? 0.4 : 1 }}><ThemedText>{visibility === audience ? '● ' : '○ '}{audience === 'friends' ? 'Friends' : 'Only me'}</ThemedText></Pressable>)}
                {!!saveError && <ThemedText accessibilityRole="alert">{saveError}</ThemedText>}
              </View>
              {/* Save Button */}
              <Pressable
                onPress={handleSave}
                disabled={saving || !privacyLoaded}
                style={({ pressed }) => [
                  styles.saveBtn,
                  {
                    backgroundColor: theme.primary,
                    opacity: saving ? 0.7 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 16 }}>
                    Save to Rankings
                  </ThemedText>
                )}
              </Pressable>
            </ScrollView>
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
    maxWidth: 440,
    height: '90%',
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  closeBtn: {
    padding: 6,
  },
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
  selectedBanner: {
    padding: 12,
    borderRadius: 12,
  },
  vibeGrid: {
    gap: 10,
  },
  vibeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  vibeIcon: {
    fontSize: 30,
  },
  showdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contenderCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 130,
  },
  contenderEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  vsBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  equalBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  scoreBanner: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    gap: 10,
  },
  recommendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  recommendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 6,
  },
});
