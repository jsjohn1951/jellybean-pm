import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import IssueCard from './IssueCard';
import type { Issue } from '../hooks/useBoard';
import type { ColumnConfig } from '../config/schema';
import { T } from '../lib/theme';

interface Props {
  column: ColumnConfig;
  colIndex: number;
  issues: Issue[];
  onCardClick: (id: string) => void;
  avatarMap: Map<string, string>;
}

export default function Column({ column, colIndex, issues, onCardClick, avatarMap }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const accent = T.columnAccents[colIndex % T.columnAccents.length];

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Column header */}
      <div style={{
        background: T.bgPanel,
        backdropFilter: T.glassBlur,
        WebkitBackdropFilter: T.glassBlur,
        borderRadius: '8px 8px 0 0',
        borderTop: `3px solid ${accent}`,
        padding: '10px 12px 8px',
        borderLeft: T.glassBorder,
        borderRight: T.glassBorder,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: T.textSecond, fontSize: '11px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              {column.name}
            </span>
          </div>
          <span style={{
            background: T.bgInput,
            color: T.textMuted,
            fontSize: '10px',
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: '10px',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: T.fontMono,
          }}>
            {issues.length}
          </span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          minHeight: '120px',
          background: isOver ? 'rgba(168, 85, 247, 0.08)' : T.bgDropZone,
          border: T.glassBorder,
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '8px',
          transition: 'background 0.15s',
        }}
      >
        <SortableContext items={issues.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div style={{ maxWidth: '380px' }}>
          {issues.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '80px',
              border: `1px dashed ${T.borderSubtle}`,
              borderRadius: '6px',
            }}>
              <span style={{ color: T.textFaint, fontSize: '11px' }}>Drop here</span>
            </div>
          ) : (
            issues.map(i => (
              <IssueCard
                key={i.id}
                issue={i}
                avatarUrls={i.assignees
                  .slice(0, 4)
                  .map(a => avatarMap.get(a) ?? `https://github.com/${a}.png?size=32`)}
                onClick={() => onCardClick(i.id)}
              />
            ))
          )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
