import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type AccessibilityActionEvent,
  type PanResponderGestureState,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { RecommendationCard } from './recommendation-card';
import type { DiscoverChoice, Recommendation } from './types';

const DRAG_START = 8;
const SWIPE_DISTANCE = 96;
const FLICK_DISTANCE = 30;
const FLICK_VELOCITY = 0.65;

type Props = {
  place: Recommendation;
  disabled: boolean;
  onChoice: (choice: DiscoverChoice) => void;
  canRewind?: boolean;
  onRewind?: () => void;
};

export function SwipeableRecommendation({ place, disabled, onChoice, canRewind = false, onRewind }: Props) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const position = useRef(new Animated.ValueXY()).current;
  const animating = useRef(false);
  const passedThreshold = useRef(false);

  const resetPosition = useCallback(() => {
    animating.current = false;
    passedThreshold.current = false;
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      speed: 24,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [position]);

  const completeChoice = useCallback((choice: DiscoverChoice) => {
    if (disabled || animating.current) return;
    animating.current = true;

    if (Platform.OS !== 'web') {
      if (choice === 'save') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (choice === 'details') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        void Haptics.selectionAsync();
      }
    }

    const offscreen = width + 160;
    const target = choice === 'pass'
      ? { x: -offscreen, y: 0 }
      : choice === 'details'
        ? { x: offscreen, y: 0 }
        : { x: 0, y: height + 160 };

    Animated.timing(position, {
      toValue: target,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onChoice(choice);
      else resetPosition();
    });
  }, [disabled, height, onChoice, position, resetPosition, width]);

  const finishGesture = useCallback((gesture: PanResponderGestureState) => {
    const horizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.1;
    const left = gesture.dx <= -SWIPE_DISTANCE
      || (gesture.dx <= -FLICK_DISTANCE && gesture.vx <= -FLICK_VELOCITY);
    const right = gesture.dx >= SWIPE_DISTANCE
      || (gesture.dx >= FLICK_DISTANCE && gesture.vx >= FLICK_VELOCITY);
    const down = gesture.dy >= SWIPE_DISTANCE
      || (gesture.dy >= FLICK_DISTANCE && gesture.vy >= FLICK_VELOCITY);

    if (horizontal && left) completeChoice('pass');
    else if (horizontal && right) completeChoice('details');
    else if (!horizontal && down) completeChoice('save');
    else resetPosition();
  }, [completeChoice, resetPosition]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (disabled || animating.current) return false;
      const horizontal = Math.abs(gesture.dx) > DRAG_START
        && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.1;
      const down = gesture.dy > DRAG_START
        && gesture.dy > Math.abs(gesture.dx) * 1.1;
      return horizontal || down;
    },
    onPanResponderGrant: () => position.stopAnimation(),
    onPanResponderMove: (_, gesture) => {
      position.setValue({ x: gesture.dx, y: Math.max(0, gesture.dy) });
      const isOver = Math.abs(gesture.dx) >= SWIPE_DISTANCE || gesture.dy >= SWIPE_DISTANCE;
      if (isOver && !passedThreshold.current) {
        passedThreshold.current = true;
        if (Platform.OS !== 'web') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } else if (!isOver && passedThreshold.current) {
        passedThreshold.current = false;
      }
    },
    onPanResponderRelease: (_, gesture) => finishGesture(gesture),
    onPanResponderTerminate: resetPosition,
    onPanResponderTerminationRequest: () => false,
  }), [disabled, finishGesture, position, resetPosition]);

  useEffect(() => () => position.stopAnimation(), [position]);

  const cardStyle = {
    transform: [
      { translateX: position.x },
      { translateY: position.y },
      {
        rotate: position.x.interpolate({
          inputRange: [-width, 0, width],
          outputRange: ['-10deg', '0deg', '10deg'],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  const nextCardStyle = {
    transform: [
      {
        scale: position.x.interpolate({
          inputRange: [-width, 0, width],
          outputRange: [1, 0.93, 1],
          extrapolate: 'clamp',
        }),
      },
      {
        rotate: position.x.interpolate({
          inputRange: [-width, 0, width],
          outputRange: ['0deg', '-2deg', '0deg'],
          extrapolate: 'clamp',
        }),
      },
    ],
    opacity: position.x.interpolate({
      inputRange: [-width, 0, width],
      outputRange: [0.95, 0.6, 0.95],
      extrapolate: 'clamp',
    }),
  };

  const passOpacity = position.x.interpolate({
    inputRange: [-SWIPE_DISTANCE, -24, 0],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });
  const passScale = position.x.interpolate({
    inputRange: [-SWIPE_DISTANCE, -24, 0],
    outputRange: [1.12, 0.9, 0.8],
    extrapolate: 'clamp',
  });

  const detailsOpacity = position.x.interpolate({
    inputRange: [0, 24, SWIPE_DISTANCE],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });
  const detailsScale = position.x.interpolate({
    inputRange: [0, 24, SWIPE_DISTANCE],
    outputRange: [0.8, 0.9, 1.12],
    extrapolate: 'clamp',
  });

  const saveOpacity = position.y.interpolate({
    inputRange: [0, 24, SWIPE_DISTANCE],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });
  const saveScale = position.y.interpolate({
    inputRange: [0, 24, SWIPE_DISTANCE],
    outputRange: [0.8, 0.9, 1.12],
    extrapolate: 'clamp',
  });

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'pass') completeChoice('pass');
    if (event.nativeEvent.actionName === 'save') completeChoice('save');
    if (event.nativeEvent.actionName === 'details') completeChoice('details');
  };

  return (
    <View style={styles.container}>
      <View style={styles.deck}>
        <View pointerEvents="none" style={styles.cardSlot}>
          <Animated.View style={[styles.nextCard, nextCardStyle, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]} />
        </View>
        <View style={styles.cardSlot}>
          <Animated.View style={[styles.cardMotion, cardStyle]} {...panResponder.panHandlers}>
            <RecommendationCard place={place} />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.choiceBadge,
                styles.passBadge,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.pass,
                  opacity: passOpacity,
                  transform: [{ rotate: '7deg' }, { scale: passScale }],
                },
              ]}
            >
              <ThemedText type="smallBold" style={[styles.choiceText, { color: theme.pass }]}>
                PASS
              </ThemedText>
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.choiceBadge,
                styles.detailsBadge,
                {
                  backgroundColor: theme.accent,
                  borderColor: theme.onAccent,
                  opacity: detailsOpacity,
                  transform: [{ rotate: '-7deg' }, { scale: detailsScale }],
                },
              ]}
            >
              <ThemedText type="smallBold" style={[styles.choiceText, { color: theme.onAccent }]}>
                SAVE &amp; VIEW
              </ThemedText>
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.choiceBadge,
                styles.saveBadge,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.save,
                  opacity: saveOpacity,
                  transform: [{ scale: saveScale }],
                },
              ]}
            >
              <ThemedText type="smallBold" style={[styles.choiceText, { color: theme.save }]}>
                SAVE
              </ThemedText>
            </Animated.View>
          </Animated.View>
        </View>
      </View>

      {/* Floating Action Controls */}
      <View style={styles.actionsBar}>
        <Pressable
          accessibilityLabel="Pass place"
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => completeChoice('pass')}
          style={({ pressed }) => [
            styles.actionButton,
            styles.passActionButton,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            pressed && styles.actionButtonPressed,
          ]}
        >
          <ThemedText style={[styles.actionIconText, { color: theme.textSecondary }]}>✕</ThemedText>
        </Pressable>

        {canRewind && onRewind ? (
          <Pressable
            accessibilityLabel="Rewind passed places"
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.selectionAsync();
              onRewind();
            }}
            style={({ pressed }) => [
              styles.actionButton,
              styles.rewindActionButton,
              { borderColor: theme.border, backgroundColor: theme.backgroundSelected },
              pressed && styles.actionButtonPressed,
            ]}
          >
            <ThemedText style={[styles.actionSmallIcon, { color: theme.text }]}>↺</ThemedText>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityLabel="Save place"
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => completeChoice('save')}
          style={({ pressed }) => [
            styles.actionButton,
            styles.saveActionButton,
            { borderColor: theme.save, backgroundColor: theme.backgroundElement },
            pressed && styles.actionButtonPressed,
          ]}
        >
          <ThemedText style={[styles.actionIconText, { color: theme.save }]}>♡</ThemedText>
        </Pressable>

        <Pressable
          accessibilityLabel="Save and view place details"
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => completeChoice('details')}
          style={({ pressed }) => [
            styles.actionButton,
            styles.detailsActionButton,
            { backgroundColor: theme.primary },
            pressed && styles.actionButtonPressed,
          ]}
        >
          <ThemedText style={[styles.actionIconText, { color: theme.onPrimary }]}>↗</ThemedText>
        </Pressable>
      </View>

      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Choose what to do with ${place.name}`}
        accessibilityHint="Swipe left to pass, down to save, or right to save and view details."
        accessibilityActions={[
          { name: 'pass', label: 'Pass' },
          { name: 'save', label: 'Save' },
          { name: 'details', label: 'Save and view details' },
        ]}
        onAccessibilityAction={handleAccessibilityAction}
        style={[styles.guide, { opacity: disabled ? 0.45 : 1 }]}
      >
        <ThemedText style={[styles.guideText, { color: theme.textSecondary }]}>
          SWIPE LEFT TO PASS   ·   DOWN TO SAVE   ·   RIGHT TO SAVE &amp; VIEW
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, gap: 8 },
  deck: { flex: 1, minHeight: 0 },
  cardSlot: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, paddingTop: 10, paddingBottom: 10, alignItems: 'center', justifyContent: 'center' },
  cardMotion: { flex: 1, width: '92%', maxWidth: 348, maxHeight: 520 },
  nextCard: { flex: 1, width: '92%', maxWidth: 348, maxHeight: 520, borderWidth: 1, borderRadius: 28 },
  choiceBadge: {
    position: 'absolute',
    zIndex: 2,
    borderWidth: 2.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  passBadge: { top: 24, right: 24 },
  detailsBadge: { top: 24, left: 24 },
  saveBadge: { top: 24, alignSelf: 'center' },
  choiceText: { fontSize: 13, lineHeight: 17, letterSpacing: 1.2, fontWeight: '800' },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  actionButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#101820',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  passActionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  rewindActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  saveActionButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  detailsActionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 0,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.88 }],
    opacity: 0.8,
  },
  actionIconText: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
  },
  actionSmallIcon: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  guide: {
    minHeight: 14,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideText: { fontSize: 9.5, lineHeight: 14, fontWeight: '600', letterSpacing: 0.35, textAlign: 'center' },
});
