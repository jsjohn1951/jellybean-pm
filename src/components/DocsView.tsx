import React, { useEffect, useRef, useState } from 'react';
import { Plus, Paperclip, BookOpen } from 'lucide-react';
import { T } from '../lib/theme';
import { useDocs, type Doc } from '../hooks/useDocs';
import { useDocCategories } from '../hooks/useDocCategories';
import { useMutation } from '../lib/mutation-context';
import { useToast } from '../lib/toast';
import DocModal from './DocModal';
import DocPreviewModal from './DocPreviewModal';

interface Props {
  projectSlug: string;
  userLogin: string;
}

type ModalState = 'create' | null;

// ── Doc Card ──────────────────────────────────────────────────────────────────

function DocCard({ doc, onClick }: { doc: Doc; onClick: () => void }) {
  const excerpt = doc.body.length > 100 ? doc.body.slice(0, 100) + '…' : doc.body;
  return (
    <div
      onClick={onClick}
      style={{
        background: T.bgCard, border: `1px solid ${T.borderSubtle}`, borderRadius: '8px',
        padding: '14px', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ color: T.textPrimary, fontSize: '13px', fontWeight: 600, lineHeight: 1.3 }}>{doc.title}</span>
        {doc.attachmentName && <Paperclip size={12} color={T.textMuted} style={{ flexShrink: 0, marginTop: 1 }} />}
      </div>
      {doc.category && (
        <span style={{ alignSelf: 'flex-start', background: T.bgInput, color: T.textSecond, borderRadius: '10px', padding: '2px 8px', fontSize: '10px', fontWeight: 600 }}>
          {doc.category}
        </span>
      )}
      {excerpt && (
        <p style={{ color: T.textFaint, fontSize: '12px', margin: 0, lineHeight: 1.5 }}>{excerpt}</p>
      )}
    </div>
  );
}

// ── DocsView ──────────────────────────────────────────────────────────────────

export default function DocsView({ projectSlug, userLogin }: Props) {
  const { docs, mutate } = useDocs(projectSlug);
  const { categories, mutate: mutateCats } = useDocCategories(projectSlug);
  const { withMutation } = useMutation();
  const { toasts, show, dismiss } = useToast();

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [modal, setModal] = useState<ModalState>(null);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const catInputRef = useRef<HTMLInputElement>(null);

  // Reset filter if active category is removed
  useEffect(() => {
    if (activeCategory !== 'All' && !categories.includes(activeCategory)) {
      setActiveCategory('All');
    }
  }, [categories, activeCategory]);

  const filtered = activeCategory === 'All' ? docs : docs.filter(d => d.category === activeCategory);

  async function addCategory() {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) { show('Category already exists', 'error'); return; }
    await withMutation(async () => {
      const next = [...categories, trimmed];
      const res = await fetch(`/api/jellybean/data/projects/${projectSlug}/doc-categories`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) { show('Failed to add category', 'error'); return; }
      await mutateCats();
      setNewCat('');
      setAddingCat(false);
    });
  }

  const pillBase: React.CSSProperties = {
    padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
    cursor: 'pointer', border: '1px solid transparent', userSelect: 'none', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bgPage }}>
      {/* Top bar */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.borderSubtle}`, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
          <BookOpen size={13} color={T.textMuted} style={{ flexShrink: 0 }} />

          {/* All pill */}
          <span
            onClick={() => setActiveCategory('All')}
            style={{ ...pillBase, background: activeCategory === 'All' ? T.accent : T.bgInput, color: activeCategory === 'All' ? '#fff' : T.textSecond, border: `1px solid ${activeCategory === 'All' ? T.accent : T.bgInput}` }}
          >
            All
          </span>

          {/* Category pills */}
          {categories.map(c => (
            <span
              key={c}
              onClick={() => setActiveCategory(c)}
              style={{ ...pillBase, background: activeCategory === c ? T.accentBg : T.bgInput, color: activeCategory === c ? T.accentText : T.textSecond, border: `1px solid ${activeCategory === c ? T.accent : T.bgInput}` }}
            >
              {c}
            </span>
          ))}

          {/* Add category */}
          {addingCat ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <input
                ref={catInputRef}
                autoFocus
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void addCategory(); if (e.key === 'Escape') { setAddingCat(false); setNewCat(''); } }}
                placeholder="Category name…"
                style={{ background: T.bgInput, border: `1px solid ${T.borderMuted}`, color: T.textPrimary, borderRadius: '10px', padding: '2px 8px', fontSize: '11px', width: '120px' }}
              />
              <button onClick={() => void addCategory()} style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: '8px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}>Add</button>
              <button onClick={() => { setAddingCat(false); setNewCat(''); }} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>×</button>
            </span>
          ) : (
            <button
              onClick={() => setAddingCat(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'none', border: `1px dashed ${T.borderMuted}`, color: T.textMuted, borderRadius: '12px', padding: '3px 10px', fontSize: '11px', cursor: 'pointer' }}
            >
              <Plus size={10} /> Add category
            </button>
          )}
        </div>

        <button
          onClick={() => setModal('create')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: T.accent, border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          <Plus size={13} /> New Doc
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {docs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <p style={{ color: T.textFaint, fontSize: '13px', margin: '0 0 16px' }}>No documents yet — create one to get started</p>
            <button
              onClick={() => setModal('create')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: T.accent, border: 'none', color: '#fff', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={14} /> New Doc
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ color: T.textFaint, fontSize: '13px', padding: '48px 16px', textAlign: 'center', margin: 0 }}>No documents in this category</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {filtered.map(doc => (
              <DocCard key={doc.id} doc={doc} onClick={() => setPreviewDoc(doc)} />
            ))}
          </div>
        )}
      </div>

      {modal === 'create' && (
        <DocModal
          projectSlug={projectSlug}
          userLogin={userLogin}
          doc={null}
          categories={categories}
          mutate={mutate}
          onClose={() => setModal(null)}
        />
      )}
      <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />

      {/* Toast notifications */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map(t => (
          <div key={t.id} onClick={() => dismiss(t.id)} style={{ background: t.type === 'error' ? T.dangerBg : T.accentBg, border: `1px solid ${t.type === 'error' ? '#7f1d1d' : T.accent}`, color: t.type === 'error' ? T.dangerText : T.accentText, borderRadius: '6px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', maxWidth: '320px' }}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
