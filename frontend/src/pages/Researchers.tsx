import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, Building2, FileText, Quote, ExternalLink, Loader2, Mail, Globe, Link2, LayoutGrid, Table, Sparkles, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, BookOpen, Download, ChevronDown, ChevronUp, TrendingUp, Zap, X, Copy, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Researcher, Paper } from '@/types';
import { useResearchers } from '@/contexts/ResearchersContext';
import { usePapers } from '@/contexts/PapersContext';
import { enrichResearcher, EnrichmentResult } from '@/services/researcherEnrichmentService';
import { savePapers, analyzePaperViability, ViabilityAnalysis, generateResearcherEmail, GeneratedEmail } from '@/services/pipelineService';
import { useSettings } from '@/contexts/SettingsContext';
import * as semanticScholar from '@/services/semanticScholarService';
import * as openAlex from '@/services/openAlexService';

type ViewMode = 'cards' | 'table';
type SortColumn = 'name' | 'email' | 'institution' | 'papers';
type SortDirection = 'asc' | 'desc';

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

// Helper function to convert S2 paper to our Paper format
function s2PaperToPaper(s2Paper: semanticScholar.S2Paper): Paper {
  return {
    id: `s2-${s2Paper.paperId}`,
    title: s2Paper.title,
    authors: s2Paper.authors?.map(a => a.name) || [],
    abstract: s2Paper.abstract || '',
    year: s2Paper.year || new Date().getFullYear(),
    source: 'Semantic Scholar',
    citations: s2Paper.citationCount,
    url: s2Paper.url,
    doi: s2Paper.externalIds?.DOI,
    arxivId: s2Paper.externalIds?.ArXiv,
    pdfUrl: s2Paper.openAccessPdf?.url,
  };
}

// Helper function to convert OpenAlex work to our Paper format
function oaWorkToPaper(work: openAlex.OpenAlexWork): Paper {
  return {
    id: `oa-${work.id.split('/').pop()}`,
    title: work.title,
    authors: work.authorships?.map(a => a.author.display_name) || [],
    abstract: '',
    year: work.publication_year,
    source: 'OpenAlex',
    citations: work.cited_by_count,
    doi: work.doi?.replace('https://doi.org/', ''),
    url: work.doi || undefined,
  };
}

// Fetch all papers for a researcher from multiple sources
async function fetchResearcherPapers(
  name: string,
  limit: number = 50
): Promise<{ papers: Paper[]; sources: string[] }> {
  const papers: Paper[] = [];
  const sources: string[] = [];
  const seenTitles = new Set<string>();

  // Search Semantic Scholar for the author
  try {
    const s2Results = await semanticScholar.searchAuthors(name, { limit: 5 });
    const s2Match = s2Results.data.find(
      a => a.name.toLowerCase() === name.toLowerCase()
    ) || s2Results.data[0];

    if (s2Match) {
      const s2Papers = await semanticScholar.getAuthorPapers(s2Match.authorId, {
        limit,
        fields: ['paperId', 'title', 'abstract', 'year', 'citationCount', 'authors', 'externalIds', 'url', 'openAccessPdf'],
      });

      for (const p of s2Papers.data) {
        if (p.title && !seenTitles.has(p.title.toLowerCase())) {
          papers.push(s2PaperToPaper(p));
          seenTitles.add(p.title.toLowerCase());
        }
      }
      sources.push('Semantic Scholar');
    }
  } catch (err) {
    console.error('S2 paper fetch failed:', err);
  }

  // Search OpenAlex for additional papers
  try {
    const oaResults = await openAlex.searchAuthors(name, { perPage: 5 });
    const oaMatch = oaResults.results.find(
      a => a.display_name.toLowerCase() === name.toLowerCase()
    ) || oaResults.results[0];

    if (oaMatch) {
      const authorId = oaMatch.id.split('/').pop() || oaMatch.id;
      const oaPapers = await openAlex.getAuthorWorks(authorId, { perPage: limit });

      for (const w of oaPapers.results) {
        if (w.title && !seenTitles.has(w.title.toLowerCase())) {
          papers.push(oaWorkToPaper(w));
          seenTitles.add(w.title.toLowerCase());
        }
      }
      sources.push('OpenAlex');
    }
  } catch (err) {
    console.error('OpenAlex paper fetch failed:', err);
  }

  // Sort by citations
  papers.sort((a, b) => (b.citations || 0) - (a.citations || 0));

  return { papers, sources };
}

