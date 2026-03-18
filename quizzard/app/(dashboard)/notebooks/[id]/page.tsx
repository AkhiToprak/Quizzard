'use client';

import { useState, useEffect, use, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface NotebookInfo {
  id: string;
  name: string;
  subject: string | null;
  description: string | null;
  color: string | null;
  updatedAt: string;
}

interface DocumentItem {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getFileIcon(fileType: string): { icon: string; color: string; bg: string } {
  if (fileType.includes('pdf')) return { icon: 'picture_as_pdf', color: '#fd6f85', bg: 'rgba(253,111,133,0.1)' };
  if (fileType.includes('image')) return { icon: 'image', color: '#f0d04c', bg: 'rgba(240,208,76,0.1)' };
  if (fileType.includes('audio')) return { icon: 'audio_file', color: '#ae89ff', bg: 'rgba(174,137,255,0.1)' };
  return { icon: 'description', color: '#b9c3ff', bg: 'rgba(185,195,255,0.1)' };
}

const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'];

export default function NotebookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [notebook, setNotebook] = useState<NotebookInfo | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [redirected, setRedirected] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    const res = await fetch(`/api/notebooks/${id}/documents`);
    const json = await res.json();
    if (json.success) setDocuments(json.data ?? []);
  }, [id]);

  useEffect(() => {
    // Fetch notebook info
    fetch(`/api/notebooks/${id}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setNotebook(j.data); })
      .catch(() => {});

    fetchDocs();

    // Check for existing pages → redirect
    fetch(`/api/notebooks/${id}/sections`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data) {
          for (const section of j.data) {
            if (section.pages && section.pages.length > 0) {
              router.replace(`/notebooks/${id}/pages/${section.pages[0].id}`);
              setRedirected(true);
              return;
            }
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const upload = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Unsupported file type. Allowed: PDF, DOCX, TXT, MD');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 50MB');
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await fetch(`/api/notebooks/${id}/documents`, { method: 'POST', body: fd });
      await fetchDocs();
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  const handleDelete = async (docId: string) => {
    setDeletingId(docId);
    try {
      await fetch(`/api/notebooks/${id}/documents/${docId}`, { method: 'DELETE' });
      await fetchDocs();
    } finally {
      setDeletingId(null);
    }
  };

  if (redirected) return null;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ marginBottom: '48px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Breadcrumb chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {notebook?.subject && (
                <span
                  style={{
                    padding: '4px 12px',
                    background: 'rgba(174,137,255,0.2)',
                    color: '#cdb5ff',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {notebook.subject}
                </span>
              )}
              {notebook?.updatedAt && (
                <>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#464560', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#aaa8c8' }}>
                    Modified {formatDate(notebook.updatedAt)}
                  </span>
                </>
              )}
            </div>

            {/* Notebook name */}
            <h2
              style={{
                fontFamily: '"Shrikhand", serif',
                fontStyle: 'italic',
                fontSize: '52px',
                fontWeight: 400,
                color: '#e5e3ff',
                margin: 0,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
              }}
            >
              {notebook?.name ?? '…'}
            </h2>

            {notebook?.description && (
              <p style={{ fontSize: '16px', color: '#b9c3ff', margin: 0, maxWidth: '560px', lineHeight: '1.6', fontWeight: 500 }}>
                {notebook.description}
              </p>
            )}
          </div>

          {/* Start Chat CTA */}
          <Link
            href={`/ai-chat`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: '#ffde59',
              color: '#5f4f00',
              padding: '16px 32px',
              borderRadius: '16px',
              fontWeight: 900,
              fontSize: '17px',
              textDecoration: 'none',
              boxShadow: '0 8px 24px rgba(255,222,89,0.2)',
              transition: 'transform 0.2s cubic-bezier(0.22,1,0.36,1)',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.02)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'; }}
            onMouseDown={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(0.95)'; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.02)'; }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '22px', fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
            >
              auto_fix_high
            </span>
            Start Chat
          </Link>
        </div>
      </header>

      {/* Bento grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              background: '#1d1d33',
              borderRadius: '24px',
              padding: '32px',
              border: `2px dashed ${isDragging ? '#ae89ff' : 'rgba(70,69,96,0.3)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              minHeight: '280px',
              transition: 'border-color 0.2s cubic-bezier(0.22,1,0.36,1)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(174,137,255,0.5)'; }}
            onMouseLeave={(e) => { if (!isDragging) (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(70,69,96,0.3)'; }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
            />
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'rgba(174,137,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
                transition: 'transform 0.2s cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '36px', color: '#ae89ff' }}>
                {isUploading ? 'hourglass_empty' : 'cloud_upload'}
              </span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#e5e3ff', margin: '0 0 8px' }}>
              {isUploading ? 'Uploading…' : 'Feed the Scholar'}
            </h3>
            <p style={{ fontSize: '13px', color: '#aaa8c8', margin: '0 0 24px', lineHeight: 1.6, padding: '0 16px' }}>
              Drag &amp; drop PDFs, images, or notes here. Our AI will digest the complexity for you.
            </p>
            <span
              style={{
                padding: '6px 16px',
                background: '#23233c',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#737390',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Max file size 50MB
            </span>
            {uploadError && (
              <p style={{ fontSize: '12px', color: '#fd6f85', marginTop: '12px' }}>{uploadError}</p>
            )}
          </div>

          {/* Study Streak card */}
          <div
            style={{
              background: '#121222',
              borderRadius: '24px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#b9c3ff', margin: 0 }}>Study Streak</h4>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '24px',
                  color: '#ffde59',
                  fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                }}
              >
                local_fire_department
              </span>
            </div>
            <div
              style={{
                fontFamily: '"Shrikhand", serif',
                fontStyle: 'italic',
                fontSize: '36px',
                color: '#e5e3ff',
                lineHeight: 1,
              }}
            >
              — Days
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '9999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: '0%',
                  background: 'linear-gradient(90deg, #ae89ff 0%, #ffde59 100%)',
                  borderRadius: '9999px',
                }}
              />
            </div>
            <p style={{ fontSize: '12px', color: '#aaa8c8', margin: 0 }}>
              Start studying to build your streak!
            </p>
          </div>
        </div>

        {/* Right column: Document Vault */}
        <div
          style={{
            background: '#18182a',
            borderRadius: '24px',
            padding: '32px',
          }}
        >
          {/* Vault header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#e5e3ff', margin: 0 }}>Document Vault</h3>
              <span
                style={{
                  padding: '2px 8px',
                  background: '#23233c',
                  color: '#ae89ff',
                  fontSize: '11px',
                  fontWeight: 900,
                  borderRadius: '6px',
                  letterSpacing: '0.04em',
                }}
              >
                {String(documents.length).padStart(2, '0')} FILES
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                style={{
                  padding: '8px',
                  background: 'transparent',
                  border: 'none',
                  color: '#aaa8c8',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#23233c'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>grid_view</span>
              </button>
              <button
                style={{
                  padding: '8px',
                  background: 'rgba(174,137,255,0.1)',
                  border: 'none',
                  color: '#ae89ff',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>list</span>
              </button>
            </div>
          </div>

          {/* Document rows */}
          {documents.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: '#aaa8c8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#464560' }}>folder_open</span>
              <p style={{ fontSize: '14px', margin: 0 }}>No documents yet. Upload files using the zone on the left.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {documents.map((doc) => {
                const { icon, color, bg } = getFileIcon(doc.fileType);
                return (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '16px',
                      background: '#1d1d33',
                      borderRadius: '16px',
                      border: '1px solid transparent',
                      transition: 'background 0.2s cubic-bezier(0.22,1,0.36,1), border-color 0.2s cubic-bezier(0.22,1,0.36,1)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = '#23233c';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(70,69,96,0.2)';
                      const visBtn = (e.currentTarget as HTMLDivElement).querySelector<HTMLButtonElement>('.vis-btn');
                      if (visBtn) visBtn.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = '#1d1d33';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent';
                      const visBtn = (e.currentTarget as HTMLDivElement).querySelector<HTMLButtonElement>('.vis-btn');
                      if (visBtn) visBtn.style.opacity = '0';
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color, fontSize: '22px' }}>{icon}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#e5e3ff',
                          margin: '0 0 2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {doc.fileName}
                      </h4>
                      <p style={{ fontSize: '12px', color: '#aaa8c8', margin: 0 }}>
                        {formatBytes(doc.fileSize)} · Added {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        className="vis-btn"
                        style={{
                          padding: '8px',
                          background: 'transparent',
                          border: 'none',
                          color: '#aaa8c8',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          opacity: 0,
                          transition: 'opacity 0.15s, color 0.15s',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#e5e3ff'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#aaa8c8'; }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>visibility</span>
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        style={{
                          padding: '8px',
                          background: 'transparent',
                          border: 'none',
                          color: '#737390',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#fd6f85'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#737390'; }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                          {deletingId === doc.id ? 'hourglass_empty' : 'delete'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* AI Insight panel */}
          <div
            style={{
              marginTop: '24px',
              padding: '24px',
              background: 'rgba(174,137,255,0.05)',
              borderRadius: '16px',
              border: '1px solid rgba(174,137,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                fontFamily: '"Shrikhand", serif',
                fontStyle: 'italic',
                fontSize: '32px',
                color: '#ae89ff',
                flexShrink: 0,
              }}
            >
              AI Insight
            </div>
            <p style={{ flex: 1, fontSize: '14px', lineHeight: 1.7, color: 'rgba(185,195,255,0.8)', fontWeight: 500, margin: 0, minWidth: '180px' }}>
              {documents.length > 0
                ? <>Based on your {documents.length} document{documents.length !== 1 ? 's' : ''}, I&apos;m ready to help you study. Would you like me to generate a summary?</>
                : 'Upload your first document to get AI-powered insights and study recommendations.'}
            </p>
            {documents.length > 0 && (
              <button
                style={{
                  padding: '10px 20px',
                  background: '#ae89ff',
                  color: '#2a0066',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                  transition: 'transform 0.2s cubic-bezier(0.22,1,0.36,1)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
              >
                Yes, please
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
