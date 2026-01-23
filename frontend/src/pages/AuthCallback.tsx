/**
 * OAuth Callback Page - handles the redirect from Google OAuth
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Handle OAuth error
      if (errorParam) {
        setError(errorDescription || `OAuth error: ${errorParam}`);
        setIsProcessing(false);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        setError('Missing authorization code or state parameter');
        setIsProcessing(false);
        return;
      }

      // Exchange code for tokens
      const success = await handleOAuthCallback(code, state);

      if (success) {
        // Get intended destination or default to home
        const redirectTo = sessionStorage.getItem('auth_redirect') || '/';
        sessionStorage.removeItem('auth_redirect');
        navigate(redirectTo, { replace: true });
      } else {
        setError('Failed to complete authentication');
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [searchParams, handleOAuthCallback, navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <AlertCircle className="w-12 h-12 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold">Authentication Failed</h1>
          <p className="text-muted-foreground">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => navigate('/login')}>
              Back to Login
            </Button>
            <Button onClick={() => navigate('/login')}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Completing authentication...</p>
        </div>
      </div>
    );
  }

  return null;
}
