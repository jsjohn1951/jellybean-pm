import React from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import LoginScreen from './LoginScreen';
import Layout from './Layout';
import { T } from '../lib/theme';

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export default function AuthGuard() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: T.bgPage,
      }}>
        <p style={{ color: T.textFaint, fontSize: '14px' }}>Loading…</p>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return <Layout user={user as GitHubUser} />;
}
