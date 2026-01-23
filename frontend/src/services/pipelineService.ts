/**
 * Pipeline Service
 * Handles communication with the pipeline-runner backend.
 * Uses Server-Sent Events (SSE) for real-time log streaming.
 */

import { getSessionToken } from './authService';

const API_BASE = import.meta.env.VITE_PIPELINE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8082';

const AUTH_API_BASE =
  import.meta.env.VITE_AUTH_API_URL ||
  import.meta.env.VITE_GMAIL_API_URL ||
  'https://us-central1-waffle-mm.cloudfunctions.net';

// =============================================================================
// Types
// =============================================================================

export type PipelineStep =
  | 'expand'
  | 'search'
  | 'extract'
  | 'viability'
  | 'enrich'
  | 'aggregate'
  | 'save';

export type LogStatus = 'start' | 'progress' | 'complete' | 'error';

export interface LogEntry {
  timestamp: string;
  step: PipelineStep;
  status: LogStatus;
  message: string;
  data?: {
    keywords?: string[];
    keywordCount?: number;
    paperCount?: number;
    totalFound?: number;
    researcherCount?: number;
    enrichedCount?: number;
    notFoundCount?: number;
    papersTotal?: number;
    researchersTotal?: number;
    newPapers?: number;
    newResearchers?: number;
  };
}

export interface PipelineOptions {
  query: string;
  sources: ('arxiv' | 'semantic-scholar' | 'openalex')[];
  maxResults: number;
  maxResearchers?: number;
  skipViability?: boolean;
  skipEnrichment?: boolean;
  skipExpansion?: boolean;
  numKeywords?: number;
  autoMode?: boolean;
  viabilityThreshold?: number;
  apiKeys?: {
    gemini?: string;
    openai?: string;
    perplexity?: string;
  };
}

// =============================================================================
// Phase Types (for Manual Mode)
// =============================================================================

export interface ViabilityScore {
  novelty: number;
  marketSize: number;
  feasibility: number;
  timing: number;
  analysis: string;
  aggregate?: number;
}

export interface PaperWithViability {
  id: string;
  title: string;
  abstract?: string;
  authors?: string[];
  year?: number;
  doi?: string;
  arxivId?: string;
  source?: string;
  citations?: number;
  url?: string;
  pdfUrl?: string;
  viability?: ViabilityScore;
}

export interface SearchPhaseResult {
  sessionId: string;
  papers: PaperWithViability[];
  keywords: string[];
  viabilityScores: Record<string, ViabilityScore>;
}

export interface SearchPhaseOptions {
  query: string;
  sources: ('arxiv' | 'semantic-scholar' | 'openalex')[];
  maxResults: number;
  skipViability?: boolean;
  skipExpansion?: boolean;
  numKeywords?: number;
  apiKeys?: {
    gemini?: string;
    openai?: string;
    perplexity?: string;
  };
}

export interface ProcessingPhaseOptions {
  sessionId: string;
  selectedPapers: PaperWithViability[];
  keywords: string[];
  viabilityScores: Record<string, ViabilityScore>;
  skipEnrichment?: boolean;
  maxResearchers?: number;
  apiKeys?: {
    gemini?: string;
    openai?: string;
    perplexity?: string;
  };
}

export interface PipelineResult {
  success: boolean;
  papersTotal: number;
  researchersTotal: number;
  newPapers: number;
  newResearchers: number;
  error?: string;
}

export interface PipelineStatus {
  success: boolean;
  papers: number;
  researchers: number;
  viability_scores: number;
  authorship_links: number;
  error?: string;
}

export interface QuotaStatus {
  allowed: boolean;
  unlimited: boolean;
  used: number;
  quota: number;
  remaining?: number;
  error?: string;
}

// =============================================================================
// Pipeline Runner
// =============================================================================

/**
 * Run the research paper discovery pipeline with real-time log streaming.
 *
 * @param options - Pipeline configuration options
 * @param onLog - Callback for each log entry received
 * @returns Promise that resolves with the final pipeline result
 */
