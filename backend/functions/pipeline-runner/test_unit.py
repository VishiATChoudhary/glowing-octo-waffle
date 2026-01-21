#!/usr/bin/env python3
"""
Unit Tests for Pipeline Runner

Tests individual functions and components of the pipeline.
Run with: pytest test_unit.py -v
"""

import json
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Import modules under test
import storage
import main


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def temp_data_dir(tmp_path):
    """Create a temporary data directory for storage tests."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    # Patch storage.DATA_DIR to use temp directory
    original_data_dir = storage.DATA_DIR
    storage.DATA_DIR = data_dir

    yield data_dir

    # Restore original
    storage.DATA_DIR = original_data_dir


@pytest.fixture
def sample_papers():
    """Sample papers for testing."""
    return [
        {
            "id": "arxiv-2401.00001",
            "arxivId": "2401.00001",
            "title": "Solid State Battery Advances",
            "abstract": "This paper discusses advances in solid state batteries...",
            "authors": ["John Smith", "Jane Doe"],
            "year": 2024,
            "source": "arXiv",
            "url": "https://arxiv.org/abs/2401.00001",
            "citations": 10,
        },
        {
            "id": "s2-abc123",
            "title": "Lithium Ion Conductors",
            "abstract": "A study of lithium ion conductors...",
            "authors": ["Jane Doe", "Bob Wilson"],
            "year": 2023,
            "source": "Semantic Scholar",
            "url": "https://semanticscholar.org/paper/abc123",
            "citations": 25,
            "doi": "10.1234/example",
        },
        {
            "id": "oa-W123456",
            "title": "Solid State Battery Advances",  # Duplicate title
            "abstract": "Same paper from different source...",
            "authors": ["John Smith"],
            "year": 2024,
            "source": "OpenAlex",
            "url": "https://openalex.org/W123456",
            "citations": 12,
            "doi": "10.1234/example",  # Same DOI as above - should be deduplicated
        },
    ]


@pytest.fixture
def sample_researchers():
    """Sample researchers for testing."""
    return [
        {
            "id": "researcher-abc123",
            "name": "John Smith",
            "email": "john@mit.edu",
            "institution": "MIT",
            "lab": "Battery Lab",
            "country": "USA",
            "hIndex": 15,
            "citations": 500,
            "enrichedAt": "2024-01-01T00:00:00",
            "aggregateViability": None,
        },
        {
            "id": "researcher-def456",
            "name": "Jane Doe",
            "email": None,
            "institution": None,
            "lab": None,
            "country": None,
            "hIndex": None,
            "citations": None,
            "enrichedAt": None,
            "aggregateViability": None,
        },
    ]


# =============================================================================
# Storage Tests
# =============================================================================

class TestStorage:
    """Tests for the storage module."""

    def test_save_and_load_papers(self, temp_data_dir, sample_papers):
        """Test saving and loading papers."""
        # Save papers
        storage.save_papers(sample_papers[:2])

        # Load and verify
        loaded = storage.load_papers()
        assert len(loaded) == 2
        assert loaded[0]["title"] == "Solid State Battery Advances"
        assert loaded[1]["title"] == "Lithium Ion Conductors"

    def test_papers_merge_on_save(self, temp_data_dir, sample_papers):
        """Test that saving papers merges with existing data."""
        # Save first batch
        storage.save_papers([sample_papers[0]])
        assert len(storage.load_papers()) == 1

        # Save second batch
        storage.save_papers([sample_papers[1]])

        # Should have both
        loaded = storage.load_papers()
        assert len(loaded) == 2

    def test_save_and_load_researchers(self, temp_data_dir, sample_researchers):
        """Test saving and loading researchers."""
        storage.save_researchers(sample_researchers)

        loaded = storage.load_researchers()
        assert len(loaded) == 2
        assert loaded[0]["name"] == "John Smith"

    def test_researcher_merge_updates_existing(self, temp_data_dir, sample_researchers):
        """Test that saving researchers merges and updates existing entries."""
        # Save initial
        storage.save_researchers([sample_researchers[1]])  # Jane without enrichment

        # Update with enriched data
        enriched_jane = {
            **sample_researchers[1],
            "email": "jane@stanford.edu",
            "institution": "Stanford",
        }
        storage.save_researchers([enriched_jane])

        # Should have merged
        loaded = storage.load_researchers()
        assert len(loaded) == 1
        assert loaded[0]["email"] == "jane@stanford.edu"
        assert loaded[0]["institution"] == "Stanford"

    def test_save_and_load_viability(self, temp_data_dir):
        """Test saving and loading viability scores."""
        viability = {
            "paper-1": {"novelty": 4, "marketSize": 3, "feasibility": 5, "timing": 4},
            "paper-2": {"novelty": 3, "marketSize": 4, "feasibility": 3, "timing": 3},
        }

        storage.save_viability(viability)
        loaded = storage.load_viability()

        assert len(loaded) == 2
        assert loaded["paper-1"]["novelty"] == 4

    def test_save_and_load_authorship(self, temp_data_dir):
        """Test saving and loading authorship links."""
        links = [
            {"paperId": "paper-1", "researcherId": "researcher-1", "role": "author"},
            {"paperId": "paper-1", "researcherId": "researcher-2", "role": "author"},
        ]

        storage.save_authorship(links)
        loaded = storage.load_authorship()

        assert len(loaded) == 2

    def test_authorship_deduplication(self, temp_data_dir):
        """Test that duplicate authorship links are not added."""
        link = {"paperId": "paper-1", "researcherId": "researcher-1", "role": "author"}

        # Save same link twice
        storage.save_authorship([link])
        storage.save_authorship([link])

        loaded = storage.load_authorship()
        assert len(loaded) == 1

    def test_get_paper(self, temp_data_dir, sample_papers):
        """Test getting a single paper by ID."""
        storage.save_papers(sample_papers[:2])

        paper = storage.get_paper("arxiv-2401.00001")
        assert paper is not None
        assert paper["title"] == "Solid State Battery Advances"

        # Non-existent paper
        assert storage.get_paper("non-existent") is None

    def test_get_researcher_by_name(self, temp_data_dir, sample_researchers):
        """Test getting a researcher by name."""
        storage.save_researchers(sample_researchers)

        researcher = storage.get_researcher_by_name("John Smith")
        assert researcher is not None
        assert researcher["email"] == "john@mit.edu"

        # Case insensitive
        researcher = storage.get_researcher_by_name("JOHN SMITH")
        assert researcher is not None

    def test_get_stats(self, temp_data_dir, sample_papers, sample_researchers):
        """Test getting storage statistics."""
        storage.save_papers(sample_papers[:2])
        storage.save_researchers(sample_researchers)
        storage.save_viability({"paper-1": {"novelty": 4}})
        storage.save_authorship([{"paperId": "p1", "researcherId": "r1", "role": "author"}])

        stats = storage.get_stats()

        assert stats["papers"] == 2
        assert stats["researchers"] == 2
        assert stats["viability_scores"] == 1
        assert stats["authorship_links"] == 1

    def test_clear_all_data(self, temp_data_dir, sample_papers):
        """Test clearing all data."""
        storage.save_papers(sample_papers)
        assert len(storage.load_papers()) > 0

        storage.clear_all_data()

        assert len(storage.load_papers()) == 0
        assert len(storage.load_researchers()) == 0


# =============================================================================
# Deduplication Tests
# =============================================================================

class TestDeduplication:
    """Tests for paper deduplication."""

    def test_deduplicate_by_doi(self, sample_papers):
        """Test deduplication by DOI."""
        # Papers 1 and 2 have the same DOI
        papers = sample_papers[1:3]  # s2 and oa papers with same DOI

        unique = main.deduplicate_papers(papers)

        assert len(unique) == 1
        assert unique[0]["id"] == "s2-abc123"  # First one should be kept

    def test_deduplicate_by_arxiv_id(self):
        """Test deduplication by arXiv ID."""
        papers = [
            {"id": "arxiv-2401.00001", "arxivId": "2401.00001", "title": "Paper A"},
            {"id": "s2-xyz", "arxivId": "2401.00001", "title": "Paper A from S2"},
        ]

        unique = main.deduplicate_papers(papers)

        assert len(unique) == 1

    def test_deduplicate_by_title(self):
        """Test deduplication by similar title."""
        papers = [
            {"id": "paper-1", "title": "Advances in Solid State Batteries"},
            {"id": "paper-2", "title": "Advances in Solid State Batteries"},  # Exact match
            {"id": "paper-3", "title": "Different Paper Title"},
        ]

        unique = main.deduplicate_papers(papers)

        assert len(unique) == 2

    def test_deduplicate_preserves_order(self):
        """Test that deduplication preserves the order of first occurrences."""
        papers = [
            {"id": "first", "title": "Paper A", "doi": "10.1234/a"},
            {"id": "second", "title": "Paper B"},
            {"id": "duplicate", "title": "Paper A", "doi": "10.1234/a"},
        ]

        unique = main.deduplicate_papers(papers)

        assert len(unique) == 2
        assert unique[0]["id"] == "first"
        assert unique[1]["id"] == "second"


# =============================================================================
# Researcher Extraction Tests
# =============================================================================

class TestResearcherExtraction:
    """Tests for researcher extraction from papers."""

    def test_extract_researchers_basic(self, sample_papers):
        """Test basic researcher extraction."""
        researchers, links = main.extract_researchers(sample_papers[:2])

        # Should have unique researchers
        names = {r["name"] for r in researchers}
        assert "John Smith" in names
        assert "Jane Doe" in names
        assert "Bob Wilson" in names
        assert len(researchers) == 3

    def test_extract_researchers_deduplicates_by_name(self):
        """Test that researchers are deduplicated by name."""
        papers = [
            {"id": "p1", "authors": ["John Smith", "Jane Doe"]},
            {"id": "p2", "authors": ["John Smith", "Bob Wilson"]},  # John appears again
        ]

        researchers, links = main.extract_researchers(papers)

        # John should appear only once
        john_count = sum(1 for r in researchers if r["name"] == "John Smith")
        assert john_count == 1

    def test_extract_researchers_creates_authorship_links(self):
        """Test that authorship links are created correctly."""
        papers = [
            {"id": "p1", "authors": ["John Smith", "Jane Doe"]},
            {"id": "p2", "authors": ["Jane Doe"]},
        ]

        researchers, links = main.extract_researchers(papers)

        # Jane should have 2 links (one for each paper)
        jane = next(r for r in researchers if r["name"] == "Jane Doe")
        jane_links = [l for l in links if l["researcherId"] == jane["id"]]
        assert len(jane_links) == 2

    def test_extract_researchers_handles_empty_authors(self):
        """Test handling papers with no authors."""
        papers = [
            {"id": "p1", "authors": []},
            {"id": "p2", "authors": ["John Smith"]},
        ]

        researchers, links = main.extract_researchers(papers)

        assert len(researchers) == 1
        assert len(links) == 1

    def test_extract_researchers_structure(self):
        """Test that extracted researchers have correct structure."""
        papers = [{"id": "p1", "authors": ["John Smith"]}]

        researchers, _ = main.extract_researchers(papers)

        researcher = researchers[0]
        assert "id" in researcher
        assert researcher["id"].startswith("researcher-")
        assert researcher["name"] == "John Smith"
        assert researcher["email"] is None
        assert researcher["institution"] is None
        assert researcher["aggregateViability"] is None


# =============================================================================
# Keyword Expansion Tests
# =============================================================================

class TestKeywordExpansion:
    """Tests for keyword expansion functionality."""

    def test_expand_keywords_without_api_key(self):
        """Test that expand_keywords returns original query when no API key."""
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}, clear=True):
            # Remove the key if it exists
            os.environ.pop("OPENAI_API_KEY", None)

            result = main.expand_keywords("solid state batteries")

            # Should return only the original query when no API key
            assert result == ["solid state batteries"]

    @patch("main.requests.post")
    def test_expand_keywords_with_api_key(self, mock_post):
        """Test keyword expansion with mocked API response."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "keywords": [
                            "lithium ion solid electrolytes",
                            "all-solid-state battery technology",
                            "ceramic electrolyte materials",
                        ]
                    })
                }
            }]
        }
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            result = main.expand_keywords("solid state batteries", num_keywords=3)

        assert len(result) == 3
        assert "lithium ion solid electrolytes" in result

    @patch("main.requests.post")
    def test_expand_keywords_handles_api_error(self, mock_post):
        """Test that API errors are handled gracefully."""
        mock_post.side_effect = Exception("API Error")

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            result = main.expand_keywords("solid state batteries")

        # Should return original query as fallback on error
        assert result == ["solid state batteries"]

    @patch("main.requests.post")
    def test_expand_keywords_limits_count(self, mock_post):
        """Test that keyword count is limited."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "keywords": [f"keyword {i}" for i in range(20)]  # Too many
                    })
                }
            }]
        }
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            result = main.expand_keywords("test", num_keywords=5)

        assert len(result) <= 5

    @patch("main.requests.post")
    def test_expand_keywords_filters_invalid(self, mock_post):
        """Test that invalid keywords are filtered out."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "keywords": [
                            "valid keyword",
                            "",  # Empty
                            "   ",  # Whitespace only
                            123,  # Not a string
                            "another valid",
                        ]
                    })
                }
            }]
        }
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            result = main.expand_keywords("test")

        assert len(result) == 2
        assert "valid keyword" in result
        assert "another valid" in result


