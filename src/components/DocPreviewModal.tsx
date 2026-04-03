import React, { useEffect, useRef } from 'react';
import { X, Download } from 'lucide-react';
import { T } from '../lib/theme';
import { chatMarkdown } from '../lib/chatMarkdown';
import type { Doc } from '../hooks/useDocs';

interface Props {
  doc: Doc | null;
  onClose: () => void;
}

export default function DocPreviewModal({ doc, onClose }: Props) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  if (!doc) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: T.bgPanel, border: `1px solid ${T.borderSubtle}`, borderRadius: '10px', width: '600px', maxWidth: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 14px', borderBottom: `1px solid ${T.borderSubtle}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <h2 style={{ color: T.textPrimary, fontSize: '15px', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.title}
            </h2>
            {doc.category && (
              <span style={{ background: T.bgInput, color: T.textSecond, borderRadius: '10px', padding: '2px 10px', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}>
                {doc.category}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', flexShrink: 0, marginLeft: '12px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {doc.body ? (
            <div style={{ color: T.textPrimary, fontSize: '13px', lineHeight: 1.7 }}>
              {chatMarkdown(doc.body, 'doc-preview')}
            </div>
          ) : (
            <p style={{ color: T.textFaint, fontSize: '13px', margin: 0 }}>No content</p>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px 16px', borderTop: `1px solid ${T.borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ color: T.textFaint, fontSize: '11px' }}>by {doc.createdBy}</span>
          {doc.attachmentPath && doc.attachmentName && (
            <a
              href={`/api/jellybean/data/files/${doc.attachmentPath}`}
              download={doc.attachmentName}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: T.bgInput, border: `1px solid ${T.borderMuted}`, color: T.textSecond, borderRadius: '6px', padding: '5px 10px', fontSize: '12px', textDecoration: 'none' }}
            >
              <Download size={12} />
              {doc.attachmentName}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
