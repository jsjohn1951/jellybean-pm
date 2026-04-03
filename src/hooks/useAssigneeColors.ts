import { useMemo } from 'react';
import { T } from '../lib/theme';

/** Maps each collaborator login to a deterministic colour from the accent pool. */
export function useAssigneeColors(collaborators: { login: string }[]): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>();
    collaborators.forEach((c, i) => {
      map.set(c.login, T.columnAccents[i % T.columnAccents.length]);
    });
    return map;
  }, [collaborators]);
}
