export interface ChatMessage {
  id: string;              // "msg-{timestamp}-{6-char-random}"
  authorLogin: string;
  text: string;            // raw markdown
  attachments: ChatAttachment[];
  createdAt: string;       // ISO timestamp
  editedAt?: string;
}

export interface ChatAttachment {
  name: string;
  path: string;            // relative to .jellybean-pm root, e.g. "files/chat/group/uuid/file.png"
  size: number;            // bytes
  mimeType: string;
}

export interface ChatPage {
  messages: ChatMessage[];
  full: boolean;           // true when this page can no longer accept new messages (capacity reached)
}

export interface ChatMeta {
  group: { pageCount: number; latestMsgId?: string };
  dms: { [convId: string]: { pageCount: number; latestMsgId?: string } };
  projects?: {
    [slug: string]: { group: { pageCount: number; latestMsgId?: string } };
  };
}

export interface ChatUserState {
  openDms: string[];                        // GitHub logins with open DM conversations
  lastRead: { [convId: string]: string };   // convId → last-seen message ID
}

export type ChatTarget = 'group' | { dm: string };  // dm = other user's GitHub login

/** Returns the convId for a DM between two users: sorted logins joined by "_" */
export function dmConvId(loginA: string, loginB: string): string {
  return [loginA, loginB].sort().join('_');
}

export interface Asset {
  id: string;          // "asset-{timestamp}-{6-char-random}"
  name: string;
  path: string;        // relative to .jellybean-pm root
  size: number;        // bytes
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;  // ISO timestamp
}
