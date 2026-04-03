import React from 'react';
import { T } from '../lib/theme';

export default function LoginScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: T.bgPage,
    }}>
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ marginBottom: '16px', fontSize: '32px' }}>🫘</div>
        <h1 style={{ color: T.accent, fontSize: '24px', fontWeight: 700, marginBottom: '8px', letterSpacing: '.04em' }}>
          JellyBean PM
        </h1>
        <p style={{ color: T.textFaint, marginBottom: '32px', fontSize: '14px' }}>
          Sign in to access your project board
        </p>
        <a
          href="/api/jellybean/auth/login"
          style={{
            display: 'inline-block',
            background: T.accent,
            color: '#fff',
            padding: '10px 28px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          Sign in with GitHub
        </a>
      </div>
    </div>
  );
}
