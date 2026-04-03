import React, { useState, useMemo } from 'react';
import { LayoutGrid, CalendarDays, Flag, BookOpen, ImageIcon, ChevronDown, ChevronRight, X, Plus, LogOut, MessageSquare } from 'lucide-react';
import config from 'virtual:jellybean-pm/config';
import type { ProjectConfig } from '../config/schema';
import type { View } from './Layout';
import { T } from '../lib/theme';
import { ChatDmPicker } from './chat/ChatDmPicker';
import type { ChatTarget } from '../lib/chat-types';
import { dmConvId } from '../lib/chat-types';
import { useCollaborators } from '../hooks/useCollaborators';

interface Props {
  projects: ProjectConfig[];
  activeSlug: string;
  activeView: View;
  onSelect: (slug: string, view: View) => void;
  isMobile?: boolean;
  open?: boolean;
  onClose?: () => void;
  // Mobile header/footer extras
  brandName?: string;
  projectName?: string;
  userLogin?: string;
  userAvatar?: string;
  onNewIssue?: () => void;
  chatTarget?: ChatTarget;
  onChatNavigate?: (target: ChatTarget) => void;
  chatState: {
    openDms: string[];
    unreadCounts: Record<string, number>;
    openDm: (login: string) => void;
    closeDm: (login: string) => void;
    markRead: (convId: string, lastMsgId: string) => void;
  };
}

async function logout(basePath: string) {
  await fetch('/api/jellybean/auth/logout', { method: 'POST' });
  window.location.href = basePath;
}

const SUB_ITEMS: { view: View; label: string; Icon: React.FC<{ size: number; color: string }> }[] = [
  { view: 'board',    label: 'Board',    Icon: ({ size, color }) => <LayoutGrid   size={size} color={color} /> },
  { view: 'calendar', label: 'Calendar', Icon: ({ size, color }) => <CalendarDays size={size} color={color} /> },
  { view: 'goals',    label: 'Goals',    Icon: ({ size, color }) => <Flag         size={size} color={color} /> },
  { view: 'docs',     label: 'Docs',     Icon: ({ size, color }) => <BookOpen     size={size} color={color} /> },
  { view: 'assets',   label: 'Assets',   Icon: ({ size, color }) => <ImageIcon    size={size} color={color} /> },
];

