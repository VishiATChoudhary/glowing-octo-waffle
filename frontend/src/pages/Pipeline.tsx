/**
 * Pipeline Page
 *
 * Automated research paper discovery pipeline with real-time log streaming.
 * - Search form with query, source toggles, and max results
 * - "Run Pipeline" button to start the process
 * - Real-time log display with auto-scroll
 * - Progress indicators showing current step
 * - Results summary when complete
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  Users,
  TrendingUp,
  Sparkles,
  Calculator,
  Save,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  FlaskConical,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import {
  runPipeline,
  runSearchPhase,
  runProcessingPhase,
  checkDevMode,
  testDatabase,
  getQuotaStatus,
  LogEntry,
  PipelineStep,
  PipelineResult,
  QuotaStatus,
} from '@/services/pipelineService';
import { useSettings } from '@/contexts/SettingsContext';
import { useResearchers } from '@/contexts/ResearchersContext';
import { usePapers } from '@/contexts/PapersContext';
import { usePipeline, STEPS, StepState } from '@/contexts/PipelineContext';
import { PaperSelectionModal } from '@/components/PaperSelectionModal';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

const STEP_CONFIG: Record<PipelineStep, { label: string; icon: typeof Search }> = {
  expand: { label: 'Expand Keywords', icon: Lightbulb },
  search: { label: 'Search Papers', icon: Search },
  extract: { label: 'Extract Researchers', icon: Users },
  viability: { label: 'Analyze Viability', icon: TrendingUp },
  enrich: { label: 'Enrich Data', icon: Sparkles },
  aggregate: { label: 'Compute Aggregates', icon: Calculator },
  save: { label: 'Save Results', icon: Save },
};

// =============================================================================
// Components
// =============================================================================

function StepIndicator({
  step,
  state,
  isActive,
}: {
  step: PipelineStep;
  state: StepState;
  isActive: boolean;
}) {
  const config = STEP_CONFIG[step];
  const Icon = config.icon;

  const getStatusIcon = () => {
    switch (state.status) {
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      default:
        return <Icon className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-primary/10 border border-primary/20'
          : state.status === 'complete'
          ? 'bg-green-500/10'
          : state.status === 'error'
          ? 'bg-red-500/10'
          : 'bg-muted/50'
      }`}
    >
      {getStatusIcon()}
      <span
        className={`text-sm ${
          isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
        }`}
      >
        {config.label}
      </span>
      {state.progress && state.status === 'running' && (
        <Badge variant="secondary" className="ml-auto text-xs">
          {state.progress.current}/{state.progress.total}
        </Badge>
      )}
    </div>
  );
}

function LogLine({ log, index }: { log: LogEntry; index: number }) {
  const getStepColor = (step: PipelineStep): string => {
    switch (step) {
      case 'expand':
        return 'text-yellow-500';
      case 'search':
        return 'text-blue-500';
      case 'extract':
        return 'text-purple-500';
      case 'viability':
        return 'text-orange-500';
      case 'enrich':
        return 'text-pink-500';
      case 'aggregate':
        return 'text-cyan-500';
      case 'save':
        return 'text-green-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusIcon = () => {
    if (log.status === 'complete' && log.message.includes('complete')) {
      return <span className="text-green-500 mr-1">&#10003;</span>;
    }
    if (log.status === 'error') {
      return <span className="text-red-500 mr-1">&#10007;</span>;
    }
    if (log.message.startsWith('  ')) {
      return <span className="text-muted-foreground mr-1">&#8594;</span>;
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className="font-mono text-sm py-0.5"
    >
      <span className={`${getStepColor(log.step)} font-medium`}>[{log.step}]</span>{' '}
      {getStatusIcon()}
      <span
        className={
          log.status === 'error'
            ? 'text-red-400'
            : log.status === 'complete'
            ? 'text-foreground'
            : 'text-muted-foreground'
        }
      >
        {log.message}
      </span>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

const Pipeline = () => {
  // Check demo mode (frontend env var)
  const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';

  // Contexts
  const { openaiApiKey, geminiApiKey, getIntegration } = useSettings();
  const { loadFromDatabase: loadResearchers } = useResearchers();
  const { loadPapers } = usePapers();
  const {
    state: pipelineState,
    setIsRunning,
    addLog,
    setResult,
    setLastQuery,
    resetPipeline,
    setPhase,
    setSearchResults,
    togglePaperSelection,
    selectAllPapers,
    selectNoPapers,
    selectHighViabilityPapers,
    getSelectedPapers,
  } = usePipeline();

  // Form state
  const [query, setQuery] = useState(pipelineState.lastQuery);
  const [maxResults, setMaxResults] = useState(demoMode ? 5 : 20);
  const [sources, setSources] = useState({
    arxiv: true,
    semanticScholar: true,
    openalex: true,
  });
  const [skipViability, setSkipViability] = useState(false);
  const [skipEnrichment, setSkipEnrichment] = useState(false);
  const [skipExpansion, setSkipExpansion] = useState(false);
  const [numKeywords, setNumKeywords] = useState(5);
  const [maxResearchers, setMaxResearchers] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoMode, setAutoMode] = useState(false);

  // Dev mode state
  const [isDevMode, setIsDevMode] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Quota state
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);

  // Toast for notifications
  const { toast } = useToast();

  // Refs
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Check dev mode on mount
  useEffect(() => {
    checkDevMode().then(setIsDevMode).catch(() => setIsDevMode(false));
  }, []);

  // Fetch quota status on mount
  const refreshQuota = useCallback(async () => {
    const status = await getQuotaStatus();
    setQuotaStatus(status);
  }, []);

  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [pipelineState.logs]);

  // Handle database test
  const handleTestDatabase = async () => {
    if (isTestRunning) return;

    setIsTestRunning(true);
    setTestResult(null);

    try {
      const result = await testDatabase();
      setTestResult({
        success: result.success,
        message: result.success
          ? `DB test passed: ${result.paperTested?.title?.slice(0, 30)}...`
          : result.error || 'Test failed',
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      });
    } finally {
      setIsTestRunning(false);
      // Clear result after 5 seconds
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  // Handle log entry
  const handleLog = useCallback((log: LogEntry) => {
    // In demo mode, suppress scraping source errors (search step errors)
    if (demoMode && log.status === 'error' && log.step === 'search') {
      // Silently ignore scraping errors
      return;
    }
    addLog(log);
  }, [addLog, demoMode]);

  // Build sources array helper
  const getSelectedSources = (): ('arxiv' | 'semantic-scholar' | 'openalex')[] => {
    const selectedSources: ('arxiv' | 'semantic-scholar' | 'openalex')[] = [];
    if (sources.arxiv) selectedSources.push('arxiv');
    if (sources.semanticScholar) selectedSources.push('semantic-scholar');
    if (sources.openalex) selectedSources.push('openalex');
    return selectedSources;
  };

  // Get API keys from settings helper
  const getApiKeys = () => {
    const perplexityIntegration = getIntegration('perplexity');

    // In demo mode, use API keys from environment variables
    if (demoMode) {
      return {
        gemini: import.meta.env.VITE_GEMINI_API_KEY || undefined,
        openai: import.meta.env.VITE_OPENAI_API_KEY || undefined,
        perplexity: import.meta.env.VITE_PERPLEXITY_API_KEY || undefined,
      };
    }

    return {
      gemini: geminiApiKey || undefined,
      openai: openaiApiKey || undefined,
      perplexity: perplexityIntegration?.apiKey || undefined,
    };
  };

  // Run pipeline (Auto Mode) or Search Phase (Manual Mode)
  const handleRunPipeline = async () => {
    if (!query.trim() || pipelineState.isRunning) return;

    // Reset state and start
    resetPipeline();
    setIsRunning(true);
    setLastQuery(query.trim());

    const selectedSources = getSelectedSources();
    const apiKeys = getApiKeys();

    if (autoMode) {
      // Auto Mode: Run full pipeline with auto-filtering
      setPhase('processing');
      try {
        const pipelineResult = await runPipeline(
          {
            query: query.trim(),
            sources: selectedSources,
            maxResults,
            maxResearchers: skipEnrichment ? 0 : maxResearchers,
            skipViability,
            skipEnrichment,
            skipExpansion,
            numKeywords,
            autoMode: true,
            viabilityThreshold: 3.5,
            apiKeys,
          },
          handleLog
        );
        setResult(pipelineResult);
        setPhase('complete');

        if (pipelineResult.success) {
          loadResearchers();
          loadPapers();
        }
        // Refresh quota after pipeline run
        refreshQuota();
      } catch (error) {
        console.error('Pipeline error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Check for quota exceeded error
        if (errorMessage.includes('quota exceeded') || errorMessage.includes('403')) {
          toast({
            title: 'Quota Exceeded',
            description: 'You have reached your pipeline run limit. Contact an admin for more runs.',
            variant: 'destructive',
          });
          refreshQuota();
        }

        setResult({
          success: false,
          papersTotal: 0,
          researchersTotal: 0,
          newPapers: 0,
          newResearchers: 0,
          error: errorMessage,
        });
        setPhase('idle');
      }
    } else {
      // Manual Mode: Run search phase, then show selection modal
      setPhase('searching');
      try {
        const searchResult = await runSearchPhase(
          {
            query: query.trim(),
            sources: selectedSources,
            maxResults,
            skipViability,
            skipExpansion,
            numKeywords,
            apiKeys,
          },
          handleLog
        );
        setSearchResults(searchResult);
        setIsRunning(false);
        // Phase is automatically set to 'selecting' by setSearchResults
      } catch (error) {
        console.error('Search phase error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Check for quota exceeded error
        if (errorMessage.includes('quota exceeded') || errorMessage.includes('403')) {
          toast({
            title: 'Quota Exceeded',
            description: 'You have reached your pipeline run limit. Contact an admin for more runs.',
            variant: 'destructive',
          });
          refreshQuota();
        }

        setResult({
          success: false,
          papersTotal: 0,
          researchersTotal: 0,
          newPapers: 0,
          newResearchers: 0,
          error: errorMessage,
        });
        setPhase('idle');
        setIsRunning(false);
      }
    }
  };

  // Handle paper selection confirmation (Manual Mode)
  const handleConfirmSelection = async () => {
    if (!pipelineState.searchResults) return;

    const selectedPapers = getSelectedPapers();
    if (selectedPapers.length === 0) return;

    setIsRunning(true);
    setPhase('processing');

    const apiKeys = getApiKeys();

    try {
      const pipelineResult = await runProcessingPhase(
        {
          sessionId: pipelineState.searchResults.sessionId,
          selectedPapers,
          keywords: pipelineState.searchResults.keywords,
          viabilityScores: pipelineState.searchResults.viabilityScores,
          skipEnrichment,
          maxResearchers: skipEnrichment ? 0 : maxResearchers,
          apiKeys,
        },
        handleLog
      );
      setResult(pipelineResult);
      setPhase('complete');

      if (pipelineResult.success) {
        loadResearchers();
        loadPapers();
      }
      // Refresh quota after processing
      refreshQuota();
    } catch (error) {
      console.error('Processing phase error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for quota exceeded error
      if (errorMessage.includes('quota exceeded') || errorMessage.includes('403')) {
        toast({
          title: 'Quota Exceeded',
          description: 'You have reached your pipeline run limit. Contact an admin for more runs.',
          variant: 'destructive',
        });
        refreshQuota();
      }

      setResult({
        success: false,
        papersTotal: 0,
        researchersTotal: 0,
        newPapers: 0,
        newResearchers: 0,
        error: errorMessage,
      });
    }
  };

  // Handle cancel selection (Manual Mode)
  const handleCancelSelection = () => {
    setPhase('idle');
    setSearchResults(null);
    setIsRunning(false);
  };

  // Aliases for cleaner code
  const isRunning = pipelineState.isRunning;
  const logs = pipelineState.logs;
  const steps = pipelineState.steps;
  const currentStep = pipelineState.currentStep;
  const result = pipelineState.result;

  // Calculate overall progress
  const completedSteps = STEPS.filter((s) => steps[s].status === 'complete').length;
  const overallProgress = isRunning ? (completedSteps / STEPS.length) * 100 : 0;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="p-6 border-b border-border flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Research Pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Automated paper discovery, researcher extraction, and viability analysis
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Quota Display */}
          {quotaStatus && !quotaStatus.unlimited && (
            <div className={`text-sm px-3 py-1.5 rounded-md ${
              quotaStatus.allowed
                ? 'bg-muted text-muted-foreground'
                : 'bg-red-500/10 text-red-500'
            }`}>
              {quotaStatus.remaining}/{quotaStatus.quota} runs remaining
            </div>
          )}
          {quotaStatus?.unlimited && (
            <div className="text-sm px-3 py-1.5 rounded-md bg-green-500/10 text-green-500">
              Unlimited runs
            </div>
          )}
        {isDevMode && (
          <div className="flex items-center gap-2">
            {testResult && (
              <span
                className={`text-xs px-2 py-1 rounded ${
                  testResult.success
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-red-500/10 text-red-500'
                }`}
              >
                {testResult.message}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestDatabase}
              disabled={isTestRunning}
              className="text-xs"
            >
              {isTestRunning ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <FlaskConical className="w-3 h-3 mr-1" />
                  Test DB
                </>
              )}
            </Button>
          </div>
        )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Controls */}
        <div className="w-80 border-r border-border flex flex-col">
          {/* Search Form */}
          <div className="p-4 space-y-4 border-b border-border">
            <div className="space-y-2">
              <Label htmlFor="query">Search Query</Label>
              <Input
                id="query"
                placeholder="e.g., solid state batteries"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isRunning}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isRunning && query.trim()) {
                    handleRunPipeline();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Sources</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="arxiv"
                    checked={sources.arxiv}
                    onCheckedChange={(checked) =>
                      setSources((s) => ({ ...s, arxiv: checked === true }))
                    }
                    disabled={isRunning}
                  />
                  <label htmlFor="arxiv" className="text-sm">
                    arXiv
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="s2"
                    checked={sources.semanticScholar}
                    onCheckedChange={(checked) =>
                      setSources((s) => ({ ...s, semanticScholar: checked === true }))
                    }
                    disabled={isRunning}
                  />
                  <label htmlFor="s2" className="text-sm">
                    Semantic Scholar
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="openalex"
                    checked={sources.openalex}
                    onCheckedChange={(checked) =>
                      setSources((s) => ({ ...s, openalex: checked === true }))
                    }
                    disabled={isRunning}
                  />
                  <label htmlFor="openalex" className="text-sm">
                    OpenAlex
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxResults">Max Results per Source</Label>
              <Input
                id="maxResults"
                type="number"
                min={1}
                max={100}
                value={maxResults}
                onChange={(e) => setMaxResults(parseInt(e.target.value) || 20)}
                disabled={isRunning || demoMode}
              />
              {demoMode && (
                <p className="text-xs text-muted-foreground">Fixed to 5 in demo mode</p>
              )}
            </div>

            {/* Auto Mode Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex-1">
                <Label htmlFor="autoMode" className="text-sm font-medium cursor-pointer">
                  Auto Mode
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {demoMode
                    ? 'Fixed to manual mode in demo'
                    : autoMode
                    ? 'Auto-filter papers by viability (>3.5)'
                    : 'Manual paper selection after search'}
                </p>
              </div>
              <Switch
                id="autoMode"
                checked={autoMode}
                onCheckedChange={setAutoMode}
                disabled={isRunning || demoMode}
              />
            </div>

            {/* Advanced Options */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Advanced Options
              </button>
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="skipExpansion"
                        checked={skipExpansion}
                        onCheckedChange={(checked) => setSkipExpansion(checked === true)}
                        disabled={isRunning}
                      />
                      <label htmlFor="skipExpansion" className="text-sm">
                        Skip keyword expansion
                      </label>
                    </div>
                    {!skipExpansion && (
                      <div className="ml-6 space-y-1">
                        <Label htmlFor="numKeywords" className="text-xs text-muted-foreground">
                          Number of keywords to generate
                        </Label>
                        <Input
                          id="numKeywords"
                          type="number"
                          min={1}
                          max={10}
                          value={numKeywords}
                          onChange={(e) => setNumKeywords(parseInt(e.target.value) || 5)}
                          disabled={isRunning}
                          className="h-8"
                        />
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="skipViability"
                        checked={skipViability}
                        onCheckedChange={(checked) => setSkipViability(checked === true)}
                        disabled={isRunning}
                      />
                      <label htmlFor="skipViability" className="text-sm">
                        Skip viability analysis
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="skipEnrichment"
                        checked={skipEnrichment}
                        onCheckedChange={(checked) => setSkipEnrichment(checked === true)}
                        disabled={isRunning}
                      />
                      <label htmlFor="skipEnrichment" className="text-sm">
                        Skip researcher enrichment
                      </label>
                    </div>
                    {!skipEnrichment && (
                      <div className="ml-6 space-y-1">
                        <Label htmlFor="maxResearchers" className="text-xs text-muted-foreground">
                          Max researchers to enrich (0 = no limit)
                        </Label>
                        <Input
                          id="maxResearchers"
                          type="number"
                          min={0}
                          max={500}
                          value={maxResearchers}
                          onChange={(e) => setMaxResearchers(parseInt(e.target.value) || 0)}
                          disabled={isRunning || demoMode}
                          className="h-8"
                        />
                        {demoMode && (
                          <p className="text-xs text-muted-foreground">Fixed to 10 in demo mode</p>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              className="w-full"
              onClick={handleRunPipeline}
              disabled={isRunning || !query.trim() || (quotaStatus && !quotaStatus.allowed && !quotaStatus.unlimited)}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : quotaStatus && !quotaStatus.allowed && !quotaStatus.unlimited ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Quota Exceeded
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Pipeline
                </>
              )}
            </Button>
          </div>

          {/* Step Indicators */}
          <div className="flex-1 p-4 space-y-2 overflow-y-auto">
            <Label className="text-xs text-muted-foreground">Pipeline Steps</Label>
            {isRunning && (
              <Progress value={overallProgress} className="h-1 mb-2" />
            )}
            {STEPS.map((step) => (
              <StepIndicator
                key={step}
                step={step}
                state={steps[step]}
                isActive={currentStep === step}
              />
            ))}
          </div>
        </div>

        {/* Right Panel - Logs & Results */}
        <div className="flex-1 flex flex-col">
          {/* Log Display */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Pipeline Logs</span>
                {logs.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {logs.length} entries
                  </Badge>
                )}
              </div>
              {logs.length > 0 && !isRunning && pipelineState.phase !== 'selecting' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetPipeline}
                  className="text-xs"
                >
                  Clear
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1 p-4" ref={logContainerRef}>
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Search className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">Enter a search query and run the pipeline</p>
                  <p className="text-xs mt-1">Logs will appear here in real-time</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {logs.map((log, i) => (
                    <LogLine key={i} log={log} index={i} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Results Panel */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border"
              >
                <div className="p-4">
                  <Card
                    className={
                      result.success
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-red-500/30 bg-red-500/5'
                    }
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {result.success ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            Pipeline Complete
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-red-500" />
                            Pipeline Failed
                          </>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {result.success ? (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">New Papers</p>
                            <p className="text-2xl font-semibold">{result.newPapers}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">New Researchers</p>
                            <p className="text-2xl font-semibold">{result.newResearchers}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Papers</p>
                            <p className="text-lg">{result.papersTotal}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Researchers</p>
                            <p className="text-lg">{result.researchersTotal}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-red-400">{result.error}</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Paper Selection Modal (Manual Mode) */}
      <PaperSelectionModal
        open={pipelineState.phase === 'selecting'}
        onOpenChange={(open) => {
          if (!open) handleCancelSelection();
        }}
        papers={pipelineState.searchResults?.papers ?? []}
        selectedIds={pipelineState.selectedPaperIds}
        showViability={!skipViability}
        onToggleSelection={togglePaperSelection}
        onSelectAll={selectAllPapers}
        onSelectNone={selectNoPapers}
        onSelectHighViability={selectHighViabilityPapers}
        onConfirm={handleConfirmSelection}
        onCancel={handleCancelSelection}
      />
    </div>
  );
};

export default Pipeline;
