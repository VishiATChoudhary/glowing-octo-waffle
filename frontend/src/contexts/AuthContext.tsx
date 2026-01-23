/**
 * Auth Context - unified authentication state for both Google OAuth and Email auth
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useToast } from '@/hooks/use-toast';
import * as authService from '@/services/authService';
import * as gmailService from '@/services/gmailService';
import type { AuthUser } from '@/services/authService';

interface AuthContextType {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  error: string | null;
  isAdmin: boolean;

  // Email auth actions
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;

  // Google OAuth actions
  loginWithGoogle: () => Promise<void>;
  handleOAuthCallback: (code: string, state: string) => Promise<boolean>;

  // Common actions
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getRedirectUri = () => {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/auth/callback`;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // First check auth service (unified storage)
        const storedUser = authService.getStoredUser();
        const sessionToken = authService.getSessionToken();

        if (sessionToken && storedUser) {
          // Verify session is still valid
          const status = await authService.checkAuthStatus();
          if (status.authenticated && status.user) {
            setUser(status.user);
            setIsAuthenticated(true);
          } else {
            // Session expired, clear data
            authService.clearAuthData();
          }
        } else {
          // Check legacy gmail storage for backward compatibility
          const gmailToken = gmailService.getSessionToken();
          const gmailUser = gmailService.getStoredUser();

          if (gmailToken && gmailUser) {
            // Migrate to unified storage - fetch fresh data from backend to get role
            const gmailStatus = await gmailService.checkAuthStatus();
            if (gmailStatus.authenticated && gmailStatus.user) {
              const authUser: AuthUser = {
                uid: gmailStatus.user.uid,
                email: gmailStatus.user.email,
                name: gmailStatus.user.name,
                picture: gmailStatus.user.picture,
                auth_provider: 'google',
                role: gmailStatus.user.role || 'user',
              };
              authService.storeAuthData(gmailToken, authUser);
              setUser(authUser);
              setIsAuthenticated(true);
            } else {
              // Session expired
              gmailService.clearAuthData();
            }
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  // Login with email/password
  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await authService.login(email, password);

        setUser(response.user);
        setIsAuthenticated(true);

        toast({
          title: 'Welcome back!',
          description: `Signed in as ${response.user.email}`,
        });

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
        toast({
          title: 'Login Failed',
          description: message,
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  // Register new user (auto-logged in after registration)
  const register = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await authService.register(email, password, name);

        // Auto-login after registration
        setUser(response.user);
        setIsAuthenticated(true);

        toast({
          title: 'Welcome!',
          description: `Account created and signed in as ${response.user.email}`,
        });

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        setError(message);
        toast({
          title: 'Registration Failed',
          description: message,
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  // Login with Google (start OAuth flow)
  const loginWithGoogle = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { auth_url } = await gmailService.initOAuth(getRedirectUri());

      // Redirect to Google OAuth
      window.location.href = auth_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      toast({
        title: 'Connection Failed',
        description: message,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  }, [toast]);

  // Handle OAuth callback
  const handleOAuthCallback = useCallback(
    async (code: string, state: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await gmailService.exchangeCode(code, state, getRedirectUri());

        // Create auth user from gmail response
        const authUser: AuthUser = {
          uid: response.user.uid,
          email: response.user.email,
          name: response.user.name,
          picture: response.user.picture,
          auth_provider: 'google',
          role: response.user.role || 'user',
        };

        // Store in unified auth storage
        authService.storeAuthData(response.session_token, authUser);

        setUser(authUser);
        setIsAuthenticated(true);

        toast({
          title: 'Welcome!',
          description: `Signed in as ${response.user.email}`,
        });

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setError(message);
        toast({
          title: 'Authentication Failed',
          description: message,
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  // Logout
  const logout = useCallback(async () => {
    try {
      // Logout from auth service
      await authService.logout();

      // Also revoke Gmail auth if it exists
      const gmailToken = gmailService.getSessionToken();
      if (gmailToken) {
        await gmailService.revokeAuth();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }

    setUser(null);
    setIsAuthenticated(false);

    toast({
      title: 'Signed out',
      description: 'You have been signed out successfully',
    });
  }, [toast]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        error,
        isAdmin: user?.role === 'admin',
        loginWithEmail,
        register,
        loginWithGoogle,
        handleOAuthCallback,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
