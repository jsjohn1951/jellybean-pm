import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import config from 'virtual:jellybean-pm/config';
import type { ProjectConfig } from '../config/schema';
import { T } from '../lib/theme';
import { useIsMobile } from '../lib/useIsMobile';
import { useChatState } from '../hooks/useChatState';
import { apiFetch } from '../lib/fetcher';
import type { ChatMeta, ChatTarget } from '../lib/chat-types';
import { dmConvId } from '../lib/chat-types';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import BoardView from './BoardView';
import CalendarView from './CalendarView';
import GoalsView from './GoalsView';
import DocsView from './DocsView';
import AssetsView from './AssetsView';
import CreateIssueModal from './CreateIssueModal';
import ChatView from './ChatView';

export type View = 'board' | 'calendar' | 'goals' | 'docs' | 'chat' | 'assets';

interface Props {
  user: { login: string; name: string | null; avatar_url: string };
}

export default function Layout({ user }: Props) {
  const [activeSlug, setActiveSlug] = useState(config.projects[0]?.slug ?? '');
  const [activeView, setActiveView] = useState<View>('board');
  const [showCreate, setShowCreate] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<ChatTarget>('group');
  const isMobile = useIsMobile();
  const chatState = useChatState(user.login);

  const { data: chatMeta } = useSWR<ChatMeta>('/api/jellybean/data/chat/meta', apiFetch, {
    refreshInterval: 5000,
    dedupingInterval: 4000,
    revalidateOnFocus: false,
  });

  // Auto-open DMs that appear in meta but aren't in openDms yet (handles first-time receiver case)
  useEffect(() => {
    if (!chatMeta) return;
    for (const convId of Object.keys(chatMeta.dms)) {
      const logins = convId.split('_');
      if (logins.includes(user.login)) {
        const otherLogin = logins.find(l => l !== user.login);
        if (otherLogin && !chatState.openDms.includes(otherLogin)) {
          chatState.openDm(otherLogin);
        }
      }
    }
  }, [chatMeta, user.login, chatState.openDms, chatState.openDm]);

  // Compute unread counts from meta.latestMsgId vs chatState.lastRead
  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // Per-project group chats
    for (const p of config.projects as ProjectConfig[]) {
      const projectLatest = chatMeta?.projects?.[p.slug]?.group?.latestMsgId;
      const readKey = `project:${p.slug}`;
      if (projectLatest && projectLatest !== chatState.lastRead?.[readKey]) counts[readKey] = 1;
    }
    // DMs
    for (const login of chatState.openDms) {
      const convId = dmConvId(user.login, login);
      const latestMsgId = chatMeta?.dms[convId]?.latestMsgId;
      if (latestMsgId && latestMsgId !== chatState.lastRead?.[convId]) counts[convId] = 1;
    }
    return counts;
  }, [chatMeta, chatState.lastRead, chatState.openDms, user.login]);

  const chatStateWithUnread = { ...chatState, unreadCounts };

  const brandName = config.ui?.brand?.name ?? 'JellyBean PM';
  const brandLogo = config.ui?.brand?.logo;
  const basePath  = config.ui?.basePath ?? '/project-management';
  const project = config.projects.find((p: ProjectConfig) => p.slug === activeSlug);

  function handleChatNavigate(target: ChatTarget) {
    setChatTarget(target);
    setActiveView('chat');
    if (isMobile) setSidebarOpen(false);
  }

  function handleSelect(slug: string, view: View) {
    if (slug !== activeSlug) {
      setActiveSlug(slug);
      setActiveView('board');
    } else {
      setActiveView(view);
      if (view === 'chat') setChatTarget('group');
    }
    if (isMobile) setSidebarOpen(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: T.bgPage }}>
      <TopNav
        brandName={brandName}
        brandLogo={brandLogo}
        basePath={basePath}
        projectName={project?.name ?? ''}
        userLogin={user.login}
        userAvatar={user.avatar_url}
        onNewIssue={() => setShowCreate(true)}
        isMobile={isMobile}
        onMenuToggle={() => setSidebarOpen(o => !o)}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          projects={config.projects}
          activeSlug={activeSlug}
          activeView={activeView}
          onSelect={handleSelect}
          isMobile={isMobile}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          brandName={brandName}
          projectName={project?.name ?? ''}
          userLogin={user.login}
          userAvatar={user.avatar_url}
          onNewIssue={() => setShowCreate(true)}
          chatTarget={chatTarget}
          onChatNavigate={handleChatNavigate}
          chatState={chatStateWithUnread}
        />
        {activeView === 'board'    && <BoardView    projectSlug={activeSlug} />}
        {activeView === 'calendar' && <CalendarView projectSlug={activeSlug} />}
        {activeView === 'goals'    && <GoalsView    projectSlug={activeSlug} userLogin={user.login} />}
        {activeView === 'docs'     && <DocsView     projectSlug={activeSlug} userLogin={user.login} />}
        {activeView === 'assets'   && <AssetsView   projectSlug={activeSlug} userLogin={user.login} />}
        {activeView === 'chat'    && <ChatView target={chatTarget} userLogin={user.login} chatState={chatStateWithUnread} projectSlug={activeSlug} />}
      </div>
      {showCreate && (
        <CreateIssueModal
          projectSlug={activeSlug}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
