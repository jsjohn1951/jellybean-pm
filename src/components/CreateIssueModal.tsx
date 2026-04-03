import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import CreateIssueForm from './CreateIssueForm';
import { useBoard } from '../hooks/useBoard';
import { useCollaborators } from '../hooks/useCollaborators';
import { useSprints } from '../hooks/useSprints';
import { T } from '../lib/theme';

interface Props { projectSlug: string; onClose: () => void; }

export default function CreateIssueModal({ projectSlug, onClose }: Props) {
  const { mutate } = useBoard(projectSlug);
  const collaborators = useCollaborators();
  const { sprints } = useSprints(projectSlug);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  async function handleCreated() {
    await mutate();
    onClose();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: T.bgPanel, border: `1px solid ${T.borderSubtle}`, borderRadius: '10px', padding: '24px', width: '480px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ color: T.textPrimary, fontSize: '15px', fontWeight: 600, margin: 0 }}>New Issue</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}>
            <X size={18} />
          </button>
        </div>
        <CreateIssueForm
          projectSlug={projectSlug}
          collaborators={collaborators}
          sprints={sprints}
          onCreated={handleCreated}
          onCancel={onClose}
          onConflict={() => { void mutate(); }}
        />
      </div>
    </div>
  );
}
