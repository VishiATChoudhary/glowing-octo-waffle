/**
 * Paper Selection Modal
 *
 * Allows users to select which papers to process in manual pipeline mode.
 * Shows paper details including viability scores when available.
 */

import { useState, useMemo } from 'react';
import { Search, FileText, Calendar, Quote, TrendingUp, Check } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { PaperWithViability } from '@/services/pipelineService';

interface PaperSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  papers: PaperWithViability[];
  selectedIds: Set<string>;
  showViability: boolean;
  onToggleSelection: (paperId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onSelectHighViability: (threshold?: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

type SortOption = 'viability' | 'citations' | 'year' | 'title';

export function PaperSelectionModal({
  open,
  onOpenChange,
  papers,
  selectedIds,
  showViability,
  onToggleSelection,
  onSelectAll,
  onSelectNone,
  onSelectHighViability,
  onConfirm,
  onCancel,
}: PaperSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(showViability ? 'viability' : 'citations');

  // Filter and sort papers
  const filteredPapers = useMemo(() => {
    let result = papers;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.authors?.some((a) => a.toLowerCase().includes(query))
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'viability':
          return (b.viability?.aggregate ?? 0) - (a.viability?.aggregate ?? 0);
        case 'citations':
          return (b.citations ?? 0) - (a.citations ?? 0);
        case 'year':
          return (b.year ?? 0) - (a.year ?? 0);
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }, [papers, searchQuery, sortBy]);

  const selectedCount = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Papers to Process</DialogTitle>
          <DialogDescription>
            Found {papers.length} papers. Select which ones to continue processing.
          </DialogDescription>
        </DialogHeader>

        {/* Search and Sort Controls */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {showViability && <SelectItem value="viability">Viability</SelectItem>}
              <SelectItem value="citations">Citations</SelectItem>
              <SelectItem value="year">Year</SelectItem>
              <SelectItem value="title">Title</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick Selection Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={onSelectNone}>
            Select None
          </Button>
          {showViability && (
            <Button variant="outline" size="sm" onClick={() => onSelectHighViability(3.5)}>
              High Viability (&gt;3.5)
            </Button>
          )}
          <span className="ml-auto text-sm text-muted-foreground">
            {selectedCount} of {papers.length} selected
          </span>
        </div>

        {/* Paper List */}
        <ScrollArea className="flex-1 min-h-0 border rounded-lg">
          <div className="p-2 space-y-2">
            {filteredPapers.map((paper) => (
              <PaperSelectionRow
                key={paper.id}
                paper={paper}
                showViability={showViability}
                selected={selectedIds.has(paper.id)}
                onToggle={() => onToggleSelection(paper.id)}
              />
            ))}
            {filteredPapers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No papers match your search.
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedCount} paper{selectedCount !== 1 ? 's' : ''} will be processed
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={selectedCount === 0}>
              Continue with {selectedCount} Paper{selectedCount !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PaperSelectionRowProps {
  paper: PaperWithViability;
  showViability: boolean;
  selected: boolean;
  onToggle: () => void;
}

function PaperSelectionRow({ paper, showViability, selected, onToggle }: PaperSelectionRowProps) {
  const viabilityColor = (score: number) => {
    if (score >= 4) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (score >= 3) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
        selected ? 'bg-primary/5 border border-primary/20' : 'border border-transparent'
      }`}
      onClick={onToggle}
    >
      <Checkbox checked={selected} className="mt-1" />

      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm line-clamp-2">{paper.title}</h4>
        {paper.authors && paper.authors.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {paper.authors.slice(0, 3).join(', ')}
            {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {paper.year && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {paper.year}
            </span>
          )}
          {paper.citations != null && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Quote className="w-3 h-3" />
              {paper.citations.toLocaleString()}
            </span>
          )}
          {paper.source && (
            <span className="px-1.5 py-0.5 bg-secondary rounded text-xs">
              {paper.source}
            </span>
          )}
        </div>
      </div>

      {/* Viability Scores */}
      {showViability && paper.viability && (
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span
            className={`px-2 py-1 rounded font-medium text-sm ${viabilityColor(
              paper.viability.aggregate ?? 0
            )}`}
          >
            <TrendingUp className="w-3 h-3 inline mr-1" />
            {paper.viability.aggregate?.toFixed(1)}
          </span>
          <div className="flex gap-1 text-xs text-muted-foreground">
            <span title="Novelty">N:{paper.viability.novelty}</span>
            <span title="Market Size">M:{paper.viability.marketSize}</span>
            <span title="Feasibility">F:{paper.viability.feasibility}</span>
            <span title="Timing">T:{paper.viability.timing}</span>
          </div>
        </div>
      )}

      {/* Selection indicator */}
      {selected && (
        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <Check className="w-4 h-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}

export default PaperSelectionModal;
