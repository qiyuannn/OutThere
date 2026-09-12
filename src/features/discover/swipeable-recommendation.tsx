import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
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
};

export function SwipeableRecommendation({ place, disabled, onChoice }: Props) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const position = useRef(new Animated.ValueXY()).current;
  const animating = useRef(false);

  const resetPosition = useCallback(() => {
    animating.current = false;
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      speed: 20,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  }, [position]);

  const completeChoice = useCallback((choice: DiscoverChoice) => {
    if (disabled || animating.current) return;
    animating.current = true;

    const offscreen = width + 160;
    const target = choice === 'pass'
      ? { x: -offscreen, y: 0 }
      : choice === 'save'
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
    else if (horizontal && right) completeChoice('save');
    else if (!horizontal && down) completeChoice('notNow');
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
  const passOpacity = position.x.interpolate({
    inputRange: [-SWIPE_DISTANCE, -24, 0],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });
  const saveOpacity = position.x.interpolate({
    inputRange: [0, 24, SWIPE_DISTANCE],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });
  const notNowOpacity = position.y.interpolate({
    inputRange: [0, 24, SWIPE_DISTANCE],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'pass') completeChoice('pass');
    if (event.nativeEvent.actionName === 'notNow') completeChoice('notNow');
    if (event.nativeEvent.actionName === 'save') completeChoice('save');
  };

  return <View style={styles.container}>
    <Animated.View style={[styles.cardMotion, cardStyle]} {...panResponder.panHandlers}>
      <RecommendationCard place={place} />
      <Animated.View pointerEvents="none" style={[styles.choiceBadge, styles.passBadge, {
        backgroundColor: theme.backgroundElement,
        borderColor: theme.textSecondary,
        opacity: passOpacity,
      }]}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.choiceText}>PASS</ThemedText>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.choiceBadge, styles.saveBadge, {
        backgroundColor: theme.accent,
        borderColor: theme.onAccent,
        opacity: saveOpacity,
      }]}>
        <ThemedText type="smallBold" style={[styles.choiceText, { color: theme.onAccent }]}>LET’S GO</ThemedText>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.choiceBadge, styles.notNowBadge, {
        backgroundColor: theme.backgroundElement,
        borderColor: theme.primary,
        opacity: notNowOpacity,
      }]}>
        <ThemedText type="smallBold" themeColor="primary" style={styles.choiceText}>NOT NOW</ThemedText>
      </Animated.View>
    </Animated.View>

    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Choose what to do with ${place.name}`}
      accessibilityHint="Swipe left to pass, down for not now, or right for let's go."
      accessibilityActions={[
        { name: 'pass', label: 'Pass' },
        { name: 'notNow', label: 'Not now' },
        { name: 'save', label: 'Let’s go' },
      ]}
      onAccessibilityAction={handleAccessibilityAction}
      style={[styles.guide, { opacity: disabled ? 0.45 : 1 }]}
    >
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.guideText}>←  PASS</ThemedText>
      <ThemedText type="smallBold" themeColor="primary" style={styles.guideText}>↓  NOT NOW</ThemedText>
      <ThemedText type="smallBold" themeColor="primary" style={styles.guideText}>LET’S GO  →</ThemedText>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, gap: 12 },
  cardMotion: { flex: 1, minHeight: 0 },
  choiceBadge: {
    position: 'absolute',
    zIndex: 2,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  passBadge: { top: 24, right: 24, transform: [{ rotate: '7deg' }] },
  saveBadge: { top: 24, left: 24, transform: [{ rotate: '-7deg' }] },
  notNowBadge: { top: 24, alignSelf: 'center' },
  choiceText: { fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  guide: {
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    gap: 6,
  },
  guideText: { flex: 1, fontSize: 10, lineHeight: 14, letterSpacing: 0.5, textAlign: 'center' },
});
