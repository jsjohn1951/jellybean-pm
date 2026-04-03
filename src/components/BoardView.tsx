import React, { useEffect, useState } from 'react';
import { Pencil, Play, Check, Trash2, Plus, X } from 'lucide-react';
import FilterBar, { type Filters } from './FilterBar';
import Select from './Select';
import Board from './Board';
import SwimlaneView from './SwimlaneView';
import { useBoard } from '../hooks/useBoard';
import { useCollaborators } from '../hooks/useCollaborators';
import { useSprints, type Sprint } from '../hooks/useSprints';
import { T } from '../lib/theme';
import { useIsMobile } from '../lib/useIsMobile';
import { useMutation } from '../lib/mutation-context';
import config from 'virtual:jellybean-pm/config';

interface Props {
  projectSlug: string;
}

type ViewMode = 'kanban' | 'swimlane';

// ── SprintBar ────────────────────────────────────────────────────────────────

interface SprintBarProps {
  sprints: Sprint[];
  selected: string;
  onChange: (id: string) => void;
  onMutateSprints: () => void;
  onSprintDeleted: (id: string) => void;
  projectSlug: string;
}

function SprintBar({ sprints, selected, onChange, onMutateSprints, onSprintDeleted, projectSlug }: SprintBarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const { withMutation } = useMutation();

  async function createSprint() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      await withMutation(async () => {
        const res = await fetch(`/api/jellybean/data/projects/${projectSlug}/sprints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName.trim() }),
        });
        if (res.ok) {
          const sprint = await res.json() as Sprint;
          onMutateSprints();
          onChange(sprint.id);
          setCreating(false);
          setNewName('');
        }
      });
    } finally {
      setBusy(false);
    }
  }

  async function patchSprint(id: string, patch: Partial<Pick<Sprint, 'name' | 'status'>>) {
    if (busy) return;
    setBusy(true);
    try {
      await withMutation(async () => {
        await fetch(`/api/jellybean/data/projects/${projectSlug}/sprints/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        onMutateSprints();
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteSprint(id: string, name: string) {
    if (busy) return;
    if (!window.confirm(`Delete sprint "${name}"? All its issues will move to the backlog.`)) return;
    setBusy(true);
    try {
      await withMutation(async () => {
        const res = await fetch(`/api/jellybean/data/projects/${projectSlug}/sprints/${id}`, { method: 'DELETE' });
        if (!res.ok) { alert('Failed to delete sprint — please try again.'); return; }
        onMutateSprints();
        onSprintDeleted(id);
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(id: string) {
    if (!editName.trim()) { setEditingId(null); return; }
    await patchSprint(id, { name: editName.trim() });
    setEditingId(null);
  }

  const pillBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
    cursor: 'pointer', border: '1px solid transparent', userSelect: 'none', whiteSpace: 'nowrap',
  };

  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', color: T.textMuted,
    cursor: 'pointer', padding: '0 2px', lineHeight: 1,
    display: 'inline-flex', alignItems: 'center',
  };

  function statusIcon(s: Sprint) {
    if (s.status === 'active') return ' ●';
    if (s.status === 'completed') return ' ✓';
    return '';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
      {/* All / Backlog pills */}
      {(['all', 'backlog'] as const).map(key => (
        <span
          key={key}
          onClick={() => onChange(key)}
          style={{
            ...pillBase,
            background: selected === key ? T.accent : T.bgInput,
            color: selected === key ? '#fff' : T.textSecond,
            border: `1px solid ${selected === key ? T.accent : T.bgInput}`,
          }}
        >
          {key === 'all' ? 'All' : 'Backlog'}
        </span>
      ))}

      {/* Sprint pills */}
      {sprints.map(s => (
        <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          {editingId === s.id ? (
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void saveRename(s.id); if (e.key === 'Escape') setEditingId(null); }}
              onBlur={() => void saveRename(s.id)}
              style={{
                background: T.bgInput, border: `1px solid ${T.accent}`, color: T.textPrimary,
                borderRadius: '10px', padding: '2px 8px', fontSize: '11px', width: '110px',
              }}
            />
          ) : (
            <span
              onClick={() => onChange(s.id)}
              style={{
                ...pillBase,
                background: selected === s.id ? T.accentBg : T.bgInput,
                color: selected === s.id ? T.accentText : T.textSecond,
                border: `1px solid ${selected === s.id ? T.accent : T.bgInput}`,
              }}
            >
              {s.name}{statusIcon(s)}
            </span>
          )}
          {editingId !== s.id && (
            <>
              <button title="Rename" onClick={() => { setEditingId(s.id); setEditName(s.name); }} style={iconBtn}>
                <Pencil size={11} />
              </button>
              {s.status === 'planned' && (
                <button title="Activate sprint" onClick={() => void patchSprint(s.id, { status: 'active' })} style={iconBtn}>
                  <Play size={11} />
                </button>
              )}
              {s.status === 'active' && (
                <button title="Complete sprint" onClick={() => void patchSprint(s.id, { status: 'completed' })} style={iconBtn}>
                  <Check size={11} />
                </button>
              )}
              <button title="Delete sprint (moves issues to backlog)" onClick={() => void deleteSprint(s.id, s.name)} style={iconBtn}>
                <Trash2 size={11} />
              </button>
            </>
          )}
        </span>
      ))}

      {/* Create sprint */}
      {creating ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void createSprint(); if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
            placeholder="Sprint name…"
            style={{
              background: T.bgInput, border: `1px solid ${T.borderMuted}`, color: T.textPrimary,
              borderRadius: '10px', padding: '2px 8px', fontSize: '11px', width: '120px',
            }}
          />
          <button onClick={() => void createSprint()} disabled={busy}
            style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: '8px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}>
            Add
          </button>
          <button onClick={() => { setCreating(false); setNewName(''); }}
            style={{ ...iconBtn, fontSize: '12px' }}>
            <X size={12} />
          </button>
        </span>
      ) : (
        <button
          onClick={() => setCreating(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: 'none', border: `1px dashed ${T.borderMuted}`, color: T.textMuted,
            borderRadius: '12px', padding: '3px 10px', fontSize: '11px', cursor: 'pointer',
          }}
        >
          <Plus size={11} /> Sprint
        </button>
      )}
    </div>
  );
}

// ── BoardView ────────────────────────────────────────────────────────────────

export default function BoardView({ projectSlug }: Props) {
  const { issues, isLoading, mutate } = useBoard(projectSlug);
  const collaborators = useCollaborators();
  const { sprints, mutate: mutateSprints } = useSprints(projectSlug);
  const [filters, setFilters] = useState<Filters>({ assignee: '', label: '', priority: '' });
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedSprint, setSelectedSprint] = useState<string>('all');
  const isMobile = useIsMobile();

  const allColumns: { id: string; name: string }[] =
    config.projects.find((p: { slug: string }) => p.slug === projectSlug)?.columns ?? [];

  const [visibleColumnId, setVisibleColumnId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(`jellybean-pm:column:${projectSlug}`);
    return stored ?? allColumns[0]?.id ?? null;
  });

  useEffect(() => {
    const active = sprints.find(s => s.status === 'active');
    if (active) setSelectedSprint(active.id);
  }, [sprints.map(s => s.id).join(',')]);

  useEffect(() => {
    if (isMobile && visibleColumnId) {
      localStorage.setItem(`jellybean-pm:column:${projectSlug}`, visibleColumnId);
    }
  }, [visibleColumnId, isMobile, projectSlug]);

  const allLabels = [...new Set(issues.flatMap(i => i.labels))];
  const allAssignees = [...new Set(issues.map(i => i.assignee).filter((a): a is string => a !== null))];

  const filtered = issues.filter(i => {
    if (selectedSprint === 'backlog' && i.sprintId) return false;
    if (selectedSprint !== 'all' && selectedSprint !== 'backlog' && i.sprintId !== selectedSprint) return false;
    if (filters.assignee && i.assignee !== filters.assignee) return false;
    if (filters.label && !i.labels.includes(filters.label)) return false;
    if (filters.priority && i.priority !== filters.priority) return false;
    return true;
  });

  if (isLoading) {
    return <p style={{ color: T.textFaint, padding: '24px', fontSize: '14px' }}>Loading board…</p>;
  }

  function ViewToggleBtn({ mode, label }: { mode: ViewMode; label: string }) {
    return (
      <button
        onClick={() => setViewMode(mode)}
        style={{
          background: viewMode === mode ? T.accent : 'none',
          color: viewMode === mode ? '#fff' : T.textFaint,
          border: `1px solid ${viewMode === mode ? T.accent : T.borderSubtle}`,
          padding: '4px 12px', borderRadius: '4px', cursor: 'pointer',
          fontSize: '12px', fontWeight: 600,
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div style={{ flex: 1, padding: '16px', overflowX: 'auto', background: T.bgPage }}>
      <SprintBar
        sprints={sprints}
        selected={selectedSprint}
        onChange={setSelectedSprint}
        onMutateSprints={mutateSprints}
        onSprintDeleted={(id) => { if (selectedSprint === id) setSelectedSprint('backlog'); void Promise.all([mutateSprints(), mutate()]); }}
        projectSlug={projectSlug}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <FilterBar filters={filters} onChange={setFilters} allLabels={allLabels} allAssignees={allAssignees} />
        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto', flexShrink: 0 }}>
          {!isMobile && <ViewToggleBtn mode="kanban" label="Kanban" />}
          {!isMobile && <ViewToggleBtn mode="swimlane" label="Swimlane" />}
        </div>
      </div>
      {/* Mobile column selector */}
      {isMobile && viewMode === 'kanban' && allColumns.length > 1 && (
        <Select
          value={visibleColumnId ?? allColumns[0]?.id ?? ''}
          onChange={v => setVisibleColumnId(v)}
          options={allColumns.map(col => ({ value: col.id, label: col.name }))}
          style={{ width: '100%', marginBottom: '12px' }}
        />
      )}
      {viewMode === 'kanban' ? (
        <Board
          issues={filtered}
          collaborators={collaborators}
          projectSlug={projectSlug}
          mutate={mutate}
          onCardClick={(id) => setSelectedIssueId(id || null)}
          selectedIssueId={selectedIssueId}
          visibleColumnId={isMobile ? visibleColumnId : null}
        />
      ) : (
        <SwimlaneView
          issues={filtered}
          collaborators={collaborators}
          projectSlug={projectSlug}
          mutate={mutate}
          selectedIssueId={selectedIssueId}
          onCardClick={(id) => setSelectedIssueId(id || null)}
        />
      )}
    </div>
  );
}
