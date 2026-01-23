import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Integration } from '@/types';
import { defaultIntegrations } from '@/data/mockData';

const STORAGE_KEY_API_KEY = 'scholargraph_openai_api_key';
const STORAGE_KEY_GEMINI_API_KEY = 'scholargraph_gemini_api_key';
const STORAGE_KEY_INTEGRATIONS = 'scholargraph_integrations';
const STORAGE_KEY_PROMPTS = 'scholargraph_prompts';

export interface PromptConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
}

export const defaultPrompts: PromptConfig[] = [
  {
    id: 'researcher-enrichment',
    name: 'Researcher Enrichment',
    description: 'Used to find contact information and affiliations for researchers',
    systemPrompt: 'You are a research assistant that finds academic researcher contact information. Provide accurate, factual information only. If you cannot find specific information, return null for that field.',
    userPrompt: `Find the professional contact information for the academic researcher named {name} {affiliation_clause}.

Search for their:
1. Institutional/academic email address
2. Current research lab, department, or research group name
3. Current university or institution name
4. Country where they are based

Return accurate information only. If you cannot find specific information, leave it null.`,
  },
  {
    id: 'keyword-expansion',
    name: 'Keyword Expansion',
    description: 'Expands search queries to find more relevant academic papers',
    systemPrompt: 'You are a research assistant that helps discover academic papers. Generate diverse, relevant search queries. Return JSON only.',
    userPrompt: `Given this research topic query: "{query}"

Generate {num_keywords} related but distinct search queries that would help find relevant academic papers on this topic.

Consider:
- Alternative terminology and synonyms
- Related sub-topics or applications
- Different technical approaches
- Broader or narrower scope variations
- Industry applications

Return ONLY a JSON object with a "keywords" array containing the search queries (strings).
Do NOT include the original query in the list.
Each keyword should be 2-5 words for effective paper search.

Example response format:
{"keywords": ["keyword one", "keyword two", "keyword three"]}`,
  },
  {
    id: 'market-viability',
    name: 'Market Viability Analysis',
    description: 'Analyzes research papers for commercial and market potential',
    systemPrompt: `You are a senior technology commercialization analyst with expertise in evaluating academic research for market potential. You have 15+ years of experience in venture capital, technology transfer offices, and startup incubation.

Your task is to analyze academic papers and provide rigorous, evidence-based assessments of their commercial viability. Be critical and objective - not every paper has commercial potential, and that's okay. Provide honest assessments.

IMPORTANT: You must respond ONLY with valid JSON. No markdown, no explanations outside the JSON structure.`,
    userPrompt: `Analyze the commercial/market viability of this research paper.

Title: {title}

Abstract: {abstract}

Rate each dimension from 1-5:
1. Novelty (1=incremental, 5=breakthrough)
2. Market Size (1=niche, 5=massive market)
3. Feasibility (1=decades away, 5=ready for commercialization)
4. Timing (1=too early, 5=perfect timing)

Provide a brief analysis (2-3 sentences) of the commercial potential.

Return ONLY a JSON object with keys: novelty, marketSize, feasibility, timing, analysis
Example: {"novelty": 4, "marketSize": 3, "feasibility": 5, "timing": 4, "analysis": "..."}`,
  },
  {
    id: 'keyword-suggestions',
    name: 'Keyword Suggestions',
    description: 'Suggests search keywords for finding academic papers on a topic',
    systemPrompt: `You are an expert academic research assistant specializing in helping researchers find relevant papers. Your task is to suggest search keywords and phrases that will help find academic papers on a given topic.

IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanations outside the JSON structure.`,
    userPrompt: `Given the research topic: "{topic}"

Generate search keywords and phrases to help find relevant academic papers. Include:
1. Core terms: Direct keywords related to the topic
2. Technical synonyms: Alternative technical terms used in academia
3. Related concepts: Broader or adjacent research areas
4. Specific methods: Relevant methodologies or techniques
5. Application domains: Fields where this research applies

Respond with this exact JSON structure:
{
  "keywords": [
    {
      "term": "<keyword or phrase>",
      "category": "<core|synonym|related|method|application>",
      "relevance": "<high|medium>"
    }
  ]
}

Provide 8-12 diverse, high-quality suggestions. Prioritize terms commonly used in academic literature.`,
  },
];

interface SettingsContextType {
  // API Keys
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  hasOpenaiApiKey: boolean;
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  hasGeminiApiKey: boolean;

  // Integrations
  integrations: Integration[];
  toggleIntegration: (id: string, enabled: boolean) => void;
  updateIntegration: (integration: Integration) => void;
  addIntegration: (integration: Integration) => void;
  getIntegration: (id: string) => Integration | undefined;
  isIntegrationEnabled: (id: string) => boolean;

