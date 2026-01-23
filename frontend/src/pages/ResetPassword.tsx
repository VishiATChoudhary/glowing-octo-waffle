/**
 * Reset Password Page - set new password with reset token
 */

import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword, validatePassword } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, Check, X, CheckCircle, XCircle } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password requirements
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid reset link');
      return;
    }

    // Validate password
    const validation = validatePassword(password);
    if (!validation.valid) {
      setError(validation.error || 'Invalid password');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword(token, password);
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
    <div className={`flex items-center gap-2 text-xs ${met ? 'text-green-600' : 'text-muted-foreground'}`}>
      {met ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {text}
    </div>
  );

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <XCircle className="w-16 h-16 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Invalid Reset Link</h1>
          <p className="text-muted-foreground">
            This password reset link is invalid or has expired.
          </p>
          <Button asChild className="w-full">
            <Link to="/forgot-password">Request a new reset link</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold">Password Reset!</h1>
          <p className="text-muted-foreground">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/waffle-icon.svg" alt="Waffles" className="w-16 h-16" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Reset your password</h1>
          <p className="text-muted-foreground mt-2">Enter your new password below</p>
        </div>

        {/* Form */}
        <div className="bg-card border rounded-lg p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Password requirements */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <RequirementItem met={hasMinLength} text="At least 8 characters" />
                  <RequirementItem met={hasUppercase} text="One uppercase letter" />
                  <RequirementItem met={hasLowercase} text="One lowercase letter" />
                  <RequirementItem met={hasNumber} text="One number" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              {confirmPassword.length > 0 && (
                <div className="mt-1">
                  <RequirementItem met={passwordsMatch} text="Passwords match" />
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !passwordsMatch}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset password'
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-foreground hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
