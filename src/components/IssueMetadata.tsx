import React, { useState, useEffect } from 'react';
import type { Collaborator } from '../hooks/useCollaborators';
import type { Sprint } from '../hooks/useSprints';
import AssigneeSelect from './AssigneeSelect';
import Select from './Select';
import { T } from '../lib/theme';

interface Props {
  assignees: string[];
  labels: string[];
  collaborators: Collaborator[];
  sprintId?: string | null;
  sprints?: Sprint[];
  onChangeAssignees: (v: string[]) => void;
  onChangeLabels: (v: string[]) => void;
  onChangeSprintId?: (v: string | null) => void;
}

export default function IssueMetadata({ assignees, labels, collaborators, sprintId, sprints, onChangeAssignees, onChangeLabels, onChangeSprintId }: Props) {
  const [labelsStr, setLabelsStr] = useState(labels.join(', '));
  useEffect(() => { setLabelsStr(labels.join(', ')); }, [labels.join(',')]);

  const inputStyle = { background: T.bgInput, border: `1px solid ${T.borderMuted}`, color: T.textPrimary, borderRadius: '5px', padding: '6px 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' as const };
  const labelStyle = { color: T.textMuted, fontSize: '10px', fontWeight: 600, letterSpacing: '.08em', display: 'block', marginBottom: '4px' };

  return (
    <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <label style={labelStyle}>ASSIGNEES</label>
        <AssigneeSelect value={assignees} collaborators={collaborators} onChange={onChangeAssignees} />
      </div>
      <div>
        <label style={labelStyle}>LABELS</label>
        <input value={labelsStr} onChange={e => setLabelsStr(e.target.value)}
          onBlur={() => onChangeLabels(labelsStr.split(',').map(l => l.trim()).filter(Boolean))}
          placeholder="bug, auth, ui" style={inputStyle} />
      </div>
      {sprints !== undefined && onChangeSprintId && (
        <div>
          <label style={labelStyle}>SPRINT</label>
          <Select
            value={sprintId ?? ''}
            onChange={v => onChangeSprintId(v || null)}
            placeholder="— Backlog —"
            options={[
              { value: '', label: '— Backlog —' },
              ...sprints.map(s => ({
                value: s.id,
                label: s.name + (s.status === 'active' ? ' ●' : s.status === 'completed' ? ' ✓' : ''),
              })),
            ]}
          />
        </div>
      )}
    </div>
  );
}