# =============================================================================
# Viability Analysis Tests
# =============================================================================

class TestViabilityAnalysis:
    """Tests for market viability analysis."""

    def test_analyze_viability_without_api_key(self):
        """Test default scores when no API key."""
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}, clear=True):
            os.environ.pop("OPENAI_API_KEY", None)

            paper = {"title": "Test Paper", "abstract": "Test abstract"}
            result = main.analyze_viability(paper)

        assert result["novelty"] == 3
        assert result["marketSize"] == 3
        assert result["feasibility"] == 3
        assert result["timing"] == 3
        assert "No LLM API key" in result["analysis"]

    @patch("main.requests.post")
    def test_analyze_viability_with_api(self, mock_post):
        """Test viability analysis with mocked API."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "novelty": 5,
                        "marketSize": 4,
                        "feasibility": 3,
                        "timing": 4,
                        "analysis": "Promising technology with large market potential.",
                    })
                }
            }]
        }
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            paper = {"title": "Test", "abstract": "Abstract"}
            result = main.analyze_viability(paper)

        assert result["novelty"] == 5
        assert result["marketSize"] == 4
        assert "Promising" in result["analysis"]

    @patch("main.requests.post")
    def test_analyze_viability_clamps_scores(self, mock_post):
        """Test that scores are clamped to 1-5 range."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "novelty": 10,  # Too high
                        "marketSize": 0,  # Too low
                        "feasibility": 3,
                        "timing": -1,  # Negative
                    })
                }
            }]
        }
        mock_post.return_value = mock_response

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            result = main.analyze_viability({"title": "Test", "abstract": "Test"})

        assert result["novelty"] == 5  # Clamped to max
        assert result["marketSize"] == 1  # Clamped to min
        assert result["timing"] == 1  # Clamped to min


