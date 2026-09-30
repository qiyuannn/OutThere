import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

interface CommentInputBarProps {
  commentText: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  canSubmit: boolean;
}

export function CommentInputBar({
  commentText,
  onChangeText,
  onSubmit,
  submitting,
  canSubmit,
}: CommentInputBarProps) {
  return (
    <View style={styles.inputBar}>
      <TextInput
        accessibilityLabel="Add a comment"
        maxLength={1000}
        multiline
        onChangeText={onChangeText}
        placeholder="Add a comment..."
        placeholderTextColor="#9CA3AF"
        style={styles.inputField}
        value={commentText}
      />
      <Pressable
        accessibilityLabel="Post comment"
        accessibilityRole="button"
        disabled={!canSubmit || submitting}
        onPress={onSubmit}
        style={({ pressed }) => [
          styles.postBtn,
          canSubmit ? styles.postBtnActive : styles.postBtnDisabled,
          pressed && canSubmit && styles.pressed,
        ]}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <ThemedText
            style={[
              styles.postBtnText,
              canSubmit ? styles.postBtnTextActive : styles.postBtnTextDisabled,
            ]}
          >
            Post
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  inputBar: {
    width: '100%',
    maxWidth: 402,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: '#FFFFFF',
  },
  inputField: {
    flex: 1,
    minHeight: 38,
    maxHeight: 100,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 13,
    lineHeight: 18,
    color: '#000000',
  },
  postBtn: {
    height: 38,
    minWidth: 54,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  postBtnActive: {
    backgroundColor: '#000000',
  },
  postBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  postBtnText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
  },
  postBtnTextActive: {
    color: '#FFFFFF',
  },
  postBtnTextDisabled: {
    color: '#9CA3AF',
  },
  pressed: {
    opacity: 0.55,
  },
});
