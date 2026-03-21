'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string; avatarUrl: string | null };
}

interface CommentSectionProps {
  postId: string;
  commentCount: number;
  expanded?: boolean;
}

const EASING = 'cubic-bezier(0.22,1,0.36,1)';
const MAX_COMMENT = 500;

const COLORS = {
  elevated: '#1d1d33',
  inputBg: '#23233c',
  primary: '#ae89ff',
  deepPurple: '#884efb',
  textPrimary: '#e5e3ff',
  textSecondary: '#aaa8c8',
  textMuted: '#737390',
  error: '#fd6f85',
  border: '#464560',
} as const;

const AVATAR_COLORS = [
  'linear-gradient(135deg, #ae89ff, #884efb)',
  'linear-gradient(135deg, #ff89ae, #fb4e88)',
  'linear-gradient(135deg, #89ffd4, #4efba5)',
  'linear-gradient(135deg, #ffde59, #fbae4e)',
];

function getAvatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  if (hrs < 24) return `${hrs}h`;
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CommentSection({ postId, commentCount, expanded = false }: CommentSectionProps) {
  const { data: session } = useSession();
  const user = session?.user as { id?: string; username?: string; avatarUrl?: string } | undefined;

  const [comments, setComments] = useState<Comment[]>([]);
  const [showAll, setShowAll] = useState(expanded);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [hoveredPostBtn, setHoveredPostBtn] = useState(false);
  const [hoveredViewAll, setHoveredViewAll] = useState(false);
  const [focused, setFocused] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const url = `/api/posts/${postId}/comments?limit=20${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          if (cursor) {
            setComments((prev) => [...prev, ...json.data.comments]);
          } else {
            setComments(json.data.comments);
          }
          setNextCursor(json.data.nextCursor);
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (showAll && comments.length === 0) {
      fetchComments();
    }
  }, [showAll, comments.length, fetchComments]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [commentText]);

  const handlePost = async () => {
    if (!commentText.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          // Optimistic: prepend to list
          setComments((prev) => [json.data, ...prev]);
          setCommentText('');
          if (!showAll) setShowAll(true);
        }
      }
    } catch {
      // silently fail
    } finally {
      setPosting(false);
    }
  };

  const charCount = commentText.length;
  const showCharCount = charCount > 400;
  const isOverLimit = charCount > MAX_COMMENT;
  const canPost = commentText.trim().length > 0 && !isOverLimit && !posting;

  const displayedComments = showAll ? comments : comments.slice(0, 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* View all link */}
      {!showAll && commentCount > 2 && (
        <button
          onClick={() => {
            setShowAll(true);
            if (comments.length === 0) fetchComments();
          }}
          onMouseEnter={() => setHoveredViewAll(true)}
          onMouseLeave={() => setHoveredViewAll(false)}
          style={{
            background: 'none',
            border: 'none',
            color: hoveredViewAll ? COLORS.primary : COLORS.textMuted,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '2px 0',
            textAlign: 'left',
            transition: `color 0.15s ${EASING}`,
          }}
        >
          View all {commentCount} comments
        </button>
      )}

      {/* Comments */}
      {displayedComments.map((comment) => (
        <div key={comment.id} style={{ display: 'flex', gap: 10 }}>
          {/* Avatar */}
          {comment.author.avatarUrl ? (
            <img
              src={comment.author.avatarUrl}
              alt={comment.author.username}
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                objectFit: 'cover',
                flexShrink: 0,
                marginTop: 2,
              }}
            />
          ) : (
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: getAvatarGradient(comment.author.id),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {comment.author.username[0].toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: COLORS.textPrimary,
                }}
              >
                {comment.author.username}
              </span>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                {timeAgo(comment.createdAt)}
              </span>
            </div>
            <div
              style={{
                fontSize: 13,
                color: COLORS.textSecondary,
                lineHeight: 1.5,
                marginTop: 2,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {comment.content}
            </div>
          </div>
        </div>
      ))}

      {/* Load more */}
      {showAll && nextCursor && (
        <button
          onClick={() => fetchComments(nextCursor)}
          disabled={loading}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.textMuted,
            fontSize: 12,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            padding: '4px 0',
            textAlign: 'left',
          }}
        >
          {loading ? 'Loading...' : 'Load more comments'}
        </button>
      )}

      {/* Comment input */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.username || ''}
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: getAvatarGradient(user?.id || ''),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {(user?.username || '?')[0].toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={textareaRef}
            placeholder="Write a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && canPost) {
                e.preventDefault();
                handlePost();
              }
            }}
            rows={1}
            style={{
              width: '100%',
              minHeight: 34,
              maxHeight: 120,
              resize: 'none',
              padding: '7px 70px 7px 12px',
              borderRadius: 10,
              border: `1.5px solid ${focused ? COLORS.primary : COLORS.border}`,
              background: COLORS.inputBg,
              color: COLORS.textPrimary,
              fontSize: 13,
              lineHeight: 1.5,
              outline: 'none',
              fontFamily: 'inherit',
              transition: `border-color 0.2s ${EASING}`,
              boxSizing: 'border-box',
            }}
          />
          {showCharCount && (
            <span
              style={{
                position: 'absolute',
                right: 60,
                bottom: 8,
                fontSize: 10,
                color: isOverLimit ? COLORS.error : COLORS.textMuted,
              }}
            >
              {charCount}/{MAX_COMMENT}
            </span>
          )}
          <button
            onClick={handlePost}
            disabled={!canPost}
            onMouseEnter={() => setHoveredPostBtn(true)}
            onMouseLeave={() => setHoveredPostBtn(false)}
            style={{
              position: 'absolute',
              right: 6,
              bottom: 5,
              padding: '4px 12px',
              borderRadius: 7,
              border: 'none',
              background: canPost
                ? hoveredPostBtn
                  ? COLORS.primary
                  : COLORS.deepPurple
                : 'transparent',
              color: canPost ? '#fff' : COLORS.textMuted,
              fontSize: 11,
              fontWeight: 700,
              cursor: canPost ? 'pointer' : 'default',
              transition: `all 0.15s ${EASING}`,
            }}
          >
            {posting ? '...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