export async function runPipeline(
  options: PipelineOptions,
  onLog: (log: LogEntry) => void
): Promise<PipelineResult> {
  return new Promise((resolve, reject) => {
    let lastLog: LogEntry | null = null;
    let hasError = false;

    // Create POST request for SSE (using fetch with streaming)
    fetch(`${API_BASE}/pipeline-runner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getSessionToken()}`,
      },
      body: JSON.stringify({
        query: options.query,
        sources: options.sources,
        maxResults: options.maxResults,
        maxResearchers: options.maxResearchers ?? 0,
        skipViability: options.skipViability ?? false,
        skipEnrichment: options.skipEnrichment ?? false,
        skipExpansion: options.skipExpansion ?? false,
        numKeywords: options.numKeywords ?? 5,
        autoMode: options.autoMode ?? false,
        viabilityThreshold: options.viabilityThreshold ?? 3.5,
        apiKeys: options.apiKeys || {},
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Pipeline request failed: ${response.status} - ${error}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        // Read the stream
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = line.slice(6); // Remove 'data: ' prefix
                if (data.trim()) {
                  const log: LogEntry = JSON.parse(data);
                  lastLog = log;

                  // Check for errors
                  if (log.status === 'error') {
                    hasError = true;
                  }

                  // Call the log callback
                  onLog(log);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e, line);
              }
            }
          }
        }

        // Determine final result from last log
        if (lastLog?.step === 'save' && lastLog.status === 'complete' && lastLog.data) {
          resolve({
            success: true,
            papersTotal: lastLog.data.papersTotal || 0,
            researchersTotal: lastLog.data.researchersTotal || 0,
            newPapers: lastLog.data.newPapers || 0,
            newResearchers: lastLog.data.newResearchers || 0,
          });
        } else if (hasError) {
          resolve({
            success: false,
            papersTotal: 0,
            researchersTotal: 0,
            newPapers: 0,
            newResearchers: 0,
            error: lastLog?.message || 'Pipeline failed with error',
          });
        } else {
          resolve({
            success: false,
            papersTotal: 0,
            researchersTotal: 0,
            newPapers: 0,
            newResearchers: 0,
            error: 'Pipeline ended unexpectedly',
          });
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}

// =============================================================================
// Phase Functions (for Manual Mode)
// =============================================================================

/**
 * Run the search phase of the pipeline (Phase 1).
 * Keyword expansion, paper search, and optional viability analysis.
 *
 * @param options - Search phase options
 * @param onLog - Callback for each log entry received
 * @returns Promise that resolves with the search phase result
 */
export async function runSearchPhase(
  options: SearchPhaseOptions,
  onLog: (log: LogEntry) => void
): Promise<SearchPhaseResult> {
  return new Promise((resolve, reject) => {
    fetch(`${API_BASE}/pipeline-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getSessionToken()}`,
      },
      body: JSON.stringify({
        query: options.query,
        sources: options.sources,
        maxResults: options.maxResults,
        skipViability: options.skipViability ?? false,
        skipExpansion: options.skipExpansion ?? false,
        numKeywords: options.numKeywords ?? 5,
        apiKeys: options.apiKeys || {},
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Search phase request failed: ${response.status} - ${error}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let searchResult: SearchPhaseResult | null = null;

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = line.slice(6);
                if (data.trim()) {
                  const parsed = JSON.parse(data);

                  // Check if this is the final papers_ready event
                  if (parsed.type === 'papers_ready') {
                    searchResult = {
                      sessionId: parsed.sessionId,
                      papers: parsed.papers,
                      keywords: parsed.keywords,
                      viabilityScores: parsed.viabilityScores || {},
                    };
                  } else {
                    // Regular log entry
                    const log: LogEntry = parsed;
                    onLog(log);
                  }
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e, line);
              }
            }
          }
        }

        if (searchResult) {
          resolve(searchResult);
        } else {
          reject(new Error('Search phase ended without papers_ready event'));
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}

/**
 * Run the processing phase of the pipeline (Phase 2).
 * Researcher extraction, enrichment, aggregation, and save.
 *
 * @param options - Processing phase options
 * @param onLog - Callback for each log entry received
 * @returns Promise that resolves with the final pipeline result
 */
export async function runProcessingPhase(
  options: ProcessingPhaseOptions,
  onLog: (log: LogEntry) => void
): Promise<PipelineResult> {
  return new Promise((resolve, reject) => {
    let lastLog: LogEntry | null = null;
    let hasError = false;

    fetch(`${API_BASE}/pipeline-continue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getSessionToken()}`,
      },
      body: JSON.stringify({
        sessionId: options.sessionId,
        selectedPapers: options.selectedPapers,
        keywords: options.keywords,
        viabilityScores: options.viabilityScores,
        skipEnrichment: options.skipEnrichment ?? false,
        maxResearchers: options.maxResearchers ?? 0,
        apiKeys: options.apiKeys || {},
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Processing phase request failed: ${response.status} - ${error}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = line.slice(6);
                if (data.trim()) {
                  const log: LogEntry = JSON.parse(data);
                  lastLog = log;

                  if (log.status === 'error') {
                    hasError = true;
                  }

                  onLog(log);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e, line);
              }
            }
          }
        }

        if (lastLog?.step === 'save' && lastLog.status === 'complete' && lastLog.data) {
          resolve({
            success: true,
            papersTotal: lastLog.data.papersTotal || 0,
            researchersTotal: lastLog.data.researchersTotal || 0,
            newPapers: lastLog.data.newPapers || 0,
            newResearchers: lastLog.data.newResearchers || 0,
          });
        } else if (hasError) {
          resolve({
            success: false,
            papersTotal: 0,
            researchersTotal: 0,
            newPapers: 0,
            newResearchers: 0,
            error: lastLog?.message || 'Processing phase failed with error',
          });
        } else {
          resolve({
            success: false,
            papersTotal: 0,
            researchersTotal: 0,
            newPapers: 0,
            newResearchers: 0,
            error: 'Processing phase ended unexpectedly',
          });
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}

// =============================================================================
// Pipeline Status
// =============================================================================

/**
 * Get current pipeline storage statistics.
 */
export async function getPipelineStatus(): Promise<PipelineStatus> {
  const response = await fetch(`${API_BASE}/pipeline-status`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get pipeline status: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Researcher data returned from the backend.
 */
export interface BackendResearcher {
  id: string;
  name: string;
  email?: string;
  institution?: string;
  lab?: string;
  country?: string;
  hIndex?: number;
  citations?: number;
  enrichedAt?: string;
  associated_papers?: { id: string; title: string; keywords: string[] }[];
  aggregateViability?: {
    paperCount: number;
    avgNovelty: number;
    avgMarketSize: number;
    avgFeasibility: number;
    avgTiming: number;
    weightedAvg: number;
  };
}

/**
 * Fetch researchers from the backend storage.
 */
export async function fetchResearchers(): Promise<BackendResearcher[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const response = await fetch(`${API_BASE}/get-researchers`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch researchers: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.researchers || [];
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out - database may be unavailable');
    }
    throw err;
  }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Get step display name.
 */
export function getStepDisplayName(step: PipelineStep): string {
  switch (step) {
    case 'expand':
      return 'Expand';
    case 'search':
      return 'Search';
    case 'extract':
      return 'Extract';
    case 'viability':
      return 'Viability';
    case 'enrich':
      return 'Enrich';
    case 'aggregate':
      return 'Aggregate';
    case 'save':
      return 'Save';
    default:
      return step;
  }
}

/**
 * Get step icon/emoji for display.
 */
export function getStepIcon(step: PipelineStep, status: LogStatus): string {
  if (status === 'error') return 'x';
  if (status === 'complete') return 'check';

  switch (step) {
    case 'expand':
      return 'lightbulb';
    case 'search':
      return 'search';
    case 'extract':
      return 'users';
    case 'viability':
      return 'trending-up';
    case 'enrich':
      return 'sparkles';
    case 'aggregate':
      return 'calculator';
    case 'save':
      return 'save';
    default:
      return 'circle';
  }
}

/**
 * Parse log message to extract progress numbers.
 */
export function parseProgress(message: string): { current: number; total: number } | null {
  // Match patterns like "(5/20)" or "5/20"
  const match = message.match(/\(?\s*(\d+)\s*\/\s*(\d+)\s*\)?/);
  if (match) {
    return {
      current: parseInt(match[1], 10),
      total: parseInt(match[2], 10),
    };
  }
  return null;
}

// =============================================================================
// Dev Mode
// =============================================================================

/**
 * Check if DEV_MODE is enabled on the backend.
 */
export async function checkDevMode(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/dev-status`, {
      method: 'GET',
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.devMode === true;
  } catch {
    return false;
  }
}

/**
 * Clear all data from the database. Only available in DEV_MODE.
 */
export interface ClearDatabaseResult {
  success: boolean;
  message?: string;
  error?: string;
  authorship_deleted?: number;
  viability_deleted?: number;
  papers_deleted?: number;
  researchers_deleted?: number;
}

export async function clearDatabase(): Promise<ClearDatabaseResult> {
  const response = await fetch(`${API_BASE}/clear-database`, {
    method: 'POST',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to clear database');
  }

  return data;
}

/**
 * Test database connectivity. Only available in DEV_MODE.
 * Searches arXiv for 1 paper, saves it, then deletes it.
 */
export interface TestDatabaseResult {
  success: boolean;
  message?: string;
  error?: string;
  steps?: string[];
  paperTested?: {
    id: string;
    title: string;
  };
}

export async function testDatabase(): Promise<TestDatabaseResult> {
  const response = await fetch(`${API_BASE}/test-database`, {
    method: 'POST',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Database test failed');
  }

  return data;
}

/**
 * Save papers to the database.
 */
export interface SavePapersResult {
  success: boolean;
  savedCount: number;
  totalProvided: number;
  message?: string;
  error?: string;
}

export interface PaperToSave {
  id: string;
  title: string;
  abstract?: string;
  authors?: string[];
  year?: number;
  doi?: string;
  arxivId?: string;
  source?: string;
  citations?: number;
  url?: string;
  pdfUrl?: string;
}

export async function savePapers(
  papers: PaperToSave[],
  keywords?: string[]
): Promise<SavePapersResult> {
  const response = await fetch(`${API_BASE}/save-papers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      papers,
      keywords: keywords || ['researcher-papers'],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to save papers');
  }

  return data;
}

/**
 * Analyze market viability for a single paper.
 */
export interface ViabilityAnalysis {
  novelty: number;
  marketSize: number;
  feasibility: number;
  timing: number;
  analysis: string;
  aggregate?: number;
}

export interface AnalyzeViabilityResult {
  success: boolean;
  paperId?: string;
  viability?: ViabilityAnalysis;
  error?: string;
}

export async function analyzePaperViability(
  paper: { id: string; title: string; abstract?: string },
  apiKeys?: { gemini?: string; openai?: string }
): Promise<AnalyzeViabilityResult> {
  try {
    console.log('Calling analyze-viability API:', `${API_BASE}/analyze-viability`);

    const response = await fetch(`${API_BASE}/analyze-viability`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paper,
        apiKeys: apiKeys || {},
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to analyze viability');
    }

    return data;
  } catch (err) {
    console.error('analyzePaperViability error:', err);
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error('Cannot connect to backend. Make sure the server is running on port 8082.');
    }
    throw err;
  }
}

// =============================================================================
// Paper Review Status
// =============================================================================

// =============================================================================
// Quota Management
// =============================================================================

/**
 * Get the current pipeline quota status for the authenticated user.
 */
export async function getQuotaStatus(): Promise<QuotaStatus> {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    return {
      allowed: false,
      unlimited: false,
      used: 0,
      quota: 0,
      error: 'Not authenticated',
    };
  }

  try {
    const response = await fetch(`${AUTH_API_BASE}/email-auth-quota`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
      },
    });

    if (!response.ok) {
      const data = await response.json();
      return {
        allowed: false,
        unlimited: false,
        used: 0,
        quota: 0,
        error: data.error || 'Failed to get quota status',
      };
    }

    return await response.json();
  } catch (error) {
    return {
      allowed: false,
      unlimited: false,
      used: 0,
      quota: 0,
      error: error instanceof Error ? error.message : 'Failed to get quota status',
    };
  }
}

