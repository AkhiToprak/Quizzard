'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';

const COLORS = {
  pageBg: '#0d0d1a',
  cardBg: '#121222',
  elevated: '#1d1d33',
  primary: '#ae89ff',
  deepPurple: '#884efb',
  deepPurple2: '#8348f6',
  textPrimary: '#e5e3ff',
  textSecondary: '#aaa8c8',
  textMuted: '#737390',
  error: '#fd6f85',
  success: '#4ade80',
  border: '#464560',
  borderSubtle: '#2a2a44',
  star: '#ffde59',
} as const;

const EASING = 'cubic-bezier(0.22,1,0.36,1)';

const TAG_COLORS = [
  '#ff6b6b',
  '#ffde59',
  '#4ecdc4',
  '#ffb142',
  '#ae89ff',
  '#ff89ae',
  '#63cdff',
  '#48db9c',
];

interface NotebookDetail {
  shareId: string;
  notebookId: string;
  name: string;
  subject?: string | null;
  color?: string | null;
  notebookDescription?: string | null;
  sectionCount: number;
  sections: { id: string; title: string; pageCount: number }[];
  shareType: string;
  visibility: string;
  title?: string | null;
  description?: string | null;
  content?: string | null;
  coverImageUrl?: string | null;
  images: { id: string; url: string; fileName: string; mimeType: string }[];
  author: { id: string; username: string; avatarUrl?: string | null };
  sharedAt: string;
  downloadCount: number;
  ratingCount: number;
  averageRating: number;
  viewCount: number;
  tags: string[];
  userRating: number | null;
  userDownloaded: boolean;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StarRating({
  rating,
  onRate,
  interactive,
}: {
  rating: number;
  onRate?: (value: number) => void;
  interactive: boolean;
}) {
  const [hoverValue, setHoverValue] = useState(0);
  const displayValue = hoverValue || rating;

  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(displayValue);
        return (
          <button
            key={star}
            onClick={() => interactive && onRate?.(star)}
            onMouseEnter={() => interactive && setHoverValue(star)}
            onMouseLeave={() => interactive && setHoverValue(0)}
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              cursor: interactive ? 'pointer' : 'default',
              fontSize: 22,
              color: filled ? COLORS.star : COLORS.border,
              transition: `color 0.1s, transform 0.1s ${EASING}`,
              transform: interactive && hoverValue === star ? 'scale(1.2)' : 'scale(1)',
              lineHeight: 1,
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

interface CommentData {
  id: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  author: { id: string; username: string; avatarUrl?: string | null };
  upvotes: number;
  downvotes: number;
  score: number;
  userVote: number;
  replyCount: number;
}

function CommentInput({
  onSubmit,
  placeholder,
  autoFocus,
  onCancel,
}: {
  onSubmit: (text: string) => Promise<void>;
  placeholder: string;
  autoFocus?: boolean;
  onCancel?: () => void;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit(text.trim());
    setText('');
    setSubmitting(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 1000))}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 10,
          border: `1px solid ${COLORS.borderSubtle}`,
          background: COLORS.elevated,
          color: COLORS.textPrimary,
          fontSize: 13,
          lineHeight: 1.6,
          fontFamily: 'inherit',
          outline: 'none',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
        }}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: COLORS.textMuted, marginRight: 'auto' }}>
          {text.length}/1000
        </span>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: `1px solid ${COLORS.borderSubtle}`,
              background: 'transparent',
              color: COLORS.textSecondary,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          style={{
            padding: '6px 16px',
            borderRadius: 8,
            border: 'none',
            background: text.trim() ? COLORS.primary : COLORS.elevated,
            color: text.trim() ? '#fff' : COLORS.textMuted,
            fontSize: 12,
            fontWeight: 600,
            cursor: text.trim() ? 'pointer' : 'default',
            opacity: submitting ? 0.6 : 1,
            fontFamily: 'inherit',
          }}
        >
          {submitting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  );
}

