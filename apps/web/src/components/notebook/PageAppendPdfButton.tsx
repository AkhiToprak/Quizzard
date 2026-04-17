'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { FileUp, Loader2 } from 'lucide-react';
import { useDirectUpload } from '@/hooks/useDirectUpload';

interface PageAppendPdfButtonProps {
  editor: Editor;
  notebookId: string;
  sectionId: string;
  pageId: string;
}

/**
 * Toolbar button that appends the contents of a PDF (text + embedded
 * images) to the current page. The server extracts and persists images
 * + returns TipTap nodes, which the client inserts at the end of the
 * document so undo/redo and cursor behaviour stay natural.
 */
export default function PageAppendPdfButton({
  editor,
  notebookId,
  sectionId,
  pageId,
}: PageAppendPdfButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload } = useDirectUpload();
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      return;
    }
    setBusy(true);
    try {
      const { storagePath } = await upload(file, 'section-import', {
        notebookId,
        sectionId,
      });
      const res = await fetch(`/api/notebooks/${notebookId}/pages/${pageId}/append-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, fileName: file.name, fileType: file.type }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Append failed (${res.status})`);
      }
      const nodes = json?.data?.nodes as Array<Record<string, unknown>> | undefined;
      if (nodes && nodes.length > 0) {
        editor.chain().focus('end').insertContent(nodes).run();
      }
    } catch {
      // Silent — toast infra is not wired for the toolbar here
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

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
        disabled={busy}
        title="Append PDF to this page"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          border: 'none',
          background: 'transparent',
          color: 'rgba(237,233,255,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: busy ? 'progress' : 'pointer',
          opacity: busy ? 0.35 : 1,
          transition: 'background 0.12s ease, color 0.12s ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!busy) {
            e.currentTarget.style.background = 'rgba(237,233,255,0.08)';
            e.currentTarget.style.color = 'rgba(237,233,255,0.8)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'rgba(237,233,255,0.5)';
        }}
      >
        {busy ? (
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
        ) : (
          <FileUp size={16} />
        )}
      </button>
    </>
  );
}