// =============================================================================
// Paper Review Status
// =============================================================================

export type ReviewStatus = 'pending' | 'saved' | 'under_review' | 'pass';

export interface UpdatePaperStatusResult {
  success: boolean;
  paperId?: string;
  status?: ReviewStatus;
  passReason?: string;
  error?: string;
}

export async function updatePaperStatus(
  paperId: string,
  status: ReviewStatus,
  passReason?: string
): Promise<UpdatePaperStatusResult> {
  const response = await fetch(`${API_BASE}/update-paper-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      paperId,
      status,
      passReason,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to update paper status');
  }

  return data;
}

export interface PassReasonTag {
  id: number;
  name: string;
  createdAt?: string;
}

export async function getPassReasonTags(): Promise<PassReasonTag[]> {
  const response = await fetch(`${API_BASE}/get-pass-reason-tags`, {
    method: 'GET',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to get pass reason tags');
  }

  return data.tags || [];
}

export async function createPassReasonTag(name: string): Promise<PassReasonTag> {
  const response = await fetch(`${API_BASE}/create-pass-reason-tag`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create pass reason tag');
  }

  return data.tag;
}

// =============================================================================
// Email Generation
// =============================================================================

export interface GeneratedEmail {
  subject: string;
  greeting: string;
  body: string;
  closing: string;
}

export interface GenerateEmailResult {
  success: boolean;
  email?: GeneratedEmail;
  error?: string;
}

export interface ResearcherForEmail {
  name: string;
  email?: string;
  institution?: string;
  lab?: string;
}

export interface PaperForEmail {
  title: string;
  abstract?: string;
}

export async function generateResearcherEmail(
  researcher: ResearcherForEmail,
  paper?: PaperForEmail,
  purpose?: 'collaboration' | 'inquiry' | 'feedback' | 'licensing',
  context?: string,
  apiKeys?: { gemini?: string }
): Promise<GenerateEmailResult> {
  const response = await fetch(`${API_BASE}/generate-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      researcher,
      paper: paper || {},
      purpose: purpose || 'collaboration',
      context: context || '',
      apiKeys: apiKeys || {},
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to generate email');
  }

  return data;
}

// =============================================================================
// Filtered Papers
// =============================================================================

export interface FilteredPapersOptions {
  status?: ReviewStatus;
  location?: string;
  sortBy?: 'created_at' | 'year' | 'citations' | 'viability_score';
  sortOrder?: 'asc' | 'desc';
}

export async function fetchPapersFiltered(options: FilteredPapersOptions = {}): Promise<BackendPaper[]> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.location) params.set('location', options.location);
  if (options.sortBy) params.set('sortBy', options.sortBy);
  if (options.sortOrder) params.set('sortOrder', options.sortOrder);

  const url = `${API_BASE}/get-papers-filtered${params.toString() ? `?${params}` : ''}`;
  const response = await fetch(url, { method: 'GET' });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch filtered papers');
  }

  return data.papers || [];
}

export interface BackendPaper {
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
