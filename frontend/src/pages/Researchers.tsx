import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, Building2, FileText, Quote, ExternalLink, Loader2, Mail, Globe, Link2, LayoutGrid, Table, Network, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonColorful } from '@/components/ui/button-colorful';
import { Input } from '@/components/ui/input';
import { PlaceholdersAndVanishInput } from '@/components/ui/placeholders-and-vanish-input';
import { Card, CardContent } from '@/components/ui/card';
import { Researcher, GraphData, GraphNode, GraphLink } from '@/types';
import { useResearchers } from '@/contexts/ResearchersContext';
import { enrichResearcher, EnrichmentResult } from '@/services/researcherEnrichmentService';
import * as semanticScholar from '@/services/semanticScholarService';
import * as openAlex from '@/services/openAlexService';

type ViewMode = 'cards' | 'table';

const Researchers = () => {
  const navigate = useNavigate();
  const { state, addResearchers, setSelectedResearcher } = useResearchers();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState({ current: 0, total: 0 });

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
  const filteredResearchers = state.researchers.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.affiliation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Count unenriched researchers
  const unenrichedCount = state.researchers.filter(r => !r.enrichedAt).length;

  // Track which individual researchers are being enriched
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());

  // Track enrichment result for popup
  const [enrichmentResult, setEnrichmentResult] = useState<EnrichmentResult | null>(null);

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

  // Enrich all unenriched researchers
  const handleEnrichAll = async () => {
    const toEnrich = state.researchers.filter(r => !r.enrichedAt);
    if (toEnrich.length === 0) return;

    setIsEnriching(true);
    setEnrichmentProgress({ current: 0, total: toEnrich.length });

    for (let i = 0; i < toEnrich.length; i++) {
      setEnrichmentProgress({ current: i + 1, total: toEnrich.length });

      try {
        const { researcher: enriched } = await enrichResearcher(toEnrich[i]);
        // Update the researcher in the list
        addResearchers([enriched]);
      } catch (error) {
        console.error(`Failed to enrich ${toEnrich[i].name}:`, error);
      }

      // Small delay to avoid rate limiting
      if (i < toEnrich.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsEnriching(false);
  };

  // Build researcher collaboration graph
  const handleGraphIt = () => {
    if (state.researchers.length < 2) return;

    // Build co-authorship relationships from shared papers
    const coAuthorships = new Map<string, number>();

    // For each researcher, find papers they've authored
    // Then find other researchers who share those papers
    state.researchers.forEach(researcher => {
      const paperIds = new Set(researcher.papers);

      state.researchers.forEach(other => {
        if (other.id === researcher.id) return;

        // Count shared papers
        const sharedPapers = other.papers.filter(p => paperIds.has(p)).length;
        if (sharedPapers > 0) {
          const key = researcher.id < other.id
            ? `${researcher.id}||${other.id}`
            : `${other.id}||${researcher.id}`;
          coAuthorships.set(key, Math.max(coAuthorships.get(key) || 0, sharedPapers));
        }
      });
    });

    // Create graph nodes (researchers only)
    const nodes: GraphNode[] = state.researchers.map(r => ({
      id: r.id,
      name: r.name,
      type: 'researcher' as const,
      val: Math.max(10, Math.min(30, (r.publications?.length || r.papers.length) * 2)),
      data: r,
    }));

    // Create graph links (co-authorship)
    const links: GraphLink[] = [];
    coAuthorships.forEach((weight, key) => {
      const [source, target] = key.split('||');
      links.push({
        source,
        target,
        type: 'coauthorship',
        weight,
      });
    });

    const graphData: GraphData = { nodes, links };

    navigate('/graph', {
      state: {
        graphData,
        searchQuery: 'Researcher Collaborations',
        seedPaperCount: 0,
        totalPaperCount: 0,
        expansionDegrees: 0,
        wasTruncated: false,
        expansionType: 'researchers',
      },
    });
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
          <h2 className="text-lg font-semibold">Researchers</h2>
          <p className="text-sm text-muted-foreground">
            Search and discover academic researchers
          </p>
        </div>
      </div>

      {/* Search Form */}
      <div className="p-6 border-b border-border">
        <div className="flex gap-2">
          <div className="flex-1">
            <PlaceholdersAndVanishInput
              placeholders={[
                "Search by name or affiliation...",
                "Geoffrey Hinton",
                "Stanford AI Lab",
                "machine learning researchers",
                "MIT CSAIL"
              ]}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSubmit={handleSearch}
            />
          </div>
          <ButtonColorful
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleSearch(e as any);
            }}
            disabled={isSearching || !searchQuery.trim()}
            label={isSearching ? 'Searching...' : 'Search'}
          />
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
        </div>

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
          {isEnriching ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Enriching researchers...</p>
                <p className="text-xs text-muted-foreground">
                  {enrichmentProgress.current} of {enrichmentProgress.total}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {filteredResearchers.length} of {state.researchers.length} researchers
                </p>
                {unenrichedCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {unenrichedCount} not enriched
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unenrichedCount > 0 && (
                  <Button
                    onClick={handleEnrichAll}
                    variant="outline"
                    className="gap-2 bg-yellow-100/50 hover:bg-yellow-200/50 border-yellow-300 text-yellow-700"
                  >
                    <Sparkles className="w-4 h-4" />
                    Enrich All ({unenrichedCount})
                  </Button>
                )}
                <Button
                  onClick={handleGraphIt}
                  disabled={state.researchers.length < 2}
                  className="gap-2"
                >
                  <Network className="w-4 h-4" />
                  Graph It
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Researcher Detail Popup */}
      <ResearcherPopup
        researcher={state.selectedResearcher}
        onClose={() => setSelectedResearcher(null)}
      />

      {/* Enrichment Result Popup */}
      <EnrichmentPopup
        result={enrichmentResult}
        onClose={() => setEnrichmentResult(null)}
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
}

