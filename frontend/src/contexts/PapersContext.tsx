import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  fetchPapersFiltered,
  updatePaperStatus as updatePaperStatusApi,
  getPassReasonTags,
  createPassReasonTag as createPassReasonTagApi,
  ReviewStatus,
  PassReasonTag,
  BackendPaper,
} from '@/services/pipelineService';

export interface DbPaper {
  id: string;
  title: string;
  abstract?: string;
  authors?: string[];
  year?: number;
  doi?: string;
  arxiv_id?: string;
  source?: string;
  citations?: number;
  url?: string;
  pdf_url?: string;
  keywords?: string[];
  flagged?: boolean;
  viability_score?: number;
  viability_novelty?: number;
  viability_market_size?: number;
  viability_feasibility?: number;
  viability_timing?: number;
  viability_analysis?: string;
  review_status?: ReviewStatus;
  pass_reason?: string;
  status_updated_at?: string;
  created_at?: string;
}

export type SortBy = 'created_at' | 'year' | 'citations' | 'viability_score';
export type SortOrder = 'asc' | 'desc';

interface PapersState {
  papers: DbPaper[];
  isLoading: boolean;
  error: string | null;
  lastLoaded: Date | null;
  // Filter/sort state
  statusFilter: ReviewStatus | null;
  locationFilter: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  // Pass reason tags
  passReasonTags: PassReasonTag[];
  isLoadingTags: boolean;
}

interface PapersContextType {
  state: PapersState;
  loadPapers: () => Promise<void>;
  clearPapers: () => void;
  // Filter/sort actions
  setStatusFilter: (status: ReviewStatus | null) => void;
  setLocationFilter: (location: string) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSortOrder: (order: SortOrder) => void;
  // Paper status actions
  updatePaperStatus: (paperId: string, status: ReviewStatus, passReason?: string) => Promise<void>;
  // Pass reason tag actions
  loadPassReasonTags: () => Promise<void>;
  createPassReasonTag: (name: string) => Promise<PassReasonTag | null>;
}

const PapersContext = createContext<PapersContextType | undefined>(undefined);

export const PapersProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<PapersState>({
    papers: [],
    isLoading: false,
    error: null,
    lastLoaded: null,
    statusFilter: null,
    locationFilter: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
    passReasonTags: [],
    isLoadingTags: false,
  });

  const loadPapers = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const papers = await fetchPapersFiltered({
        status: state.statusFilter || undefined,
        location: state.locationFilter || undefined,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
      });
      setState(prev => ({
        ...prev,
        papers: papers as DbPaper[],
        isLoading: false,
        error: null,
        lastLoaded: new Date(),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load papers';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [state.statusFilter, state.locationFilter, state.sortBy, state.sortOrder]);

  const clearPapers = () => {
    setState(prev => ({
      ...prev,
      papers: [],
      isLoading: false,
      error: null,
      lastLoaded: null,
    }));
  };

  const setStatusFilter = (status: ReviewStatus | null) => {
    setState(prev => ({ ...prev, statusFilter: status }));
  };

  const setLocationFilter = (location: string) => {
    setState(prev => ({ ...prev, locationFilter: location }));
  };

  const setSortBy = (sortBy: SortBy) => {
    setState(prev => ({ ...prev, sortBy }));
  };

  const setSortOrder = (order: SortOrder) => {
    setState(prev => ({ ...prev, sortOrder: order }));
  };

  const updatePaperStatus = async (paperId: string, status: ReviewStatus, passReason?: string) => {
    try {
      await updatePaperStatusApi(paperId, status, passReason);
      // Update local state
      setState(prev => ({
        ...prev,
        papers: prev.papers.map(p =>
          p.id === paperId
            ? { ...p, review_status: status, pass_reason: passReason, status_updated_at: new Date().toISOString() }
            : p
        ),
      }));
    } catch (err) {
      console.error('Failed to update paper status:', err);
      throw err;
    }
  };

  const loadPassReasonTags = async () => {
    setState(prev => ({ ...prev, isLoadingTags: true }));
    try {
      const tags = await getPassReasonTags();
      setState(prev => ({ ...prev, passReasonTags: tags, isLoadingTags: false }));
    } catch (err) {
      console.error('Failed to load pass reason tags:', err);
      setState(prev => ({ ...prev, isLoadingTags: false }));
    }
  };

  const createPassReasonTag = async (name: string): Promise<PassReasonTag | null> => {
    try {
      const tag = await createPassReasonTagApi(name);
      setState(prev => ({
        ...prev,
        passReasonTags: [...prev.passReasonTags, tag].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      return tag;
    } catch (err) {
      console.error('Failed to create pass reason tag:', err);
      return null;
    }
  };

  // Auto-load papers when filters change
  useEffect(() => {
    loadPapers();
  }, [state.statusFilter, state.locationFilter, state.sortBy, state.sortOrder]);

  // Load pass reason tags on mount
  useEffect(() => {
    loadPassReasonTags();
  }, []);

  return (
    <PapersContext.Provider value={{
      state,
      loadPapers,
      clearPapers,
      setStatusFilter,
      setLocationFilter,
      setSortBy,
      setSortOrder,
      updatePaperStatus,
      loadPassReasonTags,
      createPassReasonTag,
    }}>
      {children}
    </PapersContext.Provider>
  );
};

export const usePapers = () => {
  const context = useContext(PapersContext);
  if (!context) {
    throw new Error('usePapers must be used within a PapersProvider');
  }
  return context;
};