export default function Sidebar({ projects, activeSlug, activeView, onSelect, isMobile, open, onClose, brandName, projectName, userLogin, userAvatar, onNewIssue, chatTarget, onChatNavigate, chatState }: Props) {
  const [expandedSlug, setExpandedSlug] = useState<string>(activeSlug);
  const [expandedChatSlug, setExpandedChatSlug] = useState<string>('');
  const [showDmPicker, setShowDmPicker] = useState(false);
  const [hoveredDm, setHoveredDm] = useState<string | null>(null);

  const basePath = config.ui?.basePath ?? '/project-management';
  const activeProject = config.projects.find((p: ProjectConfig) => p.slug === activeSlug);
  const activeRepo = (activeProject?._resolvedStorage ?? config.storage)?.repo ?? '';
  const isAdmin = userLogin === activeRepo.split('/')[0];

  const collaborators = useCollaborators();
  const avatarUrls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of collaborators) map[c.login] = c.avatar_url;
    return map;
  }, [collaborators]);

  function toggleProject(slug: string) {
    setExpandedSlug(prev => (prev === slug ? '' : slug));
  }

  function handleSubItem(slug: string, view: View) {
    setExpandedSlug(slug);
    onSelect(slug, view);
  }

  const mobileStyle: React.CSSProperties = isMobile ? {
    position: 'fixed',
    left: 0,
    top: 0,
    height: '100vh',
    zIndex: 200,
    transform: open ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.25s ease',
  } : {};

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 }}
        />
      )}
    <nav style={{
      width: 200,
      background: T.bgPanel,
      backdropFilter: T.glassBlur,
      WebkitBackdropFilter: T.glassBlur,
      borderRight: T.glassBorder,
      padding: '12px 8px',
      flexShrink: 0,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      ...mobileStyle,
    }}>
      {/* Mobile header: close + brand + project + new issue */}
      {isMobile && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
          </div>

          {/* Brand + project name */}
          <div style={{ paddingLeft: '8px', marginBottom: '12px' }}>
            <p style={{ color: T.accent, fontWeight: 700, fontSize: '14px', letterSpacing: '.04em', fontFamily: "'Space Mono', monospace", margin: 0 }}>
              {brandName}
            </p>
            {projectName && (
              <p style={{ color: T.textSecond, fontSize: '12px', margin: '2px 0 0 0' }}>
                {projectName}
              </p>
            )}
          </div>

          {/* New Issue button */}
          {onNewIssue && (
            <button
              onClick={() => { onNewIssue(); onClose?.(); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                width: '100%', marginBottom: '12px',
                background: `linear-gradient(135deg, ${T.accent}, ${T.accentHover})`,
                color: '#fff', border: 'none', borderRadius: '6px',
                padding: '8px 14px', cursor: 'pointer',
                fontWeight: 600, fontSize: '13px',
                boxShadow: T.glowShadow,
              }}
            >
              <Plus size={14} />
              New Issue
            </button>
          )}

          <div style={{ height: '1px', background: T.glassBorder, margin: '0 0 12px 0' }} />
        </>
      )}

      <p style={{
        color: T.textMuted, fontSize: '10px', fontWeight: 600,
        letterSpacing: '.08em', marginBottom: '8px', paddingLeft: '8px',
      }}>
        PROJECTS
      </p>

      {projects.map(p => {
        const isExpanded = expandedSlug === p.slug;
        const isActive = p.slug === activeSlug;

        return (
          <div key={p.slug}>
            {/* Project header */}
            <button
              onClick={() => toggleProject(p.slug)}
              style={{
                display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
                padding: '6px 8px', borderRadius: '4px', border: 'none',
                cursor: 'pointer', marginBottom: '1px',
                background: isActive && !isExpanded ? T.accentBg : 'transparent',
                color: isActive ? T.accentText : T.textMuted,
                fontWeight: isActive ? 600 : 400,
                fontSize: '12px',
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              {isExpanded
                ? <ChevronDown size={12} color={isActive ? T.accentText : T.textFaint} />
                : <ChevronRight size={12} color={isActive ? T.accentText : T.textFaint} />
              }
            </button>

            {/* Sub-items */}
            {isExpanded && (
              <div style={{ paddingLeft: '8px', marginBottom: '4px' }}>
                {SUB_ITEMS.map(({ view, label, Icon }) => {
                  const subActive = isActive && activeView === view &&
                    (view !== 'chat' || chatTarget === 'group');
                  const chatUnread = view === 'chat'
                    ? (chatState.unreadCounts[`project:${p.slug}`] ?? 0)
                    : 0;
                  return (
                    <button
                      key={view}
                      onClick={() => handleSubItem(p.slug, view)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        width: '100%', textAlign: 'left',
                        padding: '5px 8px', borderRadius: '4px', border: 'none',
                        cursor: 'pointer', marginBottom: '1px',
                        background: subActive ? T.accentBg : 'transparent',
                        color: subActive ? T.accentText : T.textMuted,
                        fontWeight: subActive ? 600 : 400,
                        fontSize: '11px',
                      }}
                    >
                      <Icon size={12} color={subActive ? T.accentText : T.textMuted} />
                      <span style={{ flex: 1 }}>{label}</span>
                      {chatUnread > 0 && !subActive && (
                        <span style={{ width: 7, height: 7, background: T.accent, borderRadius: '50%', flexShrink: 0, display: 'inline-block' }} />
                      )}
                    </button>
                  );
                })}

                {/* Chat sub-dropdown */}
                {(() => {
                  const chatIsExpanded = expandedChatSlug === p.slug;
                  const chatUnread = chatState.unreadCounts[`project:${p.slug}`] ?? 0;
                  const isChatSectionActive = isActive && activeView === 'chat';
                  return (
                    <>
                      <button
                        onClick={() => setExpandedChatSlug(prev => prev === p.slug ? '' : p.slug)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          width: '100%', textAlign: 'left',
                          padding: '5px 8px', borderRadius: '4px', border: 'none',
                          cursor: 'pointer', marginBottom: '1px',
                          background: isChatSectionActive ? T.accentBg : 'transparent',
                          color: isChatSectionActive ? T.accentText : T.textMuted,
                          fontWeight: isChatSectionActive ? 600 : 400,
                          fontSize: '11px',
                        }}
                      >
                        <MessageSquare size={12} color={isChatSectionActive ? T.accentText : T.textMuted} />
                        <span style={{ flex: 1 }}>Chat</span>
                        {chatUnread > 0 && !chatIsExpanded && (
                          <span style={{ width: 7, height: 7, background: T.accent, borderRadius: '50%', flexShrink: 0, display: 'inline-block' }} />
                        )}
                        {chatIsExpanded
                          ? <ChevronDown size={10} color={isChatSectionActive ? T.accentText : T.textFaint} />
                          : <ChevronRight size={10} color={isChatSectionActive ? T.accentText : T.textFaint} />
                        }
                      </button>

                      {chatIsExpanded && (
                        <div style={{ paddingLeft: '8px' }}>
                          {/* # General */}
                          {(() => {
                            const isGroupActive = isActive && activeView === 'chat' && chatTarget === 'group';
                            const groupUnread = chatState.unreadCounts[`project:${p.slug}`] ?? 0;
                            return (
                              <button
                                onClick={() => handleSubItem(p.slug, 'chat')}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '6px',
                                  width: '100%', textAlign: 'left',
                                  padding: '5px 8px', borderRadius: '4px', border: 'none',
                                  cursor: 'pointer', marginBottom: '1px',
                                  background: isGroupActive ? T.accentBg : 'transparent',
                                  color: isGroupActive ? T.accentText : T.textMuted,
                                  fontSize: '11px', fontWeight: isGroupActive ? 600 : 400,
                                }}
                              >
                                
                                <span style={{ flex: 1 }}># General</span>
                                {groupUnread > 0 && !isGroupActive && (
                                  <span style={{ width: 7, height: 7, background: T.accent, borderRadius: '50%', flexShrink: 0, display: 'inline-block' }} />
                                )}
                              </button>
                            );
                          })()}

                          {/* DM items */}
                          {chatState.openDms.map(login => {
                            const convId = dmConvId(userLogin ?? '', login);
                            const isNavActive = chatTarget !== 'group' && (chatTarget as { dm: string }).dm === login;
                            const unread = chatState.unreadCounts[convId] ?? 0;
                            const isHovered = hoveredDm === login;
                            return (
                              <div
                                key={login}
                                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                                onMouseEnter={() => setHoveredDm(login)}
                                onMouseLeave={() => setHoveredDm(null)}
                              >
                                <button
                                  onClick={() => onChatNavigate?.({ dm: login })}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    flex: 1, textAlign: 'left',
                                    padding: '5px 8px', borderRadius: '4px', border: 'none',
                                    cursor: 'pointer', marginBottom: '1px',
                                    background: isNavActive ? T.accentBg : 'transparent',
                                    color: isNavActive ? T.accentText : T.textMuted,
                                    fontSize: '11px', fontWeight: isNavActive ? 600 : 400,
                                    paddingRight: isHovered ? '28px' : '8px',
                                  }}
                                >
                                  {avatarUrls[login]
                                    ? <img src={avatarUrls[login]} alt={login} style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
                                    : <span style={{ width: 16, height: 16, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '8px', fontWeight: 700, flexShrink: 0 }}>
                                        {login.charAt(0).toUpperCase()}
                                      </span>
                                  }
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {login}
                                  </span>
                                  {!isHovered && unread > 0 && (
                                    <span style={{ width: 7, height: 7, background: T.accent, borderRadius: '50%', flexShrink: 0, display: 'inline-block' }} />
                                  )}
                                </button>
                                {isAdmin && isHovered && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (!window.confirm(`Permanently delete the entire chat history with ${login}? This cannot be undone.`)) return;
                                      await fetch(`/api/jellybean/data/chat/dm/${convId}`, { method: 'DELETE' });
                                      chatState.closeDm(login);
                                      if (isNavActive) onChatNavigate?.('group');
                                    }}
                                    title="Delete conversation"
                                    type="button"
                                    style={{
                                      position: 'absolute', right: '6px',
                                      background: 'transparent', border: 'none',
                                      cursor: 'pointer', color: T.textFaint,
                                      fontSize: '14px', lineHeight: 1,
                                      padding: '2px 3px', borderRadius: '3px',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e05252'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = T.textFaint; }}
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            );
                          })}

                          {/* + New DM */}
                          <button
                            onClick={() => setShowDmPicker(true)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              width: '100%', textAlign: 'left',
                              padding: '5px 8px', borderRadius: '4px', border: 'none',
                              cursor: 'pointer', marginBottom: '1px',
                              background: 'transparent',
                              color: T.textFaint, fontSize: '11px',
                            }}
                          >
                            <Plus size={11} color={T.textFaint} />
                            New DM
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
      {/* DM picker modal — rendered outside the project list to avoid z-index issues */}
      {showDmPicker && (
        <ChatDmPicker
          openDms={chatState.openDms}
          userLogin={userLogin ?? ''}
          onSelect={(login) => {
            chatState.openDm(login);
            onChatNavigate?.({ dm: login });
            setShowDmPicker(false);
          }}
          onClose={() => setShowDmPicker(false)}
        />
      )}

      {/* Mobile footer: system status + user + logout */}
      {isMobile && (
        <div style={{ marginTop: 'auto', paddingTop: '12px', paddingBottom: '20px' }}>
          <div style={{ height: '1px', background: T.glassBorder, marginBottom: '12px' }} />

          {/* System Online */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', paddingLeft: '8px', marginBottom: '12px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.statusOnline, flexShrink: 0, display: 'block' }} />
            <span style={{ color: T.textFaint, fontSize: '11px', fontFamily: T.fontMono }}>System Online</span>
          </div>

          {/* User info */}
          {userLogin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px', marginBottom: '10px' }}>
              {userAvatar && (
                <img
                  src={userAvatar}
                  alt={userLogin}
                  style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${T.borderSubtle}`, flexShrink: 0 }}
                />
              )}
              <span style={{ color: T.textSecond, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userLogin}</span>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={() => void logout(basePath)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              width: '100%', background: 'none',
              border: `1px solid ${T.borderMuted}`, color: T.textFaint,
              borderRadius: '5px', padding: '7px 10px', cursor: 'pointer',
              fontSize: '12px', marginBottom: '4px',
            }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      )}
    </nav>
    </>
  );
}
