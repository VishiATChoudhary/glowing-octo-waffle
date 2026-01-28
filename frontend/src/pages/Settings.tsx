import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Key, Eye, EyeOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import IntegrationCard from '@/components/IntegrationCard';
import IntegrationModal from '@/components/IntegrationModal';
import { Integration } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';

const Settings = () => {
  const {
    openaiApiKey,
    setOpenaiApiKey,
    geminiApiKey,
    setGeminiApiKey,
    integrations,
    toggleIntegration,
    updateIntegration,
    addIntegration,
  } = useSettings();

  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewIntegration, setIsNewIntegration] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(openaiApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState(geminiApiKey);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);
  const { toast } = useToast();

  const handleToggle = (id: string, enabled: boolean) => {
    toggleIntegration(id, enabled);
    const integration = integrations.find((int) => int.id === id);
    toast({
      title: enabled ? 'Integration Enabled' : 'Integration Disabled',
      description: `${integration?.name} has been ${enabled ? 'enabled' : 'disabled'}.`,
    });
  };

  const handleEdit = (integration: Integration) => {
    setEditingIntegration(integration);
    setIsNewIntegration(false);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingIntegration(null);
    setIsNewIntegration(true);
    setIsModalOpen(true);
  };

  const handleSave = (integration: Integration) => {
    if (isNewIntegration) {
      addIntegration(integration);
      toast({
        title: 'Integration Added',
        description: `${integration.name} has been added successfully.`,
      });
    } else {
      updateIntegration(integration);
      toast({
        title: 'Integration Updated',
        description: `${integration.name} has been updated.`,
      });
    }
  };

  const handleSaveApiKey = () => {
    setOpenaiApiKey(apiKeyInput);
    setApiKeySaved(true);
    toast({
      title: 'API Key Saved',
      description: 'Your OpenAI API key has been saved.',
    });
    setTimeout(() => setApiKeySaved(false), 2000);
  };

  const handleClearApiKey = () => {
    setApiKeyInput('');
    setOpenaiApiKey('');
    toast({
      title: 'API Key Cleared',
      description: 'Your OpenAI API key has been removed.',
    });
  };

  const handleSaveGeminiKey = () => {
    setGeminiApiKey(geminiKeyInput);
    setGeminiKeySaved(true);
    toast({
      title: 'API Key Saved',
      description: 'Your Gemini API key has been saved.',
    });
    setTimeout(() => setGeminiKeySaved(false), 2000);
  };

  const handleClearGeminiKey = () => {
    setGeminiKeyInput('');
    setGeminiApiKey('');
    toast({
      title: 'API Key Cleared',
      description: 'Your Gemini API key has been removed.',
    });
  };

  const enabledCount = integrations.filter((int) => int.enabled).length;

  // Mask API key for display
  const maskedApiKey = apiKeyInput
    ? `${apiKeyInput.slice(0, 7)}${'•'.repeat(Math.max(0, apiKeyInput.length - 11))}${apiKeyInput.slice(-4)}`
    : '';

  const maskedGeminiKey = geminiKeyInput
    ? `${geminiKeyInput.slice(0, 7)}${'•'.repeat(Math.max(0, geminiKeyInput.length - 11))}${geminiKeyInput.slice(-4)}`
    : '';

  return (
    <div className="h-screen overflow-y-auto">
      <div className="relative overflow-hidden p-6 border-b border-border bg-background">
        {/* Static Gradient Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 blur-3xl">
            <div
              className="absolute w-[500px] h-[500px] rounded-full opacity-50"
              style={{
                background: '#FDE047',
                top: '-30%',
                left: '5%',
              }}
            />
            <div
              className="absolute w-[600px] h-[600px] rounded-full opacity-50"
              style={{
                background: '#FBBF24',
                top: '-40%',
                left: '35%',
              }}
            />
            <div
              className="absolute w-[700px] h-[700px] rounded-full opacity-60"
              style={{
                background: '#F59E0B',
                top: '-50%',
                right: '-20%',
              }}
            />
          </div>
        </div>
        <div className="relative z-10">
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure API keys and paper sources
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* API Keys Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Keys
              </CardTitle>
              <CardDescription>
                Configure API keys for AI-powered features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">OpenAI API Key</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value={showApiKey ? apiKeyInput : maskedApiKey}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      onFocus={() => setShowApiKey(true)}
                      placeholder="sk-..."
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput || apiKeyInput === openaiApiKey}
                    className="gap-1"
                  >
                    {apiKeySaved ? <Check className="w-4 h-4" /> : null}
                    {apiKeySaved ? 'Saved' : 'Save'}
                  </Button>
                  {openaiApiKey && (
                    <Button variant="outline" onClick={handleClearApiKey}>
                      Clear
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Required for market analysis features. Get your key from{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    OpenAI Platform
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Gemini API Key</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={showGeminiKey ? geminiKeyInput : maskedGeminiKey}
                      onChange={(e) => setGeminiKeyInput(e.target.value)}
                      onFocus={() => setShowGeminiKey(true)}
                      placeholder="AIza..."
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showGeminiKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    onClick={handleSaveGeminiKey}
                    disabled={!geminiKeyInput || geminiKeyInput === geminiApiKey}
                    className="gap-1"
                  >
                    {geminiKeySaved ? <Check className="w-4 h-4" /> : null}
                    {geminiKeySaved ? 'Saved' : 'Save'}
                  </Button>
                  {geminiApiKey && (
                    <Button variant="outline" onClick={handleClearGeminiKey}>
                      Clear
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Optional for AI-powered features. Get your key from{' '}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Paper Sources Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold">Paper Sources</h3>
              <p className="text-sm text-muted-foreground">
                {enabledCount} of {integrations.length} sources active
              </p>
            </div>
            <Button onClick={handleAdd} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </Button>
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
            className="grid gap-4"
          >
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onToggle={handleToggle}
                onEdit={handleEdit}
              />
            ))}
          </motion.div>
        </motion.div>
      </div>

      <IntegrationModal
        integration={editingIntegration}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        isNew={isNewIntegration}
      />
    </div>
  );
};

export default Settings;