# =============================================================================
# Aggregate Viability Tests
# =============================================================================

class TestAggregateViability:
    """Tests for viability aggregation."""

    def test_compute_aggregate_basic(self):
        """Test basic aggregate computation."""
        papers = [
            {"id": "p1", "citations": 10},
            {"id": "p2", "citations": 20},
        ]
        viability = {
            "p1": {"novelty": 4, "marketSize": 3, "feasibility": 5, "timing": 4},
            "p2": {"novelty": 2, "marketSize": 4, "feasibility": 3, "timing": 3},
        }
        links = [
            {"paperId": "p1", "researcherId": "r1", "role": "author"},
            {"paperId": "p2", "researcherId": "r1", "role": "author"},
        ]

        result = main.compute_aggregate_viability("r1", links, papers, viability)

        assert result is not None
        assert result["paperCount"] == 2
        # Citation-weighted average: (4*10 + 2*20) / (10+20) = 80/30 = 2.67
        assert 2.6 < result["avgNovelty"] < 2.8

    def test_compute_aggregate_no_papers(self):
        """Test aggregate when researcher has no papers."""
        result = main.compute_aggregate_viability("r1", [], [], {})
        assert result is None

    def test_compute_aggregate_missing_viability(self):
        """Test aggregate when viability scores are missing."""
        papers = [{"id": "p1", "citations": 10}]
        links = [{"paperId": "p1", "researcherId": "r1", "role": "author"}]
        viability = {}  # No scores

        result = main.compute_aggregate_viability("r1", links, papers, viability)

        # Should use default score of 3
        assert result["avgNovelty"] == 3.0

    def test_compute_aggregate_zero_citations(self):
        """Test aggregate with zero citations (uses 1 as minimum)."""
        papers = [{"id": "p1", "citations": 0}]
        viability = {"p1": {"novelty": 5, "marketSize": 5, "feasibility": 5, "timing": 5}}
        links = [{"paperId": "p1", "researcherId": "r1", "role": "author"}]

        result = main.compute_aggregate_viability("r1", links, papers, viability)

        assert result is not None
        assert result["avgNovelty"] == 5.0


# =============================================================================
# Logging Tests
# =============================================================================

class TestLogging:
    """Tests for log entry creation."""

    def test_create_log_basic(self):
        """Test basic log creation."""
        log = main.create_log("search", "start", "Starting search...")

        # Should be SSE format
        assert log.startswith("data: ")
        assert log.endswith("\n\n")

        # Parse JSON
        data = json.loads(log[6:-2])
        assert data["step"] == "search"
        assert data["status"] == "start"
        assert data["message"] == "Starting search..."
        assert "timestamp" in data

    def test_create_log_with_data(self):
        """Test log creation with additional data."""
        log = main.create_log(
            "search", "complete", "Found papers",
            {"paperCount": 42, "keywords": ["a", "b"]}
        )

        data = json.loads(log[6:-2])
        assert data["data"]["paperCount"] == 42
        assert data["data"]["keywords"] == ["a", "b"]

    def test_create_log_timestamp_format(self):
        """Test that timestamp is ISO format."""
        log = main.create_log("test", "test", "test")
        data = json.loads(log[6:-2])

        # Should be parseable as ISO datetime
        timestamp = datetime.fromisoformat(data["timestamp"])
        assert timestamp is not None


# =============================================================================
# Run Tests
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
