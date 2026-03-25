'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';

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
} as const;

const EASING = 'cubic-bezier(0.22,1,0.36,1)';

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
  images: { id: string; url: string; fileName: string; mimeType: string }[];
  author: { id: string; username: string; avatarUrl?: string | null };
  sharedAt: string;
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

export default function CommunityNotebookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const shareId = params.shareId as string;

  const [notebook, setNotebook] = useState<NotebookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyBtnHovered, setCopyBtnHovered] = useState(false);
  const [backBtnHovered, setBackBtnHovered] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  useEffect(() => {
    fetchNotebook();
  }, [fetchNotebook]);

  const handleDownload = async () => {
    if (!notebook || copying) return;
    setCopying(true);
    setCopySuccess(false);
    try {
      const res = await fetch(`/api/notebooks/${notebook.notebookId}/share/copy`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to download');
      setCopySuccess(true);
    } catch {
      setError('Failed to download notebook. Please try again.');
    } finally {
      setCopying(false);
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
        <p style={{ fontSize: 16, fontWeight: 600, color: COLORS.error }}>{error || 'Notebook not found'}</p>
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
            marginBottom: 28,
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

        {/* Description / Blog body */}
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

        {/* Images */}
        {notebook.images.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: notebook.images.length === 1 ? '1fr' : 'repeat(2, 1fr)',
              gap: 12,
              marginBottom: 32,
            }}
          >
            {notebook.images.map((img) => (
              <div
                key={img.id}
                onClick={() => setLightboxImage(img.url)}
                style={{
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: `1px solid ${COLORS.border}`,
                  cursor: 'zoom-in',
                  aspectRatio: notebook.images.length === 1 ? '16/9' : '4/3',
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
        )}

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
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: accentColor }}>
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
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: COLORS.textMuted }}>
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
            boxShadow: copyBtnHovered && !copySuccess
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
      </div>
    </>
  );
}
