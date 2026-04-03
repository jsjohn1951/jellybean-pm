import React, { useEffect, useRef } from 'react';
import { X, Download, Trash2 } from 'lucide-react';
import { T } from '../lib/theme';
import type { Asset } from '../lib/chat-types';

interface Props {
  asset: Asset | null;
  userLogin: string;
  onClose: () => void;
  mutate: () => void;
}

export default function AssetPreviewModal({ asset, userLogin, onClose, mutate }: Props) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  if (!asset) return null;

  const src = `/api/jellybean/data/files/${asset.path}`;
  const isImage = asset.mimeType.startsWith('image/');
  const isVideo = asset.mimeType.startsWith('video/');

  async function handleDelete() {
    if (!asset) return;
    if (!window.confirm(`Delete asset "${asset.name}"? This cannot be undone.`)) return;
    const slug = asset.path.split('/')[1];
    const res = await fetch(`/api/jellybean/data/projects/${slug}/assets/${asset.id}`, { method: 'DELETE' });
    if (res.ok) { mutate(); onClose(); }
  }

  const canDelete = asset.uploadedBy === userLogin;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: T.bgPanel, border: `1px solid ${T.borderSubtle}`, borderRadius: '10px', width: '700px', maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${T.borderSubtle}`, flexShrink: 0 }}>
          <span style={{ color: T.textPrimary, fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {asset.name}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', flexShrink: 0, marginLeft: '12px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isImage && (
            <img src={src} alt={asset.name} style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain', borderRadius: '4px' }} />
          )}
          {isVideo && (
            <video controls src={src} style={{ maxWidth: '100%', maxHeight: '55vh', borderRadius: '4px' }} />
          )}
          {!isImage && !isVideo && (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <p style={{ color: T.textFaint, fontSize: '13px', margin: '0 0 16px' }}>Preview not available for this file type.</p>
              <a
                href={src}
                download={asset.name}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: T.accent, color: '#fff', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
              >
                <Download size={14} /> Download
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${T.borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ color: T.textFaint, fontSize: '11px' }}>
            Uploaded by {asset.uploadedBy}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {(isImage || isVideo) && (
              <a
                href={src}
                download={asset.name}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: T.bgInput, border: `1px solid ${T.borderMuted}`, color: T.textSecond, borderRadius: '6px', padding: '5px 10px', fontSize: '12px', textDecoration: 'none' }}
              >
                <Download size={12} /> Download
              </a>
            )}
            {canDelete && (
              <button
                onClick={() => void handleDelete()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: T.dangerBg, border: 'none', color: T.dangerText, borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer' }}
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
