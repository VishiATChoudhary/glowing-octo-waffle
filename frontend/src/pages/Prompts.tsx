import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, RotateCcw, Save, Check, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import { useSettings, defaultPrompts, PromptConfig } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';

const Prompts = () => {
  // Check demo mode (frontend env var)
  const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';

  const { prompts, updatePrompt, resetPrompt, resetAllPrompts } = useSettings();
  const { toast } = useToast();

  // Track which prompts have unsaved changes
  const [editedPrompts, setEditedPrompts] = useState<Record<string, PromptConfig>>({});
  const [savedPrompts, setSavedPrompts] = useState<Record<string, boolean>>({});

  const handleChange = (id: string, field: 'systemPrompt' | 'userPrompt', value: string) => {
    const currentPrompt = prompts.find(p => p.id === id);
    if (!currentPrompt) return;

    setEditedPrompts(prev => ({
      ...prev,
      [id]: {
        ...currentPrompt,
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSave = (id: string) => {
    const edited = editedPrompts[id];
    if (edited) {
      updatePrompt(edited);
      setEditedPrompts(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      setSavedPrompts(prev => ({ ...prev, [id]: true }));
      toast({
        title: 'Prompt Saved',
        description: `${edited.name} prompt has been updated.`,
      });
      setTimeout(() => {
        setSavedPrompts(prev => ({ ...prev, [id]: false }));
      }, 2000);
    }
  };

  const handleReset = (id: string) => {
    resetPrompt(id);
    setEditedPrompts(prev => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    const prompt = defaultPrompts.find(p => p.id === id);
    toast({
      title: 'Prompt Reset',
      description: `${prompt?.name} has been reset to default.`,
    });
  };

  const handleResetAll = () => {
    resetAllPrompts();
    setEditedPrompts({});
    toast({
      title: 'All Prompts Reset',
      description: 'All prompts have been reset to their defaults.',
    });
  };

  const getPromptValue = (id: string, field: 'systemPrompt' | 'userPrompt') => {
    if (editedPrompts[id]) {
      return editedPrompts[id][field];
    }
    const prompt = prompts.find(p => p.id === id);
    return prompt?.[field] || '';
  };

  const hasChanges = (id: string) => {
    const edited = editedPrompts[id];
    if (!edited) return false;
    const original = prompts.find(p => p.id === id);
    return (
      edited.systemPrompt !== original?.systemPrompt ||
      edited.userPrompt !== original?.userPrompt
    );
  };

  const isModifiedFromDefault = (id: string) => {
    const current = prompts.find(p => p.id === id);
    const defaultPrompt = defaultPrompts.find(p => p.id === id);
    if (!current || !defaultPrompt) return false;
    return (
      current.systemPrompt !== defaultPrompt.systemPrompt ||
      current.userPrompt !== defaultPrompt.userPrompt
    );
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Prompts</h2>
            <p className="text-sm text-muted-foreground">
              Customize AI prompts for various features
            </p>
          </div>
          {!demoMode && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset All
                </Button>
              </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all prompts?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset all prompts to their default values. Any customizations will be lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetAll}>Reset All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          )}
        </div>
      </div>

      {demoMode && (
        <div className="mx-6 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Prompt customization is disabled in demo mode. In production, you can fully customize all AI prompts to match your workflow.
          </p>
        </div>
      )}

      <div className="p-6">
        <Accordion type="single" collapsible className="space-y-4">
          {prompts.map((prompt, index) => (
            <motion.div
              key={prompt.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <AccordionItem value={prompt.id} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{prompt.name}</span>
                        {isModifiedFromDefault(prompt.id) && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Modified
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-normal">
                        {prompt.description}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${prompt.id}-system`}>System Prompt</Label>
                      <Textarea
                        id={`${prompt.id}-system`}
                        value={getPromptValue(prompt.id, 'systemPrompt')}
                        onChange={(e) => handleChange(prompt.id, 'systemPrompt', e.target.value)}
                        placeholder="Enter system prompt..."
                        className="min-h-[120px] font-mono text-sm"
                        disabled={demoMode}
                      />
                      <p className="text-xs text-muted-foreground">
                        Sets the AI's behavior and role for this task
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${prompt.id}-user`}>User Prompt Template</Label>
                      <Textarea
                        id={`${prompt.id}-user`}
                        value={getPromptValue(prompt.id, 'userPrompt')}
                        onChange={(e) => handleChange(prompt.id, 'userPrompt', e.target.value)}
                        placeholder="Enter user prompt template..."
                        className="min-h-[200px] font-mono text-sm"
                        disabled={demoMode}
                      />
                      <p className="text-xs text-muted-foreground">
                        Template with placeholders like {'{variable}'} that get filled in at runtime
                      </p>
                    </div>

                    {!demoMode && (
                      <div className="flex justify-end gap-2 pt-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!isModifiedFromDefault(prompt.id) && !hasChanges(prompt.id)}
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Reset to Default
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reset this prompt?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will reset "{prompt.name}" to its default value. Your customizations will be lost.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleReset(prompt.id)}>
                                Reset
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button
                          size="sm"
                          onClick={() => handleSave(prompt.id)}
                          disabled={!hasChanges(prompt.id)}
                          className="gap-1"
                        >
                          {savedPrompts[prompt.id] ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          {savedPrompts[prompt.id] ? 'Saved' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </div>
  );
};

export default Prompts;
