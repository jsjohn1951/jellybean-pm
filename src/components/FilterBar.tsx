import React from 'react';
import Select from './Select';
import { T } from '../lib/theme';

export interface Filters {
  assignee: string;
  label: string;
  priority: string;
}

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  allLabels: string[];
  allAssignees: string[];
}

export default function FilterBar({ filters, onChange, allLabels, allAssignees }: Props) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ color: T.textMuted, fontSize: '11px' }}>Filter:</span>
      <Select
        compact
        value={filters.assignee}
        onChange={v => onChange({ ...filters, assignee: v })}
        placeholder="All assignees"
        options={[
          { value: '', label: 'All assignees' },
          ...allAssignees.map(a => ({ value: a, label: a })),
        ]}
      />
      <Select
        compact
        value={filters.label}
        onChange={v => onChange({ ...filters, label: v })}
        placeholder="All labels"
        options={[
          { value: '', label: 'All labels' },
          ...allLabels.map(l => ({ value: l, label: l })),
        ]}
      />
      <Select
        compact
        value={filters.priority}
        onChange={v => onChange({ ...filters, priority: v })}
        placeholder="All priorities"
        options={[
          { value: '', label: 'All priorities' },
          ...['low', 'medium', 'high', 'critical'].map(p => ({ value: p, label: p })),
        ]}
      />
    </div>
  );
}
