import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Researcher } from '@/types';
import { fetchResearchers, BackendResearcher } from '@/services/pipelineService';

interface ResearchersState {
  researchers: Researcher[];
  selectedResearcher: Researcher | null;
  isLoadingFromDb: boolean;
  dbError: string | null;
  lastLoadedFromDb: Date | null;
}

interface ResearchersContextType {
  state: ResearchersState;
  addResearchers: (researchers: Researcher[]) => void;
  setSelectedResearcher: (researcher: Researcher | null) => void;
  clearResearchers: () => void;
  loadFromDatabase: () => Promise<void>;
}

const ResearchersContext = createContext<ResearchersContextType | undefined>(undefined);

// Convert backend researcher to frontend format
const convertBackendResearcher = (r: BackendResearcher): Researcher => ({
  id: r.id,
  name: r.name,
  email: r.email,
  affiliation: r.institution || '',
  lab: r.lab,
  country: r.country,
  hIndex: r.hIndex,
  citations: r.citations,
  enrichedAt: r.enrichedAt,
  papers: [],
  publications: [],
  associated_papers: r.associated_papers,
});

export const ResearchersProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ResearchersState>(() => ({
    researchers: [],
    selectedResearcher: null,
    isLoadingFromDb: false,
    dbError: null,
    lastLoadedFromDb: null,
  }));

  // Track if initial load has been attempted
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  const addResearchers = (newResearchers: Researcher[]) => {
    setState(prev => {
      const newResearchersMap = new Map(newResearchers.map(r => [r.id, r]));

      // Update existing researchers or keep them as-is
      const updated = prev.researchers.map(r =>
        newResearchersMap.has(r.id) ? newResearchersMap.get(r.id)! : r
      );

      // Add truly new researchers (not already in the list)
      const existingIds = new Set(prev.researchers.map(r => r.id));
      const brandNew = newResearchers.filter(r => !existingIds.has(r.id));

      return {
        ...prev,
        researchers: [...updated, ...brandNew],
      };
    });
  };

  const setSelectedResearcher = (researcher: Researcher | null) => {
    setState(prev => ({ ...prev, selectedResearcher: researcher }));
  };

  const clearResearchers = () => {
    setState({
      researchers: [],
      selectedResearcher: null,
      isLoadingFromDb: false,
      dbError: null,
      lastLoadedFromDb: null,
    });
  };

  const loadFromDatabase = async () => {
    setState(prev => ({ ...prev, isLoadingFromDb: true, dbError: null }));
    try {
      const backendResearchers = await fetchResearchers();
      const researchers = backendResearchers.map(convertBackendResearcher);
      setState(prev => ({
        ...prev,
        researchers,
        isLoadingFromDb: false,
        lastLoadedFromDb: new Date(),
      }));
    } catch (error) {
      console.error('Failed to load researchers from database:', error);
      setState(prev => ({
        ...prev,
        isLoadingFromDb: false,
        dbError: error instanceof Error ? error.message : 'Failed to load from database',
      }));
    }
  };

  // Auto-load from database on mount
  useEffect(() => {
    if (!hasInitialLoad) {
      setHasInitialLoad(true);
      loadFromDatabase();
    }
  }, [hasInitialLoad]);

  return (
    <ResearchersContext.Provider value={{ state, addResearchers, setSelectedResearcher, clearResearchers, loadFromDatabase }}>
      {children}
    </ResearchersContext.Provider>
  );
};

export const useResearchers = () => {
  const context = useContext(ResearchersContext);
  if (!context) {
    throw new Error('useResearchers must be used within a ResearchersProvider');
  }
  return context;
};
