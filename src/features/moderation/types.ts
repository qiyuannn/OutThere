export type ModerationStatus = 'open' | 'dismissed' | 'actioned';
export type ModerationResolution = 'dismiss' | 'remove_content' | 'suspend_user';
export interface ModerationReport {
  id: string;
  target_type: 'user' | 'post' | 'comment';
  target_id: string;
  target_author_id: string;
  reason: string;
  details: string;
  context: Record<string, unknown>;
  status: ModerationStatus;
  resolution: ModerationResolution | null;
  moderator_notes: string;
  created_at: string;
  reviewed_at: string | null;
}
