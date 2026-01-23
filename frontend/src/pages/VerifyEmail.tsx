/**
 * Verify Email Page - handles email verification via token
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail, resendVerification } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle, XCircle, Mail } from 'lucide-react';

type VerificationStatus = 'loading' | 'success' | 'error' | 'no-token';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<VerificationStatus>(token ? 'loading' : 'no-token');
  const [message, setMessage] = useState<string>('');
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const verify = async () => {
      try {
        const response = await verifyEmail(token);
        setStatus('success');
        setMessage(response.message);
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed');
      }
    };

    verify();
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResending(true);
    setResendMessage(null);

    try {
      const response = await resendVerification(resendEmail);
      setResendMessage(response.message);
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : 'Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold">Email Verified!</h1>
          <p className="text-muted-foreground">{message}</p>
          <Button asChild className="w-full">
            <Link to="/login">Sign in to your account</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <XCircle className="w-16 h-16 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold">Verification Failed</h1>
            <p className="text-muted-foreground">{message}</p>
          </div>

          {/* Resend form */}
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h2 className="font-medium">Request a new verification link</h2>
            <form onSubmit={handleResend} className="space-y-4">
              <Input
                type="email"
                placeholder="Enter your email"
                value={resendEmail}
                onChange={e => setResendEmail(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={isResending}>
                {isResending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Resend verification email
                  </>
                )}
              </Button>
            </form>
            {resendMessage && (
              <p className="text-sm text-muted-foreground text-center">{resendMessage}</p>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-foreground hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // no-token state
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Mail className="w-16 h-16 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-muted-foreground">
            We've sent a verification link to your email address. Click the link to verify your account.
          </p>
        </div>

        {/* Resend form */}
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="font-medium">Didn't receive the email?</h2>
          <form onSubmit={handleResend} className="space-y-4">
            <Input
              type="email"
              placeholder="Enter your email"
              value={resendEmail}
              onChange={e => setResendEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={isResending}>
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Resend verification email
                </>
              )}
            </Button>
          </form>
          {resendMessage && (
            <p className="text-sm text-muted-foreground text-center">{resendMessage}</p>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-foreground hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