  // Prompts
  prompts: PromptConfig[];
  updatePrompt: (prompt: PromptConfig) => void;
  getPrompt: (id: string) => PromptConfig | undefined;
  resetPrompt: (id: string) => void;
  resetAllPrompts: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  // Load API key from localStorage
  const [openaiApiKey, setOpenaiApiKeyState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
    }
    return '';
  });

  // Load Gemini API key from localStorage
  const [geminiApiKey, setGeminiApiKeyState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_GEMINI_API_KEY) || '';
    }
    return '';
  });

  // Load integrations from localStorage and merge with defaults
  const [integrations, setIntegrations] = useState<Integration[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_INTEGRATIONS);
      if (stored) {
        try {
          const storedIntegrations: Integration[] = JSON.parse(stored);
          const storedIds = new Set(storedIntegrations.map(i => i.id));

          // Add any new default integrations that don't exist in storage
          const newDefaults = defaultIntegrations.filter(d => !storedIds.has(d.id));

          // Merge stored with new defaults
          return [...storedIntegrations, ...newDefaults];
        } catch {
          return defaultIntegrations;
        }
      }
    }
    return defaultIntegrations;
  });

  // Load prompts from localStorage and merge with defaults
  const [prompts, setPrompts] = useState<PromptConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_PROMPTS);
      if (stored) {
        try {
          const storedPrompts: PromptConfig[] = JSON.parse(stored);
          const storedIds = new Set(storedPrompts.map(p => p.id));

          // Add any new default prompts that don't exist in storage
          const newDefaults = defaultPrompts.filter(d => !storedIds.has(d.id));

          // Merge stored with new defaults
          return [...storedPrompts, ...newDefaults];
        } catch {
          return defaultPrompts;
        }
      }
    }
    return defaultPrompts;
  });

  // Persist API key to localStorage
  const setOpenaiApiKey = (key: string) => {
    setOpenaiApiKeyState(key);
    if (typeof window !== 'undefined') {
      if (key) {
        localStorage.setItem(STORAGE_KEY_API_KEY, key);
      } else {
        localStorage.removeItem(STORAGE_KEY_API_KEY);
      }
    }
  };

  // Persist Gemini API key to localStorage
  const setGeminiApiKey = (key: string) => {
    setGeminiApiKeyState(key);
    if (typeof window !== 'undefined') {
      if (key) {
        localStorage.setItem(STORAGE_KEY_GEMINI_API_KEY, key);
      } else {
        localStorage.removeItem(STORAGE_KEY_GEMINI_API_KEY);
      }
    }
  };

  // Persist integrations to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_INTEGRATIONS, JSON.stringify(integrations));
    }
  }, [integrations]);

  // Persist prompts to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PROMPTS, JSON.stringify(prompts));
    }
  }, [prompts]);

  const toggleIntegration = (id: string, enabled: boolean) => {
    setIntegrations(prev =>
      prev.map(int => (int.id === id ? { ...int, enabled } : int))
    );
  };

  const updateIntegration = (integration: Integration) => {
    setIntegrations(prev =>
      prev.map(int => (int.id === integration.id ? integration : int))
    );
  };

  const addIntegration = (integration: Integration) => {
    setIntegrations(prev => [...prev, integration]);
  };

  const getIntegration = (id: string) => {
    return integrations.find(int => int.id === id);
  };

  const isIntegrationEnabled = (id: string) => {
    const integration = integrations.find(int => int.id === id);
    return integration?.enabled ?? false;
  };

  const updatePrompt = (prompt: PromptConfig) => {
    setPrompts(prev =>
      prev.map(p => (p.id === prompt.id ? prompt : p))
    );
  };

  const getPrompt = (id: string) => {
    return prompts.find(p => p.id === id);
  };

  const resetPrompt = (id: string) => {
    const defaultPrompt = defaultPrompts.find(p => p.id === id);
    if (defaultPrompt) {
      setPrompts(prev =>
        prev.map(p => (p.id === id ? defaultPrompt : p))
      );
    }
  };

  const resetAllPrompts = () => {
    setPrompts(defaultPrompts);
  };

  return (
    <SettingsContext.Provider
      value={{
        openaiApiKey,
        setOpenaiApiKey,
        hasOpenaiApiKey: !!openaiApiKey,
        geminiApiKey,
        setGeminiApiKey,
        hasGeminiApiKey: !!geminiApiKey,
        integrations,
        toggleIntegration,
        updateIntegration,
        addIntegration,
        getIntegration,
        isIntegrationEnabled,
        prompts,
        updatePrompt,
        getPrompt,
        resetPrompt,
        resetAllPrompts,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
