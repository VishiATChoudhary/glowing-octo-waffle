import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Key, AlertTriangle, Trash2, Loader2, ChevronRight, Database, MessageSquare, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettings, defaultPrompts } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { checkDevMode, clearDatabase } from '@/services/pipelineService';
import { useResearchers } from '@/contexts/ResearchersContext';
import { usePapers } from '@/contexts/PapersContext';
import { useAuth } from '@/contexts/AuthContext';

const Settings = () => {
  const {
    openaiApiKey,
    geminiApiKey,
    integrations,
    prompts,
  } = useSettings();

  const { loadFromDatabase: reloadResearchers } = useResearchers();
  const { loadPapers: reloadPapers } = usePapers();
  const { isAdmin } = useAuth();

  const { toast } = useToast();

  // Dev Mode state
  const [devMode, setDevMode] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Check if DEV_MODE is enabled
  useEffect(() => {
    checkDevMode().then(setDevMode);
  }, []);

  const enabledCount = integrations.filter((int) => int.enabled).length;
  const configuredKeysCount = [openaiApiKey, geminiApiKey].filter(Boolean).length;
  const modifiedPromptsCount = prompts.filter(p => {
    const defaultPrompt = defaultPrompts.find(d => d.id === p.id);
    return defaultPrompt && (
      p.systemPrompt !== defaultPrompt.systemPrompt ||
      p.userPrompt !== defaultPrompt.userPrompt
    );
  }).length;

  return (
    <div className="h-screen overflow-y-auto">
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure API keys and paper sources
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* API Keys Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link to="/settings/api-keys">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  <CardTitle className="text-base">API Keys</CardTitle>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {configuredKeysCount} of 2 keys configured
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        {/* Paper Sources Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link to="/settings/paper-sources">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <CardTitle className="text-base">Paper Sources</CardTitle>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {enabledCount} of {integrations.length} sources active
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        {/* Prompts Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Link to="/settings/prompts">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <CardTitle className="text-base">Prompts</CardTitle>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {modifiedPromptsCount > 0
                    ? `${modifiedPromptsCount} of ${prompts.length} prompts customized`
                    : `${prompts.length} prompts using defaults`}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        {/* User Whitelist Link - Admin only */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Link to="/settings/whitelist">
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <CardTitle className="text-base">User Whitelist</CardTitle>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Manage which emails can register
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        )}

        {/* Danger Zone - Only visible in DEV_MODE */}
        {devMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-destructive/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                </div>
                <CardDescription>
                  Destructive actions that cannot be undone. Only available in DEV_MODE.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                    <div>
                      <h4 className="font-medium">Clear All Database Data</h4>
                      <p className="text-sm text-muted-foreground">
                        Permanently delete all researchers, papers, authorship links, and viability scores from the GCP database.
                      </p>
                    </div>
                    {!showClearConfirm ? (
                      <Button
                        variant="destructive"
                        onClick={() => setShowClearConfirm(true)}
                        className="gap-2 ml-4"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear Database
                      </Button>
                    ) : (
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          onClick={() => setShowClearConfirm(false)}
                          disabled={isClearing}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={isClearing}
                          onClick={async () => {
                            setIsClearing(true);
                            try {
                              const result = await clearDatabase();
                              toast({
                                title: 'Database Cleared',
                                description: `Deleted ${result.papers_deleted} papers, ${result.researchers_deleted} researchers, ${result.authorship_deleted} authorship links, ${result.viability_deleted} viability scores.`,
                              });
                              // Reload the contexts to reflect empty data
                              reloadResearchers();
                              reloadPapers();
                            } catch (error) {
                              toast({
                                title: 'Error',
                                description: error instanceof Error ? error.message : 'Failed to clear database',
                                variant: 'destructive',
                              });
                            } finally {
                              setIsClearing(false);
                              setShowClearConfirm(false);
                            }
                          }}
                          className="gap-2"
                        >
                          {isClearing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          {isClearing ? 'Clearing...' : 'Confirm Delete'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Settings;
