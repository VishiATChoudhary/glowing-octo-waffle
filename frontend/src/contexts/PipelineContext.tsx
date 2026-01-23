import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { LogEntry, PipelineStep, PipelineResult, SearchPhaseResult, PaperWithViability } from '@/services/pipelineService';

interface StepState {
  step: PipelineStep;
  status: 'pending' | 'running' | 'complete' | 'error';
  progress?: { current: number; total: number };
}

const STEPS: PipelineStep[] = ['expand', 'search', 'extract', 'viability', 'enrich', 'aggregate', 'save'];

const createInitialSteps = (): Record<PipelineStep, StepState> => {
  const initial: Record<PipelineStep, StepState> = {} as any;
  for (const step of STEPS) {
    initial[step] = { step, status: 'pending' };
  }
  return initial;
};

export type PipelinePhase = 'idle' | 'searching' | 'selecting' | 'processing' | 'complete';

interface PipelineState {
  isRunning: boolean;
  logs: LogEntry[];
  steps: Record<PipelineStep, StepState>;
  currentStep: PipelineStep | null;
  result: PipelineResult | null;
  lastQuery: string;
  // Phase-specific state (for manual mode)
  phase: PipelinePhase;
  searchResults: SearchPhaseResult | null;
  selectedPaperIds: Set<string>;
}

interface PipelineContextType {
  state: PipelineState;
  setIsRunning: (running: boolean) => void;
  addLog: (log: LogEntry) => void;
  setResult: (result: PipelineResult | null) => void;
  setLastQuery: (query: string) => void;
  resetPipeline: () => void;
  // Phase-specific actions
  setPhase: (phase: PipelinePhase) => void;
  setSearchResults: (results: SearchPhaseResult | null) => void;
  togglePaperSelection: (paperId: string) => void;
  selectAllPapers: () => void;
  selectNoPapers: () => void;
  selectHighViabilityPapers: (threshold?: number) => void;
  getSelectedPapers: () => PaperWithViability[];
}

const PipelineContext = createContext<PipelineContextType | undefined>(undefined);

export const PipelineProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<PipelineState>({
    isRunning: false,
    logs: [],
    steps: createInitialSteps(),
    currentStep: null,
    result: null,
    lastQuery: '',
    phase: 'idle',
    searchResults: null,
    selectedPaperIds: new Set(),
  });

  const setIsRunning = useCallback((running: boolean) => {
    setState(prev => ({ ...prev, isRunning: running }));
  }, []);

  const addLog = useCallback((log: LogEntry) => {
    setState(prev => {
      const newLogs = [...prev.logs, log];
      const newSteps = { ...prev.steps };

      // Update the current step
      if (log.status === 'start') {
        newSteps[log.step] = { step: log.step, status: 'running' };
      } else if (log.status === 'complete') {
        newSteps[log.step] = { step: log.step, status: 'complete' };
      } else if (log.status === 'error') {
        newSteps[log.step] = { step: log.step, status: 'error' };
      } else if (log.status === 'progress') {
        // Parse progress from message
        const match = log.message.match(/\(?\s*(\d+)\s*\/\s*(\d+)\s*\)?/);
        const progress = match ? { current: parseInt(match[1], 10), total: parseInt(match[2], 10) } : undefined;
        newSteps[log.step] = {
          step: log.step,
          status: 'running',
          progress,
        };
      }

      return {
        ...prev,
        logs: newLogs,
        steps: newSteps,
        currentStep: log.step,
      };
    });
  }, []);

  const setResult = useCallback((result: PipelineResult | null) => {
    setState(prev => ({ ...prev, result, isRunning: false }));
  }, []);

  const setLastQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, lastQuery: query }));
  }, []);

  const resetPipeline = useCallback(() => {
    setState(prev => ({
      ...prev,
      isRunning: false,
      logs: [],
      steps: createInitialSteps(),
      currentStep: null,
      result: null,
      phase: 'idle',
      searchResults: null,
      selectedPaperIds: new Set(),
    }));
  }, []);

  // Phase-specific actions
  const setPhase = useCallback((phase: PipelinePhase) => {
    setState(prev => ({ ...prev, phase }));
  }, []);

  const setSearchResults = useCallback((results: SearchPhaseResult | null) => {
    setState(prev => {
      // When setting search results, pre-select all papers by default
      const newSelectedIds = results
        ? new Set(results.papers.map(p => p.id))
        : new Set<string>();
      return {
        ...prev,
        searchResults: results,
        selectedPaperIds: newSelectedIds,
        phase: results ? 'selecting' : prev.phase,
      };
    });
  }, []);

  const togglePaperSelection = useCallback((paperId: string) => {
    setState(prev => {
      const newSelected = new Set(prev.selectedPaperIds);
      if (newSelected.has(paperId)) {
        newSelected.delete(paperId);
      } else {
        newSelected.add(paperId);
      }
      return { ...prev, selectedPaperIds: newSelected };
    });
  }, []);

  const selectAllPapers = useCallback(() => {
    setState(prev => {
      if (!prev.searchResults) return prev;
      const allIds = new Set(prev.searchResults.papers.map(p => p.id));
      return { ...prev, selectedPaperIds: allIds };
    });
  }, []);

  const selectNoPapers = useCallback(() => {
    setState(prev => ({ ...prev, selectedPaperIds: new Set() }));
  }, []);

  const selectHighViabilityPapers = useCallback((threshold: number = 3.5) => {
    setState(prev => {
      if (!prev.searchResults) return prev;
      const highViabilityIds = new Set(
        prev.searchResults.papers
          .filter(p => p.viability?.aggregate && p.viability.aggregate > threshold)
          .map(p => p.id)
      );
      return { ...prev, selectedPaperIds: highViabilityIds };
    });
  }, []);

  const getSelectedPapers = useCallback((): PaperWithViability[] => {
    if (!state.searchResults) return [];
    return state.searchResults.papers.filter(p => state.selectedPaperIds.has(p.id));
  }, [state.searchResults, state.selectedPaperIds]);

  return (
    <PipelineContext.Provider value={{
      state,
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
    }}>
      {children}
    </PipelineContext.Provider>
  );
};

export const usePipeline = () => {
  const context = useContext(PipelineContext);
  if (!context) {
    throw new Error('usePipeline must be used within a PipelineProvider');
  }
  return context;
};

export { STEPS };
export type { StepState };