const ResearchersTable = ({ researchers, onSelect, onEnrich, enrichingIds }: ResearchersTableProps) => (
  <div className="border border-border rounded-lg overflow-hidden">
    <table className="w-full">
      <thead className="bg-secondary">
        <tr className="text-left text-xs font-medium text-muted-foreground">
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Affiliation</th>
          <th className="px-4 py-3 text-center">h-index</th>
          <th className="px-4 py-3 text-center">Citations</th>
          <th className="px-4 py-3 text-center">Papers</th>
          <th className="px-4 py-3 text-center">Email</th>
          <th className="px-4 py-3 text-center">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {researchers.map((researcher) => {
          const isEnriching = enrichingIds.has(researcher.id);
          const isEnriched = !!researcher.enrichedAt;

          return (
            <tr
              key={researcher.id}
              onClick={() => onSelect(researcher)}
              className="hover:bg-secondary/50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-yellow-400 bg-transparent">
                    <Users className="w-4 h-4 text-yellow-500" />
                  </div>
                  <span className="font-medium text-sm">{researcher.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                {researcher.affiliation}
              </td>
              <td className="px-4 py-3 text-sm text-center">
                {researcher.hIndex ?? '-'}
              </td>
              <td className="px-4 py-3 text-sm text-center">
                {researcher.citations?.toLocaleString() ?? '-'}
              </td>
              <td className="px-4 py-3 text-sm text-center">
                {researcher.publications?.length || researcher.papers.length || '-'}
              </td>
              <td className="px-4 py-3 text-center">
                {researcher.email ? (
                  <a
                    href={`mailto:${researcher.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    title={researcher.email}
                  >
                    <Mail className="w-3 h-3" />
                    Contact
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {isEnriched ? (
                  <span className="text-xs text-green-600">Enriched</span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={isEnriching}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEnrich(researcher);
                    }}
                  >
                    {isEnriching ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
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
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-yellow-400 bg-transparent">
            <Users className="w-5 h-5 text-yellow-500" />
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
              {researcher.hIndex !== undefined && (
                <span>h-index: {researcher.hIndex}</span>
              )}
              {researcher.citations !== undefined && (
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

interface ResearcherPopupProps {
  researcher: Researcher | null;
  onClose: () => void;
}

const ResearcherPopup = ({ researcher, onClose }: ResearcherPopupProps) => {
  const [showPublications, setShowPublications] = useState(false);

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
                    <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-yellow-400 bg-transparent">
                      <Users className="w-7 h-7 text-yellow-500" />
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

                  {/* Publications Section */}
                  {researcher.publications && researcher.publications.length > 0 && (
                    <div className="mt-6">
                      <button
                        onClick={() => setShowPublications(!showPublications)}
                        className="flex items-center justify-between w-full text-sm font-medium"
                      >
                        <span>Publications ({researcher.publications.length})</span>
                        <span className="text-muted-foreground">
                          {showPublications ? '▲' : '▼'}
                        </span>
                      </button>

                      <AnimatePresence>
                        {showPublications && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 space-y-2 max-h-60 overflow-y-auto"
                          >
                            {researcher.publications.slice(0, 20).map((pub) => (
                              <div
                                key={pub.id}
                                className="p-2 bg-secondary/50 rounded text-xs"
                              >
                                <p className="font-medium line-clamp-2">{pub.title}</p>
                                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                                  <span>{pub.year}</span>
                                  {pub.citations !== undefined && (
                                    <span>{pub.citations.toLocaleString()} citations</span>
                                  )}
                                  {pub.doi && (
                                    <a
                                      href={`https://doi.org/${pub.doi}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-foreground"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      DOI ↗
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <div className="flex gap-2 mt-6">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
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
                    <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-yellow-400 bg-transparent">
                      <Sparkles className="w-5 h-5 text-yellow-500" />
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
            {data.hIndex !== undefined && <span>h-index: {data.hIndex}</span>}
            {data.citations !== undefined && <span>Citations: {data.citations.toLocaleString()}</span>}
            {data.publications !== undefined && <span>Papers: {data.publications}</span>}
            {data.affiliation && <span>Affiliation: {data.affiliation}</span>}
          </>
        )}
      </div>
    )}
  </div>
);

export default Researchers;
