import React, { useEffect, useRef, useState } from 'react';
import { X, Trash2, Paperclip, Edit2 } from 'lucide-react';
import Select from './Select';
import { T } from '../lib/theme';
import { useMutation } from '../lib/mutation-context';
import { useToast } from '../lib/toast';
import type { Doc } from '../hooks/useDocs';

interface Props {
  projectSlug: string;
  userLogin: string;
  doc: Doc | null;
  categories: string[];
  mutate: () => void;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: T.bgInput, border: `1px solid ${T.borderMuted}`,
  color: T.textPrimary, borderRadius: '6px', padding: '7px 10px', fontSize: '13px',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', color: T.textMuted, fontSize: '11px', fontWeight: 600,
  letterSpacing: '.05em', marginBottom: '5px',
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export default function DocModal({ projectSlug, userLogin, doc, categories, mutate, onClose }: Props) {
  const isCreate = doc === null;
  const { withMutation } = useMutation();
  const { toasts, show, dismiss } = useToast();

  const [mode, setMode] = useState<'view' | 'edit'>(isCreate ? 'edit' : 'view');
  const [title, setTitle] = useState(doc?.title ?? '');
  const [category, setCategory] = useState(doc?.category ?? (categories[0] ?? ''));
  const [body, setBody] = useState(doc?.body ?? '');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const base = `/api/jellybean/data/projects/${projectSlug}/docs`;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) { setPendingFile(null); return; }
    if (file.size > MAX_FILE_BYTES) {
      show('File must be under 5 MB', 'error');
      e.target.value = '';
      setPendingFile(null);
      return;
    }
    setPendingFile(file);
  }

  async function readFileAsBase64(file: File): Promise<{ base64: string; name: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1] ?? '';
        resolve({ base64, name: file.name });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSave() {
    if (!title.trim()) { show('Title is required', 'error'); return; }
    await withMutation(async () => {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        category,
        body,
        createdBy: userLogin,
      };

      if (pendingFile) {
        const { base64, name } = await readFileAsBase64(pendingFile);
        const docId = isCreate ? `doc-${Date.now()}` : doc.id;
        payload['_binaryUpload'] = {
          path: `projects/${projectSlug}/docs/attachments/${docId}-${name}`,
          content: base64,
        };
        payload['attachmentName'] = name;
      }

      const res = isCreate
        ? await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`${base}/${doc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

      if (!res.ok) { show('Failed to save document', 'error'); return; }
      mutate();
      onClose();
    });
  }

  async function handleDelete() {
    if (!doc) return;
    if (!window.confirm(`Delete document "${doc.title}"?`)) return;
    await withMutation(async () => {
      const res = await fetch(`${base}/${doc.id}`, { method: 'DELETE' });
      if (!res.ok) { show('Failed to delete document', 'error'); return; }
      mutate();
      onClose();
    });
  }

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ background: T.bgPanel, border: `1px solid ${T.borderSubtle}`, borderRadius: '10px', padding: '24px', width: '560px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ color: T.textPrimary, fontSize: '15px', fontWeight: 600, margin: 0 }}>
              {isCreate ? 'New Document' : mode === 'view' ? doc.title : 'Edit Document'}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}>
              <X size={18} />
            </button>
          </div>

          {mode === 'view' && doc ? (
            /* View mode */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                {doc.category && (
                  <span style={{ background: T.bgInput, color: T.textSecond, borderRadius: '10px', padding: '2px 10px', fontSize: '11px', fontWeight: 600 }}>
                    {doc.category}
                  </span>
                )}
                <span style={{ color: T.textFaint, fontSize: '11px', marginLeft: 'auto' }}>by {doc.createdBy}</span>
              </div>

              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: T.textPrimary, fontSize: '13px', lineHeight: 1.6, margin: '0 0 16px', background: T.bgInput, borderRadius: '6px', padding: '12px' }}>
                {doc.body || <span style={{ color: T.textFaint }}>No content</span>}
              </pre>

              {doc.attachmentName && (
                <a
                  href={`/api/jellybean/data/files/${doc.attachmentPath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: T.accentText, fontSize: '12px', textDecoration: 'none' }}
                >
                  <Paperclip size={13} /> {doc.attachmentName}
                </a>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
                <button onClick={handleDelete} style={{ background: T.dangerBg, border: 'none', color: T.dangerText, borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Trash2 size={13} /> Delete
                </button>
                <button onClick={() => setMode('edit')} style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Edit2 size={13} /> Edit
                </button>
              </div>
            </div>
          ) : (
            /* Edit / Create mode */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>TITLE *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="Document title…" />
              </div>

              <div>
                <label style={labelStyle}>CATEGORY</label>
                <Select
                  value={category}
                  onChange={setCategory}
                  placeholder="No category"
                  options={[
                    { value: '', label: 'No category' },
                    ...categories.map(c => ({ value: c, label: c })),
                  ]}
                />
              </div>

              <div>
                <label style={labelStyle}>CONTENT</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={8}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                  placeholder="Document content…"
                />
              </div>

              <div>
                <label style={labelStyle}>ATTACHMENT</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.pdf,.txt,.md,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  style={{ color: T.textSecond, fontSize: '12px' }}
                />
                {pendingFile && (
                  <p style={{ color: T.textFaint, fontSize: '11px', margin: '4px 0 0' }}>{pendingFile.name} ({(pendingFile.size / 1024).toFixed(0)} KB)</p>
                )}
                {!isCreate && doc?.attachmentName && !pendingFile && (
                  <p style={{ color: T.textFaint, fontSize: '11px', margin: '4px 0 0' }}>Current: {doc.attachmentName}</p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={() => isCreate ? onClose() : setMode('view')}
                  style={{ background: 'none', border: `1px solid ${T.borderMuted}`, color: T.textMuted, borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isCreate ? 'Create Document' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast notifications */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map(t => (
          <div key={t.id} onClick={() => dismiss(t.id)} style={{ background: t.type === 'error' ? T.dangerBg : T.accentBg, border: `1px solid ${t.type === 'error' ? '#7f1d1d' : T.accent}`, color: t.type === 'error' ? T.dangerText : T.accentText, borderRadius: '6px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', maxWidth: '320px' }}>
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
