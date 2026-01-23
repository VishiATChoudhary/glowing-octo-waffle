/**
 * Whitelist Management Page - Admin only
 * Allows admins to add/remove emails from the registration whitelist
 */

import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  UserPlus,
  Trash2,
  Loader2,
  Shield,
  User,
  Mail,
  RefreshCw,
  Users,
  RotateCcw,
  Pencil,
  Check,
  X,
  Infinity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  listWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  validateEmail,
  listUsers,
  updateUserQuota,
  resetUserRuns,
  type WhitelistEntry,
  type UserWithQuota,
} from '@/services/authService';

export default function Whitelist() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [users, setUsers] = useState<UserWithQuota[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [formError, setFormError] = useState<string | null>(null);

  // Quota editing state
  const [editingQuota, setEditingQuota] = useState<string | null>(null);
  const [editQuotaValue, setEditQuotaValue] = useState<number>(10);
  const [isSavingQuota, setIsSavingQuota] = useState(false);
  const [isResettingRuns, setIsResettingRuns] = useState<string | null>(null);

  // Load whitelist and users on mount
  useEffect(() => {
    if (isAdmin) {
      loadWhitelist();
      loadUsers();
    }
  }, [isAdmin]);

  const loadWhitelist = async () => {
    setIsLoading(true);
    try {
      const data = await listWhitelist();
      setWhitelist(data);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load whitelist',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const email = newEmail.trim().toLowerCase();

    if (!email) {
      setFormError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setFormError('Invalid email format');
      return;
    }

    // Check if already in whitelist
    if (whitelist.some(entry => entry.email === email)) {
      setFormError('This email is already whitelisted');
      return;
    }

    setIsAdding(true);
    try {
      const entry = await addToWhitelist(email, newRole);
      setWhitelist(prev => [...prev, entry]);
      setNewEmail('');
      setNewRole('user');
      toast({
        title: 'Email Added',
        description: `${email} has been added to the whitelist as ${newRole}`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to add email',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveEmail = async (email: string) => {
    try {
      await removeFromWhitelist(email);
      setWhitelist(prev => prev.filter(entry => entry.email !== email));
      toast({
        title: 'Email Removed',
        description: `${email} has been removed from the whitelist`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to remove email',
        variant: 'destructive',
      });
    }
  };

  const handleStartEditQuota = (user: UserWithQuota) => {
    setEditingQuota(user.uid);
    setEditQuotaValue(user.pipeline_quota ?? 10);
  };

  const handleCancelEditQuota = () => {
    setEditingQuota(null);
    setEditQuotaValue(10);
  };

  const handleSaveQuota = async (uid: string) => {
    setIsSavingQuota(true);
    try {
      await updateUserQuota(uid, editQuotaValue);
      setUsers(prev =>
        prev.map(u => (u.uid === uid ? { ...u, pipeline_quota: editQuotaValue } : u))
      );
      setEditingQuota(null);
      toast({
        title: 'Quota Updated',
        description: `Pipeline quota has been updated to ${editQuotaValue}`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update quota',
        variant: 'destructive',
      });
    } finally {
      setIsSavingQuota(false);
    }
  };

  const handleResetRuns = async (user: UserWithQuota) => {
    setIsResettingRuns(user.uid);
    try {
      await resetUserRuns(user.uid);
      setUsers(prev =>
        prev.map(u => (u.uid === user.uid ? { ...u, pipeline_runs_used: 0 } : u))
      );
      toast({
        title: 'Runs Reset',
        description: `Pipeline run count for ${user.email} has been reset to 0`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to reset runs',
        variant: 'destructive',
      });
    } finally {
      setIsResettingRuns(null);
    }
  };

  // Redirect non-admins
  if (!authLoading && !isAdmin) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="p-6 border-b border-border">
        <Link
          to="/settings"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Settings
        </Link>
        <h2 className="text-lg font-semibold">User Whitelist</h2>
        <p className="text-sm text-muted-foreground">
          Manage which email addresses can register for an account
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Add Email Form */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Add Email to Whitelist
              </CardTitle>
              <CardDescription>
                Only whitelisted emails can register for an account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddEmail} className="space-y-4">
                {formError && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                    {formError}
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={newEmail}
                      onChange={e => {
                        setNewEmail(e.target.value);
                        setFormError(null);
                      }}
                      disabled={isAdding}
                    />
                  </div>

                  <div className="w-32 space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={newRole}
                      onValueChange={(value: 'user' | 'admin') => setNewRole(value)}
                      disabled={isAdding}
                    >
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3" />
                            User
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="w-3 h-3" />
                            Admin
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button type="submit" disabled={isAdding || !newEmail.trim()}>
                      {isAdding ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Whitelist Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Whitelisted Emails
                  </CardTitle>
                  <CardDescription>
                    {whitelist.length} email{whitelist.length !== 1 ? 's' : ''} in whitelist
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadWhitelist}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : whitelist.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No emails in whitelist</p>
                  <p className="text-sm">Add an email above to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Added By</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {whitelist.map(entry => (
                      <TableRow key={entry.email}>
                        <TableCell className="font-medium">{entry.email}</TableCell>
                        <TableCell>
                          <Badge variant={entry.role === 'admin' ? 'default' : 'secondary'}>
                            {entry.role === 'admin' ? (
                              <Shield className="w-3 h-3 mr-1" />
                            ) : (
                              <User className="w-3 h-3 mr-1" />
                            )}
                            {entry.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.added_by}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove from whitelist?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove <strong>{entry.email}</strong> from the whitelist.
                                  They will no longer be able to register for an account.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveEmail(entry.email)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Registered Users with Quota Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Registered Users
                  </CardTitle>
                  <CardDescription>
                    {users.length} registered user{users.length !== 1 ? 's' : ''} - Manage pipeline quotas
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadUsers}
                  disabled={isLoadingUsers}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No registered users yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Quota</TableHead>
                      <TableHead>Runs Used</TableHead>
                      <TableHead className="w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.uid}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role === 'admin' ? (
                              <Shield className="w-3 h-3 mr-1" />
                            ) : (
                              <User className="w-3 h-3 mr-1" />
                            )}
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.role === 'admin' ? (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Infinity className="w-4 h-4" />
                              Unlimited
                            </span>
                          ) : editingQuota === user.uid ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                value={editQuotaValue}
                                onChange={e => setEditQuotaValue(parseInt(e.target.value) || 0)}
                                className="w-20 h-8"
                                disabled={isSavingQuota}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSaveQuota(user.uid)}
                                disabled={isSavingQuota}
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                              >
                                {isSavingQuota ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEditQuota}
                                disabled={isSavingQuota}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{user.pipeline_quota ?? 10}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStartEditQuota(user)}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.role === 'admin' ? (
                            <span className="text-muted-foreground">N/A</span>
                          ) : (
                            <span className={
                              (user.pipeline_runs_used ?? 0) >= (user.pipeline_quota ?? 10)
                                ? 'text-red-500 font-medium'
                                : ''
                            }>
                              {user.pipeline_runs_used ?? 0}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.role !== 'admin' && (user.pipeline_runs_used ?? 0) > 0 && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isResettingRuns === user.uid}
                                  className="text-xs"
                                >
                                  {isResettingRuns === user.uid ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-3 h-3 mr-1" />
                                  )}
                                  Reset Runs
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reset pipeline runs?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will reset the pipeline run count for <strong>{user.email}</strong> to 0,
                                    allowing them to run {user.pipeline_quota ?? 10} more pipelines.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleResetRuns(user)}>
                                    Reset
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
