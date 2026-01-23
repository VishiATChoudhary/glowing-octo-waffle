import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Key, Eye, EyeOff, Check, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';

const ApiKeys = () => {
  const {
    openaiApiKey,
    setOpenaiApiKey,
    geminiApiKey,
    setGeminiApiKey,
  } = useSettings();

  const [apiKeyInput, setApiKeyInput] = useState(openaiApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState(geminiApiKey);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);
  const { toast } = useToast();

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

  // Mask API key for display
  const maskedApiKey = apiKeyInput
    ? `${apiKeyInput.slice(0, 7)}${'•'.repeat(Math.max(0, apiKeyInput.length - 11))}${apiKeyInput.slice(-4)}`
    : '';

  const maskedGeminiKey = geminiKeyInput
    ? `${geminiKeyInput.slice(0, 7)}${'•'.repeat(Math.max(0, geminiKeyInput.length - 11))}${geminiKeyInput.slice(-4)}`
    : '';

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
        <h2 className="text-lg font-semibold">API Keys</h2>
        <p className="text-sm text-muted-foreground">
          Configure API keys for AI-powered features
        </p>
      </div>

      <div className="p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="w-4 h-4" />
                OpenAI
              </CardTitle>
              <CardDescription>
                Required for market analysis features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
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
                Get your key from{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  OpenAI Platform
                </a>
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="w-4 h-4" />
                Gemini
              </CardTitle>
              <CardDescription>
                Optional for AI-powered features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
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
                Get your key from{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Google AI Studio
                </a>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default ApiKeys;
