import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, Calendar, Users, Quote, TrendingUp, Star, ExternalLink, AlertCircle, Filter, ChevronDown, ChevronUp, CheckCircle, XCircle, UserPlus, Info, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonColorful } from '@/components/ui/button-colorful';
import { Input } from '@/components/ui/input';
import { PlaceholdersAndVanishInput } from '@/components/ui/placeholders-and-vanish-input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Paper, MarketViability, Researcher } from '@/types';
import { unifiedSearch } from '@/services/unifiedSearchService';
import { analyzeMarketViability, suggestKeywords, KeywordSuggestion } from '@/services/llmClient';
import { useSearch } from '@/contexts/SearchContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useResearchers } from '@/contexts/ResearchersContext';
import { useToast } from '@/hooks/use-toast';

interface SearchFilters {
  yearFrom: string;
  yearTo: string;
  minCitations: string;
}

const SearchPapers = () => {
  const { state, setQuery, setResults, setHasSearched, setViability, getViability } = useSearch();
  const { integrations, openaiApiKey, geminiApiKey } = useSettings();
  const { addResearchers } = useResearchers();
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [addedToDb, setAddedToDb] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    yearFrom: '',
    yearTo: '',
    minCitations: '',
  });

  // Determine which LLM provider to use
  const llmProvider = openaiApiKey ? 'openai' : geminiApiKey ? 'gemini' : null;
  const llmApiKey = openaiApiKey || geminiApiKey || '';

  // Keyword suggestions state
  const [keywordSuggestions, setKeywordSuggestions] = useState<KeywordSuggestion[]>([]);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const [showKeywords, setShowKeywords] = useState(false);
  const { toast } = useToast();

  // Get enabled sources from settings
  const getEnabledSources = () => {
    const sourceMapping: Record<string, string> = {
      'arxiv': 'arxiv',
      'semantic-scholar': 'semantic-scholar',
      'openalex': 'openalex',
      'crossref': 'crossref',
    };

    return integrations
      .filter(int => int.enabled && sourceMapping[int.id])
      .map(int => sourceMapping[int.id]);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.query.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const enabledSources = getEnabledSources();

      if (enabledSources.length === 0) {
        setSearchError('No search sources enabled. Please enable at least one source in Settings.');
        setIsSearching(false);
        return;
      }

      const { papers, sourceResults } = await unifiedSearch(state.query, {
        maxResultsPerSource: 10,
        sources: enabledSources,
      });

      // Apply client-side filters
      let filteredResults = papers;

      // Year filter
      if (filters.yearFrom) {
        const fromYear = parseInt(filters.yearFrom);
        filteredResults = filteredResults.filter(p => p.year >= fromYear);
      }
      if (filters.yearTo) {
        const toYear = parseInt(filters.yearTo);
        filteredResults = filteredResults.filter(p => p.year <= toYear);
      }

      // Citation filter
      const minCitations = parseInt(filters.minCitations) || 0;
      if (minCitations > 0) {
        filteredResults = filteredResults.filter(paper => (paper.citations || 0) >= minCitations);
      }

      // Sort by citations (descending), then by year (descending)
      filteredResults.sort((a, b) => {
        const citeDiff = (b.citations || 0) - (a.citations || 0);
        if (citeDiff !== 0) return citeDiff;
        return b.year - a.year;
      });

      // Recalculate source counts after filtering (keep raw count for display)
      const filteredSourceResults = sourceResults.map(sr => {
        if (sr.error) return sr;
        const filteredCount = filteredResults.filter(p => p.source === sr.source).length;
        return { ...sr, rawCount: sr.count, count: filteredCount };
      });

      setResults(filteredResults, filteredSourceResults);
      setHasSearched(true);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchError(
        error instanceof Error ? error.message : 'Search failed. Please try again.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ yearFrom: '', yearTo: '', minCitations: '' });
  };

  const hasActiveFilters = filters.yearFrom || filters.yearTo || filters.minCitations;

  // Extract unique authors from papers and add to Researchers DB
  const handleAddToDb = () => {
    if (state.results.length === 0) return;

    // Extract unique authors from all papers
    const authorMap = new Map<string, Researcher>();

    state.results.forEach(paper => {
      paper.authors.forEach(authorName => {
        const authorId = `author-${authorName.replace(/\s+/g, '-').toLowerCase()}`;

        if (!authorMap.has(authorId)) {
          authorMap.set(authorId, {
            id: authorId,
            name: authorName,
            affiliation: 'Unknown',
            papers: [paper.id],
          });
        } else {
          // Add paper to existing author
          const existing = authorMap.get(authorId)!;
          if (!existing.papers.includes(paper.id)) {
            existing.papers.push(paper.id);
          }
        }
      });
    });

    const researchers = Array.from(authorMap.values());
    addResearchers(researchers);
    setAddedToDb(true);

    // Reset after a few seconds
    setTimeout(() => setAddedToDb(false), 3000);
  };

  const handleSuggestionClick = (term: string) => {
    setQuery(term);
  };

  // Handle keyword suggestions
  const handleGetKeywords = async () => {
    if (!state.query.trim()) {
      toast({
        title: 'Enter a topic',
        description: 'Please enter a search topic to get keyword suggestions.',
      });
      return;
    }

    if (!llmProvider || !llmApiKey) {
      toast({
        title: 'API Key Required',
        description: 'Please configure an OpenAI or Gemini API key in Settings.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingKeywords(true);
    setShowKeywords(true);

    try {
      const suggestions = await suggestKeywords(llmApiKey, state.query, llmProvider);
      setKeywordSuggestions(suggestions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get suggestions';
      toast({
        title: 'Suggestion Failed',
        description: message,
        variant: 'destructive',
      });
      setKeywordSuggestions([]);
    } finally {
      setIsLoadingKeywords(false);
    }
  };

  const handleKeywordClick = (keyword: string) => {
    // Append keyword to current query
    const currentQuery = state.query.trim();
    if (currentQuery.toLowerCase().includes(keyword.toLowerCase())) {
      return; // Already in query
    }
    setQuery(currentQuery ? `${currentQuery} ${keyword}` : keyword);
  };

  const getCategoryColor = (category: KeywordSuggestion['category']) => {
    switch (category) {
      case 'core':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'synonym':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'related':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'method':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'application':
        return 'bg-pink-500/10 text-pink-600 border-pink-500/20';
      default:
        return 'bg-secondary text-foreground';
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="relative overflow-hidden p-6 border-b border-border bg-background">
        {/* Static Gradient Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 blur-3xl">
            <div
              className="absolute w-[500px] h-[500px] rounded-full opacity-50"
              style={{
                background: '#FDE047',
                top: '-30%',
                left: '5%',
              }}
            />
            <div
              className="absolute w-[600px] h-[600px] rounded-full opacity-50"
              style={{
                background: '#FBBF24',
                top: '-40%',
                left: '35%',
              }}
            />
            <div
              className="absolute w-[700px] h-[700px] rounded-full opacity-60"
              style={{
                background: '#F59E0B',
                top: '-50%',
                right: '-20%',
              }}
            />
          </div>
        </div>
        <div className="relative z-10">
          <h2 className="text-lg font-semibold">Search Papers</h2>
          <p className="text-sm text-muted-foreground">
            Search across {getEnabledSources().length} academic databases
          </p>
        </div>
      </div>

      {/* Search Form */}
      <div className="p-6 border-b border-border">
        <div className="flex gap-2">
          <div className="flex-1">
            <PlaceholdersAndVanishInput
              placeholders={[
                "Search by title, author, or topic...",
                "transformer attention mechanisms",
                "neural network optimization",
                "deep learning applications",
                "machine learning algorithms"
              ]}
              value={state.query}
              onChange={(e) => setQuery(e.target.value)}
              onSubmit={handleSearch}
            />
          </div>
          <ButtonColorful
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleSearch(e as any);
            }}
            disabled={isSearching || !state.query.trim()}
            label={isSearching ? 'Searching...' : 'Search'}
          />
          <Button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all duration-200 text-zinc-900 font-medium"
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
            {hasActiveFilters && <span className="ml-1 w-2 h-2 bg-zinc-900 rounded-full" />}
            {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={handleGetKeywords}
                  disabled={isLoadingKeywords || !state.query.trim()}
                  className="h-10 w-10 p-0 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400 transition-all duration-200"
                >
                  <Sparkles className="w-4 h-4 text-zinc-900" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Suggest related keywords</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Keyword Suggestions Panel */}
        <AnimatePresence>
          {showKeywords && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-3 bg-secondary/30 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Suggested Keywords</span>
                  </div>
                  <button
                    onClick={() => setShowKeywords(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {isLoadingKeywords ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                    Generating suggestions...
                  </div>
                ) : keywordSuggestions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {keywordSuggestions.map((kw, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleKeywordClick(kw.term)}
                        className={`px-2 py-1 text-xs rounded-full border transition-all hover:scale-105 ${getCategoryColor(kw.category)} ${
                          kw.relevance === 'high' ? 'font-medium' : ''
                        }`}
                      >
                        {kw.term}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No suggestions available.</p>
                )}

                {keywordSuggestions.length > 0 && (
                  <div className="flex gap-3 mt-3 pt-2 border-t border-border/50">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500/50" /> Core
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500/50" /> Synonym
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500/50" /> Related
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500/50" /> Method
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-pink-500/50" /> Application
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 p-4 bg-yellow-50/80 rounded-lg border border-yellow-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Filter Results</span>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                      Clear all
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Date Range */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Year From</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 2020"
                      min="1991"
                      max={new Date().getFullYear()}
                      value={filters.yearFrom}
                      onChange={(e) => handleFilterChange('yearFrom', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Year To</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 2024"
                      min="1991"
                      max={new Date().getFullYear()}
                      value={filters.yearTo}
                      onChange={(e) => handleFilterChange('yearTo', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  {/* Citations Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Min Citations</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 10"
                      min="0"
                      value={filters.minCitations}
                      onChange={(e) => handleFilterChange('minCitations', e.target.value)}
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">
                      From Semantic Scholar, OpenAlex, CrossRef
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {searchError && (
          <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            {searchError}
          </div>
        )}
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {!state.hasSearched ? (
          <EmptyState onSuggestionClick={handleSuggestionClick} />
        ) : state.results.length === 0 ? (
          <NoResults query={state.query} />
        ) : (
          <SearchResults
            results={state.results}
            getViability={getViability}
            setViability={setViability}
            llmProvider={llmProvider}
            llmApiKey={llmApiKey}
          />
        )}
      </div>

      {/* Footer */}
      {state.results.length > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="p-4 border-t border-border bg-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {state.results.length} paper{state.results.length !== 1 ? 's' : ''} found
              </p>
              {/* Source Results */}
              {state.sourceResults.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {state.sourceResults.map((sr) => (
                    <span
                      key={sr.source}
                      className={`text-xs flex items-center gap-1 ${
                        sr.error ? 'text-destructive' : sr.count === 0 && sr.rawCount ? 'text-amber-500' : 'text-muted-foreground'
                      }`}
                    >
                      {sr.error ? (
                        <XCircle className="w-3 h-3" />
                      ) : sr.count > 0 ? (
                        <CheckCircle className="w-3 h-3 text-green-500" />
                      ) : (
                        <AlertCircle className="w-3 h-3" />
                      )}
                      {sr.source}: {sr.error ? 'failed' : sr.rawCount && sr.rawCount !== sr.count ? `${sr.count}/${sr.rawCount}` : `${sr.count}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={handleAddToDb} disabled={addedToDb} className="gap-2">
              {addedToDb ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Added to Researchers
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Add Authors to DB
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const EmptyState = ({ onSuggestionClick }: { onSuggestionClick: (term: string) => void }) => (
  <div className="flex flex-col items-center justify-center h-full text-center">
    <FileText className="w-12 h-12 text-muted-foreground mb-4" />
    <p className="text-muted-foreground text-sm max-w-md mb-4">
      Search for papers by title, author name, or research topic.
    </p>
    <div className="flex flex-wrap gap-2 justify-center">
      {['transformer', 'neural network', 'deep learning', 'attention'].map(term => (
        <button
          key={term}
          onClick={() => onSuggestionClick(term)}
          className="px-3 py-1 text-sm border border-border rounded-full hover:bg-secondary transition-colors"
        >
          {term}
        </button>
      ))}
    </div>
  </div>
);

const NoResults = ({ query }: { query: string }) => (
  <div className="flex flex-col items-center justify-center h-full text-center">
    <Search className="w-12 h-12 text-muted-foreground mb-4" />
    <p className="text-muted-foreground">
      No papers found for "{query}"
    </p>
    <p className="text-xs text-muted-foreground mt-2">
      Try a different search term
    </p>
  </div>
);

interface SearchResultsProps {
  results: Paper[];
  getViability: (paperId: string) => MarketViability | undefined;
  setViability: (paperId: string, viability: MarketViability) => void;
  llmProvider: 'openai' | 'gemini' | null;
  llmApiKey: string;
}

const SearchResults = ({ results, getViability, setViability, llmProvider, llmApiKey }: SearchResultsProps) => (
  <div className="space-y-3">
    <AnimatePresence>
      {results.map((paper, index) => (
        <motion.div
          key={paper.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <PaperCard
            paper={paper}
            viability={getViability(paper.id)}
            onViabilityCalculated={(v) => setViability(paper.id, v)}
            llmProvider={llmProvider}
            llmApiKey={llmApiKey}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

interface StarRatingProps {
  rating: number;
  label: string;
  tooltip?: string;
}

const StarRating = ({ rating, label, tooltip }: StarRatingProps) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {tooltip && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3 h-3 ${
            star <= rating ? 'fill-foreground text-foreground' : 'text-border'
          }`}
        />
      ))}
    </div>
  </div>
);

interface PaperCardProps {
  paper: Paper;
  viability?: MarketViability;
  onViabilityCalculated: (viability: MarketViability) => void;
  llmProvider: 'openai' | 'gemini' | null;
  llmApiKey: string;
}

const PaperCard = ({ paper, viability, onViabilityCalculated, llmProvider, llmApiKey }: PaperCardProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showViability, setShowViability] = useState(!!viability);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleMarketViability = async () => {
    if (viability) {
      setShowViability(!showViability);
      return;
    }

    // Check if API key is configured
    if (!llmProvider || !llmApiKey) {
      toast({
        title: 'API Key Required',
        description: 'Please configure an OpenAI or Gemini API key in Settings to analyze market viability.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await analyzeMarketViability(
        llmApiKey,
        paper.title,
        paper.abstract,
        llmProvider
      );

      const newViability: MarketViability = {
        novelty: result.novelty,
        marketSize: result.marketSize,
        feasibility: result.feasibility,
        timing: result.timing,
        analysis: result.analysis,
      };

      onViabilityCalculated(newViability);
      setShowViability(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
      toast({
        title: 'Analysis Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow bg-white border-amber-500">
      <CardContent className="p-4">
        <h3 className="font-medium text-sm mb-2">{paper.title}</h3>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {paper.authors.slice(0, 3).join(', ')}
            {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {paper.year}
          </span>
          {paper.citations && (
            <span className="flex items-center gap-1">
              <Quote className="w-3 h-3" />
              {paper.citations.toLocaleString()} citations
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {paper.abstract}
        </p>
        <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 bg-secondary rounded-full">
              {paper.source}
            </span>
            {paper.arxivId && (
              <span className="text-xs text-muted-foreground">
                {paper.arxivId}
              </span>
            )}
            {paper.categories && paper.categories.length > 0 && (
              <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                {paper.categories[0]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {paper.pdfUrl && (
              <a
                href={paper.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                PDF
              </a>
            )}
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                View
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarketViability}
              disabled={isLoading}
              className="h-7 text-xs"
            >
              <TrendingUp className="w-3 h-3 mr-1" />
              {isLoading ? 'Analyzing...' : 'Market Viability'}
            </Button>
          </div>
        </div>

        {/* Market Viability Results */}
        <AnimatePresence>
          {showViability && viability && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-border"
            >
              <h4 className="text-xs font-medium mb-2">Market Viability Score</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <StarRating
                  rating={viability.novelty}
                  label="Novelty"
                  tooltip={viability.analysis?.novelty}
                />
                <StarRating
                  rating={viability.marketSize}
                  label="Market Size"
                  tooltip={viability.analysis?.marketSize}
                />
                <StarRating
                  rating={viability.feasibility}
                  label="Feasibility"
                  tooltip={viability.analysis?.feasibility}
                />
                <StarRating
                  rating={viability.timing}
                  label="Timing"
                  tooltip={viability.analysis?.timing}
                />
              </div>
              {viability.analysis?.overall && (
                <p className="text-xs text-muted-foreground mt-3 p-2 bg-secondary/50 rounded">
                  {viability.analysis.overall}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error display */}
        {error && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {error}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SearchPapers;
