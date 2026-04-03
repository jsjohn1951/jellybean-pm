import React, { useRef, useState } from 'react';
import { Paperclip, Download, X } from 'lucide-react';
import { T } from '../lib/theme';

export interface Attachment { name: string; path: string; uploadedBy: string; uploadedAt: string; }
export interface PendingAttachment { name: string; path: string; base64: string; uploadedAt: string; }

interface Props {
  attachments: Attachment[];
  pendingAttachments: PendingAttachment[];
  issueId: string;
  onAddPending: (p: PendingAttachment) => void;
  onRemoveSaved: (path: string) => void;
  onRemovePending: (path: string) => void;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
const MIME_MAP: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

function isImage(name: string) { return IMAGE_EXT.test(name); }
function mimeType(name: string) {
  return MIME_MAP[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}
function fileUrl(path: string) { return `/api/jellybean/data/files/${path}`; }

async function triggerDownload(name: string, src: string) {
  const res = await fetch(src);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href; a.download = name; a.click();
  URL.revokeObjectURL(href);
}

// ─── Lightbox ───────────────────────────────────────────────────────────────

function Lightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, cursor: 'zoom-out',
      }}
    >
      <img
        src={src}
        alt={name}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '88vw', maxHeight: '76vh', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}
      />
      <p style={{ color: T.textMuted, fontSize: '12px', marginTop: '12px', userSelect: 'none' }}>{name}</p>
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={() => void triggerDownload(name, src)}
          style={{ background: T.bgInput, color: T.textSecond, border: `1px solid ${T.borderMuted}`, padding: '5px 16px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}
        >
          Download
        </button>
        <button
          onClick={onClose}
          style={{ background: 'none', color: T.textMuted, border: `1px solid ${T.borderSubtle}`, padding: '5px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────

function AttachmentRow({
  name, date, pending, thumbSrc, fileSrc,
  onPreview, onRemove,
}: {
  name: string;
  date: string;
  pending?: boolean;
  thumbSrc: string | null;
  fileSrc: string;
  onPreview: () => void;
  onRemove: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px',
      padding: '7px 9px', background: T.bgPage, borderRadius: '6px', border: `1px solid ${T.borderSubtle}`,
    }}>
      {/* Thumbnail or icon */}
      {thumbSrc ? (
        <img
          src={thumbSrc}
          alt={name}
          onClick={onPreview}
          style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: '4px', flexShrink: 0, cursor: 'zoom-in', border: `1px solid ${T.borderSubtle}` }}
        />
      ) : (
        <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bgInput, borderRadius: '4px', flexShrink: 0, color: T.textMuted }}>
          <Paperclip size={18} />
        </div>
      )}

      {/* Meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: T.textPrimary, fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
          <span style={{ color: T.textFaint, fontSize: '10px' }}>{date}</span>
          {pending && (
            <span style={{ color: '#f59e0b', fontSize: '10px', background: '#1c1400', padding: '1px 5px', borderRadius: '3px' }}>pending</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {!pending && (
          <button
            onClick={() => void triggerDownload(name, fileSrc)}
            title="Download"
            style={{ background: 'none', border: `1px solid ${T.borderSubtle}`, color: T.textMuted, cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
          >
            <Download size={13} />
          </button>
        )}
        <button
          onClick={onRemove}
          title="Remove"
          style={{ background: 'none', border: `1px solid ${T.borderSubtle}`, color: T.textMuted, cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AttachmentList({ attachments, pendingAttachments, issueId, onAddPending, onRemoveSaved, onRemovePending }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      onAddPending({ name: file.name, path: `attachments/${issueId}/${file.name}`, base64, uploadedAt: new Date().toISOString() });
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.onerror = () => setReading(false);
    reader.readAsDataURL(file);
  }

  return (
    <div>
      {lightbox && <Lightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />}

      <p style={{ color: T.textMuted, fontSize: '10px', fontWeight: 600, letterSpacing: '.08em', marginBottom: '8px' }}>ATTACHMENTS</p>

      {attachments.map(a => {
        const url = fileUrl(a.path);
        return (
          <AttachmentRow
            key={a.path}
            name={a.name}
            date={new Date(a.uploadedAt).toLocaleDateString()}
            thumbSrc={isImage(a.name) ? url : null}
            fileSrc={url}
            onPreview={() => setLightbox({ src: url, name: a.name })}
            onRemove={() => onRemoveSaved(a.path)}
          />
        );
      })}

      {pendingAttachments.map(a => {
        const src = isImage(a.name) ? `data:${mimeType(a.name)};base64,${a.base64}` : null;
        return (
          <AttachmentRow
            key={a.path}
            name={a.name}
            date={new Date(a.uploadedAt).toLocaleDateString()}
            pending
            thumbSrc={src}
            fileSrc={src ?? ''}
            onPreview={() => src && setLightbox({ src, name: a.name })}
            onRemove={() => onRemovePending(a.path)}
          />
        );
      })}

      <input ref={fileRef} type="file" onChange={handleFile} style={{ display: 'none' }} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={reading}
        style={{ background: T.bgInput, color: T.textSecond, border: `1px solid ${T.borderMuted}`, padding: '5px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', marginTop: '2px' }}
      >
        {reading ? 'Reading…' : '+ Attach file'}
      </button>
    </div>
  );
}
