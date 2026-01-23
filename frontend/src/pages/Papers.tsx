import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Search, ExternalLink, Loader2, RefreshCw, Calendar, Quote, Tag, Database, TrendingUp,
  BookmarkPlus, Clock, XCircle, ChevronDown, ArrowUpDown, Plus, Check, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { usePapers, DbPaper, SortBy, SortOrder } from '@/contexts/PapersContext';
import { ReviewStatus, PassReasonTag } from '@/services/pipelineService';

// Viability score color helper
const getViabilityColor = (score: number) => {
  if (score >= 4) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (score >= 3) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
};

// Status badge colors
const getStatusBadge = (status: ReviewStatus | undefined) => {
  switch (status) {
    case 'saved':
      return { label: 'Saved', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    case 'under_review':
      return { label: 'Under Review', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
    case 'pass':
      return { label: 'Passed', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    default:
      return { label: 'Pending', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
  }
};

const Papers = () => {
  const {
    state,
    loadPapers,
    setStatusFilter,
    setLocationFilter,
    setSortBy,
    setSortOrder,
    updatePaperStatus,
    createPassReasonTag,
  } = usePapers();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaper, setSelectedPaper] = useState<DbPaper | null>(null);
  const [locationInput, setLocationInput] = useState(state.locationFilter);

  // Debounce location filter
  useEffect(() => {
    const timer = setTimeout(() => {
      if (locationInput !== state.locationFilter) {
        setLocationFilter(locationInput);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [locationInput]);

  // Filter papers based on local search query (client-side filtering for text search)
  const filteredPapers = state.papers.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.keywords?.some(k => k.toLowerCase().includes(searchQuery.toLowerCase())) ||
    p.authors?.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Papers</h2>
            <p className="text-sm text-muted-foreground">
              Review and manage papers from the database
            </p>
          </div>
          <Button
            onClick={loadPapers}
            disabled={state.isLoading}
            variant="outline"
            className="gap-2"
          >
            {state.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </Button>
        </div>
        {state.error && (
          <p className="mt-2 text-sm text-destructive">{state.error}</p>
        )}
      </div>

      {/* Filter Bar */}
      <div className="p-4 border-b border-border bg-secondary/30">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <select
              value={state.statusFilter || ''}
              onChange={(e) => setStatusFilter(e.target.value as ReviewStatus || null)}
              className="h-8 px-2 rounded border border-border bg-background text-sm"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="saved">Saved</option>
              <option value="under_review">Under Review</option>
              <option value="pass">Passed</option>
            </select>
          </div>

          {/* Location Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Location:</span>
            <div className="relative">
              <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="Institution or country..."
                className="h-8 pl-7 w-44 text-sm"
              />
            </div>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort:</span>
            <select
              value={state.sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="h-8 px-2 rounded border border-border bg-background text-sm"
            >
              <option value="created_at">Date Added</option>
              <option value="year">Year</option>
              <option value="citations">Citations</option>
              <option value="viability_score">Viability</option>
            </select>
          </div>

          {/* Sort Order Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(state.sortOrder === 'asc' ? 'desc' : 'asc')}
            className="h-8 gap-1"
          >
            <ArrowUpDown className="w-3 h-3" />
            {state.sortOrder === 'asc' ? 'Asc' : 'Desc'}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, keywords, or author..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {state.isLoading && state.papers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading papers from database...</p>
          </div>
        ) : state.papers.length === 0 ? (
          <EmptyState onLoad={loadPapers} isLoading={state.isLoading} />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredPapers.map((paper, index) => (
                <motion.div
                  key={paper.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <PaperCard
                    paper={paper}
                    onClick={() => setSelectedPaper(paper)}
                    onStatusChange={updatePaperStatus}
                    passReasonTags={state.passReasonTags}
                    onCreateTag={createPassReasonTag}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      {state.papers.length > 0 && (
        <div className="p-4 border-t border-border bg-card">
          <p className="text-sm text-muted-foreground">
            {filteredPapers.length} of {state.papers.length} papers
            {state.lastLoaded && (
              <span className="ml-2">
                (loaded {state.lastLoaded.toLocaleTimeString()})
              </span>
            )}
          </p>
        </div>
      )}

      {/* Paper Detail Popup */}
      <PaperPopup paper={selectedPaper} onClose={() => setSelectedPaper(null)} />
    </div>
  );
};

interface EmptyStateProps {
  onLoad: () => void;
  isLoading: boolean;
}

const EmptyState = ({ onLoad, isLoading }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center h-full text-center">
    <FileText className="w-12 h-12 text-muted-foreground mb-4" />
    <p className="text-muted-foreground text-sm max-w-md mb-4">
      No papers loaded. Click the button below to load papers from the database.
    </p>
    <Button onClick={onLoad} disabled={isLoading} className="gap-2">
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Database className="w-4 h-4" />
      )}
      Load Papers
    </Button>
  </div>
);

interface PaperCardProps {
  paper: DbPaper;
  onClick: () => void;
  onStatusChange: (paperId: string, status: ReviewStatus, passReason?: string) => Promise<void>;
  passReasonTags: PassReasonTag[];
  onCreateTag: (name: string) => Promise<PassReasonTag | null>;
}

const PaperCard = ({ paper, onClick, onStatusChange, passReasonTags, onCreateTag }: PaperCardProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPassDropdown, setShowPassDropdown] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isPassed = paper.review_status === 'pass';
  const statusBadge = getStatusBadge(paper.review_status);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPassDropdown(false);
        setNewTagName('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusChange = async (status: ReviewStatus, passReason?: string) => {
    setIsUpdating(true);
    try {
      await onStatusChange(paper.id, status, passReason);
      setShowPassDropdown(false);
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateAndSelectTag = async () => {
    if (!newTagName.trim()) return;
    setIsCreatingTag(true);
    const tag = await onCreateTag(newTagName.trim());
    if (tag) {
      await handleStatusChange('pass', tag.name);
    }
    setIsCreatingTag(false);
    setNewTagName('');
  };

  return (
    <Card
      className={`hover:shadow-md transition-all cursor-pointer ${
        isPassed ? 'opacity-50 bg-muted' : ''
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0"
            onClick={onClick}
          >
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0" onClick={onClick}>
            <h3 className="font-medium text-sm line-clamp-2">{paper.title}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
              {paper.year && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {paper.year}
                </span>
              )}
              {paper.citations != null && (
                <span className="flex items-center gap-1">
                  <Quote className="w-3 h-3" />
                  {paper.citations.toLocaleString()} citations
                </span>
              )}
              {paper.source && (
                <span className="px-1.5 py-0.5 bg-secondary rounded">
                  {paper.source}
                </span>
              )}
              {/* Viability score badge */}
              {paper.viability_score != null && (
                <span className={`px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${getViabilityColor(paper.viability_score)}`}>
                  <TrendingUp className="w-3 h-3" />
                  {paper.viability_score.toFixed(1)}
                </span>
              )}
              {/* Status badge */}
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
            </div>
            {paper.keywords && paper.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {paper.keywords.slice(0, 3).map((kw, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs flex items-center gap-1"
                  >
                    <Tag className="w-3 h-3" />
                    {kw}
                  </span>
                ))}
                {paper.keywords.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{paper.keywords.length - 3} more
                  </span>
                )}
              </div>
            )}
            {/* Pass reason */}
            {paper.review_status === 'pass' && paper.pass_reason && (
              <p className="text-xs text-muted-foreground mt-1 italic">
                Reason: {paper.pass_reason}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {/* Save Button */}
                <Button
                  size="sm"
                  variant={paper.review_status === 'saved' ? 'default' : 'ghost'}
                  className={`h-7 w-7 p-0 ${paper.review_status === 'saved' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                  onClick={() => handleStatusChange(paper.review_status === 'saved' ? 'pending' : 'saved')}
                  title="Save"
                >
                  <BookmarkPlus className="w-4 h-4" />
                </Button>

                {/* Under Review Button */}
                <Button
                  size="sm"
                  variant={paper.review_status === 'under_review' ? 'default' : 'ghost'}
                  className={`h-7 w-7 p-0 ${paper.review_status === 'under_review' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}`}
                  onClick={() => handleStatusChange(paper.review_status === 'under_review' ? 'pending' : 'under_review')}
                  title="Under Review"
                >
                  <Clock className="w-4 h-4" />
                </Button>

                {/* Pass Button with Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <Button
                    size="sm"
                    variant={paper.review_status === 'pass' ? 'default' : 'ghost'}
                    className={`h-7 px-2 gap-1 ${paper.review_status === 'pass' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                    onClick={() => setShowPassDropdown(!showPassDropdown)}
                    title="Pass"
                  >
                    <XCircle className="w-4 h-4" />
                    <ChevronDown className="w-3 h-3" />
                  </Button>

                  {/* Pass Reason Dropdown */}
                  {showPassDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
                      <div className="px-2 py-1 text-xs text-muted-foreground font-medium border-b border-border mb-1">
                        Select pass reason
                      </div>

                      {/* Existing tags */}
                      {passReasonTags.map((tag) => (
                        <button
                          key={tag.id}
                          className="w-full px-3 py-1.5 text-sm text-left hover:bg-secondary flex items-center gap-2"
                          onClick={() => handleStatusChange('pass', tag.name)}
                        >
                          {paper.pass_reason === tag.name && <Check className="w-3 h-3 text-green-500" />}
                          <span className={paper.pass_reason === tag.name ? 'font-medium' : ''}>{tag.name}</span>
                        </button>
                      ))}

                      {/* Create new tag */}
                      <div className="border-t border-border mt-1 pt-1 px-2">
                        <div className="flex gap-1">
                          <Input
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            placeholder="New reason..."
                            className="h-7 text-xs"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateAndSelectTag()}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={handleCreateAndSelectTag}
                            disabled={!newTagName.trim() || isCreatingTag}
                          >
                            {isCreatingTag ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>

                      {/* Clear pass status */}
                      {paper.review_status === 'pass' && (
                        <button
                          className="w-full px-3 py-1.5 text-sm text-left hover:bg-secondary text-muted-foreground border-t border-border mt-1"
                          onClick={() => handleStatusChange('pending')}
                        >
                          Clear pass status
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface PaperPopupProps {
  paper: DbPaper | null;
  onClose: () => void;
}

const PaperPopup = ({ paper, onClose }: PaperPopupProps) => (
  <AnimatePresence>
    {paper && (
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
            className="w-full max-w-2xl pointer-events-auto max-h-[90vh] overflow-hidden flex flex-col"
          >
            <Card className="flex flex-col overflow-hidden">
              <CardContent className="p-6 overflow-y-auto">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">{paper.title}</h2>
                    {paper.authors && paper.authors.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {paper.authors.join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className={`grid gap-3 mt-6 ${paper.viability_score != null ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  <div className="bg-secondary p-3 rounded text-center">
                    <p className="text-xs text-muted-foreground">Year</p>
                    <p className="text-xl font-semibold">{paper.year ?? '-'}</p>
                  </div>
                  <div className="bg-secondary p-3 rounded text-center">
                    <p className="text-xs text-muted-foreground">Citations</p>
                    <p className="text-xl font-semibold">
                      {paper.citations?.toLocaleString() ?? '-'}
                    </p>
                  </div>
                  <div className="bg-secondary p-3 rounded text-center">
                    <p className="text-xs text-muted-foreground">Source</p>
                    <p className="text-sm font-semibold truncate">{paper.source ?? '-'}</p>
                  </div>
                  {paper.viability_score != null && (
                    <div className={`p-3 rounded text-center ${getViabilityColor(paper.viability_score)}`}>
                      <p className="text-xs opacity-80">Viability</p>
                      <p className="text-xl font-semibold">{paper.viability_score.toFixed(1)}</p>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Review Status</p>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${getStatusBadge(paper.review_status).className}`}>
                      {getStatusBadge(paper.review_status).label}
                    </span>
                    {paper.pass_reason && (
                      <span className="text-sm text-muted-foreground">
                        - {paper.pass_reason}
                      </span>
                    )}
                  </div>
                </div>

                {/* Viability breakdown */}
                {paper.viability_score != null && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Viability Breakdown</p>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-secondary p-2 rounded text-center">
                        <p className="text-xs text-muted-foreground">Novelty</p>
                        <p className="font-semibold">{paper.viability_novelty ?? '-'}</p>
                      </div>
                      <div className="bg-secondary p-2 rounded text-center">
                        <p className="text-xs text-muted-foreground">Market</p>
                        <p className="font-semibold">{paper.viability_market_size ?? '-'}</p>
                      </div>
                      <div className="bg-secondary p-2 rounded text-center">
                        <p className="text-xs text-muted-foreground">Feasibility</p>
                        <p className="font-semibold">{paper.viability_feasibility ?? '-'}</p>
                      </div>
                      <div className="bg-secondary p-2 rounded text-center">
                        <p className="text-xs text-muted-foreground">Timing</p>
                        <p className="font-semibold">{paper.viability_timing ?? '-'}</p>
                      </div>
                    </div>
                    {paper.viability_analysis && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        "{paper.viability_analysis}"
                      </p>
                    )}
                  </div>
                )}

                {paper.keywords && paper.keywords.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {paper.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-primary/10 text-primary rounded text-xs"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {paper.abstract && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Abstract</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {paper.abstract}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 mt-6">
                  <Button variant="outline" className="flex-1" onClick={onClose}>
                    Close
                  </Button>
                  {paper.url && (
                    <Button
                      className="flex-1 gap-2"
                      onClick={() => window.open(paper.url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Paper
                    </Button>
                  )}
                  {paper.doi && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => window.open(`https://doi.org/${paper.doi}`, '_blank')}
                    >
                      DOI
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </>
    )}
  </AnimatePresence>
);

export default Papers;
