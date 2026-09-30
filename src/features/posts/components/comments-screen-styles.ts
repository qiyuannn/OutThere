import { StyleSheet } from 'react-native';

export const commentsScreenStyles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  keyboardArea: {
    flex: 1,
  },
  list: {
    flex: 1,
    width: '100%',
    maxWidth: 402,
    alignSelf: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  headerContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  commentsTitleRow: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  commentsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    lineHeight: 18,
  },
  emptyComments: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyCommentsTitle: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyCommentsBody: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
  },
  centerState: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  stateTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  stateBody: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
  },
  retryBtn: {
    minHeight: 38,
    marginTop: 8,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.55,
  },
});