const Researchers = () => {
  const { state, addResearchers, setSelectedResearcher, loadFromDatabase } = useResearchers();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sort, setSort] = useState<SortState>({ column: 'name', direction: 'asc' });

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    setSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const researchers: Researcher[] = [];

      // Search Semantic Scholar for authors
      try {
        const s2Results = await semanticScholar.searchAuthors(searchQuery, { limit: 10 });
        for (const author of s2Results.data) {
          researchers.push({
            id: `s2-author-${author.authorId}`,
            name: author.name,
            affiliation: author.affiliations?.[0] || 'Unknown',
            hIndex: author.hIndex,
            citations: author.citationCount,
            papers: author.papers?.map(p => p.paperId) || [],
          });
        }
      } catch (err) {
        console.error('Semantic Scholar author search failed:', err);
      }

      // Search OpenAlex for authors
      try {
        const oaResults = await openAlex.searchAuthors(searchQuery, { perPage: 10 });
        for (const author of oaResults.results) {
          // Avoid duplicates by checking name similarity
          const isDuplicate = researchers.some(
            r => r.name.toLowerCase() === author.display_name.toLowerCase()
          );
          if (!isDuplicate) {
            researchers.push({
              id: `oa-author-${author.id.split('/').pop()}`,
              name: author.display_name,
              affiliation: author.last_known_institution?.display_name || 'Unknown',
              hIndex: author.summary_stats?.h_index,
              citations: author.cited_by_count,
              papers: [],
            });
          }
        }
      } catch (err) {
        console.error('OpenAlex author search failed:', err);
      }

      if (researchers.length === 0) {
        setSearchError('No researchers found. Try a different search term.');
      } else {
        addResearchers(researchers);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Filter researchers based on search query (for filtering existing list)
  const filteredResearchers = state.researchers
    .filter(r =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.affiliation.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const direction = sort.direction === 'asc' ? 1 : -1;

      switch (sort.column) {
        case 'name':
          return direction * a.name.localeCompare(b.name);
        case 'email':
          const emailA = a.email || '';
          const emailB = b.email || '';
          return direction * emailA.localeCompare(emailB);
        case 'institution':
          const instA = a.affiliation || '';
          const instB = b.affiliation || '';
          return direction * instA.localeCompare(instB);
        case 'papers':
          const papersA = a.associated_papers?.length || a.publications?.length || a.papers?.length || 0;
          const papersB = b.associated_papers?.length || b.publications?.length || b.papers?.length || 0;
          return direction * (papersA - papersB);
        default:
          return 0;
      }
    });

  // Track which individual researchers are being enriched
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());

  // Track enrichment result for popup
  const [enrichmentResult, setEnrichmentResult] = useState<EnrichmentResult | null>(null);

  // Papers context for saving
  const { loadPapers } = usePapers();
  const [saveMessage, setSaveMessage] = useState<{ success: boolean; text: string } | null>(null);

  // Email draft state
  const [emailDraftResearcher, setEmailDraftResearcher] = useState<Researcher | null>(null);

  // Handle saving papers to database
  const handleSavePapers = async (papers: Paper[]) => {
    try {
      const result = await savePapers(
        papers.map(p => ({
          id: p.id,
          title: p.title,
          abstract: p.abstract,
          authors: p.authors,
          year: p.year,
          doi: p.doi,
          arxivId: p.arxivId,
          source: p.source,
          citations: p.citations,
          url: p.url,
          pdfUrl: p.pdfUrl,
        })),
        ['researcher-papers']
      );
      setSaveMessage({
        success: true,
        text: `Saved ${result.savedCount} new papers`,
      });
      // Reload papers list
      loadPapers();
    } catch (err) {
      setSaveMessage({
        success: false,
        text: err instanceof Error ? err.message : 'Failed to save papers',
      });
    }
    // Clear message after 3 seconds
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Enrich a single researcher
  const handleEnrichOne = async (researcher: Researcher) => {
    if (researcher.enrichedAt || enrichingIds.has(researcher.id)) return;

    setEnrichingIds(prev => new Set(prev).add(researcher.id));

    try {
      const result = await enrichResearcher(researcher);
      addResearchers([result.researcher]);
      setEnrichmentResult(result);
    } catch (error) {
      console.error(`Failed to enrich ${researcher.name}:`, error);
    } finally {
      setEnrichingIds(prev => {
        const next = new Set(prev);
        next.delete(researcher.id);
        return next;
      });
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Researchers</h2>
            <p className="text-sm text-muted-foreground">
              Search and discover academic researchers
            </p>
          </div>
          <Button
            onClick={loadFromDatabase}
            disabled={state.isLoadingFromDb}
            variant="outline"
            className="gap-2"
          >
            {state.isLoadingFromDb ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </Button>
        </div>
        {state.dbError && (
          <p className="mt-2 text-sm text-destructive">{state.dbError}</p>
        )}
      </div>

      {/* Search Form */}
      <div className="p-6 border-b border-border">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or affiliation..."
              className="pl-10"
            />
          </div>
          <Button type="submit" disabled={isSearching || !searchQuery.trim()}>
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              'Search'
            )}
          </Button>

          {/* View Toggle */}
          <div className="flex border border-border rounded-md">
            <Button
              type="button"
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('cards')}
              className="rounded-r-none"
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('table')}
              className="rounded-l-none border-l"
              title="Table view"
            >
              <Table className="w-4 h-4" />
            </Button>
          </div>
        </form>

        {searchError && (
          <p className="mt-2 text-sm text-destructive">{searchError}</p>
        )}
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {state.researchers.length === 0 ? (
          <EmptyState />
        ) : viewMode === 'table' ? (
          <ResearchersTable
            researchers={filteredResearchers}
            onSelect={setSelectedResearcher}
            onEnrich={handleEnrichOne}
            enrichingIds={enrichingIds}
            sort={sort}
            onSort={handleSort}
            onEmail={setEmailDraftResearcher}
          />
        ) : (
          <ResearchersList
            researchers={filteredResearchers}
            onSelect={setSelectedResearcher}
            onEnrich={handleEnrichOne}
            enrichingIds={enrichingIds}
          />
        )}
      </div>

      {/* Footer */}
      {state.researchers.length > 0 && (
        <div className="p-4 border-t border-border bg-card">
          <p className="text-sm font-medium">
            {filteredResearchers.length} of {state.researchers.length} researchers
          </p>
        </div>
      )}

      {/* Save Message Toast */}
      <AnimatePresence>
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg ${
              saveMessage.success
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {saveMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Researcher Detail Popup */}
      <ResearcherPopup
        researcher={state.selectedResearcher}
        onClose={() => setSelectedResearcher(null)}
        onSavePapers={handleSavePapers}
      />

      {/* Enrichment Result Popup */}
      <EnrichmentPopup
        result={enrichmentResult}
        onClose={() => setEnrichmentResult(null)}
      />

      {/* Email Draft Popup */}
      <EmailDraftPopup
        researcher={emailDraftResearcher}
        onClose={() => setEmailDraftResearcher(null)}
      />
    </div>
  );
};

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-full text-center">
    <Users className="w-12 h-12 text-muted-foreground mb-4" />
    <p className="text-muted-foreground text-sm max-w-md mb-4">
      Search for researchers by name or affiliation to build your network.
    </p>
    <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
      <span>Try: "Geoffrey Hinton", "Stanford AI", "machine learning"</span>
    </div>
  </div>
);

