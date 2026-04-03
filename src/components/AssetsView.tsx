import React, { useRef, useState } from 'react';
import { Upload, Image } from 'lucide-react';
import useSWR from 'swr';
import { T } from '../lib/theme';
import { apiFetch } from '../lib/fetcher';
import { useMutation } from '../lib/mutation-context';
import { useToast } from '../lib/toast';
import type { Asset } from '../lib/chat-types';
import AssetPreviewModal from './AssetPreviewModal';

interface Props {
  projectSlug: string;
  userLogin: string;
}

type AssetFilter = 'all' | 'images' | 'videos' | 'svg' | 'other';

function matchesFilter(asset: Asset, filter: AssetFilter): boolean {
  if (filter === 'all')    return true;
  if (filter === 'images') return asset.mimeType.startsWith('image/') && asset.mimeType !== 'image/svg+xml';
  if (filter === 'videos') return asset.mimeType.startsWith('video/');
  if (filter === 'svg')    return asset.mimeType === 'image/svg+xml';
  return !asset.mimeType.startsWith('image/') && !asset.mimeType.startsWith('video/');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeBadgeLabel(mimeType: string): string {
  if (mimeType === 'image/svg+xml') return 'SVG';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.startsWith('video/')) return 'Video';
  return 'File';
}

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

// ── Asset Card ────────────────────────────────────────────────────────────────

function AssetCard({ asset, onClick }: { asset: Asset; onClick: () => void }) {
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
        <span style={{ color: T.textPrimary, fontSize: '13px', fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {asset.name}
        </span>
        <span style={{ background: T.bgInput, color: T.textSecond, borderRadius: '10px', padding: '2px 8px', fontSize: '10px', fontWeight: 600, flexShrink: 0 }}>
          {typeBadgeLabel(asset.mimeType)}
        </span>
      </div>
      <p style={{ color: T.textFaint, fontSize: '11px', margin: 0 }}>
        {formatBytes(asset.size)} · {asset.uploadedBy}
      </p>
    </div>
  );
}

// ── AssetsView ────────────────────────────────────────────────────────────────

export default function AssetsView({ projectSlug, userLogin }: Props) {
  const base = `/api/jellybean/data/projects/${projectSlug}/assets`;
  const { data: assets = [], mutate } = useSWR<Asset[]>(base, apiFetch);
  const { withMutation } = useMutation();
  const { toasts, show, dismiss } = useToast();

  const [filter, setFilter] = useState<AssetFilter>('all');
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = assets.filter(a => matchesFilter(a, filter));

  const filters: { key: AssetFilter; label: string }[] = [
    { key: 'all',    label: 'All'    },
    { key: 'images', label: 'Images' },
    { key: 'videos', label: 'Videos' },
    { key: 'svg',    label: 'SVG'    },
    { key: 'other',  label: 'Other'  },
  ];

  const pillBase: React.CSSProperties = {
    padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
    cursor: 'pointer', border: '1px solid transparent', userSelect: 'none', whiteSpace: 'nowrap',
  };

  async function handleFiles(files: FileList) {
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        show(`${file.name} exceeds the 25 MB limit`, 'error');
        continue;
      }
      await withMutation(async () => {
        const base64 = await readAsBase64(file);
        const res = await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            _binaryUpload: {
              path: `projects/${projectSlug}/assets/pending/${file.name}`,
              content: base64,
            },
            asset: { name: file.name, size: file.size, mimeType: file.type || 'application/octet-stream' },
          }),
        });
        if (!res.ok) { show(`Failed to upload ${file.name}`, 'error'); return; }
        await mutate();
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bgPage }}>
      {/* Top bar */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.borderSubtle}`, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
          <Image size={13} color={T.textMuted} style={{ flexShrink: 0 }} />
          {filters.map(({ key, label }) => (
            <span
              key={key}
              onClick={() => setFilter(key)}
              style={{
                ...pillBase,
                background: filter === key ? (key === 'all' ? T.accent : T.accentBg) : T.bgInput,
                color: filter === key ? (key === 'all' ? '#fff' : T.accentText) : T.textSecond,
                border: `1px solid ${filter === key ? T.accent : T.bgInput}`,
              }}
            >
              {label}
            </span>
          ))}
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: T.accent, border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          <Upload size={13} /> Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.svg,.pdf,.zip"
          multiple
          style={{ display: 'none' }}
          onChange={e => e.target.files && void handleFiles(e.target.files)}
        />
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {assets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <p style={{ color: T.textFaint, fontSize: '13px', margin: '0 0 16px' }}>No assets yet — upload one to get started</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: T.accent, border: 'none', color: '#fff', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Upload size={14} /> Upload
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ color: T.textFaint, fontSize: '13px', padding: '48px 16px', textAlign: 'center', margin: 0 }}>No assets in this category</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {filtered.map(asset => (
              <AssetCard key={asset.id} asset={asset} onClick={() => setPreviewAsset(asset)} />
            ))}
          </div>
        )}
      </div>

      <AssetPreviewModal asset={previewAsset} userLogin={userLogin} onClose={() => setPreviewAsset(null)} mutate={mutate} />

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

async function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
