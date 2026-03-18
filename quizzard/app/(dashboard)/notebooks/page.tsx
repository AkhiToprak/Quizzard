'use client';

import { useState, useEffect, useCallback } from 'react';
import NotebookCard, { type NotebookData } from '@/components/features/NotebookCard';
import NotebookForm from '@/components/features/NotebookForm';

const FILTER_PILLS = ['All Subjects', 'Science', 'History', 'Languages', 'Literature'];

function SkeletonCard() {
  return (
    <div
      style={{
        background: '#12122a',
        borderRadius: '12px',
        overflow: 'hidden',
        minHeight: '160px',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '8px', background: 'rgba(174,137,255,0.2)' }} />
      <div style={{ padding: '24px 24px 24px 40px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ width: '64px', height: '20px', borderRadius: '9999px', background: 'rgba(229,227,255,0.06)' }} />
        <div style={{ width: '80%', height: '18px', borderRadius: '6px', background: 'rgba(229,227,255,0.08)' }} />
        <div style={{ width: '60%', height: '14px', borderRadius: '5px', background: 'rgba(229,227,255,0.05)' }} />
      </div>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}

export default function NotebooksPage() {
  const [notebooks, setNotebooks] = useState<NotebookData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All Subjects');
  const [showForm, setShowForm] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<NotebookData | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NotebookData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchNotebooks = useCallback(async () => {
    try {
      const res = await fetch('/api/notebooks');
      const json = await res.json();
      if (json.success) setNotebooks(json.data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotebooks();
  }, [fetchNotebooks]);

  const handleCreate = async (data: { name: string; subject: string; description: string; color: string }) => {
    setFormLoading(true);
    try {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) { setShowForm(false); await fetchNotebooks(); }
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (data: { name: string; subject: string; description: string; color: string }) => {
    if (!editingNotebook) return;
    setFormLoading(true);
    try {
      const res = await fetch(`/api/notebooks/${editingNotebook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) { setEditingNotebook(null); setShowForm(false); await fetchNotebooks(); }
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/notebooks/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { setDeleteTarget(null); await fetchNotebooks(); }
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalDocs = notebooks.reduce((s, n) => s + (n._count.documents || 0), 0);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '32px', flexWrap: 'wrap' }}>
        {FILTER_PILLS.map((pill) => {
          const active = pill === activeFilter;
          return (
            <button
              key={pill}
              onClick={() => setActiveFilter(pill)}
              style={{
                padding: '8px 20px',
                borderRadius: '9999px',
                border: 'none',
                background: active ? '#ae89ff' : '#1d1d33',
                color: active ? '#2a0066' : '#aaa8c8',
                fontSize: '14px',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: active ? '0 4px 12px rgba(174,137,255,0.3)' : 'none',
                transition: 'background 0.2s cubic-bezier(0.22,1,0.36,1), color 0.2s cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              {pill}
            </button>
          );
        })}

        {/* New Notebook button — right side */}
        <button
          onClick={() => { setEditingNotebook(null); setShowForm(true); }}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 24px',
            borderRadius: '9999px',
            border: 'none',
            background: '#ae89ff',
            color: '#2a0066',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(174,137,255,0.25)',
            transition: 'transform 0.2s cubic-bezier(0.22,1,0.36,1)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          Add Notebook
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Grid */}
      {!isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {notebooks.map((nb) => (
            <NotebookCard
              key={nb.id}
              notebook={nb}
              onEdit={(n) => { setEditingNotebook(n); setShowForm(true); }}
              onDelete={(n) => setDeleteTarget(n)}
            />
          ))}

          {/* Add card */}
          <div
            onClick={() => { setEditingNotebook(null); setShowForm(true); }}
            style={{
              background: 'rgba(18,18,42,0.5)',
              borderRadius: '12px',
              border: '2px dashed rgba(70,69,96,0.3)',
              minHeight: '160px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.3s cubic-bezier(0.22,1,0.36,1)',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(174,137,255,0.5)';
              const icon = (e.currentTarget as HTMLDivElement).querySelector<HTMLSpanElement>('.add-icon-wrap');
              if (icon) { icon.style.background = 'rgba(174,137,255,0.2)'; icon.style.transform = 'scale(1.1)'; }
              const label = (e.currentTarget as HTMLDivElement).querySelector<HTMLParagraphElement>('.add-label');
              if (label) label.style.color = '#e5e3ff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(70,69,96,0.3)';
              const icon = (e.currentTarget as HTMLDivElement).querySelector<HTMLSpanElement>('.add-icon-wrap');
              if (icon) { icon.style.background = '#18182a'; icon.style.transform = 'scale(1)'; }
              const label = (e.currentTarget as HTMLDivElement).querySelector<HTMLParagraphElement>('.add-label');
              if (label) label.style.color = '#aaa8c8';
            }}
          >
            <span
              className="add-icon-wrap"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#18182a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.3s cubic-bezier(0.22,1,0.36,1), transform 0.3s cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#737390' }}>add</span>
            </span>
            <p className="add-label" style={{ fontWeight: 700, color: '#aaa8c8', margin: '4px 0 0', transition: 'color 0.2s' }}>
              New Subject
            </p>
            <p style={{ fontSize: '12px', color: '#737390', margin: 0, textAlign: 'center', padding: '0 24px' }}>
              Organize your thoughts in a new notebook
            </p>
          </div>
        </div>
      )}

      {/* Stats footer */}
      {!isLoading && (
        <div
          style={{
            marginTop: '48px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '24px',
          }}
        >
          {[
            { icon: 'book_4', color: '#ae89ff', bg: 'rgba(174,137,255,0.1)', value: notebooks.length, label: 'Total Notebooks' },
            { icon: 'article', color: '#ffedb3', bg: 'rgba(255,237,179,0.1)', value: totalDocs, label: 'Active Documents' },
            { icon: 'flash_on', color: '#b9c3ff', bg: 'rgba(185,195,255,0.1)', value: '—', label: 'Mastered Cards' },
          ].map(({ icon, color, bg, value, label }) => (
            <div
              key={label}
              style={{
                background: '#18182a',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ color, fontSize: '24px' }}>{icon}</span>
              </div>
              <div>
                <p style={{ fontSize: '24px', fontWeight: 900, color: '#e5e3ff', margin: '0 0 2px' }}>{value}</p>
                <p style={{ fontSize: '12px', color: '#aaa8c8', margin: 0 }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <NotebookForm
          notebook={editingNotebook}
          onSubmit={editingNotebook ? handleEdit : handleCreate}
          onCancel={() => { setShowForm(false); setEditingNotebook(null); }}
          isLoading={formLoading}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => { if (!deleteLoading) setDeleteTarget(null); }}
        >
          <div
            style={{
              background: '#18182a',
              borderRadius: '20px',
              padding: '32px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
              animation: 'slideUp 0.2s cubic-bezier(0.22,1,0.36,1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`
              @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
            `}</style>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(253,111,133,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <span className="material-symbols-outlined" style={{ color: '#fd6f85', fontSize: '24px' }}>delete</span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#e5e3ff', margin: '0 0 8px' }}>
              Delete &ldquo;{deleteTarget.name}&rdquo;?
            </h3>
            <p style={{ fontSize: '14px', color: '#aaa8c8', margin: '0 0 28px', lineHeight: 1.6 }}>
              This will permanently delete the notebook and all its documents and chat history. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { if (!deleteLoading) setDeleteTarget(null); }}
                disabled={deleteLoading}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  background: '#23233c', border: 'none',
                  fontSize: '14px', fontWeight: 600, color: '#aaa8c8',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  background: deleteLoading ? 'rgba(253,111,133,0.2)' : '#fd6f85',
                  border: 'none', fontSize: '14px', fontWeight: 700,
                  color: deleteLoading ? '#aaa8c8' : '#490013',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { setEditingNotebook(null); setShowForm(true); }}
        title="Quick Note"
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#ffde59',
          border: 'none',
          color: '#5f4f00',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(255,222,89,0.3)',
          zIndex: 50,
          transition: 'transform 0.2s cubic-bezier(0.22,1,0.36,1)',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)'; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'; }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '28px', fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
        >
          edit_note
        </span>
      </button>
    </div>
  );
}