interface ResearchersListProps {
  researchers: Researcher[];
  onSelect: (researcher: Researcher) => void;
  onEnrich: (researcher: Researcher) => void;
  enrichingIds: Set<string>;
}

const ResearchersList = ({ researchers, onSelect, onEnrich, enrichingIds }: ResearchersListProps) => (
  <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
    <AnimatePresence>
      {researchers.map((researcher, index) => (
        <motion.div
          key={researcher.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
        >
          <ResearcherCard
            researcher={researcher}
            onClick={() => onSelect(researcher)}
            onEnrich={() => onEnrich(researcher)}
            isEnriching={enrichingIds.has(researcher.id)}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

interface ResearchersTableProps {
  researchers: Researcher[];
  onSelect: (researcher: Researcher) => void;
  onEnrich: (researcher: Researcher) => void;
  enrichingIds: Set<string>;
  sort: SortState;
  onSort: (column: SortColumn) => void;
  onEmail?: (researcher: Researcher) => void;
}

const SortIcon = ({ column, sort }: { column: SortColumn; sort: SortState }) => {
  if (sort.column !== column) {
    return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
  }
  return sort.direction === 'asc'
    ? <ArrowUp className="w-3 h-3 ml-1" />
    : <ArrowDown className="w-3 h-3 ml-1" />;
};

const ResearchersTable = ({ researchers, onSelect, onEnrich, enrichingIds, sort, onSort, onEmail }: ResearchersTableProps) => (
  <div className="border border-border rounded-lg overflow-hidden">
    <table className="w-full">
      <thead className="bg-secondary">
        <tr className="text-left text-xs font-medium text-muted-foreground">
          <th
            className="px-4 py-3 cursor-pointer hover:bg-secondary/80 select-none"
            onClick={() => onSort('name')}
          >
            <div className="flex items-center">
              Researcher
              <SortIcon column="name" sort={sort} />
            </div>
          </th>
          <th
            className="px-4 py-3 cursor-pointer hover:bg-secondary/80 select-none"
            onClick={() => onSort('email')}
          >
            <div className="flex items-center">
              Email
              <SortIcon column="email" sort={sort} />
            </div>
          </th>
          <th
            className="px-4 py-3 cursor-pointer hover:bg-secondary/80 select-none"
            onClick={() => onSort('institution')}
          >
            <div className="flex items-center">
              Institution
              <SortIcon column="institution" sort={sort} />
            </div>
          </th>
          <th
            className="px-4 py-3 cursor-pointer hover:bg-secondary/80 select-none"
            onClick={() => onSort('papers')}
          >
            <div className="flex items-center">
              Associated Papers
              <SortIcon column="papers" sort={sort} />
            </div>
          </th>
          <th className="px-4 py-3 w-20">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {researchers.map((researcher) => {
          const associatedPapers = researcher.associated_papers || [];

          return (
            <tr
              key={researcher.id}
              onClick={() => onSelect(researcher)}
              className="hover:bg-secondary/50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-node-researcher flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-node-researcher-border" />
                  </div>
                  <span className="font-medium text-sm">{researcher.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                {researcher.email ? (
                  <a
                    href={`mailto:${researcher.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    title={researcher.email}
                  >
                    <Mail className="w-3 h-3" />
                    {researcher.email}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                {researcher.affiliation || '-'}
              </td>
              <td className="px-4 py-3">
                {associatedPapers.length > 0 ? (
                  <div className="space-y-1 max-w-md">
                    {associatedPapers.slice(0, 3).map((paper) => (
                      <div key={paper.id} className="text-xs">
                        <span className="text-foreground line-clamp-1">{paper.title}</span>
                        {paper.keywords && paper.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {paper.keywords.slice(0, 2).map((kw, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px]">
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {associatedPapers.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{associatedPapers.length - 3} more papers
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {researcher.publications?.length || researcher.papers?.length || 0} papers
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                {onEmail && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEmail(researcher);
                    }}
                    title="Draft Email"
                  >
                    <Mail className="w-4 h-4" />
                  </Button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

interface ResearcherCardProps {
  researcher: Researcher;
  onClick: () => void;
  onEnrich: () => void;
  isEnriching: boolean;
}

const ResearcherCard = ({ researcher, onClick, onEnrich, isEnriching }: ResearcherCardProps) => {
  const isEnriched = !!researcher.enrichedAt;

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-node-researcher flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-node-researcher-border" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm truncate">{researcher.name}</h3>
              {researcher.email && (
                <Mail className="w-3 h-3 text-green-500 flex-shrink-0" title="Email available" />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3" />
              {researcher.affiliation}
            </p>
            <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
              {researcher.hIndex != null && (
                <span>h-index: {researcher.hIndex}</span>
              )}
              {researcher.citations != null && (
                <span className="flex items-center gap-1">
                  <Quote className="w-3 h-3" />
                  {researcher.citations.toLocaleString()}
                </span>
              )}
              {(researcher.publications?.length || researcher.papers.length > 0) && (
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {researcher.publications?.length || researcher.papers.length}
                </span>
              )}
            </div>
          </div>
          {/* Enrich Button */}
          <div className="flex-shrink-0">
            {isEnriched ? (
              <span className="text-xs text-green-600 font-medium">Enriched</span>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                disabled={isEnriching}
                onClick={(e) => {
                  e.stopPropagation();
                  onEnrich();
                }}
                title="Enrich researcher data"
              >
                {isEnriching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Expandable Paper Card Component
interface ExpandablePaperCardProps {
  paper: Paper;
  viability?: ViabilityAnalysis;
  onAnalyzeViability: (paper: Paper) => void;
  isAnalyzing: boolean;
  error?: string;
}

const ExpandablePaperCard = ({ paper, viability, onAnalyzeViability, isAnalyzing, error }: ExpandablePaperCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-500';
    if (score >= 3) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="border border-border rounded-lg bg-background overflow-hidden">
      {/* Header - Always visible */}
      <div
        className="p-3 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm line-clamp-2">{paper.title}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{paper.year}</span>
              {paper.citations != null && (
                <span>{paper.citations.toLocaleString()} citations</span>
              )}
              <span className="text-primary/70">{paper.source}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {viability && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getScoreColor(viability.aggregate || 0)} bg-current/10`}>
                {viability.aggregate?.toFixed(1)}
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
              {/* Abstract */}
              {paper.abstract ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Abstract</p>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    {paper.abstract}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No abstract available</p>
              )}

              {/* Authors */}
              {paper.authors && paper.authors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Authors</p>
                  <p className="text-xs text-foreground/80">
                    {paper.authors.slice(0, 5).join(', ')}
                    {paper.authors.length > 5 && ` +${paper.authors.length - 5} more`}
                  </p>
                </div>
              )}

              {/* Viability Scores */}
              {viability && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Market Viability</p>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-2 bg-secondary/50 rounded">
                      <p className="text-[10px] text-muted-foreground">Novelty</p>
                      <p className={`text-sm font-semibold ${getScoreColor(viability.novelty)}`}>
                        {viability.novelty}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-secondary/50 rounded">
                      <p className="text-[10px] text-muted-foreground">Market</p>
                      <p className={`text-sm font-semibold ${getScoreColor(viability.marketSize)}`}>
                        {viability.marketSize}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-secondary/50 rounded">
                      <p className="text-[10px] text-muted-foreground">Feasibility</p>
                      <p className={`text-sm font-semibold ${getScoreColor(viability.feasibility)}`}>
                        {viability.feasibility}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-secondary/50 rounded">
                      <p className="text-[10px] text-muted-foreground">Timing</p>
                      <p className={`text-sm font-semibold ${getScoreColor(viability.timing)}`}>
                        {viability.timing}
                      </p>
                    </div>
                  </div>
                  {viability.analysis && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      {viability.analysis}
                    </p>
                  )}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-500 mb-2">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {!viability && (
                  <Button
                    size="sm"
                    variant={error ? 'destructive' : 'outline'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnalyzeViability(paper);
                    }}
                    disabled={isAnalyzing}
                    className="text-xs gap-1"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Analyzing...
                      </>
                    ) : error ? (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        Retry Analysis
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-3 h-3" />
                        Analyze Viability
                      </>
                    )}
                  </Button>
                )}
                {paper.doi && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://doi.org/${paper.doi}`, '_blank');
                    }}
                    className="text-xs gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    DOI
                  </Button>
                )}
                {paper.pdfUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(paper.pdfUrl, '_blank');
                    }}
                    className="text-xs gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    PDF
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ResearcherPopupProps {
  researcher: Researcher | null;
  onClose: () => void;
  onSavePapers?: (papers: Paper[]) => void;
}

const ResearcherPopup = ({ researcher, onClose, onSavePapers }: ResearcherPopupProps) => {
  const [showPublications, setShowPublications] = useState(false);
  const [isFetchingPapers, setIsFetchingPapers] = useState(false);
  const [fetchedPapers, setFetchedPapers] = useState<Paper[]>([]);
  const [paperSources, setPaperSources] = useState<string[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  // Viability analysis state
  const [viabilityScores, setViabilityScores] = useState<Record<string, ViabilityAnalysis>>({});
  const [analyzingPaperIds, setAnalyzingPaperIds] = useState<Set<string>>(new Set());
  const [viabilityErrors, setViabilityErrors] = useState<Record<string, string>>({});

  // Get API keys from settings
  const { geminiApiKey, openaiApiKey } = useSettings();

  // Reset state when researcher changes
  const handleClose = () => {
    setFetchedPapers([]);
    setPaperSources([]);
    setHasFetched(false);
    setShowPublications(false);
    setViabilityScores({});
    setAnalyzingPaperIds(new Set());
    setViabilityErrors({});
    onClose();
  };

  const handleFetchPapers = async () => {
    if (!researcher || isFetchingPapers) return;

    setIsFetchingPapers(true);
    try {
      const result = await fetchResearcherPapers(researcher.name, 50);
      setFetchedPapers(result.papers);
      setPaperSources(result.sources);
      setHasFetched(true);
      setShowPublications(true);
    } catch (err) {
      console.error('Failed to fetch papers:', err);
    } finally {
      setIsFetchingPapers(false);
    }
  };

  const handleAnalyzeViability = async (paper: Paper) => {
    if (analyzingPaperIds.has(paper.id)) return;

    console.log('Analyzing viability for:', paper.title);
    setAnalyzingPaperIds(prev => new Set(prev).add(paper.id));
    // Clear any previous error
    setViabilityErrors(prev => {
      const next = { ...prev };
      delete next[paper.id];
      return next;
    });

    try {
      const result = await analyzePaperViability(
        {
          id: paper.id,
          title: paper.title,
          abstract: paper.abstract,
        },
        {
          gemini: geminiApiKey || undefined,
          openai: openaiApiKey || undefined,
        }
      );

      console.log('Viability result:', result);

      if (result.success && result.viability) {
        setViabilityScores(prev => ({
          ...prev,
          [paper.id]: result.viability!,
        }));
      } else {
        setViabilityErrors(prev => ({
          ...prev,
          [paper.id]: result.error || 'Analysis failed',
        }));
      }
    } catch (err) {
      console.error('Failed to analyze viability:', err);
      setViabilityErrors(prev => ({
        ...prev,
        [paper.id]: err instanceof Error ? err.message : 'Analysis failed',
      }));
    } finally {
      setAnalyzingPaperIds(prev => {
        const next = new Set(prev);
        next.delete(paper.id);
        return next;
      });
    }
  };

  const handleSavePapers = () => {
    if (fetchedPapers.length > 0 && onSavePapers) {
      onSavePapers(fetchedPapers);
    }
  };

  // Use fetched papers if available, otherwise fall back to existing publications
  const displayPapers = hasFetched ? fetchedPapers : (researcher?.publications || []);

  return (
    <AnimatePresence>
      {researcher && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />

          {/* Popup */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg pointer-events-auto max-h-[90vh] overflow-hidden flex flex-col"
            >
              <Card className="flex flex-col overflow-hidden">
                <CardContent className="p-6 overflow-y-auto">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-node-researcher flex items-center justify-center flex-shrink-0">
                      <Users className="w-7 h-7 text-node-researcher-border" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold">{researcher.name}</h2>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Building2 className="w-4 h-4" />
                        {researcher.affiliation}
                      </p>
                    </div>
                  </div>

                  {/* Contact Info */}
                  {(researcher.email || researcher.homepage || researcher.orcidId) && (
                    <div className="mt-4 space-y-2">
                      {researcher.email && (
                        <a
                          href={`mailto:${researcher.email}`}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Mail className="w-4 h-4" />
                          {researcher.email}
                        </a>
                      )}
                      {researcher.homepage && (
                        <a
                          href={researcher.homepage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Globe className="w-4 h-4" />
                          Homepage
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {researcher.orcidId && (
                        <a
                          href={`https://orcid.org/${researcher.orcidId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Link2 className="w-4 h-4" />
                          ORCID: {researcher.orcidId}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <div className="bg-secondary p-3 rounded text-center">
                      <p className="text-xs text-muted-foreground">h-index</p>
                      <p className="text-xl font-semibold">{researcher.hIndex ?? '-'}</p>
                    </div>
                    <div className="bg-secondary p-3 rounded text-center">
                      <p className="text-xs text-muted-foreground">Citations</p>
                      <p className="text-xl font-semibold">
                        {researcher.citations?.toLocaleString() ?? '-'}
                      </p>
                    </div>
                    <div className="bg-secondary p-3 rounded text-center">
                      <p className="text-xs text-muted-foreground">Papers</p>
                      <p className="text-xl font-semibold">
                        {researcher.publications?.length || researcher.papers.length || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Pre-existing Publications Section (from enrichment) */}
                  {!hasFetched && researcher.publications && researcher.publications.length > 0 && (
                    <div className="mt-6">
                      <button
                        onClick={() => setShowPublications(!showPublications)}
                        className="flex items-center justify-between w-full text-sm font-medium"
                      >
                        <span>Known Publications ({researcher.publications.length})</span>
                        <span className="text-muted-foreground">
                          {showPublications ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </button>

                      <AnimatePresence>
                        {showPublications && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 space-y-2 max-h-[300px] overflow-y-auto pr-1"
                          >
                            {researcher.publications.slice(0, 20).map((pub) => (
                              <ExpandablePaperCard
                                key={pub.id}
                                paper={pub}
                                viability={viabilityScores[pub.id]}
                                onAnalyzeViability={handleAnalyzeViability}
                                isAnalyzing={analyzingPaperIds.has(pub.id)}
                                error={viabilityErrors[pub.id]}
                              />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Fetch Papers Button */}
                  <div className="mt-6 p-4 bg-secondary/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium">Other Papers</p>
                        <p className="text-xs text-muted-foreground">
                          {hasFetched
                            ? `Found ${fetchedPapers.length} papers from ${paperSources.join(', ')}`
                            : 'Fetch papers from Semantic Scholar & OpenAlex'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={hasFetched ? 'outline' : 'default'}
                        onClick={handleFetchPapers}
                        disabled={isFetchingPapers}
                        className="gap-2"
                      >
                        {isFetchingPapers ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Fetching...
                          </>
                        ) : hasFetched ? (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-4 h-4" />
                            Fetch Papers
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Show fetched papers with expandable cards */}
                    {hasFetched && fetchedPapers.length > 0 && (
                      <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {fetchedPapers.slice(0, 30).map((paper) => (
                          <ExpandablePaperCard
                            key={paper.id}
                            paper={paper}
                            viability={viabilityScores[paper.id]}
                            onAnalyzeViability={handleAnalyzeViability}
                            isAnalyzing={analyzingPaperIds.has(paper.id)}
                            error={viabilityErrors[paper.id]}
                          />
                        ))}
                        {fetchedPapers.length > 30 && (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            +{fetchedPapers.length - 30} more papers
                          </p>
                        )}
                      </div>
                    )}

                    {/* Save to Database button */}
                    {hasFetched && fetchedPapers.length > 0 && onSavePapers && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSavePapers}
                        className="w-full mt-3 gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Save {fetchedPapers.length} Papers to Database
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-2 mt-6">
                    <Button variant="outline" className="flex-1" onClick={handleClose}>
                      Close
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      onClick={() => {
                        const query = encodeURIComponent(researcher.name);
                        window.open(`https://scholar.google.com/scholar?q=author:"${query}"`, '_blank');
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Google Scholar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

interface EnrichmentPopupProps {
  result: EnrichmentResult | null;
  onClose: () => void;
}

const EnrichmentPopup = ({ result, onClose }: EnrichmentPopupProps) => {
  if (!result) return null;

  const { researcher, sources, details } = result;
  const noSourcesFound = sources.length === 0;

  return (
    <AnimatePresence>
      {result && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

          {/* Popup */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg pointer-events-auto"
            >
              <Card>
                <CardContent className="p-6">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Enrichment Results</h3>
                      <p className="text-sm text-muted-foreground">{researcher.name}</p>
                    </div>
                  </div>

                  {noSourcesFound ? (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground">
                        No data found for this researcher in any database.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Searched: Semantic Scholar, OpenAlex, ORCID
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Summary */}
                      <div className="grid grid-cols-4 gap-3 mb-6">
                        <div className="bg-secondary p-3 rounded text-center">
                          <p className="text-xs text-muted-foreground">h-index</p>
                          <p className="text-lg font-semibold">{researcher.hIndex ?? '-'}</p>
                        </div>
                        <div className="bg-secondary p-3 rounded text-center">
                          <p className="text-xs text-muted-foreground">Citations</p>
                          <p className="text-lg font-semibold">
                            {researcher.citations?.toLocaleString() ?? '-'}
                          </p>
                        </div>
                        <div className="bg-secondary p-3 rounded text-center">
                          <p className="text-xs text-muted-foreground">Papers</p>
                          <p className="text-lg font-semibold">
                            {researcher.publications?.length || '-'}
                          </p>
                        </div>
                        <div className="bg-secondary p-3 rounded text-center">
                          <p className="text-xs text-muted-foreground">Contact</p>
                          <p className="text-lg font-semibold">
                            {researcher.email ? (
                              <Mail className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              '-'
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Source Details */}
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Sources</p>

                        {/* Semantic Scholar */}
                        <SourceRow
                          name="Semantic Scholar"
                          found={details.semanticScholar.found}
                          data={details.semanticScholar}
                        />

                        {/* OpenAlex */}
                        <SourceRow
                          name="OpenAlex"
                          found={details.openAlex.found}
                          data={details.openAlex}
                        />

                        {/* ORCID */}
                        <SourceRow
                          name="ORCID"
                          found={details.orcid.found}
                          data={details.orcid}
                          isOrcid
                        />
                      </div>
                    </>
                  )}

                  {/* Close Button */}
                  <Button className="w-full mt-6" onClick={onClose}>
                    Close
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

interface SourceRowProps {
  name: string;
  found: boolean;
  data: {
    hIndex?: number;
    citations?: number;
    publications?: number;
    email?: string;
    homepage?: string;
    affiliation?: string;
  };
  isOrcid?: boolean;
}

const SourceRow = ({ name, found, data, isOrcid }: SourceRowProps) => (
  <div className={`p-3 rounded border ${found ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-secondary/50'}`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium">{name}</span>
      {found ? (
        <span className="text-xs text-green-600 font-medium">Found</span>
      ) : (
        <span className="text-xs text-muted-foreground">Not found</span>
      )}
    </div>
    {found && (
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {isOrcid ? (
          <>
            {data.email && <span>Email: {data.email}</span>}
            {data.homepage && <span>Homepage: Yes</span>}
            {!data.email && !data.homepage && <span>Profile found (no public contact)</span>}
          </>
        ) : (
          <>
            {data.hIndex != null && <span>h-index: {data.hIndex}</span>}
            {data.citations != null && <span>Citations: {data.citations.toLocaleString()}</span>}
            {data.publications != null && <span>Papers: {data.publications}</span>}
            {data.affiliation && <span>Affiliation: {data.affiliation}</span>}
          </>
        )}
      </div>
    )}
  </div>
);

// =============================================================================
// Email Draft Popup
// =============================================================================

interface EmailDraftPopupProps {
  researcher: Researcher | null;
  onClose: () => void;
}

const EmailDraftPopup = ({ researcher, onClose }: EmailDraftPopupProps) => {
  const { geminiApiKey } = useSettings();

  // Form state
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState<string>('');
  const [purpose, setPurpose] = useState<'collaboration' | 'inquiry' | 'feedback' | 'licensing'>('collaboration');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset form when researcher changes
  useEffect(() => {
    if (researcher) {
      setToEmail(researcher.email || '');
      setSubject('');
      setBody('');
      setSelectedPaperId('');
      setPurpose('collaboration');
      setGenerateError(null);
    }
  }, [researcher]);

  // Get associated papers
  const associatedPapers = researcher?.associated_papers || [];

  const handleGenerate = async () => {
    if (!researcher) return;

    setIsGenerating(true);
    setGenerateError(null);

    try {
      // Find selected paper
      const selectedPaper = associatedPapers.find(p => p.id === selectedPaperId);

      const result = await generateResearcherEmail(
        {
          name: researcher.name,
          email: researcher.email,
          institution: researcher.affiliation,
          lab: researcher.lab,
        },
        selectedPaper ? { title: selectedPaper.title } : undefined,
        purpose,
        undefined,
        { gemini: geminiApiKey || undefined }
      );

      if (result.success && result.email) {
        setSubject(result.email.subject || '');
        const greeting = result.email.greeting || '';
        const bodyText = result.email.body || '';
        const closing = result.email.closing || '';
        setBody(`${greeting}\n\n${bodyText}\n\n${closing}`.trim());
      } else {
        setGenerateError(result.error || 'Failed to generate email - no content returned');
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate email');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    const fullEmail = `To: ${toEmail}\nSubject: ${subject}\n\n${body}`;
    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const handleSendMail = async () => {
    if (!toEmail || !body) return;

    setIsSending(true);
    // Mock sending - simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSending(false);
    setSendSuccess(true);
    setTimeout(() => setSendSuccess(false), 2000);
  };

  const handleClose = () => {
    setToEmail('');
    setSubject('');
    setBody('');
    setSelectedPaperId('');
    setGenerateError(null);
    setIsSending(false);
    setSendSuccess(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {researcher && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

          {/* Popup */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg pointer-events-auto max-h-[90vh] overflow-hidden flex flex-col"
            >
              <Card className="flex flex-col overflow-hidden">
                <CardContent className="p-6 overflow-y-auto">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Email Draft</h3>
                        <p className="text-sm text-muted-foreground">{researcher.name}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleClose}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* To Field */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">To</label>
                      <Input
                        value={toEmail}
                        onChange={(e) => setToEmail(e.target.value)}
                        placeholder="researcher@email.com"
                        type="email"
                      />
                    </div>

                    {/* Subject Field */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">Subject</label>
                      <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Subject line..."
                      />
                    </div>

                    {/* Paper Selection & Generate */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-sm font-medium mb-1 block">Paper Context</label>
                        <select
                          value={selectedPaperId}
                          onChange={(e) => setSelectedPaperId(e.target.value)}
                          className="w-full h-9 px-3 rounded border border-border bg-background text-sm"
                        >
                          <option value="">No paper selected</option>
                          {associatedPapers.map((paper) => (
                            <option key={paper.id} value={paper.id}>
                              {paper.title.length > 50 ? `${paper.title.slice(0, 50)}...` : paper.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Purpose</label>
                        <select
                          value={purpose}
                          onChange={(e) => setPurpose(e.target.value as typeof purpose)}
                          className="h-9 px-3 rounded border border-border bg-background text-sm"
                        >
                          <option value="collaboration">Collaboration</option>
                          <option value="inquiry">Inquiry</option>
                          <option value="feedback">Feedback</option>
                          <option value="licensing">Licensing</option>
                        </select>
                      </div>
                    </div>

                    {/* Generate Button */}
                    <Button
                      onClick={handleGenerate}
                      disabled={isGenerating || !geminiApiKey}
                      className="w-full gap-2"
                      variant={generateError ? 'destructive' : 'default'}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate with AI
                        </>
                      )}
                    </Button>

                    {!geminiApiKey && (
                      <p className="text-xs text-muted-foreground text-center">
                        Add Gemini API key in Settings to enable AI generation
                      </p>
                    )}

                    {generateError && (
                      <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
                        {generateError}
                      </div>
                    )}

                    {/* Body Field */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">Body</label>
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Email body..."
                        rows={8}
                        className="w-full px-3 py-2 rounded border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={handleCopy}
                        disabled={!body}
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 text-green-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button
                        className="flex-1 gap-2"
                        onClick={handleSendMail}
                        disabled={!toEmail || !body || isSending}
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending...
                          </>
                        ) : sendSuccess ? (
                          <>
                            <Check className="w-4 h-4 text-green-500" />
                            Sent!
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Send Mail
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Researchers;
