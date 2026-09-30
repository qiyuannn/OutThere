import { StyleSheet } from 'react-native';

export const profileFormStyles = StyleSheet.create({
  onboardingScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  onboardingSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  onboardingContent: {
    width: '100%',
    maxWidth: 402,
    flexGrow: 1,
    alignSelf: 'center',
    gap: 10,
    padding: 10,
  },
  onboardingSpacer: {
    minHeight: 24,
    flexGrow: 1,
  },
  editScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  editContent: {
    width: '100%',
    maxWidth: 720,
    flexGrow: 1,
    alignSelf: 'center',
    gap: 10,
    padding: 10,
  },
  avatarArea: {
    minHeight: 89,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editSpacer: {
    minHeight: 24,
    flexGrow: 1,
  },
  editError: {
    color: '#B42318',
    fontSize: 12,
    lineHeight: 17,
  },
});
