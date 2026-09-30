import { Image } from 'expo-image';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useRatePlaceWizard } from '../hooks/use-rate-place-wizard';
import type { CandidatePlace, RankedPlace, RankingMode, SaveRatingInput } from '../types';
import { ScoreRevealStep } from './steps/score-reveal-step';
import { SelectPlaceStep } from './steps/select-place-step';
import { ShowdownStep } from './steps/showdown-step';
import { VibeCheckStep } from './steps/vibe-check-step';

const closeIcon = require('../../../../assets/images/rankings/close.svg');

export interface RatePlaceModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (input: SaveRatingInput) => Promise<void>;
  existingRankings: RankedPlace[];
  mode: RankingMode;
  initialPlace?: CandidatePlace | null;
}

export function RatePlaceModal(props: RatePlaceModalProps) {
  const { visible, onClose, existingRankings, mode } = props;
  const wizard = useRatePlaceWizard(props);

  const comparedPlace =
    wizard.currentMid !== null && existingRankings[wizard.currentMid]
      ? existingRankings[wizard.currentMid]
      : null;

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
              {wizard.step === 'select_place' ? (
                <>
                  <ThemedText type="smallBold" themeColor="primary" style={styles.eyebrow}>
                    SELECT PLACE
                  </ThemedText>
                  <ThemedText type="subtitle" style={styles.selectTitle}>
                    {mode === 'food' ? 'Rate a Restaurant' : 'Rate an Activity'}
                  </ThemedText>
                </>
              ) : (
                <ThemedText style={styles.stepTitle}>
                  {wizard.step === 'vibe_check' && 'Vibe Check'}
                  {wizard.step === 'showdown' && `Showdown Match ${wizard.comparisonCount}`}
                  {wizard.step === 'score_reveal' && 'Final Score'}
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

          {wizard.step === 'select_place' && (
            <SelectPlaceStep
              searchQuery={wizard.searchQuery}
              onSearchChange={wizard.setSearchQuery}
              loading={wizard.loadingCandidates}
              candidates={wizard.filteredCandidates}
              onSelect={wizard.handleSelectPlace}
            />
          )}

          {wizard.step === 'vibe_check' && wizard.selectedPlace && (
            <VibeCheckStep place={wizard.selectedPlace} onSelectVibe={wizard.handleSelectVibe} />
          )}

          {wizard.step === 'showdown' && wizard.selectedPlace && comparedPlace && (
            <ShowdownStep
              selectedPlace={wizard.selectedPlace}
              comparedPlace={comparedPlace}
              onChoice={wizard.handleShowdownChoice}
            />
          )}

          {wizard.step === 'score_reveal' && wizard.selectedPlace && (
            <ScoreRevealStep
              place={wizard.selectedPlace}
              finalScore={wizard.finalScore}
              projectedRank={wizard.projectedRank}
              totalRanked={existingRankings.length + 1}
              mode={mode}
              saving={wizard.saving}
              onSave={(openPost) => void wizard.handleSave(openPost)}
            />
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
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  selectTitle: { color: '#000000', fontSize: 20, lineHeight: 24 },
  stepTitle: { color: '#000000', fontSize: 10, fontWeight: '600', lineHeight: 12 },
  closeBtn: { width: 24, height: 24, flexShrink: 0 },
  closeIcon: { width: 24, height: 24 },
  pressed: { opacity: 0.55 },
});