function VoteButtons({
  score,
  userVote,
  onVote,
}: {
  score: number;
  userVote: number;
  onVote: (value: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <button
        onClick={() => onVote(userVote === 1 ? 0 : 1)}
        style={{
          border: 'none',
          background: 'none',
          padding: '2px 4px',
          cursor: 'pointer',
          color: userVote === 1 ? COLORS.primary : COLORS.textMuted,
          fontSize: 14,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          transition: `color 0.1s ${EASING}`,
        }}
        title="Upvote"
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 16, fontVariationSettings: userVote === 1 ? "'FILL' 1" : "'FILL' 0" }}
        >
          arrow_upward
        </span>
      </button>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          minWidth: 20,
          textAlign: 'center',
          color: score > 0 ? COLORS.primary : score < 0 ? COLORS.error : COLORS.textMuted,
        }}
      >
        {score}
      </span>
      <button
        onClick={() => onVote(userVote === -1 ? 0 : -1)}
        style={{
          border: 'none',
          background: 'none',
          padding: '2px 4px',
          cursor: 'pointer',
          color: userVote === -1 ? COLORS.error : COLORS.textMuted,
          fontSize: 14,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          transition: `color 0.1s ${EASING}`,
        }}
        title="Downvote"
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 16, fontVariationSettings: userVote === -1 ? "'FILL' 1" : "'FILL' 0" }}
        >
          arrow_downward
        </span>
      </button>
    </div>
  );
}

