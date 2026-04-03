import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { T } from '../lib/theme';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Compact pill variant — used in FilterBar and inline contexts */
  compact?: boolean;
  style?: React.CSSProperties;
}

export default function Select({ value, onChange, options, placeholder = '—', compact = false, style }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, []);

  const selected = options.find(o => o.value === value);

  const triggerStyle: React.CSSProperties = compact
    ? {
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        background: T.bgInput, border: `1px solid ${T.borderMuted}`,
        borderRadius: '12px', padding: '3px 8px', cursor: 'pointer', userSelect: 'none',
      }
    : {
        display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between',
        background: T.bgInput, border: `1px solid ${T.borderMuted}`,
        borderRadius: '5px', padding: '5px 8px', minHeight: '34px', cursor: 'pointer',
      };

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <div style={triggerStyle} onClick={() => setOpen(o => !o)}>
        <span style={{
          color: selected ? T.textPrimary : T.textMuted,
          fontSize: compact ? '11px' : '12px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={compact ? 10 : 12} style={{ color: T.textMuted, flexShrink: 0 }} />
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 300,
          background: T.bgPanel, border: `1px solid ${T.borderMuted}`, borderRadius: '5px',
          maxHeight: '220px', overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          minWidth: compact ? '140px' : undefined,
        }}>
          {options.map(opt => {
            const isActive = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', cursor: 'pointer', fontSize: '12px',
                  color: isActive ? T.accentText : T.textPrimary,
                  background: isActive ? T.accentBg : 'transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.accentBg; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span>{opt.label}</span>
                {isActive && <Check size={12} color={T.accentText} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
