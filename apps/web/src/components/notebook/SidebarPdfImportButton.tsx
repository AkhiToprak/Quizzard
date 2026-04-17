'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, Loader2 } from 'lucide-react';
import { useDirectUpload } from '@/hooks/useDirectUpload';

interface SidebarPdfImportButtonProps {
  notebookId: string;
  onImported: () => void;
}

/**
 * Top-level "Import PDF" button shown in the notebook sidebar.
 * Creates a new page named after the PDF file and imports its contents
 * (text + embedded images) via the existing section-import endpoint.
 *
 * If the notebook has no sections yet, an "Imports" section is created
 * on the fly so the user does not need to do that manually first.
 */
export default function SidebarPdfImportButton({
  notebookId,
  onImported,
}: SidebarPdfImportButtonProps) {
  const router = useRouter();
  const { upload } = useDirectUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureSectionId = useCallback(async (): Promise<string> => {
    const res = await fetch(`/api/notebooks/${notebookId}/sections`);
    const json = await res.json();
    if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data[0].id as string;
    }
    // Create an "Imports" section on the fly
    const created = await fetch(`/api/notebooks/${notebookId}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Imports' }),
    });
    const createdJson = await created.json();
    if (!createdJson?.success || !createdJson?.data?.id) {
      throw new Error('Could not create a section for the imported PDF');
    }
    return createdJson.data.id as string;
  }, [notebookId]);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are supported here');
        setTimeout(() => setError(null), 3000);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const sectionId = await ensureSectionId();
        const { storagePath } = await upload(file, 'section-import', {
          notebookId,
          sectionId,
        });
        const res = await fetch(
          `/api/notebooks/${notebookId}/sections/${sectionId}/import`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              storagePath,
              fileName: file.name,
              fileType: file.type,
            }),
          }
        );
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || `Import failed (${res.status})`);
        }
        onImported();
        const createdPageId = json?.data?.id;
        if (createdPageId) {
          router.push(`/notebooks/${notebookId}/pages/${createdPageId}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed');
        setTimeout(() => setError(null), 4000);
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [notebookId, upload, ensureSectionId, onImported, router]
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => !busy && inputRef.current?.click()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={busy}
        title="Import PDF as a new page"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '7px 0',
          marginBottom: '6px',
          borderRadius: '6px',
          border: '1px solid rgba(140,82,255,0.25)',
          background: hovered ? 'rgba(140,82,255,0.14)' : 'rgba(140,82,255,0.06)',
          color: hovered ? '#ede9ff' : 'rgba(237,233,255,0.72)',
          fontFamily: 'inherit',
          fontSize: '12px',
          fontWeight: 600,
          cursor: busy ? 'progress' : 'pointer',
          transition: 'background 0.12s ease, color 0.12s ease',
        }}
      >
        {busy ? (
          <>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Importing PDF...
          </>
        ) : (
          <>
            <FileUp size={14} />
            Import PDF
          </>
        )}
      </button>
      {error && (
        <div
          style={{
            marginBottom: '6px',
            padding: '6px 8px',
            fontSize: '11px',
            color: '#fca5a5',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