function CommentThread({
  comment,
  allComments,
  depth,
  shareId,
  onCommentAdded,
  onVoteUpdate,
}: {
  comment: CommentData;
  allComments: CommentData[];
  depth: number;
  shareId: string;
  onCommentAdded: (c: CommentData) => void;
  onVoteUpdate: (
    commentId: string,
    data: { score: number; userVote: number; upvotes: number; downvotes: number }
  ) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [hovered, setHovered] = useState(false);

  const replies = allComments.filter((c) => c.parentCommentId === comment.id);
  const maxDepth = 4;
  const effectiveDepth = Math.min(depth, maxDepth);

  const handleReply = async (text: string) => {
    const res = await fetch(`/api/community/notebooks/${shareId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, parentCommentId: comment.id }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        onCommentAdded(json.data);
        setShowReply(false);
        setCollapsed(false);
      }
    }
  };

  const handleVote = async (value: number) => {
    const res = await fetch(`/api/community/notebooks/${shareId}/comments/${comment.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        onVoteUpdate(comment.id, json.data);
      }
    }
  };

  return (
    <div style={{ marginLeft: effectiveDepth > 0 ? 20 : 0 }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          gap: 10,
          padding: '10px 0',
        }}
      >
        {/* Collapse bar */}
        {replies.length > 0 && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: 2,
              minHeight: '100%',
              padding: 0,
              border: 'none',
              cursor: 'pointer',
              background: collapsed
                ? COLORS.primary
                : hovered
                  ? COLORS.textMuted
                  : COLORS.borderSubtle,
              borderRadius: 1,
              flexShrink: 0,
              transition: `background 0.15s ${EASING}`,
            }}
            title={collapsed ? 'Expand thread' : 'Collapse thread'}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {comment.author.avatarUrl ? (
              <Image
                src={comment.author.avatarUrl}
                alt={comment.author.username}
                width={22}
                height={22}
                style={{ borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.deepPurple})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {comment.author.username.charAt(0).toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
              {comment.author.username}
            </span>
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>
              {timeAgo(comment.createdAt)}
            </span>
          </div>

          {/* Content */}
          {!collapsed && (
            <>
              <p
                style={{
                  margin: '0 0 6px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: COLORS.textSecondary,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {comment.content}
              </p>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <VoteButtons
                  score={comment.score}
                  userVote={comment.userVote}
                  onVote={handleVote}
                />
                <button
                  onClick={() => setShowReply(!showReply)}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    color: showReply ? COLORS.primary : COLORS.textMuted,
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: `color 0.1s ${EASING}`,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    reply
                  </span>
                  Reply
                </button>
                {replies.length > 0 && collapsed && (
                  <button
                    onClick={() => setCollapsed(false)}
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      color: COLORS.primary,
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: 'inherit',
                    }}
                  >
                    {replies.length} repl{replies.length === 1 ? 'y' : 'ies'}
                  </button>
                )}
              </div>

              {/* Reply input */}
              {showReply && (
                <div style={{ marginTop: 8 }}>
                  <CommentInput
                    onSubmit={handleReply}
                    placeholder={`Reply to ${comment.author.username}...`}
                    autoFocus
                    onCancel={() => setShowReply(false)}
                  />
                </div>
              )}
            </>
          )}

          {/* Collapsed indicator */}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              style={{
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
                color: COLORS.primary,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'inherit',
              }}
            >
              Show {replies.length} repl{replies.length === 1 ? 'y' : 'ies'}
            </button>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {!collapsed && replies.length > 0 && (
        <div>
          {replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              allComments={allComments}
              depth={depth + 1}
              shareId={shareId}
              onCommentAdded={onCommentAdded}
              onVoteUpdate={onVoteUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentSection({ shareId }: { shareId: string }) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/community/notebooks/${shareId}/comments`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setComments(json.data.comments);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleNewComment = async (text: string) => {
    const res = await fetch(`/api/community/notebooks/${shareId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        setComments((prev) => [...prev, json.data]);
      }
    }
  };

  const handleCommentAdded = (c: CommentData) => {
    setComments((prev) => [...prev, c]);
  };

  const handleVoteUpdate = (
    commentId: string,
    data: { score: number; userVote: number; upvotes: number; downvotes: number }
  ) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              score: data.score,
              userVote: data.userVote,
              upvotes: data.upvotes,
              downvotes: data.downvotes,
            }
          : c
      )
    );
  };

  const rootComments = comments.filter((c) => !c.parentCommentId);
  const commentCount = comments.length;

  return (
    <div
      style={{
        background: COLORS.cardBg,
        borderRadius: 16,
        border: `1px solid ${COLORS.border}`,
        overflow: 'hidden',
        marginBottom: 28,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 24px',
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: COLORS.primary }}>
          chat_bubble
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary }}>Comments</span>
        <span style={{ fontSize: 12, color: COLORS.textMuted, marginLeft: 'auto' }}>
          {commentCount} comment{commentCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ padding: '16px 24px' }}>
        {/* New comment input */}
        <CommentInput onSubmit={handleNewComment} placeholder="Write a comment..." />

        {/* Comments list */}
        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 24, color: COLORS.primary, animation: 'spin 1s linear infinite' }}
            >
              progress_activity
            </span>
          </div>
        ) : rootComments.length === 0 ? (
          <div
            style={{
              padding: '24px 0',
              textAlign: 'center',
              color: COLORS.textMuted,
              fontSize: 13,
            }}
          >
            No comments yet. Be the first to comment!
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            {rootComments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                allComments={comments}
                depth={0}
                shareId={shareId}
                onCommentAdded={handleCommentAdded}
                onVoteUpdate={handleVoteUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommunityNotebookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const shareId = params.shareId as string;

  const [notebook, setNotebook] = useState<NotebookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyBtnHovered, setCopyBtnHovered] = useState(false);
  const [backBtnHovered, setBackBtnHovered] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isAuthor = session?.user?.id && notebook?.author?.id === session.user.id;

  const handleDelete = async () => {
    if (!notebook || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/community/notebooks/${shareId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/home');
      } else {
        setError('Failed to delete publication.');
      }
    } catch {
      setError('Failed to delete publication.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const fetchNotebook = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/community/notebooks/${shareId}`);
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'Notebook not found' : 'Failed to load notebook');
      }
      const json = await res.json();
      if (!json.success) throw new Error('Failed to load notebook');
      setNotebook(json.data);
      setUserRating(json.data.userRating);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  useEffect(() => {
    fetchNotebook();
  }, [fetchNotebook]);

  // Track view
  useEffect(() => {
    if (shareId) {
      fetch(`/api/community/notebooks/${shareId}/view`, { method: 'POST' }).catch(() => {});
    }
  }, [shareId]);

  const handleDownload = async () => {
    if (!notebook || copying) return;
    setCopying(true);
    setCopySuccess(false);
    try {
      // Record download via the new endpoint
      await fetch(`/api/community/notebooks/${shareId}/download`, { method: 'POST' });
      // Also copy the notebook
      const res = await fetch(`/api/notebooks/${notebook.notebookId}/share/copy`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to download');
      setCopySuccess(true);
      setNotebook((prev) =>
        prev
          ? {
              ...prev,
              downloadCount: prev.downloadCount + (prev.userDownloaded ? 0 : 1),
              userDownloaded: true,
            }
          : prev
      );
    } catch {
      setError('Failed to download notebook. Please try again.');
    } finally {
      setCopying(false);
    }
  };

  const handleRate = async (value: number) => {
    if (!notebook || ratingSubmitting) return;
    setRatingSubmitting(true);
    try {
      const res = await fetch(`/api/community/notebooks/${shareId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setUserRating(value);
          setNotebook((prev) =>
            prev
              ? {
                  ...prev,
                  averageRating: json.data.averageRating,
                  ratingCount: json.data.ratingCount,
                }
              : prev
          );
        }
      }
    } catch {
      // silent fail
    } finally {
      setRatingSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: COLORS.pageBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 32, color: COLORS.primary, animation: 'spin 1s linear infinite' }}
        >
          progress_activity
        </span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !notebook) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: COLORS.pageBg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: COLORS.textPrimary,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: COLORS.error }}>
          error_outline
        </span>
        <p style={{ fontSize: 16, fontWeight: 600, color: COLORS.error }}>
          {error || 'Notebook not found'}
        </p>
        <button
          onClick={() => router.push('/home')}
          style={{
            padding: '10px 24px',
            borderRadius: 12,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.elevated,
            color: COLORS.textPrimary,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Back to Home
        </button>
      </div>
    );
  }

  const displayTitle = notebook.title || notebook.name;
  const accentColor = notebook.color || COLORS.primary;

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .rich-content h2 { font-size: 22px; font-weight: 700; color: ${COLORS.textPrimary}; margin: 24px 0 12px; }
        .rich-content h3 { font-size: 18px; font-weight: 600; color: ${COLORS.textPrimary}; margin: 20px 0 10px; }
        .rich-content p { margin: 0 0 12px; }
        .rich-content ul, .rich-content ol { padding-left: 24px; margin: 0 0 12px; }
        .rich-content li { margin-bottom: 4px; }
        .rich-content blockquote { border-left: 3px solid ${COLORS.primary}; padding-left: 16px; margin: 16px 0; color: ${COLORS.textSecondary}; font-style: italic; }
        .rich-content pre { background: ${COLORS.elevated}; border-radius: 8px; padding: 16px; overflow-x: auto; margin: 16px 0; }
        .rich-content code { font-family: 'SF Mono', Monaco, monospace; font-size: 13px; }
        .rich-content img { max-width: 100%; border-radius: 8px; margin: 12px 0; }
      `}</style>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
            padding: 24,
          }}
        >
          <img
            src={lightboxImage}
            alt=""
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: 12,
              objectFit: 'contain',
            }}
          />
        </div>
      )}

      <div
        style={{
          maxWidth: 800,
          margin: '0 auto',
          padding: '32px 24px 64px',
          animation: 'fadeIn 0.4s ease-out',
        }}
      >
        {/* Back button */}
        <button
          onClick={() => router.back()}
          onMouseEnter={() => setBackBtnHovered(true)}
          onMouseLeave={() => setBackBtnHovered(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 10,
            border: 'none',
            background: backBtnHovered ? COLORS.elevated : 'transparent',
            color: backBtnHovered ? COLORS.textPrimary : COLORS.textMuted,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: `all 0.2s ${EASING}`,
            marginBottom: 24,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            arrow_back
          </span>
          Back
        </button>

        {/* Color accent bar */}
        <div
          style={{
            height: 4,
            width: 80,
            borderRadius: 2,
            background: accentColor,
            marginBottom: 24,
          }}
        />

        {/* Title */}
        <h1
          style={{
            margin: '0 0 12px',
            fontSize: 32,
            fontWeight: 800,
            color: COLORS.textPrimary,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
          }}
        >
          {displayTitle}
        </h1>

        {/* Meta row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 16,
            marginBottom: 20,
          }}
        >
          {/* Author */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {notebook.author.avatarUrl ? (
              <Image
                src={notebook.author.avatarUrl}
                alt={notebook.author.username}
                width={28}
                height={28}
                style={{ borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.deepPurple})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fff',
                }}
              >
                {notebook.author.username.charAt(0).toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: 14, color: COLORS.textSecondary, fontWeight: 500 }}>
              {notebook.author.username}
            </span>
          </div>

          <span style={{ color: COLORS.border }}>·</span>
          <span style={{ fontSize: 13, color: COLORS.textMuted }}>
            {timeAgo(notebook.sharedAt)}
          </span>

          {notebook.subject && (
            <>
              <span style={{ color: COLORS.border }}>·</span>
              <span
                style={{
                  padding: '2px 10px',
                  background: 'rgba(174,137,255,0.12)',
                  color: COLORS.primary,
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                }}
              >
                {notebook.subject}
              </span>
            </>
          )}
        </div>

        {/* Metrics bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 20,
            marginBottom: 28,
            padding: '14px 20px',
            background: COLORS.cardBg,
            borderRadius: 12,
            border: `1px solid ${COLORS.borderSubtle}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18, color: COLORS.textMuted }}
            >
              visibility
            </span>
            <span style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: 500 }}>
              {notebook.viewCount} viewer{notebook.viewCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18, color: COLORS.textMuted }}
            >
              download
            </span>
            <span style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: 500 }}>
              {notebook.downloadCount} download{notebook.downloadCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, color: COLORS.star }}>★</span>
            <span style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: 500 }}>
              {notebook.averageRating > 0 ? notebook.averageRating.toFixed(1) : '—'}
            </span>
            <span style={{ fontSize: 12, color: COLORS.textMuted }}>
              ({notebook.ratingCount} rating{notebook.ratingCount !== 1 ? 's' : ''})
            </span>
          </div>
        </div>

        {/* Tags */}
        {notebook.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
            {notebook.tags.map((tag, i) => {
              const color = TAG_COLORS[i % TAG_COLORS.length];
              const isHovered = hoveredTag === tag;
              return (
                <Link
                  key={tag}
                  href={`/community?tag=${encodeURIComponent(tag)}`}
                  onMouseEnter={() => setHoveredTag(tag)}
                  onMouseLeave={() => setHoveredTag(null)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 8,
                    background: isHovered ? `${color}22` : `${color}11`,
                    color: color,
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: `background 0.15s ${EASING}, transform 0.15s ${EASING}`,
                    transform: isHovered ? 'translateY(-1px)' : 'none',
                  }}
                >
                  #{tag}
                </Link>
              );
            })}
          </div>
        )}

        {/* Cover image */}
        {notebook.coverImageUrl && (
          <div
            style={{
              borderRadius: 14,
              overflow: 'hidden',
              border: `1px solid ${COLORS.border}`,
              marginBottom: 28,
            }}
          >
            <img
              src={notebook.coverImageUrl}
              alt={`Cover for ${displayTitle}`}
              style={{
                width: '100%',
                maxHeight: 400,
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* Description */}
        {notebook.description && (
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: COLORS.textSecondary,
              whiteSpace: 'pre-wrap',
              marginBottom: 32,
            }}
          >
            {notebook.description}
          </div>
        )}

        {/* Rich content */}
        {notebook.content && (
          <div
            className="rich-content"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notebook.content) }}
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: COLORS.textSecondary,
              marginBottom: 32,
            }}
          />
        )}

        {/* Images (exclude cover image — inline images are embedded in content) */}
        {(() => {
          const nonCoverImages = notebook.images.filter(
            (img) => img.url !== notebook.coverImageUrl
          );
          if (nonCoverImages.length === 0) return null;
          return (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: nonCoverImages.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                gap: 12,
                marginBottom: 32,
              }}
            >
              {nonCoverImages.map((img) => (
                <div
                  key={img.id}
                  onClick={() => setLightboxImage(img.url)}
                  style={{
                    borderRadius: 14,
                    overflow: 'hidden',
                    border: `1px solid ${COLORS.border}`,
                    cursor: 'zoom-in',
                    aspectRatio: nonCoverImages.length === 1 ? '16/9' : '4/3',
                    position: 'relative',
                  }}
                >
                  <img
                    src={img.url}
                    alt={img.fileName}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              ))}
            </div>
          );
        })()}

        {/* Notebook contents card */}
        <div
          style={{
            background: COLORS.cardBg,
            borderRadius: 16,
            border: `1px solid ${COLORS.border}`,
            overflow: 'hidden',
            marginBottom: 28,
          }}
        >
          {/* Card header */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: `1px solid ${COLORS.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20, color: accentColor }}
            >
              menu_book
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary }}>
              Notebook Contents
            </span>
            <span style={{ fontSize: 12, color: COLORS.textMuted, marginLeft: 'auto' }}>
              {notebook.sectionCount} section{notebook.sectionCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Sections list */}
          <div style={{ padding: '8px 0' }}>
            {notebook.sections.map((section) => (
              <div
                key={section.id}
                style={{
                  padding: '10px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18, color: COLORS.textMuted }}
                >
                  folder
                </span>
                <span style={{ fontSize: 14, color: COLORS.textPrimary, fontWeight: 500 }}>
                  {section.title}
                </span>
                <span style={{ fontSize: 12, color: COLORS.textMuted, marginLeft: 'auto' }}>
                  {section.pageCount} page{section.pageCount !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
            {notebook.sections.length === 0 && (
              <div style={{ padding: '16px 24px', fontSize: 13, color: COLORS.textMuted }}>
                No sections
              </div>
            )}
          </div>
        </div>

        {/* Rating section */}
        <div
          style={{
            background: COLORS.cardBg,
            borderRadius: 16,
            border: `1px solid ${COLORS.border}`,
            padding: '20px 24px',
            marginBottom: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div
              style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 4 }}
            >
              {userRating ? 'Your Rating' : 'Rate this notebook'}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>
              {userRating
                ? 'Click a star to update your rating'
                : 'Help others discover great notebooks'}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              opacity: ratingSubmitting ? 0.5 : 1,
            }}
          >
            <StarRating
              rating={userRating || 0}
              onRate={handleRate}
              interactive={!ratingSubmitting}
            />
            {userRating && (
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>({userRating}/5)</span>
            )}
          </div>
        </div>

        {/* Comments */}
        <CommentSection shareId={shareId} />

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={copying || copySuccess}
          onMouseEnter={() => setCopyBtnHovered(true)}
          onMouseLeave={() => setCopyBtnHovered(false)}
          style={{
            width: '100%',
            padding: '16px 24px',
            borderRadius: 14,
            border: 'none',
            background: copySuccess
              ? COLORS.success
              : copyBtnHovered
                ? `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.deepPurple2})`
                : `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.deepPurple})`,
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: copying ? 'wait' : copySuccess ? 'default' : 'pointer',
            opacity: copying ? 0.7 : 1,
            transition: `all 0.25s ${EASING}`,
            transform: copyBtnHovered && !copying && !copySuccess ? 'translateY(-2px)' : 'none',
            boxShadow:
              copyBtnHovered && !copySuccess
                ? '0 12px 32px rgba(174,137,255,0.3)'
                : '0 6px 20px rgba(174,137,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontFamily: 'inherit',
          }}
        >
          {copySuccess ? (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                check_circle
              </span>
              Added to your notebooks!
            </>
          ) : copying ? (
            <>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 22, animation: 'spin 1s linear infinite' }}
              >
                progress_activity
              </span>
              Downloading...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                download
              </span>
              Download Notebook
            </>
          )}
        </button>

        {copySuccess && (
          <p
            style={{
              textAlign: 'center',
              fontSize: 13,
              color: COLORS.textMuted,
              marginTop: 12,
            }}
          >
            The notebook with all its sections and pages has been added to your notebooks.
          </p>
        )}

        {/* Delete button — only visible to the author */}
        {isAuthor && (
          <div
            style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${COLORS.borderSubtle}` }}
          >
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: `1px solid ${COLORS.borderSubtle}`,
                  background: 'transparent',
                  color: COLORS.textMuted,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: `color 0.15s ${EASING}, border-color 0.15s ${EASING}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = COLORS.error;
                  e.currentTarget.style.borderColor = COLORS.error;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = COLORS.textMuted;
                  e.currentTarget.style.borderColor = COLORS.borderSubtle;
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  delete
                </span>
                Delete Publication
              </button>
            ) : (
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  background: 'rgba(253,111,133,0.08)',
                  border: `1px solid rgba(253,111,133,0.2)`,
                }}
              >
                <p
                  style={{ margin: '0 0 12px', fontSize: 13, color: COLORS.error, fontWeight: 600 }}
                >
                  Are you sure? This will remove the publication from the community. Your notebook
                  will not be affected.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 8,
                      border: 'none',
                      background: COLORS.error,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: deleting ? 'wait' : 'pointer',
                      opacity: deleting ? 0.7 : 1,
                      fontFamily: 'inherit',
                    }}
                  >
                    {deleting ? 'Deleting...' : 'Yes, delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 8,
                      border: `1px solid ${COLORS.borderSubtle}`,
                      background: 'transparent',
                      color: COLORS.textSecondary,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
