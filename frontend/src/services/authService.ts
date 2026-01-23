/**
 * Auth Service - handles email authentication API calls
 */

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  picture?: string | null;
  auth_provider?: 'email' | 'google';
  role?: 'admin' | 'user';
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  user: AuthUser;
  session_token: string;
}

export interface LoginResponse {
  success: boolean;
  user: AuthUser;
  session_token: string;
}

export interface MessageResponse {
  success: boolean;
  message: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user?: AuthUser;
}

export interface LoginErrorResponse {
  error: string;
}

// API base URL
const API_BASE =
  import.meta.env.VITE_AUTH_API_URL ||
  import.meta.env.VITE_GMAIL_API_URL ||
  'https://us-central1-waffle-mm.cloudfunctions.net';

// Storage keys
const STORAGE_KEYS = {
  SESSION_TOKEN: 'auth_session_token',
  USER: 'auth_user',
  // Legacy Gmail storage (for backward compatibility)
  GMAIL_SESSION_TOKEN: 'gmail_session_token',
} as const;

/**
 * Register a new user with email/password
 * Automatically stores session on success (no email verification needed)
 */
export async function register(
  email: string,
  password: string,
  name: string
): Promise<RegisterResponse> {
  const response = await fetch(`${API_BASE}/email-auth-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  // Store session (user is auto-logged in after registration)
  localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, data.session_token);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));

  return data;
}

/**
 * Login with email/password
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/email-auth-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  // Store session
  localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, data.session_token);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));

  return data;
}

/**
 * Request password reset
 */
export async function forgotPassword(email: string): Promise<MessageResponse> {
  const response = await fetch(`${API_BASE}/email-auth-forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to process request');
  }

  return data;
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, password: string): Promise<MessageResponse> {
  const response = await fetch(`${API_BASE}/email-auth-reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to reset password');
  }

  return data;
}

/**
 * Check authentication status
 */
export async function checkAuthStatus(): Promise<AuthStatusResponse> {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    return { authenticated: false };
  }

  try {
    const response = await fetch(`${API_BASE}/email-auth-status`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });

    if (!response.ok) {
      return { authenticated: false };
    }

    return await response.json();
  } catch {
    return { authenticated: false };
  }
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
  const sessionToken = getSessionToken();
  if (sessionToken) {
    try {
      await fetch(`${API_BASE}/email-auth-logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
    } catch {
      // Ignore errors - we'll clear local data anyway
    }
  }
  clearAuthData();
}

/**
 * Get stored session token
 * Checks auth_session_token first, then falls back to gmail_session_token for backward compatibility
 */
export function getSessionToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN) ||
         localStorage.getItem(STORAGE_KEYS.GMAIL_SESSION_TOKEN);
}

/**
 * Get stored user info
 */
export function getStoredUser(): AuthUser | null {
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Store auth data (used after Google OAuth)
 */
export function storeAuthData(sessionToken: string, user: AuthUser): void {
  localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, sessionToken);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

/**
 * Clear all stored auth data
 */
export function clearAuthData(): void {
  localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
}

/**
 * Validate password requirements
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email);
}

/**
 * Check if user is an admin
 */
export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin';
}

// ============================================================================
// Admin - Whitelist Management
// ============================================================================

export interface WhitelistEntry {
  email: string;
  role: 'admin' | 'user';
  added_by: string;
  created_at?: unknown;
}

export interface UserWithQuota {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  auth_provider: 'email' | 'google';
  pipeline_quota: number;
  pipeline_runs_used: number;
  created_at?: string;
  last_login?: string;
}

/**
 * List all whitelisted emails (admin only)
 */
export async function listWhitelist(): Promise<WhitelistEntry[]> {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}/email-auth-whitelist-list`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to list whitelist');
  }

  return data.whitelist;
}

/**
 * Add an email to the whitelist (admin only)
 */
export async function addToWhitelist(
  email: string,
  role: 'admin' | 'user' = 'user'
): Promise<WhitelistEntry> {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}/email-auth-whitelist-add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ email, role }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to add to whitelist');
  }

  return data.entry;
}

/**
 * Remove an email from the whitelist (admin only)
 */
export async function removeFromWhitelist(email: string): Promise<void> {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}/email-auth-whitelist-remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to remove from whitelist');
  }
}

// ============================================================================
// Admin - User Management (including quota)
// ============================================================================

/**
 * List all registered users with quota info (admin only)
 */
export async function listUsers(): Promise<UserWithQuota[]> {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}/email-auth-users-list`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to list users');
  }

  return data.users;
}

/**
 * Update a user's pipeline quota (admin only)
 */
export async function updateUserQuota(uid: string, quota: number): Promise<void> {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}/email-auth-user-update-quota`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ uid, quota }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to update quota');
  }
}

/**
 * Reset a user's pipeline run count to 0 (admin only)
 */
export async function resetUserRuns(uid: string): Promise<void> {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}/email-auth-user-reset-runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ uid }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to reset runs');
  }
}
