import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { CommentInputBar } from './components/comment-input-bar';
import { CommentItem } from './components/comment-item';
import { commentsScreenStyles as styles } from './components/comments-screen-styles';
import { FeedItem } from './feed-item';
import { useComments } from './hooks/use-comments';

export default function CommentsScreen() {
  const {
    post,
    comments,
    loading,
    refreshing,
    error,
    commentText,
    setCommentText,
    submitting,
    canSubmit,
    flatListRef,
    currentUserId,
    loadData,
    handleRefresh,
    handleSubmitComment,
    handleDeleteComment,
  } = useComments();

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <AppHeader description="Comments" onBack={() => router.back()} showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardArea}
      >
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator accessibilityLabel="Loading comments" color="#000000" />
          </View>
        ) : error && !post ? (
          <View style={styles.centerState}>
            <ThemedText style={styles.stateTitle}>Couldn’t load comments</ThemedText>
            <ThemedText style={styles.stateBody}>{error}</ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadData()}
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
            >
              <ThemedText style={styles.retryLabel}>Try again</ThemedText>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ListEmptyComponent={(
              <View style={styles.emptyComments}>
                <ThemedText style={styles.emptyCommentsTitle}>No comments yet</ThemedText>
                <ThemedText style={styles.emptyCommentsBody}>
                  Be the first to share your thoughts.
                </ThemedText>
              </View>
            )}
            ListHeaderComponent={(
              <View style={styles.headerContainer}>
                {post ? (
                  <FeedItem disableCommentLink post={post} showActions={false} />
                ) : null}
                <View style={styles.commentsTitleRow}>
                  <ThemedText style={styles.commentsTitle}>Comments</ThemedText>
                </View>
              </View>
            )}
            contentContainerStyle={styles.listContent}
            data={comments}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            ref={flatListRef}
            refreshControl={(
              <RefreshControl
                onRefresh={() => void handleRefresh()}
                refreshing={refreshing}
                tintColor="#000000"
              />
            )}
            renderItem={({ item }) => (
              <CommentItem
                comment={item}
                currentUserId={currentUserId}
                onDelete={handleDeleteComment}
              />
            )}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        )}

        <CommentInputBar
          canSubmit={canSubmit}
          commentText={commentText}
          onChangeText={setCommentText}
          onSubmit={() => void handleSubmitComment()}
          submitting={submitting}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
