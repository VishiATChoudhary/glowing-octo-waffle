/**
 * Gmail OAuth and API type definitions
 */

// User types
export interface GmailUser {
  uid: string;
  email: string;
  name: string;
  picture?: string;
  role?: 'admin' | 'user';
}

export interface GmailAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GmailUser | null;
  sessionToken: string | null;
  error: string | null;
}

// Gmail API response types
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: GmailMessagePayload;
  sizeEstimate: number;
  historyId: string;
  internalDate: string;
}

export interface GmailMessagePayload {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers: GmailHeader[];
  body: GmailMessageBody;
  parts?: GmailMessagePayload[];
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessageBody {
  attachmentId?: string;
  size: number;
  data?: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  messageListVisibility?: 'show' | 'hide';
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide';
  type: 'system' | 'user';
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
  color?: {
    textColor: string;
    backgroundColor: string;
  };
}

export interface GmailDraft {
  id: string;
  message: GmailMessage;
}

// Request/Response types
export interface AuthInitResponse {
  auth_url: string;
  state: string;
  code_verifier: string;
}

export interface TokenExchangeResponse {
  success: boolean;
  user: GmailUser;
  session_token: string;
  expires_in: number;
}

export interface GmailMessagesResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate: number;
}

export interface GmailLabelsResponse {
  labels: GmailLabel[];
}

export interface GmailDraftsResponse {
  drafts?: GmailDraft[];
}

// Compose email types
export interface ComposeEmailData {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  htmlBody?: string;
  threadId?: string;
}

// Parsed email for display
export interface EmailListItem {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: Date;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  hasAttachments: boolean;
}

export interface ParsedEmail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  date: Date;
  body: string;
  htmlBody?: string;
  labels: string[];
  isRead: boolean;
  isStarred: boolean;
}

// Label modification
export interface LabelModification {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

// Common system labels
export const SYSTEM_LABELS = {
  INBOX: 'INBOX',
  SENT: 'SENT',
  DRAFTS: 'DRAFT',
  SPAM: 'SPAM',
  TRASH: 'TRASH',
  UNREAD: 'UNREAD',
  STARRED: 'STARRED',
  IMPORTANT: 'IMPORTANT',
} as const;

export type SystemLabel = typeof SYSTEM_LABELS[keyof typeof SYSTEM_LABELS];
