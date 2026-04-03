import React, { createContext, useCallback, useContext, useState } from 'react';
import { T } from './theme';

interface MutationContextValue {
  withMutation: <R>(fn: () => Promise<R>) => Promise<R>;
}

const MutationContext = createContext<MutationContextValue>({
  withMutation: fn => fn(),
});

function LoadingOverlay() {
  return (
    <>
      <style>{`@keyframes jpm-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(8,15,20,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: `3px solid ${T.borderSubtle}`,
          borderTopColor: T.accent,
          animation: 'jpm-spin 0.65s linear infinite',
        }} />
      </div>
    </>
  );
}

export function MutationProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const withMutation = useCallback(async <R,>(fn: () => Promise<R>): Promise<R> => {
    setCount(c => c + 1);
    try {
      return await fn();
    } finally {
      setCount(c => c - 1);
    }
  }, []);

  return (
    <MutationContext.Provider value={{ withMutation }}>
      {children}
      {count > 0 && <LoadingOverlay />}
    </MutationContext.Provider>
  );
}

export const useMutation = () => useContext(MutationContext);
