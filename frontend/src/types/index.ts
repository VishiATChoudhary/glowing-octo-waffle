export interface Integration {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  apiUrl?: string;
  icon: string;
  // API configuration
  requiresKey?: boolean;
  apiKey?: string;
  configFields?: ('email' | 'apiKey')[];
  email?: string;
}

export interface Researcher {
  id: string;
  name: string;
  affiliation: string;
  hIndex?: number;
  citations?: number;
  papers: string[];
  // Enriched fields
  email?: string;
  homepage?: string;
  orcidId?: string;
  semanticScholarId?: string;
  openAlexId?: string;
  publications?: Paper[];
  enrichedAt?: string;
  // From database
  lab?: string;
  country?: string;
  associated_papers?: { id: string; title: string; keywords: string[] }[];
}

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  year: number;
  source: string;
  doi?: string;
  citations?: number;
  url?: string;
  // arXiv-specific fields
  arxivId?: string;
  pdfUrl?: string;
  categories?: string[];
  published?: string;
  updated?: string;
}

export interface GraphNode {
  id: string;
  name: string;
  type: 'researcher' | 'paper';
  val: number;
  data: Researcher | Paper;
}

export interface GraphLink {
  source: string;
  target: string;
  type?: 'authorship' | 'coauthorship' | 'citation';
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface MarketViabilityAnalysis {
  novelty: string;
  marketSize: string;
  feasibility: string;
  timing: string;
  overall: string;
}

export interface MarketViability {
  novelty: number;
  marketSize: number;
  feasibility: number;
  timing: number;
  analysis?: MarketViabilityAnalysis;
}

export interface AuthorPaperIndex {
  authorToPapers: Map<string, string[]>;
  paperIndex: Map<string, Paper>;
}

export interface SearchSessionState {
  graphData: GraphData;
  searchQuery: string;
  seedPaperCount: number;
  totalPaperCount: number;
  expansionDegrees: number;
  wasTruncated: boolean;
  expansionType?: 'authors' | 'citations';
}

// Paper Review Types
export type ReviewStatus = 'pending' | 'saved' | 'under_review' | 'pass';

export interface PassReasonTag {
  id: number;
  name: string;
  createdAt?: string;
}

export interface GeneratedEmail {
  subject: string;
  greeting: string;
  body: string;
  closing: string;
}
