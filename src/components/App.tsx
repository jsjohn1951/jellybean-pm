import React from 'react';
import AuthGuard from './AuthGuard';
import { MutationProvider } from '../lib/mutation-context';
import { T } from '../lib/theme';

export default function App() {
  return (
    <MutationProvider>
      <div style={{ fontFamily: T.fontPrimary }}>
        <AuthGuard />
      </div>
    </MutationProvider>
  );
}
